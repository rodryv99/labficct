"""Reglas del control de asistencia.

Para marcar, el auxiliar debe confirmar su huella en el teléfono y estar dentro del radio
de su lugar. La huella la verifica el propio teléfono (nunca sale de él): la app solo
informa si la confirmó. La ubicación sí se comprueba aquí, en el servidor.
"""

import math

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.errores import ErrorNegocio
from apps.core.roles import Rol
from apps.inventario import hojas
from apps.usuarios.models import Usuario

from .models import AsignacionLugar, LugarAsistencia, Marcacion

RADIO_TIERRA_M = 6_371_000

FORMATOS = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv; charset=utf-8",
    "pdf": "application/pdf",
}
ENCABEZADOS = [
    "Auxiliar",
    "Fecha",
    "Lugar",
    "Entrada",
    "Retraso (min)",
    "Distancia al entrar (m)",
    "Salida",
    "Distancia al salir (m)",
    "Horas",
    "Observación",
]


def distancia_m(latitud_1: float, longitud_1: float, latitud_2: float, longitud_2: float) -> float:
    """Metros entre dos puntos del mapa (fórmula del semiverseno)."""
    f1, f2 = math.radians(latitud_1), math.radians(latitud_2)
    d_latitud = f2 - f1
    d_longitud = math.radians(longitud_2 - longitud_1)
    a = math.sin(d_latitud / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(d_longitud / 2) ** 2
    return 2 * RADIO_TIERRA_M * math.asin(min(1.0, math.sqrt(a)))


def precision_maxima_m() -> int:
    """Con un GPS más impreciso que esto no se acepta la marca."""
    return int(getattr(settings, "MARCACION_PRECISION_MAXIMA_M", 150))


def _hora(momento) -> str:
    return timezone.localtime(momento).strftime("%H:%M")


def tolerancia_min() -> int:
    """Minutos de tolerancia del horario (entrada antes del inicio / salida tras el fin)."""
    return int(getattr(settings, "MARCACION_TOLERANCIA_MIN", 15))


def _hhmm(t) -> str:
    """Una hora (datetime.time) como "HH:MM"."""
    return t.strftime("%H:%M")


def _minutos(t) -> int:
    """Una hora (datetime.time) como minutos desde medianoche."""
    return t.hour * 60 + t.minute


def _min_a_hora(minutos: int) -> str:
    """420 → "07:00"."""
    minutos = max(0, minutos) % (24 * 60)
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def duracion(minutos: int | None) -> str:
    """90 → "1:30"."""
    if minutos is None:
        return ""
    return f"{minutos // 60}:{minutos % 60:02d}"


# ── Lugares ─────────────────────────────────────────────


def lugar_predeterminado() -> LugarAsistencia | None:
    return LugarAsistencia.objects.filter(predeterminado=True, activo=True).first()


def lugar_de(usuario) -> LugarAsistencia | None:
    """Dónde debe marcar: su lugar propio (si está activo) o, si no, el predeterminado."""
    asignacion = AsignacionLugar.objects.select_related("lugar").filter(usuario=usuario).first()
    if asignacion and asignacion.lugar.activo:
        return asignacion.lugar
    return lugar_predeterminado()


def quitar_otros_predeterminados(excepto=None) -> None:
    """Antes de guardar un lugar como predeterminado: solo puede haber uno."""
    otros = LugarAsistencia.objects.filter(predeterminado=True)
    if excepto is not None:
        otros = otros.exclude(pk=excepto.pk)
    otros.update(predeterminado=False)


@transaction.atomic
def eliminar_lugar(lugar: LugarAsistencia) -> None:
    if lugar.marcaciones.exists():
        raise ErrorNegocio(
            "Este lugar ya tiene marcaciones registradas. Desactívalo en vez de eliminarlo.",
            codigo="protegido",
            status_code=409,
        )
    # Sus asignaciones se borran con él: esos auxiliares vuelven al lugar predeterminado.
    lugar.delete()


@transaction.atomic
def asignar(*, auxiliar, lugar: LugarAsistencia | None, usuario) -> None:
    """Le pone a un auxiliar su lugar propio; con None vuelve al predeterminado."""
    if auxiliar.rol != Rol.AUXILIAR:
        raise ErrorNegocio("Solo los auxiliares tienen lugar de asistencia.", codigo="no_es_auxiliar")
    if lugar is None:
        AsignacionLugar.objects.filter(usuario=auxiliar).delete()
        return
    if not lugar.activo:
        raise ErrorNegocio(
            "Ese lugar está desactivado. Actívalo o elige otro.",
            codigo="lugar_inactivo",
            campos={"lugar": ["Ese lugar está desactivado."]},
        )
    asignacion = AsignacionLugar.objects.filter(usuario=auxiliar).first()
    if asignacion is None:
        AsignacionLugar.objects.create(usuario=auxiliar, lugar=lugar, creado_por=usuario, actualizado_por=usuario)
    else:
        asignacion.lugar = lugar
        asignacion.actualizado_por = usuario
        asignacion.save()


def auxiliares_con_lugar() -> list[dict]:
    """Cada auxiliar activo con su lugar y cómo va hoy (sin marcar, presente o ya salió)."""
    hoy = timezone.localdate()
    predeterminado = lugar_predeterminado()
    propios = {a.usuario_id: a.lugar for a in AsignacionLugar.objects.select_related("lugar")}
    de_hoy: dict[int, list[Marcacion]] = {}
    for marcacion in Marcacion.objects.filter(fecha=hoy).order_by("entrada_en"):
        de_hoy.setdefault(marcacion.usuario_id, []).append(marcacion)

    filas = []
    auxiliares = list(Usuario.objects.filter(rol=Rol.AUXILIAR, is_active=True).order_by("apellidos", "nombres"))
    horarios = horarios_de([a.pk for a in auxiliares])
    for auxiliar in auxiliares:
        propio = propios.get(auxiliar.pk)
        horario = horarios.get(auxiliar.pk)
        efectivo = propio if (propio is not None and propio.activo) else predeterminado
        marcas = de_hoy.get(auxiliar.pk, [])
        ultima = marcas[-1] if marcas else None
        if ultima is None:
            situacion = "sin_marcar"
        elif ultima.salida_en is None:
            situacion = "presente"
        else:
            situacion = "salio"
        minutos = sum(m.minutos or 0 for m in marcas)
        filas.append(
            {
                "id": auxiliar.pk,
                "nombre_completo": auxiliar.nombre_completo,
                "email": auxiliar.email,
                "lugar": propio.pk if propio is not None else None,
                "lugar_nombre": efectivo.nombre if efectivo is not None else "",
                "lugar_efectivo": efectivo.pk if efectivo is not None else None,
                "usa_predeterminado": propio is None or not propio.activo,
                "horario": horario.pk if horario is not None else None,
                "horario_nombre": horario.nombre if horario is not None else "",
                "situacion": situacion,
                "entrada_en": marcas[0].entrada_en if marcas else None,
                "salida_en": ultima.salida_en if ultima is not None else None,
                "minutos_hoy": minutos,
            }
        )
    return filas


# ── Marcar ──────────────────────────────────────────────


def abierta_de(usuario, hoy=None) -> Marcacion | None:
    """La entrada de hoy que todavía no tiene salida."""
    hoy = hoy or timezone.localdate()
    return (
        Marcacion.objects.select_related("lugar", "usuario")
        .filter(usuario=usuario, fecha=hoy, salida_en__isnull=True)
        .order_by("-entrada_en")
        .first()
    )


def estado(usuario) -> dict:
    """Lo que la app necesita para pintar la pantalla de marcar."""
    hoy = timezone.localdate()
    de_hoy = list(
        Marcacion.objects.select_related("lugar", "usuario").filter(usuario=usuario, fecha=hoy).order_by("entrada_en")
    )
    abierta = next((m for m in reversed(de_hoy) if m.salida_en is None), None)
    # Con una entrada abierta, la salida se marca en el mismo lugar donde se entró.
    lugar = abierta.lugar if abierta is not None else lugar_de(usuario)
    return {
        "lugar": lugar,
        "abierta": abierta,
        "hoy": de_hoy,
        "minutos_hoy": sum(m.minutos or 0 for m in de_hoy),
        "precision_maxima_m": precision_maxima_m(),
        "ahora": timezone.now(),
    }


@transaction.atomic
def marcar(
    *,
    usuario,
    tipo: str,
    latitud: float,
    longitud: float,
    precision_m: float | None = None,
    biometria: bool = False,
    simulada: bool = False,
) -> Marcacion:
    """Registra la entrada o la salida del auxiliar, si está en su lugar."""
    if usuario.rol != Rol.AUXILIAR:
        raise ErrorNegocio("Solo los auxiliares marcan asistencia.", codigo="no_es_auxiliar", status_code=403)
    if not biometria:
        raise ErrorNegocio("Confirma tu huella en el teléfono para marcar.", codigo="sin_huella")
    if simulada:
        raise ErrorNegocio(
            "El teléfono está usando una ubicación simulada. Desactívala para marcar.",
            codigo="ubicacion_simulada",
        )
    maxima = precision_maxima_m()
    if precision_m is not None and precision_m > maxima:
        raise ErrorNegocio(
            f"La señal del GPS es muy imprecisa (± {round(precision_m)} m). "
            "Acércate a una ventana o sal a un lugar abierto e intenta de nuevo.",
            codigo="gps_impreciso",
            extra={"precision_m": round(precision_m), "precision_maxima_m": maxima},
        )

    # Bloquea al usuario: dos toques seguidos no crean dos entradas.
    Usuario.objects.select_for_update().get(pk=usuario.pk)
    ahora = timezone.now()
    hoy = timezone.localdate()
    abierta = abierta_de(usuario, hoy)

    if tipo == "entrada":
        if abierta is not None:
            raise ErrorNegocio(
                f"Ya marcaste tu entrada a las {_hora(abierta.entrada_en)}. Marca la salida antes de volver a entrar.",
                codigo="entrada_repetida",
            )
        lugar = lugar_de(usuario)
        if lugar is None:
            raise ErrorNegocio(
                "Todavía no tienes un lugar de asistencia. Pídele al administrador que te asigne uno.",
                codigo="sin_lugar",
            )
    else:
        if abierta is None:
            raise ErrorNegocio("No tienes una entrada marcada hoy. Marca primero tu entrada.", codigo="sin_entrada")
        lugar = abierta.lugar

    distancia = distancia_m(latitud, longitud, lugar.latitud, lugar.longitud)
    if distancia > lugar.radio_m:
        raise ErrorNegocio(
            f"Estás a {round(distancia)} m de {lugar.nombre}. Para marcar debes estar a {lugar.radio_m} m o menos.",
            codigo="fuera_de_lugar",
            extra={"distancia_m": round(distancia), "radio_m": lugar.radio_m},
        )

    if tipo == "entrada":
        # Según su horario: ¿puede marcar ya? ¿llega con retraso?
        turno_inicio = turno_fin = None
        retraso = 0
        bloque = bloque_para(usuario, ahora)
        if bloque is not None:
            t = _minutos(timezone.localtime(ahora).time())
            ini = _minutos(bloque.inicio)
            tol = tolerancia_min()
            if t < ini - tol:
                raise ErrorNegocio(
                    f"Tu turno es de {_hhmm(bloque.inicio)} a {_hhmm(bloque.fin)}. "
                    f"Puedes marcar tu entrada desde las {_min_a_hora(ini - tol)}.",
                    codigo="fuera_de_horario_entrada",
                    extra={
                        "turno_inicio": _hhmm(bloque.inicio),
                        "turno_fin": _hhmm(bloque.fin),
                        "desde": _min_a_hora(ini - tol),
                    },
                )
            turno_inicio = bloque.inicio
            turno_fin = bloque.fin
            retraso = max(0, t - ini)
        return Marcacion.objects.create(
            usuario=usuario,
            lugar=lugar,
            fecha=hoy,
            entrada_en=ahora,
            entrada_latitud=latitud,
            entrada_longitud=longitud,
            entrada_precision_m=precision_m,
            entrada_distancia_m=round(distancia, 1),
            turno_inicio=turno_inicio,
            turno_fin=turno_fin,
            retraso_min=retraso,
            creado_por=usuario,
            actualizado_por=usuario,
        )

    # Salida: si tenía turno, calcula cuántos minutos salió antes del fin (no se bloquea).
    if abierta.turno_fin is not None:
        t = _minutos(timezone.localtime(ahora).time())
        abierta.salida_temprana_min = max(0, _minutos(abierta.turno_fin) - t)
    abierta.salida_en = ahora
    abierta.salida_latitud = latitud
    abierta.salida_longitud = longitud
    abierta.salida_precision_m = precision_m
    abierta.salida_distancia_m = round(distancia, 1)
    abierta.actualizado_por = usuario
    abierta.save()
    return abierta


@transaction.atomic
def cerrar(*, marcacion: Marcacion, usuario, salida_en, nota: str) -> Marcacion:
    """El Admin pone la salida de una marcación que quedó abierta (el auxiliar olvidó marcarla)."""
    marcacion = Marcacion.objects.select_for_update().get(pk=marcacion.pk)
    if marcacion.salida_en is not None:
        raise ErrorNegocio("Esta marcación ya tiene salida.", codigo="ya_cerrada")
    nota = (nota or "").strip()
    if not nota:
        raise ErrorNegocio(
            "Escribe por qué pones la salida a mano.",
            codigo="sin_nota",
            campos={"nota": ["Escribe por qué pones la salida a mano."]},
        )
    if salida_en <= marcacion.entrada_en:
        mensaje = f"La salida debe ser posterior a la entrada ({_hora(marcacion.entrada_en)})."
        raise ErrorNegocio(mensaje, codigo="salida_invalida", campos={"salida_en": [mensaje]})
    if salida_en > timezone.now():
        mensaje = "La salida no puede estar en el futuro."
        raise ErrorNegocio(mensaje, codigo="salida_invalida", campos={"salida_en": [mensaje]})
    marcacion.salida_en = salida_en
    marcacion.salida_manual = True
    marcacion.nota = nota
    marcacion.actualizado_por = usuario
    marcacion.save()
    return marcacion


# ── Reportes ────────────────────────────────────────────


def resumen(marcaciones) -> list[dict]:
    """Totales por auxiliar de las marcaciones dadas: días, horas y salidas que faltan."""
    por_usuario: dict[int, dict] = {}
    filas = marcaciones.order_by().values_list(
        "usuario_id",
        "usuario__nombres",
        "usuario__apellidos",
        "fecha",
        "entrada_en",
        "salida_en",
        "salida_manual",
        "retraso_min",
    )
    for usuario_id, nombres, apellidos, fecha, entrada_en, salida_en, manual, retraso in filas:
        fila = por_usuario.setdefault(
            usuario_id,
            {
                "usuario": usuario_id,
                "usuario_nombre": f"{nombres} {apellidos}".strip(),
                "apellidos": apellidos,
                "fechas": set(),
                "marcaciones": 0,
                "minutos": 0,
                "sin_salida": 0,
                "salidas_manuales": 0,
                "retrasos": 0,
                "retraso_total": 0,
                "retraso_max": 0,
            },
        )
        fila["fechas"].add(fecha)
        fila["marcaciones"] += 1
        if salida_en is None:
            fila["sin_salida"] += 1
        else:
            fila["minutos"] += max(0, int((salida_en - entrada_en).total_seconds() // 60))
        if manual:
            fila["salidas_manuales"] += 1
        if retraso and retraso > 0:
            fila["retrasos"] += 1
            fila["retraso_total"] += retraso
            fila["retraso_max"] = max(fila["retraso_max"], retraso)

    salida = []
    for fila in sorted(por_usuario.values(), key=lambda f: (f["apellidos"].lower(), f["usuario_nombre"].lower())):
        retrasos = fila["retrasos"]
        salida.append(
            {
                "usuario": fila["usuario"],
                "usuario_nombre": fila["usuario_nombre"],
                "dias": len(fila["fechas"]),
                "marcaciones": fila["marcaciones"],
                "minutos": fila["minutos"],
                "horas": duracion(fila["minutos"]),
                "sin_salida": fila["sin_salida"],
                "salidas_manuales": fila["salidas_manuales"],
                "retrasos": retrasos,
                "retraso_total_min": fila["retraso_total"],
                "retraso_max_min": fila["retraso_max"],
                "retraso_promedio_min": round(fila["retraso_total"] / retrasos) if retrasos else 0,
            }
        )
    return salida


def _metros(valor: float | None) -> str:
    return "" if valor is None else str(round(valor))


def exportar(marcaciones, formato: str, filtros: str = "") -> tuple[bytes, str, str]:
    """Devuelve (contenido, tipo MIME, nombre de archivo) con las marcaciones de la consulta."""
    if formato not in FORMATOS:
        raise ErrorNegocio("Formato no válido: usa xlsx, csv o pdf.", codigo="formato_invalido")
    filas = []
    for m in marcaciones.select_related("usuario", "lugar").order_by("usuario__apellidos", "usuario__nombres", "entrada_en"):
        if m.salida_en is None:
            observacion = "Sin salida"
        elif m.salida_manual:
            observacion = f"Salida puesta por el administrador: {m.nota}"
        else:
            observacion = m.nota
        filas.append(
            [
                m.usuario.nombre_completo,
                hojas.fecha_corta(m.fecha),
                m.lugar.nombre,
                _hora(m.entrada_en),
                str(m.retraso_min) if m.retraso_min else "",
                _metros(m.entrada_distancia_m),
                _hora(m.salida_en) if m.salida_en else "",
                _metros(m.salida_distancia_m),
                duracion(m.minutos),
                observacion,
            ]
        )
    ahora = timezone.localtime()
    nombre = f"asistencia-{ahora:%Y-%m-%d}.{formato}"
    if formato == "xlsx":
        contenido = hojas.escribir_xlsx(ENCABEZADOS, filas, "Asistencia")
    elif formato == "csv":
        contenido = hojas.escribir_csv(ENCABEZADOS, filas)
    else:
        total = f"{len(filas)} {'marcación' if len(filas) == 1 else 'marcaciones'}"
        subtitulo = " · ".join(p for p in [total, filtros, f"{ahora:%d/%m/%Y %H:%M}"] if p)
        contenido = hojas.escribir_pdf(
            "Asistencia de auxiliares",
            subtitulo,
            ENCABEZADOS,
            filas,
            [18, 8, 13, 7, 6, 8, 7, 8, 6, 19],
        )
    return contenido, FORMATOS[formato], nombre


# ── Horarios de trabajo ─────────────────────────────────

from .models import AsignacionHorario, BloqueHorario, HorarioTrabajo  # noqa: E402


def horario_de(usuario) -> HorarioTrabajo | None:
    """El horario de trabajo propio del auxiliar (si está activo); si no, None."""
    asignacion = (
        AsignacionHorario.objects.select_related("horario").filter(usuario=usuario).first()
    )
    if asignacion and asignacion.horario.activo:
        return asignacion.horario
    return None


def bloque_para(usuario, ahora) -> BloqueHorario | None:
    """El bloque del horario del auxiliar al que corresponde marcar entrada ahora.

    Elige el bloque de hoy en curso o el próximo (el primero cuyo fin no pasó aún). Si
    todos los bloques de hoy ya terminaron, devuelve el último (una entrada muy tardía se
    asocia a él y queda con un retraso grande). None = sin horario o sin bloques hoy.
    """
    horario = horario_de(usuario)
    if horario is None:
        return None
    local = timezone.localtime(ahora)
    t = _minutos(local.time())
    bloques = sorted(
        (b for b in horario.bloques.all() if b.dia == local.weekday()),
        key=lambda b: _minutos(b.inicio),
    )
    if not bloques:
        return None
    for b in bloques:
        if t <= _minutos(b.fin):
            return b
    return bloques[-1]


def validar_bloques(bloques: list[dict]) -> list[dict]:
    """Revisa que cada bloque tenga inicio < fin y que no se pisen dentro de un mismo día.

    Devuelve los bloques ordenados. Lanza ErrorNegocio con los mensajes de la pantalla.
    """
    from .models import DIAS_SEMANA

    nombres = dict(DIAS_SEMANA)
    if not bloques:
        raise ErrorNegocio(
            "Agrega al menos un bloque (un día con su hora de inicio y fin).",
            codigo="sin_bloques",
            campos={"bloques": ["Agrega al menos un bloque."]},
        )
    limpios = sorted(bloques, key=lambda b: (b["dia"], b["inicio"]))
    for b in limpios:
        if b["inicio"] >= b["fin"]:
            dia = nombres.get(b["dia"], "Ese día")
            raise ErrorNegocio(
                f"En {dia}, la hora de fin debe ser posterior a la de inicio.",
                codigo="bloque_invalido",
                campos={"bloques": [f"{dia}: la hora de fin debe ser posterior a la de inicio."]},
            )
    # Choques: dentro de cada día, el inicio de un bloque no puede caer antes del fin del anterior.
    por_dia: dict[int, list[dict]] = {}
    for b in limpios:
        por_dia.setdefault(b["dia"], []).append(b)
    for dia, lista in por_dia.items():
        for anterior, siguiente in zip(lista, lista[1:]):
            if siguiente["inicio"] < anterior["fin"]:
                raise ErrorNegocio(
                    f"En {nombres[dia]} hay dos bloques que se enciman.",
                    codigo="bloques_encimados",
                    campos={"bloques": [f"{nombres[dia]}: hay dos bloques que se enciman."]},
                )
    return limpios


@transaction.atomic
def guardar_horario(*, instancia: HorarioTrabajo | None, datos: dict, bloques: list[dict], usuario) -> HorarioTrabajo:
    """Crea o edita un horario y reemplaza todos sus bloques por los que llegan."""
    bloques = validar_bloques(bloques)
    if instancia is None:
        horario = HorarioTrabajo.objects.create(
            **datos, creado_por=usuario, actualizado_por=usuario
        )
    else:
        for campo, valor in datos.items():
            setattr(instancia, campo, valor)
        instancia.actualizado_por = usuario
        instancia.save()
        horario = instancia
        horario.bloques.all().delete()
    BloqueHorario.objects.bulk_create(
        [BloqueHorario(horario=horario, dia=b["dia"], inicio=b["inicio"], fin=b["fin"]) for b in bloques]
    )
    return horario


@transaction.atomic
def eliminar_horario(horario: HorarioTrabajo) -> None:
    """Borra un horario. Los auxiliares que lo tenían quedan sin horario."""
    horario.delete()


@transaction.atomic
def asignar_horario(*, auxiliar, horario: HorarioTrabajo | None, usuario) -> None:
    """Le pone a un auxiliar su horario de trabajo; con None se lo quita."""
    if auxiliar.rol != Rol.AUXILIAR:
        raise ErrorNegocio("Solo los auxiliares tienen horario de trabajo.", codigo="no_es_auxiliar")
    if horario is None:
        AsignacionHorario.objects.filter(usuario=auxiliar).delete()
        return
    if not horario.activo:
        raise ErrorNegocio(
            "Ese horario está desactivado. Actívalo o elige otro.",
            codigo="horario_inactivo",
            campos={"horario": ["Ese horario está desactivado."]},
        )
    asignacion = AsignacionHorario.objects.filter(usuario=auxiliar).first()
    if asignacion is None:
        AsignacionHorario.objects.create(
            usuario=auxiliar, horario=horario, creado_por=usuario, actualizado_por=usuario
        )
    else:
        asignacion.horario = horario
        asignacion.actualizado_por = usuario
        asignacion.save()


def horarios_de(usuarios_ids) -> dict[int, HorarioTrabajo]:
    """Mapa usuario_id → su horario propio (sin importar si está activo), para listas."""
    return {
        a.usuario_id: a.horario
        for a in AsignacionHorario.objects.select_related("horario").filter(usuario_id__in=usuarios_ids)
    }
