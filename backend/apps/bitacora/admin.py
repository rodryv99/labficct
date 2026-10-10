from django.contrib import admin

from .models import EntradaBitacora, RevisionProgramada


@admin.register(EntradaBitacora)
class EntradaBitacoraAdmin(admin.ModelAdmin):
    list_display = ["titulo", "laboratorio", "tipo", "fecha", "creado_por"]
    list_filter = ["tipo", "laboratorio"]
    search_fields = ["titulo", "descripcion", "elementos"]


@admin.register(RevisionProgramada)
class RevisionProgramadaAdmin(admin.ModelAdmin):
    list_display = ["titulo", "laboratorio", "cada", "unidad", "proxima_fecha", "ultima_fecha", "activa"]
    list_filter = ["activa", "laboratorio"]
