import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Segunda parte de 0002: el horario queda apuntando a la ficha Docente."""

    dependencies = [
        ("planificacion", "0002_docentes"),
    ]

    operations = [
        migrations.RemoveField(model_name="horario", name="docente"),
        migrations.RenameField(model_name="horario", old_name="docente_ficha", new_name="docente"),
        migrations.AlterField(
            model_name="horario",
            name="docente",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="horarios",
                to="planificacion.docente",
            ),
        ),
    ]
