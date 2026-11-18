from django.contrib import admin

from .models import (
    AsignacionHorario,
    AsignacionLugar,
    BloqueHorario,
    HorarioTrabajo,
    LugarAsistencia,
    Marcacion,
)


@admin.register(LugarAsistencia)
class LugarAsistenciaAdmin(admin.ModelAdmin):
    list_display = ["nombre", "latitud", "longitud", "radio_m", "predeterminado", "activo"]
    list_filter = ["activo", "predeterminado"]
    search_fields = ["nombre", "referencia"]


@admin.register(AsignacionLugar)
class AsignacionLugarAdmin(admin.ModelAdmin):
    list_display = ["usuario", "lugar"]
    list_select_related = ["usuario", "lugar"]


@admin.register(Marcacion)
class MarcacionAdmin(admin.ModelAdmin):
    list_display = ["usuario", "fecha", "lugar", "entrada_en", "salida_en", "salida_manual"]
    list_filter = ["lugar", "salida_manual", "fecha"]
    search_fields = ["usuario__nombres", "usuario__apellidos"]
    list_select_related = ["usuario", "lugar"]


class BloqueHorarioInline(admin.TabularInline):
    model = BloqueHorario
    extra = 1


@admin.register(HorarioTrabajo)
class HorarioTrabajoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "activo"]
    list_filter = ["activo"]
    search_fields = ["nombre", "descripcion"]
    inlines = [BloqueHorarioInline]


@admin.register(AsignacionHorario)
class AsignacionHorarioAdmin(admin.ModelAdmin):
    list_display = ["usuario", "horario"]
    list_select_related = ["usuario", "horario"]
