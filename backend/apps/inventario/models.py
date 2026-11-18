from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import ModeloBase
from apps.laboratorios.models import Laboratorio


class TipoActivo(ModeloBase):
    """Qué clase de bien es: silla, mesa, computadora, estabilizador…"""

    nombre = models.CharField(max_length=80, unique=True)
    descripcion = models.TextField("descripción", blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "tipo de activo"
        verbose_name_plural = "tipos de activo"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class TipoLugar(models.TextChoices):
    LABORATORIO = "laboratorio", "Laboratorio"
    DEPOSITO = "deposito", "Depósito"
    OTRO = "otro", "Otro lugar"


class Lugar(ModeloBase):
    """Dónde puede estar un activo: un laboratorio, un depósito u otro ambiente.

    Los lugares de tipo laboratorio se crean solos (uno por laboratorio) y siguen
    su código y nombre. Los demás los administra el Admin.
    """

    nombre = models.CharField(max_length=120)
    tipo = models.CharField(max_length=20, choices=TipoLugar.choices, default=TipoLugar.OTRO)
    laboratorio = models.OneToOneField(
        Laboratorio,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lugar_inventario",
    )
    descripcion = models.TextField("descripción", blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "lugar"
        verbose_name_plural = "lugares"
        ordering = ["tipo", "nombre"]

    def __str__(self):
        return self.nombre


class EstadoActivo(models.TextChoices):
    OPERATIVO = "operativo", "Operativo"
    DANADO = "danado", "Dañado"
    EN_REPARACION = "en_reparacion", "En reparación"
    BAJA = "baja", "De baja"


class Activo(ModeloBase):
    """15. Un bien inventariado (activo fijo). Nunca se borra: se da de baja.

    El lugar y el estado no se editan directamente: cambian con un movimiento
    (traslado, cambio de estado o baja), y así queda el historial.
    """

    codigo = models.CharField("código", max_length=30, unique=True)
    descripcion = models.CharField("descripción", max_length=200)
    tipo = models.ForeignKey(
        TipoActivo, on_delete=models.PROTECT, null=True, blank=True, related_name="activos"
    )
    marca = models.CharField(max_length=80, blank=True)
    modelo = models.CharField(max_length=80, blank=True)
    serie = models.CharField("número de serie", max_length=80, blank=True)
    fecha_adquisicion = models.DateField("fecha de adquisición", null=True, blank=True)
    estado = models.CharField(max_length=20, choices=EstadoActivo.choices, default=EstadoActivo.OPERATIVO)
    lugar = models.ForeignKey(Lugar, on_delete=models.PROTECT, related_name="activos")
    # Quién custodia el bien (p. ej. el responsable que figura en el acta de patrimonio).
    responsable = models.CharField("responsable", max_length=120, blank=True)
    observaciones = models.TextField(blank=True)

    class Meta:
        verbose_name = "activo"
        verbose_name_plural = "activos"
        ordering = ["codigo"]

    def __str__(self):
        return f"{self.codigo} · {self.descripcion}"


class TipoMovimiento(models.TextChoices):
    ALTA = "alta", "Alta"
    TRASLADO = "traslado", "Traslado"
    ESTADO = "estado", "Cambio de estado"
    BAJA = "baja", "Baja"


class MovimientoActivo(ModeloBase):
    """Algo que le pasó a un activo: entró al inventario, se trasladó, cambió de estado
    o se dio de baja. No se borra; se puede corregir y la corrección queda registrada."""

    activo = models.ForeignKey(Activo, on_delete=models.PROTECT, related_name="movimientos")
    tipo = models.CharField(max_length=20, choices=TipoMovimiento.choices)
    fecha = models.DateField(default=timezone.localdate)
    lugar_origen = models.ForeignKey(Lugar, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    lugar_destino = models.ForeignKey(
        Lugar, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    estado_anterior = models.CharField(max_length=20, choices=EstadoActivo.choices, blank=True)
    estado_nuevo = models.CharField(max_length=20, choices=EstadoActivo.choices, blank=True)
    motivo = models.TextField(blank=True)
    documento = models.CharField(
        max_length=100, blank=True, help_text="Respaldo: número de acta, nota o informe."
    )

    class Meta:
        verbose_name = "movimiento de activo"
        verbose_name_plural = "movimientos de activos"
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"{self.get_tipo_display()} · {self.activo_id} · {self.fecha:%d/%m/%Y}"


class CambioInventario(models.Model):
    """Historial de correcciones: quién cambió qué dato de un activo o de un movimiento."""

    activo = models.ForeignKey(Activo, on_delete=models.CASCADE, related_name="cambios")
    movimiento = models.ForeignKey(
        MovimientoActivo, on_delete=models.CASCADE, null=True, blank=True, related_name="cambios"
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    # [{"campo": "Marca", "antes": "HP", "despues": "Dell"}, …]
    cambios = models.JSONField(default=list)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "corrección de inventario"
        verbose_name_plural = "correcciones de inventario"
        ordering = ["-creado_en", "-id"]

    def __str__(self):
        return f"{self.activo_id} · {self.creado_en:%d/%m/%Y %H:%M}"


class EstadoVerificacion(models.TextChoices):
    ABIERTA = "abierta", "Abierta"
    CERRADA = "cerrada", "Cerrada"
    CANCELADA = "cancelada", "Cancelada"


class Verificacion(ModeloBase):
    """Una lista de activos que el Admin manda a verificar (¿están donde deberían?).

    Al crearla se copia la lista de activos tal como estaba y aparece una tarea en el
    pizarrón. Los auxiliares marcan cada activo; el Admin la cierra. Las diferencias
    no mueven nada solas: el Admin decide y registra el traslado o la baja.
    """

    titulo = models.CharField("título", max_length=150)
    instrucciones = models.TextField(blank=True)
    # Texto que describe qué se pidió verificar: "Todos los activos", "Tipo: Silla · Lugar: LAB-41"…
    alcance = models.CharField(max_length=255, blank=True)
    estado = models.CharField(
        max_length=20, choices=EstadoVerificacion.choices, default=EstadoVerificacion.ABIERTA
    )
    responsables = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="verificaciones_asignadas"
    )
    fecha_limite = models.DateField("fecha límite", null=True, blank=True)
    tarea = models.OneToOneField(
        "tareas.Tarea", on_delete=models.SET_NULL, null=True, blank=True, related_name="verificacion"
    )
    conclusion = models.TextField("conclusión", blank=True)
    cerrada_en = models.DateTimeField(null=True, blank=True)
    cerrada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        verbose_name = "verificación de inventario"
        verbose_name_plural = "verificaciones de inventario"
        ordering = ["-creado_en"]

    def __str__(self):
        return self.titulo


class ResultadoVerificacion(models.TextChoices):
    PENDIENTE = "pendiente", "Sin revisar"
    ESTA = "esta", "Está"
    FALTA = "falta", "Falta"
    OTRO_LUGAR = "otro_lugar", "En otro lugar"
    DANADO = "danado", "Dañado"


class ItemVerificacion(models.Model):
    """Un activo dentro de una verificación, con sus datos copiados al crearla."""

    verificacion = models.ForeignKey(Verificacion, on_delete=models.CASCADE, related_name="items")
    activo = models.ForeignKey(Activo, on_delete=models.PROTECT, related_name="verificaciones")
    codigo = models.CharField("código", max_length=30)
    descripcion = models.CharField("descripción", max_length=200)
    tipo_nombre = models.CharField(max_length=80)
    lugar = models.ForeignKey(Lugar, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    lugar_nombre = models.CharField(max_length=120)
    resultado = models.CharField(
        max_length=20, choices=ResultadoVerificacion.choices, default=ResultadoVerificacion.PENDIENTE
    )
    lugar_encontrado = models.ForeignKey(
        Lugar, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    nota = models.CharField(max_length=300, blank=True)
    verificado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    verificado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "activo por verificar"
        verbose_name_plural = "activos por verificar"
        ordering = ["lugar_nombre", "codigo"]
        constraints = [
            models.UniqueConstraint(fields=["verificacion", "activo"], name="item_verificacion_unico"),
        ]

    def __str__(self):
        return f"{self.codigo} · {self.get_resultado_display()}"
