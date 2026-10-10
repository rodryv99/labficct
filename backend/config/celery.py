"""Celery: tareas en segundo plano.

Las periódicas (avisos de aulas, revisiones que vencen, limpieza de notificaciones)
están en CELERY_BEAT_SCHEDULE; cada app define las suyas en su tasks.py.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("labficct")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
