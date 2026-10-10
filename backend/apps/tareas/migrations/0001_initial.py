import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

ESTADOS = [("pendiente", "Pendiente"), ("en_progreso", "En progreso"), ("hecha", "Hecha")]


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("bitacora", "0001_initial"),
        ("laboratorios", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Tarea",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
                ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
                ("titulo", models.CharField(max_length=150, verbose_name="título")),
                ("descripcion", models.TextField(blank=True, verbose_name="descripción")),
                ("estado", models.CharField(choices=ESTADOS, default="pendiente", max_length=20)),
                (
                    "prioridad",
                    models.CharField(
                        choices=[("baja", "Baja"), ("normal", "Normal"), ("alta", "Alta")],
                        default="normal",
                        max_length=10,
                    ),
                ),
                ("fecha_limite", models.DateField(blank=True, null=True, verbose_name="fecha límite")),
                ("progreso", models.PositiveSmallIntegerField(default=0, help_text="De 0 a 100.")),
                ("completada_en", models.DateTimeField(blank=True, null=True)),
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
                    "completada_por",
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
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tareas",
                        to="laboratorios.laboratorio",
                    ),
                ),
                (
                    "responsables",
                    models.ManyToManyField(blank=True, related_name="tareas_asignadas", to=settings.AUTH_USER_MODEL),
                ),
                (
                    "revision",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tareas",
                        to="bitacora.revisionprogramada",
                    ),
                ),
            ],
            options={
                "verbose_name": "tarea",
                "verbose_name_plural": "tareas",
                "ordering": ["-actualizado_en"],
            },
        ),
        migrations.CreateModel(
            name="AvanceTarea",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("texto", models.TextField(blank=True)),
                ("progreso", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("estado_anterior", models.CharField(blank=True, choices=ESTADOS, max_length=20)),
                ("estado_nuevo", models.CharField(blank=True, choices=ESTADOS, max_length=20)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "autor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tarea",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="avances",
                        to="tareas.tarea",
                    ),
                ),
            ],
            options={
                "verbose_name": "avance de tarea",
                "verbose_name_plural": "avances de tareas",
                "ordering": ["creado_en", "id"],
            },
        ),
    ]
