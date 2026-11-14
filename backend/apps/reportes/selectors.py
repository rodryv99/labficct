"""Una consulta por reporte (solo lectura).

Cada función recibe los filtros ya validados y devuelve
`{"secciones": [...], "notas": [...]}`. Las secciones tienen siempre la misma
forma (ver `seccion`), así la web, el Excel y el PDF sirven para todos los reportes.

Los conteos y sumas se hacen en PostgreSQL (`annotate`, `aggregate`); en Python
solo se arman las filas.
"""

from datetime import datetime, time, timedelta

from django.conf import settings
from django.contrib.postgres.aggregates import StringAgg
from django.db.models import (
    Avg,
    Count,
    DateTimeField,
    DurationField,
    ExpressionWrapper,
    F,
    IntegerField,
    Max,
    Min,
    OuterRef,
    Q,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce, Concat, ExtractIsoWeekDay, Greatest, Least
from django.utils import timezone

from apps.asistencia.models import CategoriaAsistencia, EstadoSolicitud, SolicitudAsistencia
from apps.bitacora.models import EntradaBitacora, TipoEntrada
from apps.core import atencion
from apps.laboratorios.models import (
    CategoriaElemento,
    ElementoLaboratorio,
    EstadoElemento,
    Laboratorio,
)
from apps.objetos_perdidos.models import CategoriaObjeto, EstadoObjeto, ObjetoPerdido
from apps.planificacion.models import (
    BloqueReserva,
    DiaSemana,
    EstadoReserva,
    ExcepcionHorario,
    Horario,
    Reserva,
    minutos,
)

# Tipos de columna. La web, el Excel y el PDF formatean según el tipo.
TEXTO, ENTERO, DECIMAL, PORCENTAJE = "texto", "entero", "decimal", "porcentaje"
HORAS, MINUTOS, FECHA, FECHAHORA = "horas", "minutos", "fecha", "fechahora"

# R4: por defecto solo equipos (sin mobiliario ni infraestructura).
CATEGORIAS_EQUIPOS = (CategoriaElemento.EQUIPO, CategoriaElemento.AUDIOVISUAL, CategoriaElemento.RED)


# ── Estructura común ────────────────────────────────────


def col(clave, titulo, tipo=TEXTO) -> dict:
    return {"clave": clave, "titulo": titulo, "tipo": tipo}


def seccion(titulo, columnas, filas, totales=None) -> dict:
    return {"titulo": titulo, "columnas": columnas, "filas": filas, "totales": totales}


def sumar(filas, claves, etiqueta_en, etiqueta="Total") -> dict:
    """Fila de totales: suma las columnas `claves` y pone `etiqueta` en `etiqueta_en`."""
    totales = {clave: sum(f.get(clave) or 0 for f in filas) for clave in claves}
    totales[etiqueta_en] = etiqueta
    return totales


def horas(duracion) -> float:
    return round(duracion.total_seconds() / 3600, 2) if duracion else 0.0


def minutos_de(duracion) -> float | None:
    return round(duracion.total_seconds() / 60, 1) if duracion is not None else None


def proporcion(parte, total) -> float | None:
    return round(parte / total, 4) if total else None


def duracion(fin, inicio):
    return ExpressionWrapper(F(fin) - F(inicio), output_field=DurationField())


def nombre(prefijo):
    """Nombre completo de un usuario relacionado, calculado en la base."""
    return Concat(F(f"{prefijo}__nombres"), Value(" "), F(f"{prefijo}__apellidos"))


def rango_local(desde, hasta):
    """Fechas locales (ambas incluidas) → [inicio, fin) con zona horaria."""
    inicio = timezone.make_aware(datetime.combine(desde, time.min))
    fin = timezone.make_aware(datetime.combine(hasta + timedelta(days=1), time.min))
    return inicio, fin


def laboratorios(f):
    """El laboratorio elegido o, sin filtro, todos los activos."""
    if f.get("laboratorio"):
        return Laboratorio.objects.filter(pk=f["laboratorio"].pk)
    return Laboratorio.objects.filter(activo=True)


def filtro_lugar(f, campo="laboratorio") -> Q:
    """Para tablas con laboratorio opcional (asistencia, objetos): sin filtro
    entran los laboratorios activos y lo que solo tiene un lugar escrito."""
    if f.get("laboratorio"):
        return Q(**{campo: f["laboratorio"]})
    return Q(**{f"{campo}__isnull": True}) | Q(**{f"{campo}__activo": True})


def local(valor):
    return timezone.localtime(valor) if valor else None


def conteo_por(campo, choices, prefijo="", base=None) -> dict:
    """{valor: Count(...)} para cada opción de `choices`."""
    ruta = f"{prefijo}__" if prefijo else ""
    objetivo = prefijo or "id"
    return {
        valor: Count(objetivo, filter=(base or Q()) & Q(**{f"{ruta}{campo}": valor}))
        for valor in choices.values
    }


# ── R1 – Ocupación de laboratorios ──────────────────────


def _veces_dia(desde, hasta, dia_semana) -> int:
    """Cuántas fechas entre desde y hasta (incluidas) caen en `dia_semana` (1 = lunes)."""
    if hasta < desde:
        return 0
    primero = desde + timedelta(days=(dia_semana - desde.isoweekday()) % 7)
    return 0 if primero > hasta else (hasta - primero).days // 7 + 1


def ocupacion(f) -> dict:
    desde, hasta = f["desde"], f["hasta"]
    inicio, fin = rango_local(desde, hasta)
    labs = list(laboratorios(f).order_by("codigo"))
    ids = [lab.id for lab in labs]

    # Horas de atención: días del rango que están en ATENCION_DIAS × duración diaria.
    dias_atencion = sum(_veces_dia(desde, hasta, d) for d in set(settings.ATENCION_DIAS))
    horas_dia = (minutos(atencion.fin()) - minutos(atencion.inicio())) / 60
    horas_atencion = round(dias_atencion * horas_dia, 2)

    # Clases: se calculan desde los horarios semanales (no se guardan día por día).
    horarios = list(
        Horario.objects.filter(
            activo=True,
            laboratorio_id__in=ids,
            periodo__fecha_inicio__lte=hasta,
            periodo__fecha_fin__gte=desde,
        ).select_related("periodo")
    )
    suspendidas = dict(
        ExcepcionHorario.objects.filter(
            horario__in=horarios,
            fecha__range=(desde, hasta),
            fecha__gte=F("horario__periodo__fecha_inicio"),
            fecha__lte=F("horario__periodo__fecha_fin"),
        )
        .annotate(dia=ExtractIsoWeekDay("fecha"))
        .filter(dia=F("horario__dia_semana"))
        .values("horario")
        .annotate(n=Count("id"))
        .values_list("horario", "n")
    )

    datos = {
        lab.id: {
            "clases": 0,
            "suspendidas": 0,
            "horas_clase": 0.0,
            "bloques": 0,
            "horas_reserva": 0.0,
            "por_dia": dict.fromkeys(range(1, 8), 0.0),
        }
        for lab in labs
    }
    for h in horarios:
        programadas = _veces_dia(
            max(desde, h.periodo.fecha_inicio), min(hasta, h.periodo.fecha_fin), h.dia_semana
        )
        n_suspendidas = min(suspendidas.get(h.id, 0), programadas)
        dictadas = programadas - n_suspendidas
        horas_clase = dictadas * (minutos(h.hora_fin) - minutos(h.hora_inicio)) / 60
        d = datos[h.laboratorio_id]
        d["clases"] += dictadas
        d["suspendidas"] += n_suspendidas
        d["horas_clase"] += horas_clase
        d["por_dia"][h.dia_semana] += horas_clase

    # Reservas confirmadas: bloques activos, recortados al rango.
    reservas = (
        BloqueReserva.objects.filter(
            activo=True,
            reserva__estado=EstadoReserva.CONFIRMADA,
            laboratorio_id__in=ids,
            inicio__lt=fin,
            fin__gt=inicio,
        )
        .annotate(
            desde_r=Greatest("inicio", Value(inicio, output_field=DateTimeField())),
            hasta_r=Least("fin", Value(fin, output_field=DateTimeField())),
        )
        .annotate(dia=ExtractIsoWeekDay("desde_r"))
        .values("laboratorio", "dia")
        .annotate(bloques=Count("id"), duracion=Sum(duracion("hasta_r", "desde_r")))
    )
    for r in reservas:
        d = datos[r["laboratorio"]]
        d["bloques"] += r["bloques"]
        d["horas_reserva"] += horas(r["duracion"])
        d["por_dia"][r["dia"]] += horas(r["duracion"])

    filas, filas_dia = [], []
    dias = sorted(
        set(settings.ATENCION_DIAS)
        | {dia for d in datos.values() for dia, valor in d["por_dia"].items() if valor}
    )
    for lab in labs:
        d = datos[lab.id]
        ocupadas = d["horas_clase"] + d["horas_reserva"]
        filas.append(
            {
                "laboratorio": lab.codigo,
                "nombre": lab.nombre,
                "horas_atencion": horas_atencion,
                "clases": d["clases"],
                "suspendidas": d["suspendidas"],
                "horas_clase": round(d["horas_clase"], 2),
                "bloques": d["bloques"],
                "horas_reserva": round(d["horas_reserva"], 2),
                "horas_ocupadas": round(ocupadas, 2),
                "ocupacion": proporcion(ocupadas, horas_atencion),
            }
        )
        fila_dia = {"laboratorio": lab.codigo, "total": round(ocupadas, 2)}
        fila_dia.update({f"dia_{dia}": round(d["por_dia"][dia], 2) for dia in dias})
        filas_dia.append(fila_dia)

    claves = [
        "horas_atencion",
        "clases",
        "suspendidas",
        "horas_clase",
        "bloques",
        "horas_reserva",
        "horas_ocupadas",
    ]
    totales = sumar(filas, claves, "laboratorio")
    totales = {k: round(v, 2) if isinstance(v, float) else v for k, v in totales.items()}
    # El porcentaje total sale de las sumas, no del promedio de porcentajes.
    totales["ocupacion"] = proporcion(totales["horas_ocupadas"], totales["horas_atencion"])
    columnas_dia = [col(f"dia_{dia}", DiaSemana(dia).label, HORAS) for dia in dias]

    return {
        "secciones": [
            seccion(
                "Ocupación por laboratorio",
                [
                    col("laboratorio", "Laboratorio"),
                    col("nombre", "Nombre"),
                    col("horas_atencion", "Horas de atención", HORAS),
                    col("clases", "Clases dictadas", ENTERO),
                    col("suspendidas", "Clases suspendidas", ENTERO),
                    col("horas_clase", "Horas de clase", HORAS),
                    col("bloques", "Bloques de reserva", ENTERO),
                    col("horas_reserva", "Horas de reserva", HORAS),
                    col("horas_ocupadas", "Horas ocupadas", HORAS),
                    col("ocupacion", "% de ocupación", PORCENTAJE),
                ],
                filas,
                totales,
            ),
            seccion(
                "Horas ocupadas por día de la semana",
                [col("laboratorio", "Laboratorio"), *columnas_dia, col("total", "Total", HORAS)],
                filas_dia,
                {
                    k: round(v, 2) if isinstance(v, float) else v
                    for k, v in sumar(
                        filas_dia, [c["clave"] for c in columnas_dia] + ["total"], "laboratorio"
                    ).items()
                },
            ),
        ],
        "notas": [
            "Los feriados se cuentan como días de atención; el porcentaje de ocupación puede ser algo menor al real."
        ],
    }


# ── R2 – Reservas ───────────────────────────────────────


def reservas(f) -> dict:
    inicio, fin = rango_local(f["desde"], f["hasta"])
    ids = list(laboratorios(f).values_list("id", flat=True))
    estado = f.get("estado")

    # Bloques que entran al reporte; una reserva entra si tiene al menos uno.
    bloques = BloqueReserva.objects.filter(inicio__gte=inicio, inicio__lt=fin, laboratorio_id__in=ids)
    if estado:
        bloques = bloques.filter(reserva__estado=estado)

    # Sección 1 – por estado.
    por_estado = {
        r["reserva__estado"]: r
        for r in bloques.values("reserva__estado").annotate(
            reservas=Count("reserva", distinct=True),
            bloques=Count("id"),
            duracion=Sum(duracion("fin", "inicio")),
        )
    }
    filas_estado = []
    for valor, etiqueta in EstadoReserva.choices:
        if estado and valor != estado:
            continue
        r = por_estado.get(valor, {})
        filas_estado.append(
            {
                "estado": etiqueta,
                "reservas": r.get("reservas", 0),
                "bloques": r.get("bloques", 0),
                "horas": horas(r.get("duracion")),
            }
        )

    # Sección 2 – por laboratorio.
    en_rango = Q(
        bloques_reserva__inicio__gte=inicio,
        bloques_reserva__inicio__lt=fin,
        **({"bloques_reserva__reserva__estado": estado} if estado else {}),
    )

    def por(valor):
        return en_rango & Q(bloques_reserva__reserva__estado=valor)

    labs = (
        Laboratorio.objects.filter(id__in=ids)
        .annotate(
            confirmadas=Count(
                "bloques_reserva__reserva", distinct=True, filter=por(EstadoReserva.CONFIRMADA)
            ),
            pendientes=Count("bloques_reserva__reserva", distinct=True, filter=por(EstadoReserva.PENDIENTE)),
            canceladas=Count("bloques_reserva__reserva", distinct=True, filter=por(EstadoReserva.CANCELADA)),
            duracion=Sum(
                duracion("bloques_reserva__fin", "bloques_reserva__inicio"),
                filter=por(EstadoReserva.CONFIRMADA),
            ),
        )
        .order_by("codigo")
    )
    suspensiones = ExcepcionHorario.objects.filter(
        reserva__isnull=False, fecha__range=(f["desde"], f["hasta"]), horario__laboratorio_id__in=ids
    )
    if estado:
        suspensiones = suspensiones.filter(reserva__estado=estado)
    suspendidas_lab = dict(
        suspensiones.values("horario__laboratorio")
        .annotate(n=Count("id"))
        .values_list("horario__laboratorio", "n")
    )
    filas_lab = [
        {
            "laboratorio": lab.codigo,
            "confirmadas": lab.confirmadas,
            "pendientes": lab.pendientes,
            "canceladas": lab.canceladas,
            "horas_confirmadas": horas(lab.duracion),
            "suspendidas": suspendidas_lab.get(lab.id, 0),
        }
        for lab in labs
    ]

    # Sección 3 – detalle (solo los bloques del rango y de los laboratorios elegidos).
    del_rango = Q(bloques__inicio__gte=inicio, bloques__inicio__lt=fin, bloques__laboratorio_id__in=ids)
    clases_suspendidas = (
        ExcepcionHorario.objects.filter(
            reserva=OuterRef("pk"), fecha__range=(f["desde"], f["hasta"]), horario__laboratorio_id__in=ids
        )
        .values("reserva")
        .annotate(n=Count("id"))
        .values("n")
    )
    detalle = (
        Reserva.objects.filter(id__in=bloques.values("reserva"))
        .select_related("solicitante", "creado_por", "aprobada_por")
        .annotate(
            primer=Min("bloques__inicio", filter=del_rango),
            ultimo=Max("bloques__inicio", filter=del_rango),
            n_bloques=Count("bloques", filter=del_rango),
            duracion=Sum(duracion("bloques__fin", "bloques__inicio"), filter=del_rango),
            labs=StringAgg("bloques__laboratorio__codigo", delimiter=", ", distinct=True, filter=del_rango),
            n_suspendidas=Coalesce(Subquery(clases_suspendidas, output_field=IntegerField()), 0),
        )
        .order_by("primer", "id")
    )
    filas_detalle = [
        {
            "titulo": r.titulo,
            "solicitante": r.nombre_solicitante,
            "laboratorios": r.labs or "",
            "primer_dia": local(r.primer).date() if r.primer else None,
            "ultimo_dia": local(r.ultimo).date() if r.ultimo else None,
            "bloques": r.n_bloques,
            "horas": horas(r.duracion),
            "estado": r.get_estado_display(),
            "registro": r.creado_por.nombre_completo if r.creado_por_id else "",
            "aprobo": r.aprobada_por.nombre_completo if r.aprobada_por_id else "",
            # "—" si se confirmó directamente (no pasó por aprobación).
            "horas_aprobacion": horas(r.aprobada_en - r.creado_en) if r.aprobada_en else None,
            "suspendidas": r.n_suspendidas,
            "motivo_cancelacion": r.motivo_cancelacion,
        }
        for r in detalle
    ]

    return {
        "secciones": [
            seccion(
                "Resumen por estado",
                [
                    col("estado", "Estado"),
                    col("reservas", "Reservas", ENTERO),
                    col("bloques", "Bloques", ENTERO),
                    col("horas", "Horas", HORAS),
                ],
                filas_estado,
                sumar(filas_estado, ["reservas", "bloques", "horas"], "estado"),
            ),
            seccion(
                "Por laboratorio",
                [
                    col("laboratorio", "Laboratorio"),
                    col("confirmadas", "Confirmadas", ENTERO),
                    col("pendientes", "Por aprobar", ENTERO),
                    col("canceladas", "Canceladas", ENTERO),
                    col("horas_confirmadas", "Horas confirmadas", HORAS),
                    col("suspendidas", "Clases suspendidas por reservas", ENTERO),
                ],
                filas_lab,
                sumar(
                    filas_lab,
                    ["confirmadas", "pendientes", "canceladas", "horas_confirmadas", "suspendidas"],
                    "laboratorio",
                ),
            ),
            seccion(
                "Detalle",
                [
                    col("titulo", "Título"),
                    col("solicitante", "Solicitante"),
                    col("laboratorios", "Laboratorios"),
                    col("primer_dia", "Primer día", FECHA),
                    col("ultimo_dia", "Último día", FECHA),
                    col("bloques", "Bloques", ENTERO),
                    col("horas", "Horas", HORAS),
                    col("estado", "Estado"),
                    col("registro", "Registró"),
                    col("aprobo", "Aprobó"),
                    col("horas_aprobacion", "Horas hasta la aprobación", HORAS),
                    col("suspendidas", "Clases suspendidas", ENTERO),
                    col("motivo_cancelacion", "Motivo de cancelación"),
                ],
                filas_detalle,
                sumar(filas_detalle, ["bloques", "horas", "suspendidas"], "titulo"),
            ),
        ],
        "notas": [],
    }


# ── R3 – Solicitudes de asistencia ──────────────────────

ATENDIDAS = [EstadoSolicitud.EN_CURSO, EstadoSolicitud.RESUELTA]


def _tiempos() -> dict:
    """Promedios de respuesta y resolución. Excluyen pendientes y canceladas."""
    return {
        "respuesta": Avg(
            duracion("atendida_en", "creado_en"),
            filter=Q(estado__in=ATENDIDAS, atendida_en__isnull=False),
        ),
        "resolucion": Avg(
            duracion("cerrada_en", "creado_en"),
            filter=Q(estado=EstadoSolicitud.RESUELTA, cerrada_en__isnull=False),
        ),
    }


def _conteos_asistencia() -> dict:
    return {
        "solicitudes": Count("id"),
        "urgentes": Count("id", filter=Q(urgente=True)),
        "pendientes": Count("id", filter=Q(estado=EstadoSolicitud.PENDIENTE)),
        "en_curso": Count("id", filter=Q(estado=EstadoSolicitud.EN_CURSO)),
        "resueltas": Count("id", filter=Q(estado=EstadoSolicitud.RESUELTA)),
        "canceladas": Count("id", filter=Q(estado=EstadoSolicitud.CANCELADA)),
    }


def _con_tiempos(fila: dict) -> dict:
    fila["respuesta"] = minutos_de(fila.get("respuesta"))
    fila["resolucion"] = minutos_de(fila.get("resolucion"))
    return fila


def asistencia(f) -> dict:
    inicio, fin = rango_local(f["desde"], f["hasta"])
    base = SolicitudAsistencia.objects.filter(filtro_lugar(f), creado_en__gte=inicio, creado_en__lt=fin)
    if f.get("categoria"):
        base = base.filter(categoria=f["categoria"])
    agregados = {**_conteos_asistencia(), **_tiempos()}

    resumen = _con_tiempos(base.aggregate(**agregados))
    resumen["total"] = resumen.pop("solicitudes")

    etiquetas = dict(CategoriaAsistencia.choices)
    filas_cat = [
        _con_tiempos({**r, "categoria": etiquetas.get(r["categoria"], r["categoria"])})
        for r in base.values("categoria").annotate(**agregados).order_by("categoria")
    ]

    atendidas = base.filter(atendida_por__isnull=False)
    filas_aux = [
        _con_tiempos({**r, "atendidas": r["solicitudes"]})
        for r in atendidas.annotate(auxiliar=nombre("atendida_por"))
        .values("atendida_por", "auxiliar")
        .annotate(**agregados)
        .order_by("auxiliar")
    ]
    totales_aux = _con_tiempos(atendidas.aggregate(**agregados))
    totales_aux.update(auxiliar="Total", atendidas=totales_aux["solicitudes"])

    filas_lab = [
        {
            "laboratorio": r["laboratorio__codigo"] or "Otro lugar",
            "solicitudes": r["solicitudes"],
            "urgentes": r["urgentes"],
            "resueltas": r["resueltas"],
        }
        for r in base.values("laboratorio__codigo")
        .annotate(**_conteos_asistencia())
        .order_by(F("laboratorio__codigo").asc(nulls_last=True))
    ]

    tiempos = [
        col("respuesta", "Tiempo de respuesta promedio", MINUTOS),
        col("resolucion", "Tiempo de resolución promedio", MINUTOS),
    ]
    total_cat = sumar(filas_cat, ["solicitudes", "urgentes", "resueltas"], "categoria")
    total_cat.update(respuesta=resumen["respuesta"], resolucion=resumen["resolucion"])
    return {
        "secciones": [
            seccion(
                "Resumen",
                [
                    col("total", "Total", ENTERO),
                    col("pendientes", "Pendientes", ENTERO),
                    col("en_curso", "En curso", ENTERO),
                    col("resueltas", "Resueltas", ENTERO),
                    col("canceladas", "Canceladas", ENTERO),
                    col("urgentes", "Urgentes", ENTERO),
                    *tiempos,
                ],
                [resumen],
            ),
            seccion(
                "Por categoría",
                [
                    col("categoria", "Categoría"),
                    col("solicitudes", "Solicitudes", ENTERO),
                    col("urgentes", "Urgentes", ENTERO),
                    col("resueltas", "Resueltas", ENTERO),
                    *tiempos,
                ],
                filas_cat,
                total_cat,
            ),
            seccion(
                "Por auxiliar",
                [
                    col("auxiliar", "Auxiliar"),
                    col("atendidas", "Atendidas", ENTERO),
                    col("resueltas", "Resueltas", ENTERO),
                    *tiempos,
                ],
                filas_aux,
                totales_aux,
            ),
            seccion(
                "Por laboratorio",
                [
                    col("laboratorio", "Laboratorio"),
                    col("solicitudes", "Solicitudes", ENTERO),
                    col("urgentes", "Urgentes", ENTERO),
                    col("resueltas", "Resueltas", ENTERO),
                ],
                filas_lab,
                sumar(filas_lab, ["solicitudes", "urgentes", "resueltas"], "laboratorio"),
            ),
        ],
        "notas": [
            "Si una solicitud se resolvió sin tomarla antes, se guarda la misma hora como respuesta y como "
            "resolución, y su tiempo de respuesta queda más alto de lo real."
        ],
    }


# ── R4 – Inventario de equipos ──────────────────────────

ESTADOS_ELEMENTO = [
    ("operativos", EstadoElemento.OPERATIVO, "Operativos"),
    ("con_falla", EstadoElemento.CON_FALLA, "Con falla"),
    ("mantenimiento", EstadoElemento.MANTENIMIENTO, "En mantenimiento"),
    ("baja", EstadoElemento.BAJA, "De baja"),
]


def inventario(f) -> dict:
    categorias = f.get("categoria") or list(CATEGORIAS_EQUIPOS)
    condicion = {"tipo__categoria__in": categorias}
    if f.get("tipo"):
        condicion["tipo"] = f["tipo"]
    if f.get("estado"):
        condicion["estado"] = f["estado"]
    elementos = ElementoLaboratorio.objects.filter(laboratorio__in=laboratorios(f), **condicion)

    def conteos(ruta=""):
        """Total y uno por estado. `ruta` es el camino hasta el elemento ("elementos")."""
        prefijo = f"{ruta}__" if ruta else ""
        base = Q(**{f"{prefijo}{k}": v for k, v in condicion.items()}) if ruta else Q()
        objetivo = ruta or "id"
        salida = {"total": Count(objetivo, filter=base)}
        for clave, estado, _ in ESTADOS_ELEMENTO:
            salida[clave] = Count(objetivo, filter=base & Q(**{f"{prefijo}estado": estado}))
        return salida

    claves = ["total"] + [clave for clave, _, _ in ESTADOS_ELEMENTO]
    columnas_estado = [col("total", "Total", ENTERO)] + [col(c, t, ENTERO) for c, _, t in ESTADOS_ELEMENTO]

    filas_lab = [
        {"laboratorio": lab["codigo"], **{c: lab[c] for c in claves}}
        for lab in laboratorios(f)
        .annotate(**conteos("elementos"))
        .order_by("codigo")
        .values("codigo", *claves)
    ]

    categorias_txt = dict(CategoriaElemento.choices)
    filas_tipo = [
        {
            "tipo": r["tipo__nombre"],
            "categoria": categorias_txt.get(r["tipo__categoria"], r["tipo__categoria"]),
            **{c: r[c] for c in claves},
        }
        for r in elementos.values("tipo__nombre", "tipo__categoria")
        .annotate(**conteos())
        .order_by("tipo__nombre")
    ]

    filas_detalle = [
        {
            "laboratorio": e.laboratorio.codigo,
            "etiqueta": e.etiqueta,
            "tipo": e.tipo.nombre,
            # En la base empiezan en 0; en el reporte, en 1.
            "fila": e.fila + 1,
            "columna": e.columna + 1,
            "codigo_activo": e.codigo_activo,
            "ip": e.ip or "",
            "mac": e.mac,
            "estado": e.get_estado_display(),
            "especificaciones": e.especificaciones,
            "actualizado": local(e.actualizado_en),
        }
        for e in elementos.select_related("laboratorio", "tipo").order_by(
            "laboratorio__codigo", "fila", "columna"
        )
    ]

    return {
        "secciones": [
            seccion(
                "Por laboratorio",
                [col("laboratorio", "Laboratorio"), *columnas_estado],
                filas_lab,
                sumar(filas_lab, claves, "laboratorio"),
            ),
            seccion(
                "Por tipo",
                [col("tipo", "Tipo"), col("categoria", "Categoría"), *columnas_estado],
                filas_tipo,
                sumar(filas_tipo, claves, "tipo"),
            ),
            seccion(
                "Detalle",
                [
                    col("laboratorio", "Laboratorio"),
                    col("etiqueta", "Etiqueta"),
                    col("tipo", "Tipo"),
                    col("fila", "Fila", ENTERO),
                    col("columna", "Columna", ENTERO),
                    col("codigo_activo", "Código de activo"),
                    col("ip", "IP"),
                    col("mac", "MAC"),
                    col("estado", "Estado"),
                    col("especificaciones", "Especificaciones"),
                    col("actualizado", "Última actualización", FECHAHORA),
                ],
                filas_detalle,
            ),
        ],
        "notas": [],
    }


# ── R5 – Bitácora ───────────────────────────────────────


def bitacora(f) -> dict:
    inicio, fin = rango_local(f["desde"], f["hasta"])
    condicion = {}
    if f.get("tipo"):
        condicion["tipo"] = f["tipo"]
    if f.get("autor"):
        condicion["creado_por"] = f["autor"]
    entradas = EntradaBitacora.objects.filter(
        laboratorio__in=laboratorios(f), fecha__gte=inicio, fecha__lt=fin, **condicion
    )

    en_rango = Q(
        bitacora__fecha__gte=inicio,
        bitacora__fecha__lt=fin,
        **{f"bitacora__{k}": v for k, v in condicion.items()},
    )
    tipos = conteo_por("tipo", TipoEntrada, "bitacora", en_rango)
    filas_lab = [
        {"laboratorio": lab["codigo"], **{t: lab[t] for t in TipoEntrada.values}, "total": lab["total"]}
        for lab in laboratorios(f)
        .annotate(**tipos, total=Count("bitacora", filter=en_rango))
        .order_by("codigo")
        .values("codigo", "total", *TipoEntrada.values)
    ]
    columnas_tipo = [
        col(valor, etiqueta, ENTERO)
        for valor, etiqueta in [
            (TipoEntrada.INSTALACION, "Instalación"),
            (TipoEntrada.REVISION, "Revisión"),
            (TipoEntrada.MANTENIMIENTO, "Mantenimiento"),
            (TipoEntrada.INCIDENCIA, "Incidencia"),
            (TipoEntrada.LIMPIEZA, "Limpieza"),
            (TipoEntrada.OTRO, "Otro"),
        ]
    ]

    filas_autor = [
        {
            "autor": r["autor"] or "Sin autor",
            "entradas": r["entradas"],
            "incidencias": r["incidencias"],
            "revisiones": r["revisiones"],
            "mantenimientos": r["mantenimientos"],
        }
        for r in entradas.annotate(autor=nombre("creado_por"))
        .values("creado_por", "autor")
        .annotate(
            entradas=Count("id"),
            incidencias=Count("id", filter=Q(tipo=TipoEntrada.INCIDENCIA)),
            revisiones=Count("id", filter=Q(tipo=TipoEntrada.REVISION)),
            mantenimientos=Count("id", filter=Q(tipo=TipoEntrada.MANTENIMIENTO)),
        )
        .order_by("autor")
    ]

    filas_detalle = [
        {
            "fecha": local(e.fecha),
            "laboratorio": e.laboratorio.codigo,
            "tipo": e.get_tipo_display(),
            "titulo": e.titulo,
            "equipos": e.elementos,
            "autor": e.creado_por.nombre_completo if e.creado_por_id else "",
            "de_revision": "Sí" if e.revision_id else "No",
        }
        for e in entradas.select_related("laboratorio", "creado_por").order_by("fecha", "id")
    ]

    return {
        "secciones": [
            seccion(
                "Por laboratorio y tipo",
                [col("laboratorio", "Laboratorio"), *columnas_tipo, col("total", "Total", ENTERO)],
                filas_lab,
                sumar(filas_lab, [*TipoEntrada.values, "total"], "laboratorio"),
            ),
            seccion(
                "Por autor",
                [
                    col("autor", "Autor"),
                    col("entradas", "Entradas", ENTERO),
                    col("incidencias", "Incidencias", ENTERO),
                    col("revisiones", "Revisiones", ENTERO),
                    col("mantenimientos", "Mantenimientos", ENTERO),
                ],
                filas_autor,
                sumar(filas_autor, ["entradas", "incidencias", "revisiones", "mantenimientos"], "autor"),
            ),
            seccion(
                "Detalle",
                [
                    col("fecha", "Fecha y hora", FECHAHORA),
                    col("laboratorio", "Laboratorio"),
                    col("tipo", "Tipo"),
                    col("titulo", "Título"),
                    col("equipos", "Equipos"),
                    col("autor", "Autor"),
                    col("de_revision", "De revisión programada"),
                ],
                filas_detalle,
            ),
        ],
        "notas": [],
    }


# ── R6 – Objetos perdidos ───────────────────────────────

ESTADOS_OBJETO = [
    ("en_custodia", EstadoObjeto.EN_CUSTODIA),
    ("entregados", EstadoObjeto.ENTREGADO),
    ("anulados", EstadoObjeto.ANULADO),
]


def objetos_perdidos(f) -> dict:
    inicio, fin = rango_local(f["desde"], f["hasta"])
    objetos = ObjetoPerdido.objects.filter(
        filtro_lugar(f), fecha_hallazgo__gte=inicio, fecha_hallazgo__lt=fin
    )
    if f.get("categoria"):
        objetos = objetos.filter(categoria=f["categoria"])
    if f.get("estado"):
        objetos = objetos.filter(estado=f["estado"])

    ahora = timezone.now()
    conteos = {
        "registrados": Count("id"),
        **{clave: Count("id", filter=Q(estado=estado)) for clave, estado in ESTADOS_OBJETO},
    }

    resumen = objetos.aggregate(
        **conteos,
        promedio=Avg(
            duracion("entregado_en", "fecha_hallazgo"),
            filter=Q(estado=EstadoObjeto.ENTREGADO, entregado_en__isnull=False),
        ),
        mas_de_30=Count(
            "id", filter=Q(estado=EstadoObjeto.EN_CUSTODIA, fecha_hallazgo__lt=ahora - timedelta(days=30))
        ),
    )
    promedio = resumen.pop("promedio")
    resumen["promedio_dias"] = round(promedio.total_seconds() / 86400, 1) if promedio is not None else None

    categorias = dict(CategoriaObjeto.choices)
    filas_cat = [
        {**r, "categoria": categorias.get(r["categoria"], r["categoria"])}
        for r in objetos.values("categoria").annotate(**conteos).order_by("categoria")
    ]

    def dias_en_custodia(o):
        if o.estado == EstadoObjeto.ENTREGADO and o.entregado_en:
            return (o.entregado_en - o.fecha_hallazgo).days
        if o.estado == EstadoObjeto.EN_CUSTODIA:
            return (ahora - o.fecha_hallazgo).days
        return None

    # De quien recibe, solo el nombre: sin CI ni fotos.
    filas_detalle = [
        {
            "codigo": o.codigo,
            "fecha_hallazgo": local(o.fecha_hallazgo),
            "descripcion": o.descripcion,
            "categoria": o.get_categoria_display(),
            "donde": " · ".join(p for p in [o.laboratorio.codigo if o.laboratorio_id else "", o.lugar] if p),
            "estado": o.get_estado_display(),
            "dias": dias_en_custodia(o),
            "entregado_a": o.entregado_a,
            "entregado_en": local(o.entregado_en),
            "entrego": o.entregado_por.nombre_completo if o.entregado_por_id else "",
        }
        for o in objetos.select_related("laboratorio", "entregado_por").order_by("fecha_hallazgo", "id")
    ]

    claves = ["registrados", *[c for c, _ in ESTADOS_OBJETO]]
    return {
        "secciones": [
            seccion(
                "Resumen",
                [
                    col("registrados", "Registrados", ENTERO),
                    col("en_custodia", "En custodia", ENTERO),
                    col("entregados", "Entregados", ENTERO),
                    col("anulados", "Anulados", ENTERO),
                    col("promedio_dias", "Promedio de días hasta la entrega", DECIMAL),
                    col("mas_de_30", "En custodia hace más de 30 días", ENTERO),
                ],
                [resumen],
            ),
            seccion(
                "Por categoría",
                [
                    col("categoria", "Categoría"),
                    col("registrados", "Registrados", ENTERO),
                    col("en_custodia", "En custodia", ENTERO),
                    col("entregados", "Entregados", ENTERO),
                    col("anulados", "Anulados", ENTERO),
                ],
                filas_cat,
                sumar(filas_cat, claves, "categoria"),
            ),
            seccion(
                "Detalle",
                [
                    col("codigo", "Código"),
                    col("fecha_hallazgo", "Fecha del hallazgo", FECHAHORA),
                    col("descripcion", "Descripción"),
                    col("categoria", "Categoría"),
                    col("donde", "Dónde"),
                    col("estado", "Estado"),
                    col("dias", "Días en custodia", ENTERO),
                    col("entregado_a", "Entregado a"),
                    col("entregado_en", "Fecha de entrega", FECHAHORA),
                    col("entrego", "Entregó"),
                ],
                filas_detalle,
            ),
        ],
        "notas": [],
    }
