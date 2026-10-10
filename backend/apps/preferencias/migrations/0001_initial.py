import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

# Opciones iniciales; el Admin puede editarlas, desactivarlas o agregar más.
OPCIONES = [
    (
        "¿Tus estudiantes pueden entrar al aula antes de que llegues?",
        "Los estudiantes pueden entrar antes de que llegue el docente.",
        "Los estudiantes esperan afuera hasta que llegue el docente.",
    ),
    (
        "¿Se puede borrar la pizarra al terminar tu clase?",
        "Se puede borrar la pizarra al terminar la clase.",
        "No borrar la pizarra al terminar la clase.",
    ),
    (
        "¿Quieres las computadoras encendidas cuando llegues?",
        "Encender las computadoras antes de la clase.",
        "Dejar las computadoras apagadas.",
    ),
    (
        "¿Usas el proyector en tus clases?",
        "Dejar el proyector encendido y listo.",
        "No hace falta el proyector.",
    ),
]


def crear_opciones(apps, schema_editor):
    OpcionPreferencia = apps.get_model("preferencias", "OpcionPreferencia")
    for orden, (pregunta, texto_si, texto_no) in enumerate(OPCIONES, 1):
        OpcionPreferencia.objects.create(pregunta=pregunta, texto_si=texto_si, texto_no=texto_no, orden=orden)


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
        ("planificacion", "0004_reserva_aprobacion"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="OpcionPreferencia",
            fields=[
                *campos_base(),
                ("pregunta", models.CharField(max_length=150)),
                ("texto_si", models.CharField(max_length=150, verbose_name="texto si responde sí")),
                ("texto_no", models.CharField(max_length=150, verbose_name="texto si responde no")),
                ("orden", models.PositiveSmallIntegerField(default=0)),
                ("activa", models.BooleanField(default=True)),
                *auditoria(),
            ],
            options={
                "verbose_name": "opción de preferencia",
                "verbose_name_plural": "opciones de preferencia",
                "ordering": ["orden", "id"],
            },
        ),
        migrations.CreateModel(
            name="PreferenciasDocente",
            fields=[
                *campos_base(),
                ("valores", models.JSONField(blank=True, default=dict)),
                ("nota", models.TextField(blank=True)),
                (
                    "docente",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="preferencias",
                        to="planificacion.docente",
                    ),
                ),
                *auditoria(),
            ],
            options={
                "verbose_name": "preferencias del docente",
                "verbose_name_plural": "preferencias de los docentes",
            },
        ),
        migrations.RunPython(crear_opciones, migrations.RunPython.noop),
    ]
