from django.contrib import admin

from .models import Respaldo


@admin.register(Respaldo)
class RespaldoAdmin(admin.ModelAdmin):
    list_display = ["archivo", "origen", "tamano_bytes", "creado_en", "creado_por"]
    list_filter = ["origen"]
    search_fields = ["archivo", "nota"]
    list_select_related = ["creado_por"]
