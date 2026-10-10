from django.conf import settings
from django.db import models
from django.db.models import Q


class TipoNotificacion(models.TextChoices):
    ALISTAR = "alistar", "Alistar aula"
    CERRAR = "cerrar", "Cerrar aula"
    ASISTENCIA = "asistencia", "Asistencia"
    RESERVA = "reserva", "Reserva"
    CLASE = "clase", "Clase"
    REVISION = "revision", "Revisión"
    TAREA = "tarea", "Tarea"
    GENERAL = "general", "Aviso"


class Notificacion(models.Model):
    """Un aviso para una persona. La web y la app lo muestran en la campana."""

    destinatario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notificaciones"
    )
    tipo = models.CharField(max_length=20, choices=TipoNotificacion.choices, default=TipoNotificacion.GENERAL)
    titulo = models.CharField("título", max_length=150)
    mensaje = models.TextField(blank=True)
    # Ruta de la web a la que lleva (p. ej. /reservas?id=4). La app usa `datos`.
    enlace = models.CharField(max_length=200, blank=True)
    datos = models.JSONField(default=dict, blank=True)
    # Los avisos automáticos llevan una clave para no repetirse (p. ej. alistar:clase-3-2026-09-28).
    clave = models.CharField(max_length=120, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    leida_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "notificación"
        verbose_name_plural = "notificaciones"
        ordering = ["-creado_en", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["destinatario", "clave"], condition=~Q(clave=""), name="notificacion_clave_unica"
            ),
        ]
        indexes = [models.Index(fields=["destinatario", "leida_en"], name="notificacion_no_leidas")]

    def __str__(self):
        return f"{self.destinatario} · {self.titulo}"
