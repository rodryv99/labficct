"""Rutas raíz. Los prefijos salen del .env (API_PREFIX, ADMIN_URL)."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Laboratorios FICCT · Administración técnica"
admin.site.site_title = "Laboratorios FICCT"

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path(settings.API_PREFIX, include("config.api_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
