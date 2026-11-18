from django.contrib import admin

from .models import Activo, ItemVerificacion, Lugar, MovimientoActivo, TipoActivo, Verificacion


@admin.register(TipoActivo)
class TipoActivoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "activo"]
    search_fields = ["nombre"]


@admin.register(Lugar)
class LugarAdmin(admin.ModelAdmin):
    list_display = ["nombre", "tipo", "laboratorio", "activo"]
    list_filter = ["tipo", "activo"]
    search_fields = ["nombre"]


class MovimientoInline(admin.TabularInline):
    model = MovimientoActivo
    extra = 0
    can_delete = False
    readonly_fields = ["tipo", "fecha", "lugar_origen", "lugar_destino", "estado_anterior", "estado_nuevo"]
    fields = [*readonly_fields, "motivo", "documento"]


@admin.register(Activo)
class ActivoAdmin(admin.ModelAdmin):
    list_display = ["codigo", "descripcion", "tipo", "lugar", "estado"]
    list_filter = ["estado", "tipo", "lugar"]
    search_fields = ["codigo", "descripcion", "marca", "modelo", "serie"]
    inlines = [MovimientoInline]

    def has_delete_permission(self, request, obj=None):
        return False


class ItemInline(admin.TabularInline):
    model = ItemVerificacion
    extra = 0
    can_delete = False
    readonly_fields = ["activo", "codigo", "descripcion", "tipo_nombre", "lugar_nombre"]
    fields = [*readonly_fields, "resultado", "lugar_encontrado", "nota"]


@admin.register(Verificacion)
class VerificacionAdmin(admin.ModelAdmin):
    list_display = ["titulo", "estado", "fecha_limite", "creado_en"]
    list_filter = ["estado"]
    search_fields = ["titulo"]
    inlines = [ItemInline]
