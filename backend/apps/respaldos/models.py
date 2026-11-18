"""Respaldos (copias de seguridad) de la base de datos.

Cada registro apunta a un archivo .sql generado con pg_dump y guardado en la carpeta
de respaldos del servidor (RESPALDO_DIR). El Admin los genera y descarga desde la web
o la app; también puede haber uno automático diario (ver apps.respaldos.tasks).
"""

from django.db import models

from apps.core.models import ModeloBase


class Respaldo(ModeloBase):
    ORIGEN = [("manual", "Manual"), ("automatico", "Automático")]

    archivo = models.CharField("nombre del archivo", max_length=255)
    tamano_bytes = models.BigIntegerField("tamaño (bytes)", default=0)
    origen = models.CharField(max_length=12, choices=ORIGEN, default="manual")
    # Para reconocer la base y la versión con que se hizo.
    base_datos = models.CharField(max_length=120, blank=True)
    nota = models.CharField(max_length=300, blank=True)

    class Meta:
        verbose_name = "respaldo"
        verbose_name_plural = "respaldos"
        ordering = ["-creado_en"]

    def __str__(self):
        return self.archivo
