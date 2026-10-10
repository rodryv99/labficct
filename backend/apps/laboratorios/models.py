from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import ModeloBase

LIMITE_GRILLA = 40


class CategoriaElemento(models.TextChoices):
    EQUIPO = "equipo", "Equipo de cómputo"
    AUDIOVISUAL = "audiovisual", "Audiovisual"
    RED = "red", "Red y conectividad"
    MOBILIARIO = "mobiliario", "Mobiliario"
    INFRAESTRUCTURA = "infraestructura", "Infraestructura"
    OTRO = "otro", "Otro"


class IconoElemento(models.TextChoices):
    """Íconos incluidos en la web y la app. Un elemento también puede usar una imagen propia."""

    PC = "pc", "Computadora"
    LAPTOP = "laptop", "Laptop"
    PROYECTOR = "proyector", "Proyector"
    PANTALLA = "pantalla", "Pantalla de proyección"
    PIZARRA = "pizarra", "Pizarra"
    TELEVISOR = "televisor", "Televisor"
    IMPRESORA = "impresora", "Impresora"
    PARLANTE = "parlante", "Parlante"
    CAMARA = "camara", "Cámara"
    ROUTER = "router", "Router o switch"
    SERVIDOR = "servidor", "Servidor"
    AIRE = "aire", "Aire acondicionado"
    ENCHUFE = "enchufe", "Toma de corriente"
    PUERTA = "puerta", "Puerta"
    VENTANA = "ventana", "Ventana"
    MESA = "mesa", "Mesa o escritorio"
    SILLA = "silla", "Silla"
    GENERICO = "generico", "Genérico"


class TipoElemento(ModeloBase):
    """Lo que en OrganiLab era un 'ícono': PC, proyector, pizarra..."""

    nombre = models.CharField(max_length=80, unique=True)
    categoria = models.CharField(
        max_length=20, choices=CategoriaElemento.choices, default=CategoriaElemento.EQUIPO
    )
    icono = models.CharField(
        max_length=20, choices=IconoElemento.choices, default=IconoElemento.GENERICO
    )
    imagen = models.ImageField(upload_to="elementos/", blank=True)
    color = models.CharField(max_length=7, default="#034481")
    prefijo_etiqueta = models.CharField(
        "prefijo de etiqueta", max_length=10, blank=True, help_text="Ej.: PC → PC-01, PC-02…"
    )
    descripcion = models.TextField("descripción", blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "elemento"
        verbose_name_plural = "elementos"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Software(ModeloBase):
    nombre = models.CharField(max_length=100)
    version = models.CharField("versión", max_length=50, blank=True)
    descripcion = models.TextField("descripción", blank=True)

    class Meta:
        verbose_name = "programa"
        verbose_name_plural = "software"
        ordering = ["nombre", "version"]
        constraints = [
            models.UniqueConstraint(fields=["nombre", "version"], name="software_unico"),
        ]

    def __str__(self):
        return f"{self.nombre} {self.version}".strip()


class EstadoLaboratorio(models.TextChoices):
    OPERATIVO = "operativo", "Operativo"
    MANTENIMIENTO = "mantenimiento", "En mantenimiento"
    CERRADO = "cerrado", "Cerrado"


class Laboratorio(ModeloBase):
    codigo = models.CharField("código", max_length=20, unique=True)
    nombre = models.CharField(max_length=100)
    ubicacion = models.CharField("ubicación", max_length=150, blank=True)
    capacidad = models.PositiveIntegerField(default=0, help_text="Estudiantes que caben.")
    filas = models.PositiveSmallIntegerField(
        default=8, validators=[MinValueValidator(1), MaxValueValidator(LIMITE_GRILLA)]
    )
    columnas = models.PositiveSmallIntegerField(
        default=10, validators=[MinValueValidator(1), MaxValueValidator(LIMITE_GRILLA)]
    )
    estado = models.CharField(
        max_length=20, choices=EstadoLaboratorio.choices, default=EstadoLaboratorio.OPERATIVO
    )
    notas = models.TextField(blank=True, help_text="Información útil: horarios de limpieza, llaves, etc.")
    software = models.ManyToManyField(
        Software, blank=True, related_name="laboratorios", verbose_name="software instalado"
    )
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "laboratorio"
        verbose_name_plural = "laboratorios"
        ordering = ["codigo"]

    def __str__(self):
        return f"{self.codigo} · {self.nombre}"


class EstadoElemento(models.TextChoices):
    OPERATIVO = "operativo", "Operativo"
    CON_FALLA = "con_falla", "Con falla"
    MANTENIMIENTO = "mantenimiento", "En mantenimiento"
    BAJA = "baja", "De baja"


class ElementoLaboratorio(ModeloBase):
    """Un elemento colocado en una casilla de la grilla de un laboratorio."""

    laboratorio = models.ForeignKey(
        Laboratorio, on_delete=models.CASCADE, related_name="elementos"
    )
    tipo = models.ForeignKey(TipoElemento, on_delete=models.PROTECT, related_name="ubicados")
    fila = models.PositiveSmallIntegerField()
    columna = models.PositiveSmallIntegerField()
    etiqueta = models.CharField(max_length=30, blank=True)
    ip = models.GenericIPAddressField("IP", null=True, blank=True)
    mac = models.CharField("MAC", max_length=17, blank=True)
    codigo_activo = models.CharField("código de activo", max_length=50, blank=True)
    especificaciones = models.TextField(blank=True)
    descripcion = models.TextField("descripción", blank=True)
    estado = models.CharField(
        max_length=20, choices=EstadoElemento.choices, default=EstadoElemento.OPERATIVO
    )

    class Meta:
        verbose_name = "elemento del laboratorio"
        verbose_name_plural = "elementos del laboratorio"
        ordering = ["fila", "columna"]
        constraints = [
            # Diferida: permite intercambiar dos elementos de casilla en una sola transacción.
            models.UniqueConstraint(
                fields=["laboratorio", "fila", "columna"],
                name="elemento_unico_por_celda",
                deferrable=models.Deferrable.DEFERRED,
            ),
        ]

    def __str__(self):
        return self.etiqueta or f"{self.tipo} ({self.fila + 1}, {self.columna + 1})"


class CredencialLaboratorio(ModeloBase):
    laboratorio = models.ForeignKey(
        Laboratorio, on_delete=models.CASCADE, related_name="credenciales"
    )
    descripcion = models.CharField("descripción", max_length=120)
    usuario = models.CharField(max_length=120, blank=True)
    password_cifrado = models.TextField(blank=True, editable=False)
    notas = models.TextField(blank=True)

    class Meta:
        verbose_name = "credencial"
        verbose_name_plural = "credenciales"
        ordering = ["descripcion"]

    def __str__(self):
        return f"{self.laboratorio.codigo} · {self.descripcion}"


class RevelacionCredencial(models.Model):
    """Cada vez que alguien muestra una contraseña queda anotado aquí."""

    credencial = models.ForeignKey(
        CredencialLaboratorio, on_delete=models.CASCADE, related_name="revelaciones"
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.credencial} · {self.usuario} · {self.fecha:%d/%m/%Y %H:%M}"
