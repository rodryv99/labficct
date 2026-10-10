import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def pendientes_no_ocupan(apps, schema_editor):
    """Antes "pendiente" era un estado que se elegía a mano y ocupaba el laboratorio.
    Ahora significa "por aprobar": sus bloques no ocupan hasta que se aprueba."""
    BloqueReserva = apps.get_model("planificacion", "BloqueReserva")
    BloqueReserva.objects.filter(reserva__estado="pendiente").update(activo=False)


class Migration(migrations.Migration):
    """Reservas que chocan: quedan por aprobar y, al aprobarse, suspenden las clases."""

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("planificacion", "0003_horario_docente_ficha"),
    ]

    operations = [
        migrations.AlterField(
            model_name="reserva",
            name="estado",
            field=models.CharField(
                choices=[
                    ("pendiente", "Por aprobar"),
                    ("confirmada", "Confirmada"),
                    ("cancelada", "Cancelada"),
                ],
                default="confirmada",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="reserva",
            name="aprobada_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="reserva",
            name="aprobada_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="excepcionhorario",
            name="reserva",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="clases_suspendidas",
                to="planificacion.reserva",
            ),
        ),
        migrations.RunPython(pendientes_no_ocupan, migrations.RunPython.noop),
    ]
