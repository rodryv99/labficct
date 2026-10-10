import apps.core.almacenamiento
from django.db import migrations, models


def campo(nombre):
    return models.ImageField(
        blank=True,
        storage=apps.core.almacenamiento.almacen_privado,
        upload_to=apps.core.almacenamiento.ruta_entrega,
        verbose_name=nombre,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("objetos_perdidos", "0001_initial"),
    ]

    operations = [
        migrations.AddField(model_name="objetoperdido", name="entrega_ci_anverso", field=campo("CI (anverso)")),
        migrations.AddField(model_name="objetoperdido", name="entrega_ci_reverso", field=campo("CI (reverso)")),
        migrations.AddField(
            model_name="objetoperdido", name="entrega_foto_persona", field=campo("foto de quien recibe")
        ),
    ]
