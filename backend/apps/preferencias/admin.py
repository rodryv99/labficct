from django.contrib import admin

from .models import OpcionPreferencia, PreferenciasDocente


@admin.register(OpcionPreferencia)
class OpcionPreferenciaAdmin(admin.ModelAdmin):
    list_display = ["pregunta", "orden", "activa"]
    list_editable = ["orden", "activa"]


@admin.register(PreferenciasDocente)
class PreferenciasDocenteAdmin(admin.ModelAdmin):
    list_display = ["docente", "actualizado_en"]
    search_fields = ["docente__nombres", "docente__apellidos"]
