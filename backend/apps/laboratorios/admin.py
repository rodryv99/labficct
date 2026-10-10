from django.contrib import admin

from .models import CredencialLaboratorio, ElementoLaboratorio, Laboratorio, Software, TipoElemento


@admin.register(TipoElemento)
class TipoElementoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "categoria", "icono", "activo"]
    list_filter = ["categoria", "activo"]
    search_fields = ["nombre"]


class ElementoInline(admin.TabularInline):
    model = ElementoLaboratorio
    extra = 0
    fields = ["fila", "columna", "tipo", "etiqueta", "ip", "estado"]


@admin.register(Laboratorio)
class LaboratorioAdmin(admin.ModelAdmin):
    list_display = ["codigo", "nombre", "ubicacion", "capacidad", "estado", "activo"]
    list_filter = ["estado", "activo"]
    search_fields = ["codigo", "nombre"]
    filter_horizontal = ["software"]
    inlines = [ElementoInline]


@admin.register(Software)
class SoftwareAdmin(admin.ModelAdmin):
    list_display = ["nombre", "version"]
    search_fields = ["nombre"]


@admin.register(CredencialLaboratorio)
class CredencialAdmin(admin.ModelAdmin):
    list_display = ["laboratorio", "descripcion", "usuario"]
    exclude = ["password_cifrado"]
