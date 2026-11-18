"""Tarea periódica: un respaldo automático. El horario está en CELERY_BEAT_SCHEDULE.

Si el servidor todavía no tiene pg_dump, la tarea no rompe el worker: registra el aviso
y termina. El Admin puede generar respaldos a mano desde la web o la app cuando quiera.
"""

import logging

from celery import shared_task

from apps.core.errores import ErrorNegocio

from . import services

log = logging.getLogger(__name__)


@shared_task(name="respaldos.automatico")
def respaldo_automatico():
    try:
        respaldo = services.generar(usuario=None, origen="automatico")
    except ErrorNegocio as e:
        log.warning("Respaldo automático no realizado: %s", e.mensaje)
        return {"ok": False, "motivo": e.codigo}
    log.info("Respaldo automático creado: %s", respaldo.archivo)
    return {"ok": True, "archivo": respaldo.archivo}
