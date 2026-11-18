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
            name="Respaldo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
                ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
                ("archivo", models.CharField(max_length=255, verbose_name="nombre del archivo")),
                ("tamano_bytes", models.BigIntegerField(default=0, verbose_name="tamaño (bytes)")),
                (
                    "origen",
                    models.CharField(
                        choices=[("manual", "Manual"), ("automatico", "Automático")],
                        default="manual",
                        max_length=12,
                    ),
                ),
                ("base_datos", models.CharField(blank=True, max_length=120)),
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
            ],
            options={
                "verbose_name": "respaldo",
                "verbose_name_plural": "respaldos",
                "ordering": ["-creado_en"],
            },
        ),
    ]
