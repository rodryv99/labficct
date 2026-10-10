import django.contrib.postgres.constraints
import django.contrib.postgres.fields.ranges
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def auditoria():
    return [
        ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
        ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
        (
            "creado_por",
            models.ForeignKey(
                blank=True,
                editable=False,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
                verbose_name="creado por",
            ),
        ),
        (
            "actualizado_por",
            models.ForeignKey(
                blank=True,
                editable=False,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
                verbose_name="actualizado por",
            ),
        ),
    ]


def id_field():
    return ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"))


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("core", "0001_extensiones"),
        ("laboratorios", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PeriodoAcademico",
            fields=[
                id_field(),
                *auditoria(),
                ("nombre", models.CharField(help_text="Ej.: 2-2026", max_length=30, unique=True)),
                ("fecha_inicio", models.DateField(verbose_name="fecha de inicio")),
                ("fecha_fin", models.DateField(verbose_name="fecha de fin")),
                ("vigente", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "periodo académico",
                "verbose_name_plural": "periodos académicos",
                "ordering": ["-fecha_inicio"],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("fecha_fin__gte", models.F("fecha_inicio"))),
                        name="periodo_fechas_validas",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="Materia",
            fields=[
                id_field(),
                *auditoria(),
                ("sigla", models.CharField(max_length=20, unique=True)),
                ("nombre", models.CharField(max_length=150)),
            ],
            options={
                "verbose_name": "materia",
                "verbose_name_plural": "materias",
                "ordering": ["sigla"],
            },
        ),
        migrations.CreateModel(
            name="Horario",
            fields=[
                id_field(),
                *auditoria(),
                ("grupo", models.CharField(max_length=10)),
                (
                    "dia_semana",
                    models.PositiveSmallIntegerField(
                        choices=[
                            (1, "Lunes"),
                            (2, "Martes"),
                            (3, "Miércoles"),
                            (4, "Jueves"),
                            (5, "Viernes"),
                            (6, "Sábado"),
                            (7, "Domingo"),
                        ],
                        verbose_name="día",
                    ),
                ),
                ("hora_inicio", models.TimeField(verbose_name="hora de inicio")),
                ("hora_fin", models.TimeField(verbose_name="hora de fin")),
                ("franja", django.contrib.postgres.fields.ranges.IntegerRangeField(editable=False)),
                ("observaciones", models.TextField(blank=True)),
                ("activo", models.BooleanField(default=True)),
                (
                    "docente",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="horarios",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "laboratorio",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="horarios",
                        to="laboratorios.laboratorio",
                    ),
                ),
                (
                    "materia",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="horarios",
                        to="planificacion.materia",
                    ),
                ),
                (
                    "periodo",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="horarios",
                        to="planificacion.periodoacademico",
                    ),
                ),
            ],
            options={
                "verbose_name": "horario",
                "verbose_name_plural": "horarios",
                "ordering": ["dia_semana", "hora_inicio"],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("hora_fin__gt", models.F("hora_inicio"))),
                        name="horario_horas_validas",
                    ),
                    django.contrib.postgres.constraints.ExclusionConstraint(
                        condition=models.Q(("activo", True)),
                        expressions=[
                            ("laboratorio", "="),
                            ("periodo", "="),
                            ("dia_semana", "="),
                            ("franja", "&&"),
                        ],
                        name="horario_sin_choque",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="ExcepcionHorario",
            fields=[
                id_field(),
                *auditoria(),
                ("fecha", models.DateField()),
                ("motivo", models.CharField(max_length=150)),
                (
                    "horario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="excepciones",
                        to="planificacion.horario",
                    ),
                ),
            ],
            options={
                "verbose_name": "clase suspendida",
                "verbose_name_plural": "clases suspendidas",
                "ordering": ["fecha"],
                "constraints": [
                    models.UniqueConstraint(fields=("horario", "fecha"), name="excepcion_unica"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Reserva",
            fields=[
                id_field(),
                *auditoria(),
                ("titulo", models.CharField(max_length=150, verbose_name="título")),
                ("descripcion", models.TextField(blank=True, verbose_name="descripción")),
                (
                    "solicitante_externo",
                    models.CharField(
                        blank=True,
                        help_text="Nombre, si quien solicita no es usuario del sistema.",
                        max_length=150,
                    ),
                ),
                ("contacto", models.CharField(blank=True, max_length=100)),
                (
                    "requiere_apoyo",
                    models.BooleanField(default=False, verbose_name="requiere apoyo de auxiliares"),
                ),
                ("auxiliares_requeridos", models.PositiveSmallIntegerField(default=0)),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("pendiente", "Pendiente"),
                            ("confirmada", "Confirmada"),
                            ("cancelada", "Cancelada"),
                        ],
                        default="confirmada",
                        max_length=20,
                    ),
                ),
                ("motivo_cancelacion", models.CharField(blank=True, max_length=200)),
                (
                    "auxiliares",
                    models.ManyToManyField(
                        blank=True, related_name="reservas_asignadas", to=settings.AUTH_USER_MODEL
                    ),
                ),
                (
                    "programas",
                    models.ManyToManyField(
                        blank=True, related_name="reservas", to="laboratorios.software"
                    ),
                ),
                (
                    "solicitante",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="reservas_solicitadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "reserva",
                "verbose_name_plural": "reservas",
                "ordering": ["-creado_en"],
            },
        ),
        migrations.CreateModel(
            name="BloqueReserva",
            fields=[
                id_field(),
                ("inicio", models.DateTimeField()),
                ("fin", models.DateTimeField()),
                ("rango", django.contrib.postgres.fields.ranges.DateTimeRangeField(editable=False)),
                ("activo", models.BooleanField(default=True)),
                (
                    "laboratorio",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="bloques_reserva",
                        to="laboratorios.laboratorio",
                    ),
                ),
                (
                    "reserva",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bloques",
                        to="planificacion.reserva",
                    ),
                ),
            ],
            options={
                "verbose_name": "bloque de reserva",
                "verbose_name_plural": "bloques de reserva",
                "ordering": ["inicio"],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("fin__gt", models.F("inicio"))),
                        name="bloque_horas_validas",
                    ),
                    django.contrib.postgres.constraints.ExclusionConstraint(
                        condition=models.Q(("activo", True)),
                        expressions=[("laboratorio", "="), ("rango", "&&")],
                        name="bloque_sin_choque",
                    ),
                ],
            },
        ),
    ]
