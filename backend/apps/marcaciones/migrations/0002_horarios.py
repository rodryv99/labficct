import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("marcaciones", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="HorarioTrabajo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
                ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
                ("nombre", models.CharField(max_length=100, unique=True)),
                ("descripcion", models.CharField(blank=True, max_length=200)),
                ("activo", models.BooleanField(default=True)),
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
            ],
            options={
                "verbose_name": "horario de trabajo",
                "verbose_name_plural": "horarios de trabajo",
                "ordering": ["nombre"],
            },
        ),
        migrations.CreateModel(
            name="BloqueHorario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "dia",
                    models.PositiveSmallIntegerField(
                        choices=[
                            (0, "Lunes"),
                            (1, "Martes"),
                            (2, "Miércoles"),
                            (3, "Jueves"),
                            (4, "Viernes"),
                            (5, "Sábado"),
                            (6, "Domingo"),
                        ]
                    ),
                ),
                ("inicio", models.TimeField()),
                ("fin", models.TimeField()),
                (
                    "horario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bloques",
                        to="marcaciones.horariotrabajo",
                    ),
                ),
            ],
            options={
                "verbose_name": "bloque de horario",
                "verbose_name_plural": "bloques de horario",
                "ordering": ["dia", "inicio"],
            },
        ),
        migrations.CreateModel(
            name="AsignacionHorario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
                ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
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
                    "horario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asignaciones",
                        to="marcaciones.horariotrabajo",
                    ),
                ),
                (
                    "usuario",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asignacion_horario",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "asignación de horario",
                "verbose_name_plural": "asignaciones de horario",
            },
        ),
    ]
