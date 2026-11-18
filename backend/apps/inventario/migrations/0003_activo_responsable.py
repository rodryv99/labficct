from django.db import migrations, models


class Migration(migrations.Migration):
    """El activo guarda a su responsable (custodio), como en el acta de patrimonio."""

    dependencies = [
        ("inventario", "0002_activo_tipo_opcional"),
    ]

    operations = [
        migrations.AddField(
            model_name="activo",
            name="responsable",
            field=models.CharField(blank=True, default="", max_length=120, verbose_name="responsable"),
            preserve_default=False,
        ),
    ]
