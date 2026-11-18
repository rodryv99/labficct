import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """El tipo de un activo deja de ser obligatorio."""

    dependencies = [
        ("inventario", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="activo",
            name="tipo",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activos",
                to="inventario.tipoactivo",
            ),
        ),
    ]
