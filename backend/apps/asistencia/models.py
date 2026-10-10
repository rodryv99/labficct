from django.conf import settings
from django.db import models

from apps.core.models import ModeloBase
from apps.laboratorios.models import Laboratorio


class CategoriaAsistencia(models.TextChoices):
    EQUIPO = "equipo", "Computadora o equipo"
    PROYECTOR = "proyector", "Proyector o audio"
    RED = "red", "Internet o red"
    SOFTWARE = "software", "Programas"
    ACCESO = "acceso", "Abrir o cerrar el aula"
    OTRO = "otro", "Otro"


class EstadoSolicitud(models.TextChoices):
    PENDIENTE = "pendiente", "Pendiente"
    EN_CURSO = "en_curso", "En camino"
    RESUELTA = "resuelta", "Resuelta"
    CANCELADA = "cancelada", "Cancelada"


ABIERTAS = [EstadoSolicitud.PENDIENTE, EstadoSolicitud.EN_CURSO]


class SolicitudAsistencia(ModeloBase):
    """Un docente o administrativo pide apoyo a los auxiliares; les llega una notificación."""

    solicitante = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="solicitudes_asistencia"
    )
    laboratorio = models.ForeignKey(
        Laboratorio,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="solicitudes_asistencia",
    )
    lugar = models.CharField(max_length=150, blank=True)
    categoria = models.CharField(
        "categoría", max_length=20, choices=CategoriaAsistencia.choices, default=CategoriaAsistencia.OTRO
    )
    descripcion = models.TextField("descripción")
    urgente = models.BooleanField(default=False)
    estado = models.CharField(
        max_length=20, choices=EstadoSolicitud.choices, default=EstadoSolicitud.PENDIENTE
    )
    atendida_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    atendida_en = models.DateTimeField(null=True, blank=True)
    cerrada_en = models.DateTimeField(null=True, blank=True)
    respuesta = models.TextField(blank=True)

    class Meta:
        verbose_name = "solicitud de asistencia"
        verbose_name_plural = "solicitudes de asistencia"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.donde} · {self.get_categoria_display()}"

    @property
    def donde(self) -> str:
        partes = [self.laboratorio.codigo if self.laboratorio_id else "", self.lugar]
        return " · ".join(p for p in partes if p) or "Sin lugar indicado"
