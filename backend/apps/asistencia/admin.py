from django.contrib import admin

from .models import SolicitudAsistencia


@admin.register(SolicitudAsistencia)
class SolicitudAsistenciaAdmin(admin.ModelAdmin):
    list_display = ["id", "solicitante", "laboratorio", "categoria", "urgente", "estado", "creado_en"]
    list_filter = ["estado", "categoria", "urgente"]
    search_fields = ["descripcion", "lugar"]
