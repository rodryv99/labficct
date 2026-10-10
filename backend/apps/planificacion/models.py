from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, IntegerRangeField, RangeOperators
from django.db import models
from django.db.backends.postgresql.psycopg_any import DateTimeTZRange, NumericRange
from django.db.models import F, Q
from django.db.models.functions import Lower
from django.utils import timezone

from apps.core.models import ModeloBase
from apps.laboratorios.models import Laboratorio, Software


def minutos(hora) -> int:
    return hora.hour * 60 + hora.minute


class PeriodoAcademico(ModeloBase):
    nombre = models.CharField(max_length=30, unique=True, help_text="Ej.: 2-2026")
    fecha_inicio = models.DateField("fecha de inicio")
    fecha_fin = models.DateField("fecha de fin")
    vigente = models.BooleanField(default=True)

    class Meta:
        verbose_name = "periodo académico"
        verbose_name_plural = "periodos académicos"
        ordering = ["-fecha_inicio"]
        constraints = [
            models.CheckConstraint(
                condition=Q(fecha_fin__gte=F("fecha_inicio")), name="periodo_fechas_validas"
            ),
        ]

    def __str__(self):
        return self.nombre


class Materia(ModeloBase):
    sigla = models.CharField(max_length=20, unique=True)
    nombre = models.CharField(max_length=150)

    class Meta:
        verbose_name = "materia"
        verbose_name_plural = "materias"
        ordering = ["sigla"]

    def __str__(self):
        return f"{self.sigla} · {self.nombre}"


class Docente(ModeloBase):
    """Quien dicta las clases. Puede existir sin cuenta en el sistema: cuando se le
    crea un usuario, la ficha se vincula a él y ve sus clases con ese usuario."""

    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    email = models.EmailField("correo", max_length=254, blank=True)
    telefono = models.CharField("teléfono", max_length=30, blank=True)
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ficha_docente",
    )
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "docente"
        verbose_name_plural = "docentes"
        ordering = ["apellidos", "nombres"]
        constraints = [
            models.UniqueConstraint(
                Lower("email"), condition=~Q(email=""), name="docente_email_unico"
            ),
        ]

    def __str__(self):
        return self.nombre_completo

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombres} {self.apellidos}".strip()


class DiaSemana(models.IntegerChoices):
    LUNES = 1, "Lunes"
    MARTES = 2, "Martes"
    MIERCOLES = 3, "Miércoles"
    JUEVES = 4, "Jueves"
    VIERNES = 5, "Viernes"
    SABADO = 6, "Sábado"
    DOMINGO = 7, "Domingo"


