from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import models

from apps.core.almacenamiento import almacen_privado, ruta_entrega
from apps.core.models import ModeloBase
from apps.laboratorios.models import Laboratorio

MENSAJE_NO_BORRAR = "Los registros de objetos perdidos no se pueden eliminar. Usa Anular."


class CategoriaObjeto(models.TextChoices):
    ELECTRONICO = "electronico", "Electrónico"
    DOCUMENTO = "documento", "Documento o carnet"
    LLAVES = "llaves", "Llaves"
    ROPA = "ropa", "Ropa"
    ACCESORIO = "accesorio", "Accesorio"
    UTILES = "utiles", "Útiles"
    OTRO = "otro", "Otro"


class EstadoObjeto(models.TextChoices):
    EN_CUSTODIA = "en_custodia", "En custodia"
    ENTREGADO = "entregado", "Entregado"
    ANULADO = "anulado", "Anulado"


class ObjetoPerdido(ModeloBase):
    """7. Objeto encontrado en un laboratorio. Nunca se borra: se entrega o se anula."""

    descripcion = models.CharField("descripción", max_length=200)
    categoria = models.CharField(
        "categoría", max_length=20, choices=CategoriaObjeto.choices, default=CategoriaObjeto.OTRO
    )
    caracteristicas = models.TextField(
        "características", blank=True, help_text="Color, marca, detalles para reconocerlo."
    )
    foto = models.ImageField(upload_to="objetos_perdidos/%Y/%m/", blank=True)
    laboratorio = models.ForeignKey(
        Laboratorio,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="objetos_perdidos",
    )
    lugar = models.CharField(max_length=150, blank=True, help_text="Ej.: PC-12, debajo del escritorio.")
    fecha_hallazgo = models.DateTimeField("fecha y hora del hallazgo")
    encontrado_por = models.CharField(max_length=150, blank=True)
    estado = models.CharField(
        max_length=20, choices=EstadoObjeto.choices, default=EstadoObjeto.EN_CUSTODIA
    )
    entregado_a = models.CharField(max_length=150, blank=True)
    entregado_ci = models.CharField("CI de quien recibe", max_length=30, blank=True)
    entregado_en = models.DateTimeField(null=True, blank=True)
    entregado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    # Fotos opcionales al entregar. Son datos personales: se guardan en PRIVADO_ROOT,
    # sin URL pública, y solo se ven por la API con el permiso objetos.ver.
    entrega_ci_anverso = models.ImageField(
        "CI (anverso)", upload_to=ruta_entrega, storage=almacen_privado, blank=True
    )
    entrega_ci_reverso = models.ImageField(
        "CI (reverso)", upload_to=ruta_entrega, storage=almacen_privado, blank=True
    )
    entrega_foto_persona = models.ImageField(
        "foto de quien recibe", upload_to=ruta_entrega, storage=almacen_privado, blank=True
    )
    motivo_anulacion = models.TextField(blank=True)

    class Meta:
        db_table = "objetos_perdidos_objeto"
        verbose_name = "objeto perdido"
        verbose_name_plural = "objetos perdidos"
        ordering = ["-fecha_hallazgo"]

    def __str__(self):
        return f"{self.codigo} · {self.descripcion}"

    @property
    def codigo(self) -> str:
        anio = self.fecha_hallazgo.year if self.fecha_hallazgo else ""
        return f"OP-{anio}-{self.pk or 0:04d}"

    def delete(self, *args, **kwargs):
        raise PermissionDenied(MENSAJE_NO_BORRAR)


# Nombre en la URL → campo del modelo. /objetos-perdidos/<id>/entrega/<nombre>/
FOTOS_ENTREGA = {
    "ci-anverso": "entrega_ci_anverso",
    "ci-reverso": "entrega_ci_reverso",
    "persona": "entrega_foto_persona",
}


class TipoEvento(models.TextChoices):
    REGISTRADO = "registrado", "Registrado"
    EDITADO = "editado", "Editado"
    ENTREGADO = "entregado", "Entregado"
    ANULADO = "anulado", "Anulado"


class EventoObjeto(models.Model):
    """Historial legible de cada objeto: quién hizo qué y cuándo."""

    objeto = models.ForeignKey(ObjetoPerdido, on_delete=models.PROTECT, related_name="eventos")
    tipo = models.CharField(max_length=20, choices=TipoEvento.choices)
    detalle = models.TextField(blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, related_name="+"
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "objetos_perdidos_evento"
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"{self.get_tipo_display()} · {self.fecha:%d/%m/%Y %H:%M}"

    def delete(self, *args, **kwargs):
        raise PermissionDenied(MENSAJE_NO_BORRAR)
