from django.contrib import admin

from .models import AvanceTarea, Tarea


class AvanceInline(admin.TabularInline):
    model = AvanceTarea
    extra = 0
    readonly_fields = ["autor", "texto", "progreso", "estado_anterior", "estado_nuevo", "creado_en"]


@admin.register(Tarea)
class TareaAdmin(admin.ModelAdmin):
    list_display = ["titulo", "estado", "prioridad", "laboratorio", "fecha_limite", "progreso"]
    list_filter = ["estado", "prioridad", "laboratorio"]
    search_fields = ["titulo", "descripcion"]
    inlines = [AvanceInline]
