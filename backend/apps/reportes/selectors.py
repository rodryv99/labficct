"""Un selector por reporte: consulta la base y arma el `Resultado`
(columnas, filas, gráficos y KPI). Cada uno se registra en el catálogo.

Las consultas pesadas van agregadas en la base (`values().annotate()`); solo se
trae a Python lo justo para dar formato.
"""

from datetime import timedelta

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Max, Q
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.utils import timezone

from apps.asistencia.models import CategoriaAsistencia, EstadoSolicitud, SolicitudAsistencia
from apps.bitacora.models import EntradaBitacora, RevisionProgramada, TipoEntrada
from apps.inventario.models import Activo, EstadoActivo, ItemVerificacion, ResultadoVerificacion
from apps.laboratorios.models import (
    ElementoLaboratorio,
    EstadoElemento,
    Laboratorio,
    RevelacionCredencial,
    Software,
)
from apps.notificaciones.models import Notificacion, TipoNotificacion
from apps.objetos_perdidos.models import EstadoObjeto, ObjetoPerdido
from apps.planificacion.models import EstadoReserva, Horario, PeriodoAcademico, Reserva
from apps.respaldos.models import Respaldo
from apps.tareas.models import EstadoTarea, Prioridad, Tarea
from apps.usuarios.models import Usuario

from .base import (
    BARRAS,
    BARRAS_APILADAS,
    DONA,
    DURACION,
    FECHA,
    HEATMAP,
    KPI,
    LINEAS,
    NUMERO,
    PASTEL,
    PORCENTAJE,
    TEXTO,
    Columna,
    Grafico,
    Resultado,
    color,
    serie,
)
from .catalogo import registrar
from .consulta import Filtros

_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
_DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
_TRUNC = {"dia": TruncDay, "semana": TruncWeek, "mes": TruncMonth}


# ── Helpers ─────────────────────────────────────────────


def _por_choices(qs, campo: str, choices) -> list[tuple]:
    """[(valor, etiqueta, cantidad)] siguiendo el orden de las opciones del modelo."""
    cuenta = {r[campo]: r["n"] for r in qs.values(campo).annotate(n=Count("id"))}
    return [(valor, etiqueta, cuenta.get(valor, 0)) for valor, etiqueta in choices]


def _nombre(apellidos: str | None, nombres: str | None) -> str:
    return f"{apellidos or ''}, {nombres or ''}".strip(", ") or "—"


def _periodo_label(valor, agrupar: str) -> str:
    if valor is None:
        return "—"
    if agrupar == "mes":
        return f"{_MESES[valor.month - 1]} {valor.year}"
    return valor.strftime("%d/%m")


def _serie_tiempo(qs, campo: str, agrupar: str) -> tuple[list[str], list[int]]:
    trunc = _TRUNC.get(agrupar, TruncMonth)
    filas = qs.annotate(_p=trunc(campo)).values("_p").annotate(n=Count("id")).order_by("_p")
    etiquetas, datos = [], []
    for f in filas:
        if f["_p"] is None:
            continue
        etiquetas.append(_periodo_label(f["_p"], agrupar))
        datos.append(f["n"])
    return etiquetas, datos


def _minutos(delta) -> int:
    return round(delta.total_seconds() / 60) if delta else 0


def _dur(minutos: int) -> str:
    if not minutos:
        return "—"
    h, m = divmod(int(minutos), 60)
    return f"{h} h {m} min" if h else f"{m} min"


# ════════════════════════════════════════════════════════
#  USO DE LABORATORIOS
# ════════════════════════════════════════════════════════


@registrar("reservas_estado", "Reservas por estado", "uso",
           "Cuántas reservas hay por estado (por aprobar, confirmadas, canceladas).",
           ["rango"], icono="calendar")
