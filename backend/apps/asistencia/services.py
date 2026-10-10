"""Solicitudes de asistencia: se piden, un auxiliar las toma y luego las resuelve.
Cada paso avisa a la otra parte."""

from django.db import transaction
from django.utils import timezone

from apps.core.errores import ErrorNegocio
from apps.core.permisos import tiene_permiso
from apps.notificaciones.models import TipoNotificacion
from apps.notificaciones.services import auxiliares, notificar

from .models import ABIERTAS, EstadoSolicitud, SolicitudAsistencia


def _enlace(solicitud) -> str:
    return f"/asistencia?id={solicitud.pk}"


def _datos(solicitud) -> dict:
    return {"solicitud_id": solicitud.pk}


def _bloquear(solicitud) -> SolicitudAsistencia:
    # of=("self",): PostgreSQL no permite FOR UPDATE sobre el lado nulo del LEFT JOIN de laboratorio.
    return (
        SolicitudAsistencia.objects.select_for_update(of=("self",))
        .select_related("laboratorio")
        .get(pk=solicitud.pk)
    )


@transaction.atomic
def solicitar(*, datos: dict, usuario) -> SolicitudAsistencia:
    if not datos.get("laboratorio") and not (datos.get("lugar") or "").strip():
        raise ErrorNegocio(
            "Indica el laboratorio o escribe dónde estás.",
            codigo="sin_lugar",
            campos={"lugar": ["Indica el laboratorio o escribe dónde estás."]},
        )
    solicitud = SolicitudAsistencia.objects.create(
        **datos, solicitante=usuario, creado_por=usuario, actualizado_por=usuario
    )
    urgente = "Urgente · " if solicitud.urgente else ""
    notificar(
        auxiliares(),
        tipo=TipoNotificacion.ASISTENCIA,
        titulo=f"{urgente}Asistencia en {solicitud.donde}",
        mensaje=f"{solicitud.get_categoria_display()}: {solicitud.descripcion}\nSolicita: {usuario.nombre_completo}.",
        enlace=_enlace(solicitud),
        datos=_datos(solicitud),
        excepto=usuario,
    )
    return solicitud


@transaction.atomic
def tomar(*, solicitud: SolicitudAsistencia, usuario) -> SolicitudAsistencia:
    """Un auxiliar avisa que va a atenderla."""
    solicitud = _bloquear(solicitud)
    if solicitud.estado != EstadoSolicitud.PENDIENTE:
        quien = f" por {solicitud.atendida_por.nombre_completo}" if solicitud.atendida_por_id else ""
        raise ErrorNegocio(f"Esta solicitud ya fue tomada{quien}.", codigo="ya_tomada")
    solicitud.estado = EstadoSolicitud.EN_CURSO
    solicitud.atendida_por = usuario
    solicitud.atendida_en = timezone.now()
    solicitud.actualizado_por = usuario
    solicitud.save()
    notificar(
        [solicitud.solicitante_id],
        tipo=TipoNotificacion.ASISTENCIA,
        titulo=f"{usuario.nombre_completo} va en camino",
        mensaje=f"Atiende tu solicitud en {solicitud.donde}.",
        enlace=_enlace(solicitud),
        datos=_datos(solicitud),
        excepto=usuario,
    )
    return solicitud


@transaction.atomic
def resolver(*, solicitud: SolicitudAsistencia, usuario, respuesta: str = "") -> SolicitudAsistencia:
    solicitud = _bloquear(solicitud)
    if solicitud.estado not in ABIERTAS:
        raise ErrorNegocio("Esta solicitud ya está cerrada.", codigo="ya_cerrada")
    ahora = timezone.now()
    if not solicitud.atendida_por_id:
        solicitud.atendida_por = usuario
        solicitud.atendida_en = ahora
    solicitud.estado = EstadoSolicitud.RESUELTA
    solicitud.cerrada_en = ahora
    solicitud.respuesta = respuesta.strip()
    solicitud.actualizado_por = usuario
    solicitud.save()
    notificar(
        [solicitud.solicitante_id],
        tipo=TipoNotificacion.ASISTENCIA,
        titulo=f"Resuelta: tu solicitud en {solicitud.donde}",
        mensaje=solicitud.respuesta or f"La atendió {usuario.nombre_completo}.",
        enlace=_enlace(solicitud),
        datos=_datos(solicitud),
        excepto=usuario,
    )
    return solicitud


@transaction.atomic
def cancelar(*, solicitud: SolicitudAsistencia, usuario) -> SolicitudAsistencia:
    """La cancela quien la pidió (ya no hace falta). Quien atiende también puede cerrarla así."""
    solicitud = _bloquear(solicitud)
    if solicitud.solicitante_id != usuario.pk and not tiene_permiso(usuario, "asistencia.atender"):
        raise ErrorNegocio("Solo quien la pidió puede cancelarla.", codigo="no_es_tuya", status_code=403)
    if solicitud.estado not in ABIERTAS:
        raise ErrorNegocio("Esta solicitud ya está cerrada.", codigo="ya_cerrada")
    solicitud.estado = EstadoSolicitud.CANCELADA
    solicitud.cerrada_en = timezone.now()
    solicitud.actualizado_por = usuario
    solicitud.save()
    avisar_a = [solicitud.atendida_por_id, solicitud.solicitante_id]
    notificar(
        avisar_a,
        tipo=TipoNotificacion.ASISTENCIA,
        titulo=f"Cancelada: solicitud de asistencia en {solicitud.donde}",
        mensaje=f"La canceló {usuario.nombre_completo}.",
        enlace=_enlace(solicitud),
        datos=_datos(solicitud),
        excepto=usuario,
    )
    return solicitud