class Horario(ModeloBase):
    """4. Clase que se repite cada semana durante un periodo académico."""

    periodo = models.ForeignKey(PeriodoAcademico, on_delete=models.PROTECT, related_name="horarios")
    laboratorio = models.ForeignKey(Laboratorio, on_delete=models.PROTECT, related_name="horarios")
    materia = models.ForeignKey(Materia, on_delete=models.PROTECT, related_name="horarios")
    grupo = models.CharField(max_length=10)
    docente = models.ForeignKey(
        Docente,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="horarios",
    )
    dia_semana = models.PositiveSmallIntegerField("día", choices=DiaSemana.choices)
    hora_inicio = models.TimeField("hora de inicio")
    hora_fin = models.TimeField("hora de fin")
    # Rango de minutos del día [inicio, fin): 07:00–08:30 = [420, 510).
    franja = IntegerRangeField(editable=False)
    observaciones = models.TextField(blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "horario"
        verbose_name_plural = "horarios"
        ordering = ["dia_semana", "hora_inicio"]
        constraints = [
            models.CheckConstraint(
                condition=Q(hora_fin__gt=F("hora_inicio")), name="horario_horas_validas"
            ),
            # PostgreSQL rechaza dos clases activas en el mismo laboratorio,
            # periodo y día cuyas franjas se crucen.
            ExclusionConstraint(
                name="horario_sin_choque",
                expressions=[
                    ("laboratorio", RangeOperators.EQUAL),
                    ("periodo", RangeOperators.EQUAL),
                    ("dia_semana", RangeOperators.EQUAL),
                    ("franja", RangeOperators.OVERLAPS),
                ],
                condition=Q(activo=True),
            ),
        ]

    def __str__(self):
        return f"{self.materia.sigla} {self.grupo} · {self.get_dia_semana_display()} {self.hora_inicio:%H:%M}"

    def save(self, *args, **kwargs):
        self.franja = NumericRange(minutos(self.hora_inicio), minutos(self.hora_fin), "[)")
        super().save(*args, **kwargs)


class ExcepcionHorario(ModeloBase):
    """Un día concreto en que la clase no se dicta (feriado, suspensión)."""

    horario = models.ForeignKey(Horario, on_delete=models.CASCADE, related_name="excepciones")
    fecha = models.DateField()
    motivo = models.CharField(max_length=150)
    # Si la suspendió una reserva aprobada con prioridad: al cancelar la reserva
    # o cambiarle los días, esta suspensión se borra y la clase vuelve.
    reserva = models.ForeignKey(
        "Reserva",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="clases_suspendidas",
    )

    class Meta:
        verbose_name = "clase suspendida"
        verbose_name_plural = "clases suspendidas"
        ordering = ["fecha"]
        constraints = [
            models.UniqueConstraint(fields=["horario", "fecha"], name="excepcion_unica"),
        ]


class EstadoReserva(models.TextChoices):
    # Choca con una clase u otra reserva: espera que un administrador la apruebe.
    PENDIENTE = "pendiente", "Por aprobar"
    CONFIRMADA = "confirmada", "Confirmada"
    CANCELADA = "cancelada", "Cancelada"


class Reserva(ModeloBase):
    """5. Evento único o de pocos días, con programas y apoyo de auxiliares.

    Si el laboratorio está libre, queda confirmada al guardarla. Si choca con algo,
    queda por aprobar y no ocupa el laboratorio hasta que un administrador la
    apruebe; al aprobarla tiene prioridad sobre las clases (services.aprobar_reserva).
    """

    titulo = models.CharField("título", max_length=150)
    descripcion = models.TextField("descripción", blank=True)
    solicitante = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reservas_solicitadas",
    )
    solicitante_externo = models.CharField(
        max_length=150, blank=True, help_text="Nombre, si quien solicita no es usuario del sistema."
    )
    contacto = models.CharField(max_length=100, blank=True)
    programas = models.ManyToManyField(Software, blank=True, related_name="reservas")
    requiere_apoyo = models.BooleanField("requiere apoyo de auxiliares", default=False)
    auxiliares_requeridos = models.PositiveSmallIntegerField(default=0)
    auxiliares = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="reservas_asignadas"
    )
    estado = models.CharField(
        max_length=20, choices=EstadoReserva.choices, default=EstadoReserva.CONFIRMADA
    )
    motivo_cancelacion = models.CharField(max_length=200, blank=True)
    aprobada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    aprobada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "reserva"
        verbose_name_plural = "reservas"
        ordering = ["-creado_en"]

    def __str__(self):
        return self.titulo

    @property
    def nombre_solicitante(self) -> str:
        if self.solicitante_id:
            return self.solicitante.nombre_completo
        return self.solicitante_externo


class BloqueReserva(models.Model):
    """Un día y horario de una reserva, en un laboratorio."""

    reserva = models.ForeignKey(Reserva, on_delete=models.CASCADE, related_name="bloques")
    laboratorio = models.ForeignKey(
        Laboratorio, on_delete=models.PROTECT, related_name="bloques_reserva"
    )
    inicio = models.DateTimeField()
    fin = models.DateTimeField()
    rango = DateTimeRangeField(editable=False)
    # Ocupa el laboratorio: solo los bloques de reservas confirmadas.
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "bloque de reserva"
        verbose_name_plural = "bloques de reserva"
        ordering = ["inicio"]
        constraints = [
            models.CheckConstraint(condition=Q(fin__gt=F("inicio")), name="bloque_horas_validas"),
            ExclusionConstraint(
                name="bloque_sin_choque",
                expressions=[
                    ("laboratorio", RangeOperators.EQUAL),
                    ("rango", RangeOperators.OVERLAPS),
                ],
                condition=Q(activo=True),
            ),
        ]

    def __str__(self):
        return f"{self.laboratorio_id} · {self.fecha:%d/%m} {self.hora_inicio:%H:%M}–{self.hora_fin:%H:%M}"

    def save(self, *args, **kwargs):
        self.rango = DateTimeTZRange(self.inicio, self.fin, "[)")
        super().save(*args, **kwargs)

    # Valores en hora local, para mostrar y editar.
    @property
    def fecha(self):
        return timezone.localtime(self.inicio).date()

    @property
    def hora_inicio(self):
        return timezone.localtime(self.inicio).time()

    @property
    def hora_fin(self):
        return timezone.localtime(self.fin).time()
