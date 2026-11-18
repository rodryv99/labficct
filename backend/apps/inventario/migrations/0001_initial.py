import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

ESTADOS_ACTIVO = [
    ("operativo", "Operativo"),
    ("danado", "Dañado"),
    ("en_reparacion", "En reparación"),
    ("baja", "De baja"),
]

# Tipos iniciales; el Admin puede editarlos, desactivarlos o agregar más.
TIPOS = [
    "Computadora",
    "Monitor",
    "Teclado",
    "Mouse",
    "Estabilizador",
    "Proyector",
    "Impresora",
    "Switch o router",
    "Silla",
    "Mesa",
    "Pizarra",
    "Aire acondicionado",
    "Otro",
]


def datos_iniciales(apps, schema_editor):
    TipoActivo = apps.get_model("inventario", "TipoActivo")
    Lugar = apps.get_model("inventario", "Lugar")
    Laboratorio = apps.get_model("laboratorios", "Laboratorio")
    for nombre in TIPOS:
        TipoActivo.objects.get_or_create(nombre=nombre)
    Lugar.objects.get_or_create(nombre="Depósito", defaults={"tipo": "deposito"})
    # Cada laboratorio que ya existe es también un lugar del inventario.
    for lab in Laboratorio.objects.all():
        Lugar.objects.get_or_create(
            laboratorio_id=lab.pk,
            defaults={
                "nombre": f"{lab.codigo} · {lab.nombre}"[:120],
                "tipo": "laboratorio",
                "activo": lab.activo,
            },
        )


def campos_base():
    return [
        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
        ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
        ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
    ]


def campos_auditoria():
    return [
        (
            "actualizado_por",
            models.ForeignKey(
                blank=True,
                editable=False,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
                verbose_name="actualizado por",
            ),
        ),
        (
            "creado_por",
            models.ForeignKey(
                blank=True,
                editable=False,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
                verbose_name="creado por",
            ),
        ),
    ]


def usuario_opcional():
    return models.ForeignKey(
        blank=True,
        null=True,
        on_delete=django.db.models.deletion.SET_NULL,
        related_name="+",
        to=settings.AUTH_USER_MODEL,
    )


def lugar_protegido():
    return models.ForeignKey(
        blank=True,
        null=True,
        on_delete=django.db.models.deletion.PROTECT,
        related_name="+",
        to="inventario.lugar",
    )


def lugar_opcional():
    return models.ForeignKey(
        blank=True,
        null=True,
        on_delete=django.db.models.deletion.SET_NULL,
        related_name="+",
        to="inventario.lugar",
    )


