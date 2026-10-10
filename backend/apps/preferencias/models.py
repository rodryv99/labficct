from django.db import models

from apps.core.models import ModeloBase


class OpcionPreferencia(ModeloBase):
    """Algo que el docente puede pedir sobre el aula (sí o no). La lista la edita el Admin.

    `pregunta` es lo que ve el docente; `texto_si` y `texto_no`, lo que leen los
    auxiliares en el aviso de alistar el aula, según lo que haya respondido.
    """

    pregunta = models.CharField(max_length=150)
    texto_si = models.CharField("texto si responde sí", max_length=150)
    texto_no = models.CharField("texto si responde no", max_length=150)
    orden = models.PositiveSmallIntegerField(default=0)
    activa = models.BooleanField(default=True)

    class Meta:
        verbose_name = "opción de preferencia"
        verbose_name_plural = "opciones de preferencia"
        ordering = ["orden", "id"]

    def __str__(self):
        return self.pregunta


class PreferenciasDocente(ModeloBase):
    """Lo que respondió un docente. Vale para todas sus clases."""

    docente = models.OneToOneField(
        "planificacion.Docente", on_delete=models.CASCADE, related_name="preferencias"
    )
    # {"<id de la opción>": true | false}. Si una opción no está, el docente no tiene preferencia.
    valores = models.JSONField(default=dict, blank=True)
    nota = models.TextField(blank=True)

    class Meta:
        verbose_name = "preferencias del docente"
        verbose_name_plural = "preferencias de los docentes"

    def __str__(self):
        return f"Preferencias de {self.docente}"
