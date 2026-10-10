from django.contrib import admin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    """Panel técnico de respaldo. La gestión diaria se hace desde la web."""

    list_display = ["email", "nombres", "apellidos", "rol", "is_active", "last_login"]
    list_filter = ["rol", "is_active"]
    search_fields = ["email", "nombres", "apellidos", "codigo"]
    readonly_fields = ["password", "last_login", "creado_en", "actualizado_en"]
    fieldsets = [
        (None, {"fields": ["email", "codigo", "password"]}),
        ("Datos personales", {"fields": ["nombres", "apellidos", "telefono"]}),
        ("Acceso", {"fields": ["rol", "is_active", "is_staff", "is_superuser"]}),
        ("Registro", {"fields": ["last_login", "creado_en", "actualizado_en"]}),
    ]
