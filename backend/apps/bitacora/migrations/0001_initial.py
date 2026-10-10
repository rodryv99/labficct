import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


def campos_base():
    return [
        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
        ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
        ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
    ]


def auditoria():
    return [
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
    ]


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("laboratorios", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="RevisionProgramada",
            fields=[
                *campos_base(),
                ("titulo", models.CharField(max_length=150, verbose_name="título")),
                ("instrucciones", models.TextField(blank=True)),
                ("cada", models.PositiveSmallIntegerField(default=1)),
                (
                    "unidad",
                    models.CharField(
                        choices=[("dias", "días"), ("semanas", "semanas"), ("meses", "meses")],
                        default="semanas",
                        max_length=10,
                    ),
                ),
                ("proxima_fecha", models.DateField(verbose_name="próxima fecha")),
                ("ultima_fecha", models.DateField(blank=True, null=True, verbose_name="última vez")),
                ("activa", models.BooleanField(default=True)),
                *auditoria(),
                (
                    "laboratorio",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="revisiones",
                        to="laboratorios.laboratorio",
                    ),
                ),
                (
                    "responsable",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "revisión programada",
                "verbose_name_plural": "revisiones programadas",
                "ordering": ["proxima_fecha", "id"],
            },
        ),
        migrations.CreateModel(
            name="EntradaBitacora",
            fields=[
                *campos_base(),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("instalacion", "Instalación de programas"),
                            ("revision", "Revisión de equipos"),
                            ("mantenimiento", "Mantenimiento"),
                            ("incidencia", "Falla o incidencia"),
                            ("limpieza", "Limpieza"),
                            ("otro", "Otro"),
                        ],
                        default="otro",
                        max_length=20,
                    ),
                ),
                ("titulo", models.CharField(max_length=150, verbose_name="título")),
                ("descripcion", models.TextField(blank=True, verbose_name="descripción")),
                ("fecha", models.DateTimeField(default=django.utils.timezone.now, verbose_name="fecha y hora")),
                ("elementos", models.CharField(blank=True, max_length=200)),
                *auditoria(),
                (
                    "laboratorio",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="bitacora",
                        to="laboratorios.laboratorio",
                    ),
                ),
                (
                    "revision",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="entradas",
                        to="bitacora.revisionprogramada",
                    ),
                ),
            ],
            options={
                "verbose_name": "entrada de bitácora",
                "verbose_name_plural": "bitácora",
                "ordering": ["-fecha", "-id"],
            },
        ),
    ]
