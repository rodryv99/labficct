from django.contrib import admin

from .models import DispositivoPush, Notificacion, PreferenciaPush


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ["titulo", "destinatario", "tipo", "creado_en", "leida_en"]
    list_filter = ["tipo"]
    search_fields = ["titulo", "mensaje", "destinatario__email"]
    readonly_fields = ["creado_en"]


@admin.register(DispositivoPush)
class DispositivoPushAdmin(admin.ModelAdmin):
    list_display = ["usuario", "plataforma", "activo", "visto_en"]
    list_filter = ["plataforma", "activo"]
    search_fields = ["usuario__email", "token"]
    readonly_fields = ["creado_en", "visto_en"]


@admin.register(PreferenciaPush)
class PreferenciaPushAdmin(admin.ModelAdmin):
    list_display = ["usuario", "habilitado", "solo_en_turno", "actualizado_en"]
    list_filter = ["habilitado", "solo_en_turno"]
    search_fields = ["usuario__email"]
