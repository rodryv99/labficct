from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="terminos_aceptados_en",
            field=models.DateTimeField(
                blank=True, null=True, verbose_name="términos aceptados el"
            ),
        ),
        migrations.AddField(
            model_name="usuario",
            name="terminos_version",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                verbose_name="versión de términos aceptada",
            ),
        ),
    ]
