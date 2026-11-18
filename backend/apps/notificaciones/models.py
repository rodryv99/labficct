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
    TURNO = "turno", "Turno"
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


class Plataforma(models.TextChoices):
    ANDROID = "android", "Android"
    IOS = "ios", "iOS"
    WEB = "web", "Web"


class DispositivoPush(models.Model):
    """Un teléfono (o navegador) donde una persona recibe notificaciones push.

    Guarda el token de FCM que la app entrega al iniciar sesión. Una persona puede
    tener varios (el teléfono y la tableta). Al cerrar sesión, su token se da de baja.
    """

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dispositivos_push"
    )
    token = models.CharField(max_length=255, unique=True)
    plataforma = models.CharField(max_length=10, choices=Plataforma.choices, default=Plataforma.ANDROID)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    visto_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "dispositivo push"
        verbose_name_plural = "dispositivos push"
        ordering = ["-visto_en"]
        indexes = [models.Index(fields=["usuario", "activo"], name="dispositivo_push_activo")]

    def __str__(self):
        return f"{self.usuario} · {self.get_plataforma_display()}"


class PreferenciaPush(models.Model):
    """Qué notificaciones push quiere recibir una persona. Una fila por usuario.

    - `habilitado`: interruptor general; en false no le llega ningún push (la campana sigue).
    - `solo_en_turno`: si lo activa, solo recibe push mientras está dentro de su horario
      de trabajo (con la tolerancia del sistema). Fuera de turno, solo la campana.
    """

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="preferencia_push"
    )
    habilitado = models.BooleanField(default=True)
    solo_en_turno = models.BooleanField(default=False)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "preferencia de push"
        verbose_name_plural = "preferencias de push"

    def __str__(self):
        estado = "on" if self.habilitado else "off"
        return f"{self.usuario} · push {estado}"
