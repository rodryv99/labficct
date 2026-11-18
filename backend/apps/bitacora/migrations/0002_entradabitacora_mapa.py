from django.db import migrations, models


class Migration(migrations.Migration):
    """Bitácora estilo OrganiLab: cada entrada puede llevar un mapa pintado del laboratorio."""

    dependencies = [
        ("bitacora", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="entradabitacora",
            name="mapa",
            field=models.JSONField(blank=True, default=None, null=True),
        ),
    ]
