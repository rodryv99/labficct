import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

TIPOS = [
    ("alistar", "Alistar aula"),
    ("cerrar", "Cerrar aula"),
    ("asistencia", "Asistencia"),
    ("reserva", "Reserva"),
    ("clase", "Clase"),
    ("revision", "Revisión"),
    ("tarea", "Tarea"),
    ("turno", "Turno"),
    ("general", "Aviso"),
]


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("notificaciones", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notificacion",
            name="tipo",
            field=models.CharField(choices=TIPOS, default="general", max_length=20),
        ),
        migrations.CreateModel(
            name="DispositivoPush",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(max_length=255, unique=True)),
                (
                    "plataforma",
                    models.CharField(
                        choices=[("android", "Android"), ("ios", "iOS"), ("web", "Web")],
                        default="android",
                        max_length=10,
                    ),
                ),
                ("activo", models.BooleanField(default=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("visto_en", models.DateTimeField(auto_now=True)),
                (
                    "usuario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dispositivos_push",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "dispositivo push",
                "verbose_name_plural": "dispositivos push",
                "ordering": ["-visto_en"],
            },
        ),
        migrations.AddIndex(
            model_name="dispositivopush",
            index=models.Index(fields=["usuario", "activo"], name="dispositivo_push_activo"),
        ),
        migrations.CreateModel(
            name="PreferenciaPush",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("habilitado", models.BooleanField(default=True)),
                ("solo_en_turno", models.BooleanField(default=False)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "usuario",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="preferencia_push",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "preferencia de push",
                "verbose_name_plural": "preferencias de push",
            },
        ),
    ]
