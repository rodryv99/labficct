from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations


class Migration(migrations.Migration):
    """btree_gist permite combinar igualdad (mismo laboratorio) y solapamiento
    de rangos (misma hora) en una restricción de exclusión."""

    initial = True
    dependencies = []
    operations = [BtreeGistExtension()]
