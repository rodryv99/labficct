from django.conf import settings
from django.db import models

from apps.core.models import ModeloBase
from apps.laboratorios.models import Laboratorio


class EstadoTarea(models.TextChoices):
    PENDIENTE = "pendiente", "Pendiente"
    EN_PROGRESO = "en_progreso", "En progreso"
    HECHA = "hecha", "Hecha"


class Prioridad(models.TextChoices):
    BAJA = "baja", "Baja"
    NORMAL = "normal", "Normal"
    ALTA = "alta", "Alta"


class Tarea(ModeloBase):
    """Una tarjeta del pizarrón. Todos (Admin y auxiliares) la ven y anotan avances."""

    titulo = models.CharField("título", max_length=150)
    descripcion = models.TextField("descripción", blank=True)
    estado = models.CharField(max_length=20, choices=EstadoTarea.choices, default=EstadoTarea.PENDIENTE)
    prioridad = models.CharField(max_length=10, choices=Prioridad.choices, default=Prioridad.NORMAL)
    laboratorio = models.ForeignKey(
        Laboratorio, on_delete=models.SET_NULL, null=True, blank=True, related_name="tareas"
    )
    responsables = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="tareas_asignadas"
    )
    fecha_limite = models.DateField("fecha límite", null=True, blank=True)
    progreso = models.PositiveSmallIntegerField(default=0, help_text="De 0 a 100.")
    completada_en = models.DateTimeField(null=True, blank=True)
    completada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    # Si la creó una revisión periódica: al marcarla hecha, la revisión queda registrada.
    revision = models.ForeignKey(
        "bitacora.RevisionProgramada", on_delete=models.SET_NULL, null=True, blank=True, related_name="tareas"
    )

    class Meta:
        verbose_name = "tarea"
        verbose_name_plural = "tareas"
        ordering = ["-actualizado_en"]

    def __str__(self):
        return self.titulo


class AvanceTarea(models.Model):
    """Una anotación de cómo va la tarea. También registra los cambios de estado."""

    tarea = models.ForeignKey(Tarea, on_delete=models.CASCADE, related_name="avances")
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    texto = models.TextField(blank=True)
    progreso = models.PositiveSmallIntegerField(null=True, blank=True)
    estado_anterior = models.CharField(max_length=20, choices=EstadoTarea.choices, blank=True)
    estado_nuevo = models.CharField(max_length=20, choices=EstadoTarea.choices, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "avance de tarea"
        verbose_name_plural = "avances de tareas"
        ordering = ["creado_en", "id"]

    def __str__(self):
        return f"{self.tarea} · {self.creado_en:%d/%m %H:%M}"
