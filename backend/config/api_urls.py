"""Todas las rutas de la API, bajo API_PREFIX (por defecto /api/v1/)."""

from django.conf import settings
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.views import configuracion, salud

urlpatterns = [
    path("salud/", salud, name="salud"),
    path("configuracion/", configuracion, name="configuracion"),
    path("auth/", include("apps.usuarios.urls_auth")),
    path("", include("apps.usuarios.urls")),
    path("", include("apps.laboratorios.urls")),
    path("", include("apps.planificacion.urls")),
    path("", include("apps.objetos_perdidos.urls")),
    path("", include("apps.notificaciones.urls")),
    path("", include("apps.preferencias.urls")),
    path("", include("apps.asistencia.urls")),
    path("", include("apps.bitacora.urls")),
    path("", include("apps.tareas.urls")),
]

# El esquema OpenAPI y Swagger solo se publican en desarrollo.
if settings.DEBUG:
    urlpatterns += [
        path("schema/", SpectacularAPIView.as_view(), name="schema"),
        path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    ]
