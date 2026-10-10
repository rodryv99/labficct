from django.contrib import admin

from .models import BloqueReserva, Docente, ExcepcionHorario, Horario, Materia, PeriodoAcademico, Reserva


@admin.register(PeriodoAcademico)
class PeriodoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "fecha_inicio", "fecha_fin", "vigente"]


@admin.register(Materia)
class MateriaAdmin(admin.ModelAdmin):
    list_display = ["sigla", "nombre"]
    search_fields = ["sigla", "nombre"]


@admin.register(Docente)
class DocenteAdmin(admin.ModelAdmin):
    list_display = ["apellidos", "nombres", "email", "usuario", "activo"]
    search_fields = ["nombres", "apellidos", "email"]
    raw_id_fields = ["usuario"]


@admin.register(Horario)
class HorarioAdmin(admin.ModelAdmin):
    list_display = ["materia", "grupo", "laboratorio", "dia_semana", "hora_inicio", "hora_fin", "activo"]
    list_filter = ["periodo", "laboratorio", "dia_semana", "activo"]


@admin.register(ExcepcionHorario)
class ExcepcionAdmin(admin.ModelAdmin):
    list_display = ["horario", "fecha", "motivo", "reserva"]


class BloqueInline(admin.TabularInline):
    model = BloqueReserva
    extra = 0
    fields = ["laboratorio", "inicio", "fin", "activo"]


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = ["titulo", "estado", "requiere_apoyo", "creado_en"]
    list_filter = ["estado", "requiere_apoyo"]
    # El estado se cambia desde la web (aprobar, cancelar): así se actualizan también
    # los bloques y las clases suspendidas.
    readonly_fields = ["estado", "aprobada_por", "aprobada_en"]
    inlines = [BloqueInline]
