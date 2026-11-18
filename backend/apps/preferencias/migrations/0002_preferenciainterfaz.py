import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("preferencias", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PreferenciaInterfaz",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("clave", models.CharField(max_length=60)),
                ("valor", models.JSONField(blank=True, default=dict)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "usuario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="preferencias_interfaz",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "preferencia de interfaz",
                "verbose_name_plural": "preferencias de interfaz",
            },
        ),
        migrations.AddConstraint(
            model_name="preferenciainterfaz",
            constraint=models.UniqueConstraint(
                fields=["usuario", "clave"], name="preferencia_interfaz_unica"
            ),
        ),
    ]
