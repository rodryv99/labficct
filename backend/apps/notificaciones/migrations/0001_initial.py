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
            name="Notificacion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("alistar", "Alistar aula"),
                            ("cerrar", "Cerrar aula"),
                            ("asistencia", "Asistencia"),
                            ("reserva", "Reserva"),
                            ("clase", "Clase"),
                            ("revision", "Revisión"),
                            ("tarea", "Tarea"),
                            ("general", "Aviso"),
                        ],
                        default="general",
                        max_length=20,
                    ),
                ),
                ("titulo", models.CharField(max_length=150, verbose_name="título")),
                ("mensaje", models.TextField(blank=True)),
                ("enlace", models.CharField(blank=True, max_length=200)),
                ("datos", models.JSONField(blank=True, default=dict)),
                ("clave", models.CharField(blank=True, max_length=120)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("leida_en", models.DateTimeField(blank=True, null=True)),
                (
                    "destinatario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notificaciones",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "notificación",
                "verbose_name_plural": "notificaciones",
                "ordering": ["-creado_en", "-id"],
                "indexes": [models.Index(fields=["destinatario", "leida_en"], name="notificacion_no_leidas")],
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("clave", ""), _negated=True),
                        fields=("destinatario", "clave"),
                        name="notificacion_clave_unica",
                    )
                ],
            },
        ),
    ]
