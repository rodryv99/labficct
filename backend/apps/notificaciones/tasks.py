"""Tareas periódicas de Celery. El horario está en CELERY_BEAT_SCHEDULE (config/settings/base.py)."""

from celery import shared_task


@shared_task(name="notificaciones.avisos_de_aulas")
def avisos_de_aulas():
    from .avisos import avisos_de_aulas as enviar

    return enviar()


@shared_task(name="notificaciones.limpiar")
def limpiar_notificaciones():
    from .services import limpiar

    return limpiar()


@shared_task(name="notificaciones.push")
def enviar_push(ids, *, titulo, mensaje="", enlace="", datos=None, tipo=""):
    """Envía un push por FCM a esos usuarios. Lo encola `notificar(push=True)`."""
    from . import push

    return push.enviar_push_a(ids, titulo=titulo, mensaje=mensaje, enlace=enlace, datos=datos or {}, tipo=tipo)


@shared_task(name="notificaciones.recordatorio_turno")
def recordatorio_turno():
    """Avisa a cada auxiliar que su turno está por empezar (cada minuto revisa)."""
    from .turnos import recordatorios

    return recordatorios()
