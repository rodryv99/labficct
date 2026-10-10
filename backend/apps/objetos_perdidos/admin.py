from django.contrib import admin

from .models import EventoObjeto, ObjetoPerdido


class EventoInline(admin.TabularInline):
    model = EventoObjeto
    extra = 0
    can_delete = False
    readonly_fields = ["tipo", "detalle", "usuario", "fecha"]

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ObjetoPerdido)
class ObjetoPerdidoAdmin(admin.ModelAdmin):
    list_display = ["id", "descripcion", "categoria", "laboratorio", "fecha_hallazgo", "estado"]
    list_filter = ["estado", "categoria", "laboratorio"]
    search_fields = ["descripcion", "caracteristicas"]
    inlines = [EventoInline]

    def has_delete_permission(self, request, obj=None):
        return False
