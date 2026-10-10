from django.contrib import admin

from .models import Notificacion


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ["titulo", "destinatario", "tipo", "creado_en", "leida_en"]
    list_filter = ["tipo"]
    search_fields = ["titulo", "mensaje", "destinatario__email"]
    readonly_fields = ["creado_en"]
