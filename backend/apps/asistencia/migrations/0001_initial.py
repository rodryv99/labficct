import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("laboratorios", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SolicitudAsistencia",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
                ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
                ("lugar", models.CharField(blank=True, max_length=150)),
                (
                    "categoria",
                    models.CharField(
                        choices=[
                            ("equipo", "Computadora o equipo"),
                            ("proyector", "Proyector o audio"),
                            ("red", "Internet o red"),
                            ("software", "Programas"),
                            ("acceso", "Abrir o cerrar el aula"),
                            ("otro", "Otro"),
                        ],
                        default="otro",
                        max_length=20,
                        verbose_name="categoría",
                    ),
                ),
                ("descripcion", models.TextField(verbose_name="descripción")),
                ("urgente", models.BooleanField(default=False)),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("pendiente", "Pendiente"),
                            ("en_curso", "En camino"),
                            ("resuelta", "Resuelta"),
                            ("cancelada", "Cancelada"),
                        ],
                        default="pendiente",
                        max_length=20,
                    ),
                ),
                ("atendida_en", models.DateTimeField(blank=True, null=True)),
                ("cerrada_en", models.DateTimeField(blank=True, null=True)),
                ("respuesta", models.TextField(blank=True)),
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
                    "atendida_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
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
                    "laboratorio",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="solicitudes_asistencia",
                        to="laboratorios.laboratorio",
                    ),
                ),
                (
                    "solicitante",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="solicitudes_asistencia",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "solicitud de asistencia",
                "verbose_name_plural": "solicitudes de asistencia",
                "ordering": ["-creado_en"],
            },
        ),
    ]
