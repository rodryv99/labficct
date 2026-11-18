"""Control de asistencia de los auxiliares: marcan entrada y salida desde la app,
con su huella y solo si el GPS los ubica dentro del lugar que les asignó el Admin.

No confundir con apps.asistencia, que son los pedidos de ayuda a los auxiliares.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.core.models import ModeloBase

RADIO_MINIMO_M = 20
RADIO_MAXIMO_M = 2000
RADIO_POR_DEFECTO_M = 100


class LugarAsistencia(ModeloBase):
    """Un punto en el mapa y el radio (en metros) dentro del cual vale la marcación."""

    nombre = models.CharField(max_length=100, unique=True)
    referencia = models.CharField(max_length=200, blank=True)
    latitud = models.FloatField(validators=[MinValueValidator(-90.0), MaxValueValidator(90.0)])
    longitud = models.FloatField(validators=[MinValueValidator(-180.0), MaxValueValidator(180.0)])
    radio_m = models.PositiveIntegerField(
        "radio permitido (m)",
        default=RADIO_POR_DEFECTO_M,
        validators=[MinValueValidator(RADIO_MINIMO_M), MaxValueValidator(RADIO_MAXIMO_M)],
    )
    # El lugar de quienes no tienen uno propio. Solo puede haber uno.
    predeterminado = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "lugar de asistencia"
        verbose_name_plural = "lugares de asistencia"
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["predeterminado"],
                condition=Q(predeterminado=True),
                name="un_solo_lugar_predeterminado",
            ),
        ]

    def __str__(self):
        return self.nombre


class AsignacionLugar(ModeloBase):
    """El lugar propio de un auxiliar. Sin asignación, usa el lugar predeterminado."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="asignacion_lugar"
    )
    lugar = models.ForeignKey(LugarAsistencia, on_delete=models.CASCADE, related_name="asignaciones")

    class Meta:
        verbose_name = "asignación de lugar"
        verbose_name_plural = "asignaciones de lugar"

    def __str__(self):
        return f"{self.usuario} → {self.lugar}"


class Marcacion(ModeloBase):
    """Una jornada (o tramo) de un auxiliar: su entrada y, cuando la marca, su salida.

    De cada marca se guarda dónde estaba el teléfono, la precisión del GPS y a cuántos
    metros quedó del lugar, para que el Admin pueda revisarlo.
    """

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="marcaciones")
    lugar = models.ForeignKey(LugarAsistencia, on_delete=models.PROTECT, related_name="marcaciones")
    # Día (hora local) de la entrada: por él se agrupan los reportes.
    fecha = models.DateField(db_index=True)

    entrada_en = models.DateTimeField()
    entrada_latitud = models.FloatField()
    entrada_longitud = models.FloatField()
    entrada_precision_m = models.FloatField("precisión del GPS al entrar (m)", null=True, blank=True)
    entrada_distancia_m = models.FloatField("distancia al lugar al entrar (m)")

    salida_en = models.DateTimeField(null=True, blank=True)
    salida_latitud = models.FloatField(null=True, blank=True)
    salida_longitud = models.FloatField(null=True, blank=True)
    salida_precision_m = models.FloatField("precisión del GPS al salir (m)", null=True, blank=True)
    salida_distancia_m = models.FloatField("distancia al lugar al salir (m)", null=True, blank=True)
    # La salida la puso el Admin (el auxiliar olvidó marcarla): no tiene GPS ni huella.
    salida_manual = models.BooleanField(default=False)
    nota = models.CharField(max_length=300, blank=True)

    # Turno esperado según el horario asignado, copiado al marcar la entrada (así no
    # cambia aunque luego se edite el horario). Null = marcó sin horario que aplicara ese día.
    turno_inicio = models.TimeField("inicio del turno", null=True, blank=True)
    turno_fin = models.TimeField("fin del turno", null=True, blank=True)
    # Minutos de retraso en la entrada (0 = puntual) y minutos que salió antes del fin.
    retraso_min = models.PositiveSmallIntegerField("retraso en la entrada (min)", default=0)
    salida_temprana_min = models.PositiveSmallIntegerField("salida anticipada (min)", default=0)

    class Meta:
        verbose_name = "marcación"
        verbose_name_plural = "marcaciones"
        ordering = ["-entrada_en"]
        indexes = [models.Index(fields=["usuario", "fecha"], name="marcaciones_usuario_fecha_idx")]

    def __str__(self):
        return f"{self.usuario} · {self.fecha:%d/%m/%Y}"

    @property
    def abierta(self) -> bool:
        return self.salida_en is None

    @property
    def minutos(self) -> int | None:
        """Minutos trabajados; None mientras no haya salida."""
        if self.salida_en is None:
            return None
        return max(0, int((self.salida_en - self.entrada_en).total_seconds() // 60))


# ── Horarios de trabajo de los auxiliares ───────────────

DIAS_SEMANA = [
    (0, "Lunes"),
    (1, "Martes"),
    (2, "Miércoles"),
    (3, "Jueves"),
    (4, "Viernes"),
    (5, "Sábado"),
    (6, "Domingo"),
]
# Nombres cortos para armar textos ("Lun 08:00–12:00").
DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]


class HorarioTrabajo(ModeloBase):
    """Un horario de trabajo con nombre (p. ej. «Mañana») y sus bloques por día.

    El Admin lo crea una vez y luego se lo asigna a los auxiliares que trabajen en él.
    """

    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.CharField(max_length=200, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "horario de trabajo"
        verbose_name_plural = "horarios de trabajo"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class BloqueHorario(models.Model):
    """Un tramo de un día dentro de un horario: p. ej. lunes de 08:00 a 12:00."""

    horario = models.ForeignKey(HorarioTrabajo, on_delete=models.CASCADE, related_name="bloques")
    dia = models.PositiveSmallIntegerField(choices=DIAS_SEMANA)
    inicio = models.TimeField()
    fin = models.TimeField()

    class Meta:
        verbose_name = "bloque de horario"
        verbose_name_plural = "bloques de horario"
        ordering = ["dia", "inicio"]

    def __str__(self):
        return f"{DIAS_CORTOS[self.dia]} {self.inicio:%H:%M}–{self.fin:%H:%M}"


class AsignacionHorario(ModeloBase):
    """El horario de trabajo propio de un auxiliar. Sin asignación, no tiene horario."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="asignacion_horario"
    )
    horario = models.ForeignKey(HorarioTrabajo, on_delete=models.CASCADE, related_name="asignaciones")

    class Meta:
        verbose_name = "asignación de horario"
        verbose_name_plural = "asignaciones de horario"

    def __str__(self):
        return f"{self.usuario} → {self.horario}"
