from django.conf import settings
from django.db import models


class ModeloBase(models.Model):
    """Campos de auditoría que tienen todas las tablas del sistema."""

    creado_en = models.DateTimeField("creado el", auto_now_add=True)
    actualizado_en = models.DateTimeField("actualizado el", auto_now=True)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="creado por",
        null=True,
        blank=True,
        editable=False,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    actualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="actualizado por",
        null=True,
        blank=True,
        editable=False,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        abstract = True
