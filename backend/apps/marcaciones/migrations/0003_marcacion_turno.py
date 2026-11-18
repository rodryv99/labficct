from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marcaciones", "0002_horarios"),
    ]

    operations = [
        migrations.AddField(
            model_name="marcacion",
            name="turno_inicio",
            field=models.TimeField(blank=True, null=True, verbose_name="inicio del turno"),
        ),
        migrations.AddField(
            model_name="marcacion",
            name="turno_fin",
            field=models.TimeField(blank=True, null=True, verbose_name="fin del turno"),
        ),
        migrations.AddField(
            model_name="marcacion",
            name="retraso_min",
            field=models.PositiveSmallIntegerField(default=0, verbose_name="retraso en la entrada (min)"),
        ),
        migrations.AddField(
            model_name="marcacion",
            name="salida_temprana_min",
            field=models.PositiveSmallIntegerField(default=0, verbose_name="salida anticipada (min)"),
        ),
    ]
