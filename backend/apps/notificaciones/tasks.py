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
