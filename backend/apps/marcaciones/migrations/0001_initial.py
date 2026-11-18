import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="LugarAsistencia",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
                ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
                ("nombre", models.CharField(max_length=100, unique=True)),
                ("referencia", models.CharField(blank=True, max_length=200)),
                (
                    "latitud",
                    models.FloatField(
                        validators=[
                            django.core.validators.MinValueValidator(-90.0),
                            django.core.validators.MaxValueValidator(90.0),
                        ]
                    ),
                ),
                (
                    "longitud",
                    models.FloatField(
                        validators=[
                            django.core.validators.MinValueValidator(-180.0),
                            django.core.validators.MaxValueValidator(180.0),
                        ]
                    ),
                ),
                (
                    "radio_m",
                    models.PositiveIntegerField(
                        default=100,
                        validators=[
                            django.core.validators.MinValueValidator(20),
                            django.core.validators.MaxValueValidator(2000),
                        ],
                        verbose_name="radio permitido (m)",
                    ),
                ),
                ("predeterminado", models.BooleanField(default=False)),
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
                "verbose_name": "lugar de asistencia",
                "verbose_name_plural": "lugares de asistencia",
                "ordering": ["nombre"],
            },
        ),
        migrations.CreateModel(
            name="AsignacionLugar",
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
                    "lugar",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asignaciones",
                        to="marcaciones.lugarasistencia",
                    ),
                ),
                (
                    "usuario",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asignacion_lugar",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "asignación de lugar",
                "verbose_name_plural": "asignaciones de lugar",
            },
        ),
        migrations.CreateModel(
            name="Marcacion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
                ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
                ("fecha", models.DateField(db_index=True)),
                ("entrada_en", models.DateTimeField()),
                ("entrada_latitud", models.FloatField()),
                ("entrada_longitud", models.FloatField()),
                (
                    "entrada_precision_m",
                    models.FloatField(blank=True, null=True, verbose_name="precisión del GPS al entrar (m)"),
                ),
                ("entrada_distancia_m", models.FloatField(verbose_name="distancia al lugar al entrar (m)")),
                ("salida_en", models.DateTimeField(blank=True, null=True)),
                ("salida_latitud", models.FloatField(blank=True, null=True)),
                ("salida_longitud", models.FloatField(blank=True, null=True)),
                (
                    "salida_precision_m",
                    models.FloatField(blank=True, null=True, verbose_name="precisión del GPS al salir (m)"),
                ),
                (
                    "salida_distancia_m",
                    models.FloatField(blank=True, null=True, verbose_name="distancia al lugar al salir (m)"),
                ),
                ("salida_manual", models.BooleanField(default=False)),
                ("nota", models.CharField(blank=True, max_length=300)),
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
                    "lugar",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="marcaciones",
                        to="marcaciones.lugarasistencia",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="marcaciones",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "marcación",
                "verbose_name_plural": "marcaciones",
                "ordering": ["-entrada_en"],
            },
        ),
        migrations.AddConstraint(
            model_name="lugarasistencia",
            constraint=models.UniqueConstraint(
                condition=models.Q(("predeterminado", True)),
                fields=("predeterminado",),
                name="un_solo_lugar_predeterminado",
            ),
        ),
        migrations.AddIndex(
            model_name="marcacion",
            index=models.Index(fields=["usuario", "fecha"], name="marcaciones_usuario_fecha_idx"),
        ),
    ]
