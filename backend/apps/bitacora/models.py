from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import ModeloBase
from apps.laboratorios.models import Laboratorio


class TipoEntrada(models.TextChoices):
    INSTALACION = "instalacion", "Instalación de programas"
    REVISION = "revision", "Revisión de equipos"
    MANTENIMIENTO = "mantenimiento", "Mantenimiento"
    INCIDENCIA = "incidencia", "Falla o incidencia"
    LIMPIEZA = "limpieza", "Limpieza"
    OTRO = "otro", "Otro"


class UnidadFrecuencia(models.TextChoices):
    DIAS = "dias", "días"
    SEMANAS = "semanas", "semanas"
    MESES = "meses", "meses"


class RevisionProgramada(ModeloBase):
    """Una revisión que se repite (p. ej. revisar los equipos del LAB-2 cada 2 semanas).

    Cuando llega `proxima_fecha`, pasa al pizarrón de tareas y se avisa. Al registrarla,
    queda en la bitácora y la próxima fecha se calcula desde ese día.
    """

    laboratorio = models.ForeignKey(Laboratorio, on_delete=models.PROTECT, related_name="revisiones")
    titulo = models.CharField("título", max_length=150)
    instrucciones = models.TextField(blank=True)
    cada = models.PositiveSmallIntegerField(default=1)
    unidad = models.CharField(
        max_length=10, choices=UnidadFrecuencia.choices, default=UnidadFrecuencia.SEMANAS
    )
    proxima_fecha = models.DateField("próxima fecha")
    ultima_fecha = models.DateField("última vez", null=True, blank=True)
    # Si no hay responsable, se avisa a todos los auxiliares.
    responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    activa = models.BooleanField(default=True)

    class Meta:
        verbose_name = "revisión programada"
        verbose_name_plural = "revisiones programadas"
        ordering = ["proxima_fecha", "id"]

    def __str__(self):
        return f"{self.titulo} · {self.laboratorio.codigo}"

    @property
    def frecuencia(self) -> str:
        if self.cada == 1:
            return {"dias": "Cada día", "semanas": "Cada semana", "meses": "Cada mes"}[self.unidad]
        return f"Cada {self.cada} {self.get_unidad_display()}"


class EntradaBitacora(ModeloBase):
    """Algo que se hizo en un laboratorio: instalar programas, revisar equipos, reparar…
    El autor es `creado_por`."""

    laboratorio = models.ForeignKey(Laboratorio, on_delete=models.PROTECT, related_name="bitacora")
    tipo = models.CharField(max_length=20, choices=TipoEntrada.choices, default=TipoEntrada.OTRO)
    titulo = models.CharField("título", max_length=150)
    descripcion = models.TextField("descripción", blank=True)
    fecha = models.DateTimeField("fecha y hora", default=timezone.now)
    # Equipos involucrados, como texto libre: "PC-03, PC-07".
    elementos = models.CharField(max_length=200, blank=True)
    revision = models.ForeignKey(
        RevisionProgramada, on_delete=models.SET_NULL, null=True, blank=True, related_name="entradas"
    )

    class Meta:
        verbose_name = "entrada de bitácora"
        verbose_name_plural = "bitácora"
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"{self.laboratorio.codigo} · {self.titulo}"
