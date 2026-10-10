"""Punto de entrada ASGI. En la fase de notificaciones se suma Django Channels
(WebSocket bajo WS_PREFIX) a este mismo archivo."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

application = get_asgi_application()