def reservas_estado(f: Filtros) -> Resultado:
    qs = f.entre(Reserva.objects.all(), "creado_en")
    datos = _por_choices(qs, "estado", EstadoReserva.choices)
    etiquetas = [e for _, e, _ in datos]
    valores = [n for _, _, n in datos]
    total = sum(valores)
    conf = dict((v, n) for v, _, n in datos)
    tasa = round(100 * conf.get("confirmada", 0) / total) if total else 0
    kpis = [
        KPI("Total de reservas", str(total), "info"),
        KPI("Confirmadas", str(conf.get("confirmada", 0)), "exito"),
        KPI("Por aprobar", str(conf.get("pendiente", 0)), "aviso"),
        KPI("Tasa de confirmación", f"{tasa}%", "marca"),
    ]
    graf = [Grafico(DONA, "Reservas por estado", etiquetas=etiquetas, series=[serie("n", valores)])]
    columnas = [Columna("estado", "Estado", TEXTO, 2.5), Columna("n", "Cantidad", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("reservas_laboratorio", "Reservas por laboratorio", "uso",
           "Qué laboratorios se reservan más.", ["rango"], icono="calendar")
def reservas_laboratorio(f: Filtros) -> Resultado:
    bloques = Reserva.objects.filter(estado=EstadoReserva.CONFIRMADA)
    bloques = f.entre(bloques, "creado_en")
    filas_bd = (
        bloques.values("bloques__laboratorio__nombre")
        .annotate(n=Count("id", distinct=True))
        .order_by("-n")
    )
    etiquetas, valores, filas = [], [], []
    for r in filas_bd:
        nombre = r["bloques__laboratorio__nombre"] or "—"
        etiquetas.append(nombre)
        valores.append(r["n"])
        filas.append([nombre, r["n"]])
    graf = [Grafico(BARRAS, "Reservas confirmadas por laboratorio",
                    etiquetas=etiquetas[:12], series=[serie("Reservas", valores[:12])], ancho=2)]
    kpis = [KPI("Laboratorios con reservas", str(len(filas)), "info"),
            KPI("Total reservas confirmadas", str(sum(valores)), "marca")]
    columnas = [Columna("lab", "Laboratorio", TEXTO, 3), Columna("n", "Reservas", NUMERO, 1)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("reservas_docente", "Reservas por solicitante", "uso",
           "Quién solicita más reservas.", ["rango"], icono="person")
def reservas_docente(f: Filtros) -> Resultado:
    qs = f.entre(Reserva.objects.all(), "creado_en")
    filas_bd = (
        qs.values("solicitante__apellidos", "solicitante__nombres", "solicitante_externo")
        .annotate(n=Count("id"))
        .order_by("-n")
    )
    etiquetas, valores, filas = [], [], []
    for r in filas_bd:
        if r["solicitante__apellidos"] or r["solicitante__nombres"]:
            nombre = _nombre(r["solicitante__apellidos"], r["solicitante__nombres"])
        else:
            nombre = r["solicitante_externo"] or "Externo"
        etiquetas.append(nombre)
        valores.append(r["n"])
        filas.append([nombre, r["n"]])
    graf = [Grafico(BARRAS, "Reservas por solicitante",
                    etiquetas=etiquetas[:12], series=[serie("Reservas", valores[:12])], ancho=2)]
    kpis = [KPI("Solicitantes", str(len(filas)), "info")]
    columnas = [Columna("sol", "Solicitante", TEXTO, 3), Columna("n", "Reservas", NUMERO, 1)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("ocupacion_laboratorios", "Horas de clase por laboratorio", "uso",
           "Horas semanales de clase programadas en cada laboratorio (según los horarios vigentes).",
           ["periodo"], icono="clock")
def ocupacion_laboratorios(f: Filtros) -> Resultado:
    horarios = Horario.objects.filter(activo=True).select_related("laboratorio")
    if f.periodo:
        horarios = horarios.filter(periodo_id=f.periodo)
    horas_por_lab: dict[str, float] = {}
    for h in horarios.values("laboratorio__nombre", "hora_inicio", "hora_fin"):
        ini, fin = h["hora_inicio"], h["hora_fin"]
        dur = (fin.hour * 60 + fin.minute) - (ini.hour * 60 + ini.minute)
        if dur > 0:
            horas_por_lab[h["laboratorio__nombre"] or "—"] = horas_por_lab.get(h["laboratorio__nombre"] or "—", 0) + dur / 60
    orden = sorted(horas_por_lab.items(), key=lambda x: -x[1])
    etiquetas = [n for n, _ in orden]
    valores = [round(v, 1) for _, v in orden]
    filas = [[n, f"{v:g} h"] for n, v in zip(etiquetas, valores, strict=True)]
    graf = [Grafico(BARRAS, "Horas de clase semanales por laboratorio",
                    etiquetas=etiquetas[:12], series=[serie("Horas", valores[:12])], ancho=2)]
    kpis = [KPI("Horas de clase/semana", f"{round(sum(valores)):g}", "marca"),
            KPI("Laboratorios con clase", str(len(filas)), "info")]
    columnas = [Columna("lab", "Laboratorio", TEXTO, 3), Columna("h", "Horas/semana", NUMERO, 1)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("mapa_calor_horarios", "Mapa de calor de horarios", "uso",
           "Dónde se concentran las clases por día y hora.", ["periodo"], icono="grid")
def mapa_calor_horarios(f: Filtros) -> Resultado:
    horarios = Horario.objects.filter(activo=True)
    if f.periodo:
        horarios = horarios.filter(periodo_id=f.periodo)
    horas = list(range(7, 22))
    columnas_lbl = [f"{h:02d}" for h in horas]
    matriz = [[0 for _ in horas] for _ in range(6)]  # Lun..Sáb
    for h in horarios.values("dia_semana", "hora_inicio"):
        dia = h["dia_semana"]
        hora = h["hora_inicio"].hour
        if 0 <= dia < 6 and hora in horas:
            matriz[dia][horas.index(hora)] += 1
    graf = [Grafico(HEATMAP, "Clases por día y hora",
                    filas=_DIAS[:6], columnas=columnas_lbl, matriz=matriz, ancho=2)]
    columnas = [Columna("dia", "Día", TEXTO, 1)] + [Columna(f"h{h}", f"{h:02d}h", NUMERO, 0.6) for h in horas]
    filas = [[_DIAS[d], *[(v or "") for v in matriz[d]]] for d in range(6)]
    total = sum(sum(fila) for fila in matriz)
    kpis = [KPI("Clases programadas", str(total), "info")]
    return Resultado(columnas, filas, graf, kpis)


# ════════════════════════════════════════════════════════
#  INVENTARIO Y EQUIPOS
# ════════════════════════════════════════════════════════


@registrar("elementos_estado", "Estado de los equipos", "equipos",
           "Cómo está el parque de equipos de cada laboratorio (operativo, con falla, mantenimiento, baja).",
           ["laboratorio"], icono="desktop")
def elementos_estado(f: Filtros) -> Resultado:
    qs = f.por_laboratorio(ElementoLaboratorio.objects.all())
    datos = _por_choices(qs, "estado", EstadoElemento.choices)
    etiquetas = [e for _, e, _ in datos]
    valores = [n for _, _, n in datos]
    cuenta = {v: n for v, _, n in datos}
    total = sum(valores)
    graf = [Grafico(PASTEL, "Equipos por estado", etiquetas=etiquetas, series=[serie("n", valores)])]
    # Barras apiladas por laboratorio.
    por_lab = (
        qs.values("laboratorio__nombre", "estado")
        .annotate(n=Count("id"))
    )
    labs: dict[str, dict] = {}
    for r in por_lab:
        labs.setdefault(r["laboratorio__nombre"] or "—", {})[r["estado"]] = r["n"]
    lab_nombres = sorted(labs)
    series_apil = []
    for i, (val, etq, _) in enumerate(datos):
        series_apil.append(serie(etq, [labs[ln].get(val, 0) for ln in lab_nombres], color(i)))
    graf.append(Grafico(BARRAS_APILADAS, "Equipos por laboratorio y estado",
                        etiquetas=lab_nombres[:14], series=[{**s, "datos": s["datos"][:14]} for s in series_apil], ancho=2))
    kpis = [
        KPI("Total de equipos", str(total), "info"),
        KPI("Operativos", str(cuenta.get("operativo", 0)), "exito"),
        KPI("Con falla", str(cuenta.get("con_falla", 0)), "peligro"),
        KPI("En mantenimiento", str(cuenta.get("mantenimiento", 0)), "aviso"),
    ]
    columnas = [Columna("estado", "Estado", TEXTO, 2), Columna("n", "Cantidad", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("elementos_con_falla", "Equipos con falla o en mantenimiento", "equipos",
           "Lista de los equipos que no están operativos.", ["laboratorio"], icono="warning")
def elementos_con_falla(f: Filtros) -> Resultado:
    qs = f.por_laboratorio(
        ElementoLaboratorio.objects.exclude(estado=EstadoElemento.OPERATIVO).select_related("laboratorio", "tipo")
    ).order_by("laboratorio__nombre", "etiqueta")
    etiquetas_estado = dict(EstadoElemento.choices)
    filas = [
        [
            e.laboratorio.nombre,
            e.etiqueta or "—",
            e.tipo.nombre if e.tipo else "—",
            etiquetas_estado.get(e.estado, e.estado),
            e.codigo_activo or "—",
        ]
        for e in qs
    ]
    columnas = [
        Columna("lab", "Laboratorio", TEXTO, 2),
        Columna("etq", "Etiqueta", TEXTO, 1),
        Columna("tipo", "Tipo", TEXTO, 1.4),
        Columna("estado", "Estado", TEXTO, 1.2),
        Columna("cod", "Código activo", TEXTO, 1.2),
    ]
    kpis = [KPI("Equipos no operativos", str(len(filas)), "peligro" if filas else "exito")]
    return Resultado(columnas, filas, [], kpis)


@registrar("software_instalado", "Software instalado", "equipos",
           "En cuántos laboratorios está instalado cada programa del catálogo.", [], icono="apps")
def software_instalado(f: Filtros) -> Resultado:
    qs = Software.objects.annotate(labs=Count("laboratorios", distinct=True)).order_by("-labs", "nombre")
    etiquetas, valores, filas = [], [], []
    for s in qs:
        etiquetas.append(s.nombre)
        valores.append(s.labs)
        filas.append([s.nombre, s.version or "—", s.labs])
    graf = [Grafico(BARRAS, "Programas por número de laboratorios",
                    etiquetas=etiquetas[:14], series=[serie("Laboratorios", valores[:14])], ancho=2)]
    kpis = [KPI("Programas en el catálogo", str(len(filas)), "info")]
    columnas = [Columna("sw", "Programa", TEXTO, 3), Columna("ver", "Versión", TEXTO, 1),
                Columna("labs", "Laboratorios", NUMERO, 1)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("inventario_estado", "Activos por estado", "equipos",
           "Los activos fijos del inventario por estado.", [], icono="box")
def inventario_estado(f: Filtros) -> Resultado:
    qs = Activo.objects.all()
    datos = _por_choices(qs, "estado", EstadoActivo.choices)
    etiquetas = [e for _, e, _ in datos]
    valores = [n for _, _, n in datos]
    cuenta = {v: n for v, _, n in datos}
    graf = [Grafico(PASTEL, "Activos por estado", etiquetas=etiquetas, series=[serie("n", valores)])]
    kpis = [
        KPI("Total de activos", str(sum(valores)), "info"),
        KPI("Operativos", str(cuenta.get("operativo", 0)), "exito"),
        KPI("Dañados / reparación", str(cuenta.get("danado", 0) + cuenta.get("en_reparacion", 0)), "aviso"),
        KPI("De baja", str(cuenta.get("baja", 0)), "peligro"),
    ]
    columnas = [Columna("estado", "Estado", TEXTO, 2), Columna("n", "Cantidad", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("inventario_lugar", "Activos por lugar", "equipos",
           "Cuántos activos hay en cada lugar (laboratorio, depósito…).", [], icono="location")
def inventario_lugar(f: Filtros) -> Resultado:
    filas_bd = (
        Activo.objects.values("lugar__nombre").annotate(n=Count("id")).order_by("-n")
    )
    etiquetas, valores, filas = [], [], []
    for r in filas_bd:
        nombre = r["lugar__nombre"] or "—"
        etiquetas.append(nombre)
        valores.append(r["n"])
        filas.append([nombre, r["n"]])
    graf = [Grafico(BARRAS, "Activos por lugar",
                    etiquetas=etiquetas[:14], series=[serie("Activos", valores[:14])], ancho=2)]
    kpis = [KPI("Lugares con activos", str(len(filas)), "info")]
    columnas = [Columna("lugar", "Lugar", TEXTO, 3), Columna("n", "Activos", NUMERO, 1)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("verificaciones_resultados", "Resultados de verificaciones", "equipos",
           "Cómo salieron los activos en las verificaciones de inventario (están, faltan, dañados…).",
           ["rango"], icono="check")
def verificaciones_resultados(f: Filtros) -> Resultado:
    qs = f.entre(ItemVerificacion.objects.all(), "verificado_en")
    datos = _por_choices(qs, "resultado", ResultadoVerificacion.choices)
    etiquetas = [e for _, e, _ in datos]
    valores = [n for _, _, n in datos]
    cuenta = {v: n for v, _, n in datos}
    total = sum(valores)
    graf = [Grafico(PASTEL, "Ítems por resultado", etiquetas=etiquetas, series=[serie("n", valores)])]
    kpis = [
        KPI("Ítems verificados", str(total), "info"),
        KPI("Faltantes", str(cuenta.get("falta", 0)), "peligro"),
        KPI("En otro lugar", str(cuenta.get("otro_lugar", 0)), "aviso"),
        KPI("Dañados", str(cuenta.get("danado", 0)), "aviso"),
    ]
    columnas = [Columna("res", "Resultado", TEXTO, 2), Columna("n", "Cantidad", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("auditoria_credenciales", "Auditoría de credenciales", "equipos",
           "Quién reveló las credenciales de laboratorio y cuándo.", ["rango", "laboratorio"], icono="key")
def auditoria_credenciales(f: Filtros) -> Resultado:
    qs = RevelacionCredencial.objects.select_related("usuario", "credencial", "credencial__laboratorio")
    qs = f.entre(qs, "fecha")
    if f.laboratorio:
        qs = qs.filter(credencial__laboratorio_id=f.laboratorio)
    qs = qs.order_by("-fecha")[:1000]
    filas = [
        [
            timezone.localtime(r.fecha).strftime("%d/%m/%Y %H:%M"),
            r.usuario.nombre_completo if r.usuario else "—",
            r.credencial.laboratorio.nombre if r.credencial and r.credencial.laboratorio else "—",
            r.credencial.descripcion if r.credencial else "—",
        ]
        for r in qs
    ]
    # Serie de tiempo + top usuarios.
    etiquetas, valores = _serie_tiempo(f.entre(RevelacionCredencial.objects.all(), "fecha"), "fecha", f.agrupar or "mes")
    graf = [Grafico(LINEAS, "Revelaciones en el tiempo", etiquetas=etiquetas, series=[serie("Revelaciones", valores)], ancho=2)]
    kpis = [KPI("Revelaciones", str(len(filas)), "info")]
    columnas = [
        Columna("fecha", "Fecha", FECHA, 1.4),
        Columna("usuario", "Quién la vio", TEXTO, 2),
        Columna("lab", "Laboratorio", TEXTO, 2),
        Columna("desc", "Credencial", TEXTO, 2),
    ]
    return Resultado(columnas, filas, graf, kpis)


# ════════════════════════════════════════════════════════
#  MANTENIMIENTO Y BITÁCORA
# ════════════════════════════════════════════════════════


@registrar("bitacora_tipo", "Bitácora por tipo", "mantenimiento",
           "Entradas de bitácora por tipo (instalación, revisión, mantenimiento, incidencia, limpieza).",
           ["rango", "laboratorio"], icono="book")
def bitacora_tipo(f: Filtros) -> Resultado:
    qs = f.por_laboratorio(f.entre(EntradaBitacora.objects.all(), "fecha"))
    datos = _por_choices(qs, "tipo", TipoEntrada.choices)
    etiquetas = [e for _, e, _ in datos]
    valores = [n for _, _, n in datos]
    graf = [Grafico(BARRAS, "Entradas por tipo", etiquetas=etiquetas, series=[serie("Entradas", valores)], ancho=2)]
    etq_t, val_t = _serie_tiempo(qs, "fecha", f.agrupar or "mes")
    graf.append(Grafico(LINEAS, "Entradas en el tiempo", etiquetas=etq_t, series=[serie("Entradas", val_t)], ancho=2))
    kpis = [KPI("Entradas de bitácora", str(sum(valores)), "info")]
    columnas = [Columna("tipo", "Tipo", TEXTO, 2), Columna("n", "Cantidad", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("bitacora_laboratorio", "Bitácora por laboratorio", "mantenimiento",
           "Cuántas entradas de bitácora tiene cada laboratorio.", ["rango"], icono="book")
def bitacora_laboratorio(f: Filtros) -> Resultado:
    qs = f.entre(EntradaBitacora.objects.all(), "fecha")
    filas_bd = qs.values("laboratorio__nombre").annotate(n=Count("id")).order_by("-n")
    etiquetas, valores, filas = [], [], []
    for r in filas_bd:
        nombre = r["laboratorio__nombre"] or "—"
        etiquetas.append(nombre)
        valores.append(r["n"])
        filas.append([nombre, r["n"]])
    graf = [Grafico(BARRAS, "Entradas por laboratorio",
                    etiquetas=etiquetas[:14], series=[serie("Entradas", valores[:14])], ancho=2)]
    kpis = [KPI("Total de entradas", str(sum(valores)), "info")]
    columnas = [Columna("lab", "Laboratorio", TEXTO, 3), Columna("n", "Entradas", NUMERO, 1)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("revisiones_cumplimiento", "Cumplimiento de revisiones", "mantenimiento",
           "Revisiones periódicas vencidas, próximas y al día.", [], icono="refresh")
def revisiones_cumplimiento(f: Filtros) -> Resultado:
    hoy = timezone.localdate()
    qs = RevisionProgramada.objects.filter(activa=True).select_related("laboratorio")
    vencidas = qs.filter(proxima_fecha__lt=hoy).count()
    proximas = qs.filter(proxima_fecha__gte=hoy, proxima_fecha__lte=hoy + timedelta(days=7)).count()
    al_dia = qs.filter(proxima_fecha__gt=hoy + timedelta(days=7)).count()
    etiquetas = ["Vencidas", "Próximas (7 días)", "Al día"]
    valores = [vencidas, proximas, al_dia]
    graf = [Grafico(PASTEL, "Estado de las revisiones", etiquetas=etiquetas,
                    series=[serie("n", valores, None)])]
    filas = [
        [
            r.laboratorio.nombre,
            r.titulo,
            r.proxima_fecha.strftime("%d/%m/%Y") if r.proxima_fecha else "—",
            "Vencida" if r.proxima_fecha and r.proxima_fecha < hoy else "Al día",
            r.ultima_fecha.strftime("%d/%m/%Y") if r.ultima_fecha else "—",
        ]
        for r in qs.order_by("proxima_fecha")
    ]
    kpis = [
        KPI("Revisiones activas", str(qs.count()), "info"),
        KPI("Vencidas", str(vencidas), "peligro" if vencidas else "exito"),
        KPI("Próximas (7 días)", str(proximas), "aviso"),
    ]
    columnas = [
        Columna("lab", "Laboratorio", TEXTO, 2),
        Columna("titulo", "Revisión", TEXTO, 2.4),
        Columna("prox", "Próxima", FECHA, 1),
        Columna("estado", "Estado", TEXTO, 1),
        Columna("ult", "Última", FECHA, 1),
    ]
    return Resultado(columnas, filas, graf, kpis)


@registrar("incidencias", "Incidencias registradas", "mantenimiento",
           "Incidencias de la bitácora por laboratorio y en el tiempo.", ["rango", "laboratorio"], icono="warning")
def incidencias(f: Filtros) -> Resultado:
    qs = f.por_laboratorio(f.entre(EntradaBitacora.objects.filter(tipo=TipoEntrada.INCIDENCIA), "fecha"))
    por_lab = qs.values("laboratorio__nombre").annotate(n=Count("id")).order_by("-n")
    etiquetas, valores, filas = [], [], []
    for r in por_lab:
        nombre = r["laboratorio__nombre"] or "—"
        etiquetas.append(nombre)
        valores.append(r["n"])
        filas.append([nombre, r["n"]])
    graf = [Grafico(BARRAS, "Incidencias por laboratorio",
                    etiquetas=etiquetas[:14], series=[serie("Incidencias", valores[:14])], ancho=2)]
    etq_t, val_t = _serie_tiempo(qs, "fecha", f.agrupar or "mes")
    graf.append(Grafico(LINEAS, "Incidencias en el tiempo", etiquetas=etq_t, series=[serie("Incidencias", val_t)], ancho=2))
    kpis = [KPI("Total de incidencias", str(sum(valores)), "peligro" if valores else "exito")]
    columnas = [Columna("lab", "Laboratorio", TEXTO, 3), Columna("n", "Incidencias", NUMERO, 1)]
    return Resultado(columnas, filas, graf, kpis)


# ════════════════════════════════════════════════════════
#  SOLICITUDES DE ASISTENCIA
# ════════════════════════════════════════════════════════


@registrar("asistencia_estado", "Asistencias por estado", "asistencia",
           "Solicitudes de apoyo por estado y en el tiempo.", ["rango"], icono="hand")
def asistencia_estado(f: Filtros) -> Resultado:
    qs = f.entre(SolicitudAsistencia.objects.all(), "creado_en")
    datos = _por_choices(qs, "estado", EstadoSolicitud.choices)
    etiquetas = [e for _, e, _ in datos]
    valores = [n for _, _, n in datos]
    cuenta = {v: n for v, _, n in datos}
    graf = [Grafico(DONA, "Solicitudes por estado", etiquetas=etiquetas, series=[serie("n", valores)])]
    etq_t, val_t = _serie_tiempo(qs, "creado_en", f.agrupar or "mes")
    graf.append(Grafico(LINEAS, "Solicitudes en el tiempo", etiquetas=etq_t, series=[serie("Solicitudes", val_t)], ancho=2))
    kpis = [
        KPI("Total de solicitudes", str(sum(valores)), "info"),
        KPI("Pendientes", str(cuenta.get("pendiente", 0)), "aviso"),
        KPI("Resueltas", str(cuenta.get("resuelta", 0)), "exito"),
    ]
    columnas = [Columna("estado", "Estado", TEXTO, 2), Columna("n", "Cantidad", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("asistencia_categoria", "Asistencias por categoría", "asistencia",
           "De qué tratan las solicitudes de apoyo (equipo, proyector, red, software…).", ["rango"], icono="tag")
def asistencia_categoria(f: Filtros) -> Resultado:
    qs = f.entre(SolicitudAsistencia.objects.all(), "creado_en")
    datos = _por_choices(qs, "categoria", CategoriaAsistencia.choices)
    etiquetas = [e for _, e, _ in datos]
    valores = [n for _, _, n in datos]
    graf = [Grafico(BARRAS, "Solicitudes por categoría", etiquetas=etiquetas, series=[serie("Solicitudes", valores)], ancho=2)]
    kpis = [KPI("Total de solicitudes", str(sum(valores)), "info")]
    columnas = [Columna("cat", "Categoría", TEXTO, 2), Columna("n", "Cantidad", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("asistencia_auxiliar", "Asistencias atendidas por auxiliar", "asistencia",
           "Quién atiende más solicitudes.", ["rango"], icono="person")
def asistencia_auxiliar(f: Filtros) -> Resultado:
    qs = f.entre(SolicitudAsistencia.objects.filter(atendida_por__isnull=False), "creado_en")
    filas_bd = (
        qs.values("atendida_por__apellidos", "atendida_por__nombres")
        .annotate(n=Count("id"))
        .order_by("-n")
    )
    etiquetas, valores, filas = [], [], []
    for r in filas_bd:
        nombre = _nombre(r["atendida_por__apellidos"], r["atendida_por__nombres"])
        etiquetas.append(nombre)
        valores.append(r["n"])
        filas.append([nombre, r["n"]])
    graf = [Grafico(BARRAS, "Solicitudes atendidas por auxiliar",
                    etiquetas=etiquetas[:12], series=[serie("Atendidas", valores[:12])], ancho=2)]
    kpis = [KPI("Auxiliares que atendieron", str(len(filas)), "info"),
            KPI("Solicitudes atendidas", str(sum(valores)), "marca")]
    columnas = [Columna("aux", "Auxiliar", TEXTO, 3), Columna("n", "Atendidas", NUMERO, 1)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("asistencia_tiempos", "Tiempos de respuesta de asistencia", "asistencia",
           "Cuánto se tarda en atender (tomar) y en resolver las solicitudes.", ["rango"], icono="clock")
def asistencia_tiempos(f: Filtros) -> Resultado:
    qs = f.entre(SolicitudAsistencia.objects.all(), "creado_en")
    respuesta = ExpressionWrapper(F("atendida_en") - F("creado_en"), output_field=DurationField())
    resolucion = ExpressionWrapper(F("cerrada_en") - F("atendida_en"), output_field=DurationField())
    ag = qs.aggregate(
        resp=Avg(respuesta, filter=Q(atendida_en__isnull=False)),
        resp_max=Max(respuesta, filter=Q(atendida_en__isnull=False)),
        resol=Avg(resolucion, filter=Q(cerrada_en__isnull=False, atendida_en__isnull=False)),
    )
    resp_min = _minutos(ag["resp"])
    resol_min = _minutos(ag["resol"])
    kpis = [
        KPI("Respuesta promedio", _dur(resp_min), "marca"),
        KPI("Resolución promedio", _dur(resol_min), "info"),
        KPI("Respuesta máxima", _dur(_minutos(ag["resp_max"])), "aviso"),
    ]
    # Tabla por laboratorio.
    filas = []
    por_lab = (
        qs.values("laboratorio__nombre")
        .annotate(n=Count("id"), resp=Avg(respuesta, filter=Q(atendida_en__isnull=False)),
                  resol=Avg(resolucion, filter=Q(cerrada_en__isnull=False)))
        .order_by("-n")
    )
    etiquetas, valores = [], []
    for r in por_lab:
        nombre = r["laboratorio__nombre"] or "—"
        filas.append([nombre, r["n"], _dur(_minutos(r["resp"])), _dur(_minutos(r["resol"]))])
        etiquetas.append(nombre)
        valores.append(_minutos(r["resp"]))
    graf = [Grafico(BARRAS, "Respuesta promedio por laboratorio (min)",
                    etiquetas=etiquetas[:12], series=[serie("Minutos", valores[:12])], ancho=2)]
    columnas = [
        Columna("lab", "Laboratorio", TEXTO, 2),
        Columna("n", "Solicitudes", NUMERO, 1),
        Columna("resp", "Respuesta prom.", DURACION, 1.2),
        Columna("resol", "Resolución prom.", DURACION, 1.2),
    ]
    return Resultado(columnas, filas, graf, kpis)


# ════════════════════════════════════════════════════════
#  PUNTUALIDAD DE AUXILIARES (MARCACIONES)
# ════════════════════════════════════════════════════════


@registrar("marcaciones_puntualidad", "Puntualidad de auxiliares", "marcaciones",
           "Retrasos por auxiliar: cantidad, promedio y máximo.", ["rango"], icono="clock")
def marcaciones_puntualidad(f: Filtros) -> Resultado:
    from apps.marcaciones.models import Marcacion

    qs = f.entre(Marcacion.objects.all(), "fecha")
    filas_bd = (
        qs.values("usuario__apellidos", "usuario__nombres")
        .annotate(
            total=Count("id"),
            retrasos=Count("id", filter=Q(retraso_min__gt=0)),
            prom=Avg("retraso_min", filter=Q(retraso_min__gt=0)),
            maximo=Max("retraso_min"),
        )
        .order_by("-retrasos")
    )
    etiquetas, valores, filas = [], [], []
    tot_marc = tot_retraso = 0
    for r in filas_bd:
        nombre = _nombre(r["usuario__apellidos"], r["usuario__nombres"])
        etiquetas.append(nombre)
        valores.append(r["retrasos"])
        tot_marc += r["total"]
        tot_retraso += r["retrasos"]
        filas.append([
            nombre, r["total"], r["retrasos"],
            f"{round(r['prom'] or 0)} min", f"{r['maximo'] or 0} min",
        ])
    graf = [Grafico(BARRAS, "Retrasos por auxiliar",
                    etiquetas=etiquetas[:12], series=[serie("Retrasos", valores[:12])], ancho=2)]
    tasa = round(100 * tot_retraso / tot_marc) if tot_marc else 0
    kpis = [
        KPI("Marcaciones", str(tot_marc), "info"),
        KPI("Con retraso", str(tot_retraso), "aviso"),
        KPI("Tasa de retraso", f"{tasa}%", "peligro" if tasa > 20 else "marca"),
    ]
    columnas = [
        Columna("aux", "Auxiliar", TEXTO, 2.4),
        Columna("tot", "Marcaciones", NUMERO, 1),
        Columna("ret", "Con retraso", NUMERO, 1),
        Columna("prom", "Retraso prom.", DURACION, 1),
        Columna("max", "Retraso máx.", DURACION, 1),
    ]
    return Resultado(columnas, filas, graf, kpis)


# ════════════════════════════════════════════════════════
#  TAREAS
# ════════════════════════════════════════════════════════


@registrar("tareas_estado", "Tareas por estado", "tareas",
           "Distribución del pizarrón de tareas por estado y prioridad.", ["laboratorio"], icono="kanban")
def tareas_estado(f: Filtros) -> Resultado:
    qs = f.por_laboratorio(Tarea.objects.all())
    datos = _por_choices(qs, "estado", EstadoTarea.choices)
    etiquetas = [e for _, e, _ in datos]
    valores = [n for _, _, n in datos]
    cuenta = {v: n for v, _, n in datos}
    graf = [Grafico(DONA, "Tareas por estado", etiquetas=etiquetas, series=[serie("n", valores)])]
    prio = _por_choices(qs, "prioridad", Prioridad.choices)
    graf.append(Grafico(BARRAS, "Tareas por prioridad", etiquetas=[e for _, e, _ in prio],
                        series=[serie("Tareas", [n for _, _, n in prio])]))
    hoy = timezone.localdate()
    vencidas = qs.exclude(estado=EstadoTarea.HECHA).filter(fecha_limite__lt=hoy).count()
    kpis = [
        KPI("Total de tareas", str(sum(valores)), "info"),
        KPI("Pendientes", str(cuenta.get("pendiente", 0)), "aviso"),
        KPI("Hechas", str(cuenta.get("hecha", 0)), "exito"),
        KPI("Vencidas", str(vencidas), "peligro" if vencidas else "exito"),
    ]
    columnas = [Columna("estado", "Estado", TEXTO, 2), Columna("n", "Cantidad", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("tareas_responsable", "Tareas por responsable", "tareas",
           "Carga de tareas de cada responsable.", ["laboratorio"], icono="person")
def tareas_responsable(f: Filtros) -> Resultado:
    qs = f.por_laboratorio(Tarea.objects.all())
    filas_bd = (
        qs.values("responsables__apellidos", "responsables__nombres")
        .annotate(
            total=Count("id"),
            pendientes=Count("id", filter=~Q(estado=EstadoTarea.HECHA)),
        )
        .order_by("-total")
    )
    etiquetas, valores, filas = [], [], []
    for r in filas_bd:
        if not (r["responsables__apellidos"] or r["responsables__nombres"]):
            continue
        nombre = _nombre(r["responsables__apellidos"], r["responsables__nombres"])
        etiquetas.append(nombre)
        valores.append(r["total"])
        filas.append([nombre, r["total"], r["pendientes"]])
    graf = [Grafico(BARRAS, "Tareas por responsable",
                    etiquetas=etiquetas[:12], series=[serie("Tareas", valores[:12])], ancho=2)]
    kpis = [KPI("Responsables", str(len(filas)), "info")]
    columnas = [Columna("resp", "Responsable", TEXTO, 3), Columna("tot", "Total", NUMERO, 1),
                Columna("pend", "Sin terminar", NUMERO, 1)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("tareas_vencidas", "Tareas vencidas", "tareas",
           "Tareas sin terminar cuya fecha límite ya pasó.", ["laboratorio"], icono="warning")
def tareas_vencidas(f: Filtros) -> Resultado:
    hoy = timezone.localdate()
    qs = f.por_laboratorio(
        Tarea.objects.exclude(estado=EstadoTarea.HECHA).filter(fecha_limite__lt=hoy)
    ).select_related("laboratorio").order_by("fecha_limite")
    etiquetas_estado = dict(EstadoTarea.choices)
    filas = [
        [
            t.titulo,
            t.laboratorio.nombre if t.laboratorio else "—",
            etiquetas_estado.get(t.estado, t.estado),
            f"{t.progreso}%",
            t.fecha_limite.strftime("%d/%m/%Y") if t.fecha_limite else "—",
            (hoy - t.fecha_limite).days if t.fecha_limite else 0,
        ]
        for t in qs
    ]
    kpis = [KPI("Tareas vencidas", str(len(filas)), "peligro" if filas else "exito")]
    columnas = [
        Columna("titulo", "Tarea", TEXTO, 2.6),
        Columna("lab", "Laboratorio", TEXTO, 1.6),
        Columna("estado", "Estado", TEXTO, 1.2),
        Columna("prog", "Avance", PORCENTAJE, 0.8),
        Columna("limite", "Fecha límite", FECHA, 1),
        Columna("dias", "Días de atraso", NUMERO, 1),
    ]
    return Resultado(columnas, filas, [], kpis)


# ════════════════════════════════════════════════════════
#  OBJETOS PERDIDOS
# ════════════════════════════════════════════════════════


@registrar("objetos_estado", "Objetos perdidos por estado", "objetos",
           "En custodia, entregados y anulados, con la tasa de entrega.", ["rango"], icono="search")
def objetos_estado(f: Filtros) -> Resultado:
    qs = f.entre(ObjetoPerdido.objects.all(), "fecha_hallazgo")
    datos = _por_choices(qs, "estado", EstadoObjeto.choices)
    etiquetas = [e for _, e, _ in datos]
    valores = [n for _, _, n in datos]
    cuenta = {v: n for v, _, n in datos}
    total = sum(valores)
    entregados = cuenta.get("entregado", 0)
    tasa = round(100 * entregados / total) if total else 0
    graf = [Grafico(DONA, "Objetos por estado", etiquetas=etiquetas, series=[serie("n", valores)])]
    kpis = [
        KPI("Objetos registrados", str(total), "info"),
        KPI("En custodia", str(cuenta.get("en_custodia", 0)), "aviso"),
        KPI("Entregados", str(entregados), "exito"),
        KPI("Tasa de entrega", f"{tasa}%", "marca"),
    ]
    columnas = [Columna("estado", "Estado", TEXTO, 2), Columna("n", "Cantidad", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("objetos_tiempo", "Objetos perdidos en el tiempo", "objetos",
           "Cuántos objetos se registran por periodo.", ["rango", "agrupar"], icono="search")
def objetos_tiempo(f: Filtros) -> Resultado:
    qs = f.entre(ObjetoPerdido.objects.all(), "fecha_hallazgo")
    etiquetas, valores = _serie_tiempo(qs, "fecha_hallazgo", f.agrupar or "mes")
    graf = [Grafico(LINEAS, "Objetos registrados", etiquetas=etiquetas, series=[serie("Registrados", valores)], ancho=2)]
    kpis = [KPI("Total registrados", str(sum(valores)), "info")]
    columnas = [Columna("periodo", "Periodo", TEXTO, 2), Columna("n", "Registrados", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


# ════════════════════════════════════════════════════════
#  USUARIOS Y SISTEMA
# ════════════════════════════════════════════════════════


@registrar("usuarios_rol", "Usuarios por rol", "sistema",
           "Cuántos usuarios hay por rol y cuántos están activos.", [], icono="people")
def usuarios_rol(f: Filtros) -> Resultado:
    from apps.core.roles import Rol

    filas_bd = (
        Usuario.objects.values("rol")
        .annotate(total=Count("id"), activos=Count("id", filter=Q(is_active=True)))
    )
    por_rol = {r["rol"]: r for r in filas_bd}
    etiquetas, valores, filas = [], [], []
    for valor, etiqueta in Rol.choices:
        r = por_rol.get(valor, {"total": 0, "activos": 0})
        etiquetas.append(etiqueta)
        valores.append(r["total"])
        filas.append([etiqueta, r["total"], r["activos"], r["total"] - r["activos"]])
    graf = [Grafico(BARRAS, "Usuarios por rol", etiquetas=etiquetas, series=[serie("Usuarios", valores)], ancho=2)]
    total = sum(valores)
    activos = sum(r["activos"] for r in por_rol.values())
    kpis = [KPI("Usuarios", str(total), "info"), KPI("Activos", str(activos), "exito"),
            KPI("Inactivos", str(total - activos), "neutro")]
    columnas = [Columna("rol", "Rol", TEXTO, 2), Columna("tot", "Total", NUMERO, 1),
                Columna("act", "Activos", NUMERO, 1), Columna("inact", "Inactivos", NUMERO, 1)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("notificaciones_tipo", "Notificaciones por tipo", "sistema",
           "Volumen de notificaciones enviadas por tipo y en el tiempo.", ["rango", "agrupar"], icono="bell")
def notificaciones_tipo(f: Filtros) -> Resultado:
    qs = f.entre(Notificacion.objects.all(), "creado_en")
    datos = _por_choices(qs, "tipo", TipoNotificacion.choices)
    datos = [d for d in datos if d[2] > 0]
    etiquetas = [e for _, e, _ in datos]
    valores = [n for _, _, n in datos]
    graf = [Grafico(BARRAS, "Notificaciones por tipo", etiquetas=etiquetas, series=[serie("n", valores)], ancho=2)]
    etq_t, val_t = _serie_tiempo(qs, "creado_en", f.agrupar or "mes")
    graf.append(Grafico(LINEAS, "Notificaciones en el tiempo", etiquetas=etq_t, series=[serie("Enviadas", val_t)], ancho=2))
    kpis = [KPI("Notificaciones", str(sum(valores)), "info")]
    columnas = [Columna("tipo", "Tipo", TEXTO, 2), Columna("n", "Cantidad", NUMERO, 1)]
    filas = [[e, n] for e, n in zip(etiquetas, valores, strict=True)]
    return Resultado(columnas, filas, graf, kpis)


@registrar("respaldos_historial", "Historial de respaldos", "sistema",
           "Respaldos de la base de datos, con su tamaño y origen.", ["rango"], icono="database")
def respaldos_historial(f: Filtros) -> Resultado:
    qs = f.entre(Respaldo.objects.all(), "creado_en").order_by("-creado_en")[:500]
    filas = []
    total_bytes = 0
    for r in qs:
        total_bytes += r.tamano_bytes or 0
        filas.append([
            timezone.localtime(r.creado_en).strftime("%d/%m/%Y %H:%M"),
            r.archivo,
            _tamano(r.tamano_bytes),
            dict(Respaldo._meta.get_field("origen").choices or []).get(r.origen, r.origen),
        ])
    kpis = [KPI("Respaldos", str(len(filas)), "info"),
            KPI("Espacio total", _tamano(total_bytes), "marca")]
    columnas = [
        Columna("fecha", "Fecha", FECHA, 1.4),
        Columna("archivo", "Archivo", TEXTO, 2.4),
        Columna("tam", "Tamaño", TEXTO, 1),
        Columna("origen", "Origen", TEXTO, 1),
    ]
    return Resultado(columnas, filas, [], kpis)


def _tamano(n: int | None) -> str:
    n = n or 0
    for unidad in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f} {unidad}" if unidad == "B" else f"{n:.1f} {unidad}"
        n /= 1024
    return f"{n:.1f} TB"


def periodos_disponibles() -> list[dict]:
    """Para el filtro de periodo en la web."""
    return [
        {"id": p.id, "nombre": p.nombre, "vigente": p.vigente}
        for p in PeriodoAcademico.objects.order_by("-fecha_inicio")
    ]


def laboratorios_disponibles() -> list[dict]:
    return [
        {"id": lab.id, "nombre": lab.nombre}
        for lab in Laboratorio.objects.filter(activo=True).order_by("nombre")
    ]