class Migration(migrations.Migration):
    """Inventario de activos fijos: tipos, lugares, activos, movimientos y verificaciones."""

    initial = True

    dependencies = [
        ("laboratorios", "0001_initial"),
        ("tareas", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TipoActivo",
            fields=[
                *campos_base(),
                ("nombre", models.CharField(max_length=80, unique=True)),
                ("descripcion", models.TextField(blank=True, verbose_name="descripción")),
                ("activo", models.BooleanField(default=True)),
                *campos_auditoria(),
            ],
            options={
                "verbose_name": "tipo de activo",
                "verbose_name_plural": "tipos de activo",
                "ordering": ["nombre"],
            },
        ),
        migrations.CreateModel(
            name="Lugar",
            fields=[
                *campos_base(),
                ("nombre", models.CharField(max_length=120)),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("laboratorio", "Laboratorio"),
                            ("deposito", "Depósito"),
                            ("otro", "Otro lugar"),
                        ],
                        default="otro",
                        max_length=20,
                    ),
                ),
                ("descripcion", models.TextField(blank=True, verbose_name="descripción")),
                ("activo", models.BooleanField(default=True)),
                *campos_auditoria(),
                (
                    "laboratorio",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="lugar_inventario",
                        to="laboratorios.laboratorio",
                    ),
                ),
            ],
            options={
                "verbose_name": "lugar",
                "verbose_name_plural": "lugares",
                "ordering": ["tipo", "nombre"],
            },
        ),
        migrations.CreateModel(
            name="Activo",
            fields=[
                *campos_base(),
                ("codigo", models.CharField(max_length=30, unique=True, verbose_name="código")),
                ("descripcion", models.CharField(max_length=200, verbose_name="descripción")),
                ("marca", models.CharField(blank=True, max_length=80)),
                ("modelo", models.CharField(blank=True, max_length=80)),
                ("serie", models.CharField(blank=True, max_length=80, verbose_name="número de serie")),
                (
                    "fecha_adquisicion",
                    models.DateField(blank=True, null=True, verbose_name="fecha de adquisición"),
                ),
                ("estado", models.CharField(choices=ESTADOS_ACTIVO, default="operativo", max_length=20)),
                ("observaciones", models.TextField(blank=True)),
                *campos_auditoria(),
                (
                    "lugar",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="activos",
                        to="inventario.lugar",
                    ),
                ),
                (
                    "tipo",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="activos",
                        to="inventario.tipoactivo",
                    ),
                ),
            ],
            options={
                "verbose_name": "activo",
                "verbose_name_plural": "activos",
                "ordering": ["codigo"],
            },
        ),
        migrations.CreateModel(
            name="MovimientoActivo",
            fields=[
                *campos_base(),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("alta", "Alta"),
                            ("traslado", "Traslado"),
                            ("estado", "Cambio de estado"),
                            ("baja", "Baja"),
                        ],
                        max_length=20,
                    ),
                ),
                ("fecha", models.DateField(default=django.utils.timezone.localdate)),
                ("estado_anterior", models.CharField(blank=True, choices=ESTADOS_ACTIVO, max_length=20)),
                ("estado_nuevo", models.CharField(blank=True, choices=ESTADOS_ACTIVO, max_length=20)),
                ("motivo", models.TextField(blank=True)),
                (
                    "documento",
                    models.CharField(
                        blank=True, help_text="Respaldo: número de acta, nota o informe.", max_length=100
                    ),
                ),
                *campos_auditoria(),
                (
                    "activo",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="movimientos",
                        to="inventario.activo",
                    ),
                ),
                ("lugar_destino", lugar_protegido()),
                ("lugar_origen", lugar_protegido()),
            ],
            options={
                "verbose_name": "movimiento de activo",
                "verbose_name_plural": "movimientos de activos",
                "ordering": ["-fecha", "-id"],
            },
        ),
        migrations.CreateModel(
            name="CambioInventario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("cambios", models.JSONField(default=list)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "activo",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cambios",
                        to="inventario.activo",
                    ),
                ),
                (
                    "movimiento",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cambios",
                        to="inventario.movimientoactivo",
                    ),
                ),
                ("usuario", usuario_opcional()),
            ],
            options={
                "verbose_name": "corrección de inventario",
                "verbose_name_plural": "correcciones de inventario",
                "ordering": ["-creado_en", "-id"],
            },
        ),
        migrations.CreateModel(
            name="Verificacion",
            fields=[
                *campos_base(),
                ("titulo", models.CharField(max_length=150, verbose_name="título")),
                ("instrucciones", models.TextField(blank=True)),
                ("alcance", models.CharField(blank=True, max_length=255)),
                (
                    "estado",
                    models.CharField(
                        choices=[("abierta", "Abierta"), ("cerrada", "Cerrada"), ("cancelada", "Cancelada")],
                        default="abierta",
                        max_length=20,
                    ),
                ),
                ("fecha_limite", models.DateField(blank=True, null=True, verbose_name="fecha límite")),
                ("conclusion", models.TextField(blank=True, verbose_name="conclusión")),
                ("cerrada_en", models.DateTimeField(blank=True, null=True)),
                *campos_auditoria(),
                ("cerrada_por", usuario_opcional()),
                (
                    "responsables",
                    models.ManyToManyField(
                        blank=True, related_name="verificaciones_asignadas", to=settings.AUTH_USER_MODEL
                    ),
                ),
                (
                    "tarea",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="verificacion",
                        to="tareas.tarea",
                    ),
                ),
            ],
            options={
                "verbose_name": "verificación de inventario",
                "verbose_name_plural": "verificaciones de inventario",
                "ordering": ["-creado_en"],
            },
        ),
        migrations.CreateModel(
            name="ItemVerificacion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("codigo", models.CharField(max_length=30, verbose_name="código")),
                ("descripcion", models.CharField(max_length=200, verbose_name="descripción")),
                ("tipo_nombre", models.CharField(max_length=80)),
                ("lugar_nombre", models.CharField(max_length=120)),
                (
                    "resultado",
                    models.CharField(
                        choices=[
                            ("pendiente", "Sin revisar"),
                            ("esta", "Está"),
                            ("falta", "Falta"),
                            ("otro_lugar", "En otro lugar"),
                            ("danado", "Dañado"),
                        ],
                        default="pendiente",
                        max_length=20,
                    ),
                ),
                ("nota", models.CharField(blank=True, max_length=300)),
                ("verificado_en", models.DateTimeField(blank=True, null=True)),
                (
                    "activo",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="verificaciones",
                        to="inventario.activo",
                    ),
                ),
                ("lugar", lugar_opcional()),
                ("lugar_encontrado", lugar_opcional()),
                ("verificado_por", usuario_opcional()),
                (
                    "verificacion",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="inventario.verificacion",
                    ),
                ),
            ],
            options={
                "verbose_name": "activo por verificar",
                "verbose_name_plural": "activos por verificar",
                "ordering": ["lugar_nombre", "codigo"],
            },
        ),
        migrations.AddConstraint(
            model_name="itemverificacion",
            constraint=models.UniqueConstraint(
                fields=("verificacion", "activo"), name="item_verificacion_unico"
            ),
        ),
        migrations.RunPython(datos_iniciales, migrations.RunPython.noop),
    ]
