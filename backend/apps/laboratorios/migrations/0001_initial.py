import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def auditoria():
    """Campos de ModeloBase."""
    return [
        ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
        ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
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
    ]


def id_field():
    return ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"))


ICONOS = [
    ("pc", "Computadora"),
    ("laptop", "Laptop"),
    ("proyector", "Proyector"),
    ("pantalla", "Pantalla de proyección"),
    ("pizarra", "Pizarra"),
    ("televisor", "Televisor"),
    ("impresora", "Impresora"),
    ("parlante", "Parlante"),
    ("camara", "Cámara"),
    ("router", "Router o switch"),
    ("servidor", "Servidor"),
    ("aire", "Aire acondicionado"),
    ("enchufe", "Toma de corriente"),
    ("puerta", "Puerta"),
    ("ventana", "Ventana"),
    ("mesa", "Mesa o escritorio"),
    ("silla", "Silla"),
    ("generico", "Genérico"),
]

CATEGORIAS = [
    ("equipo", "Equipo de cómputo"),
    ("audiovisual", "Audiovisual"),
    ("red", "Red y conectividad"),
    ("mobiliario", "Mobiliario"),
    ("infraestructura", "Infraestructura"),
    ("otro", "Otro"),
]


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TipoElemento",
            fields=[
                id_field(),
                *auditoria(),
                ("nombre", models.CharField(max_length=80, unique=True)),
                ("categoria", models.CharField(choices=CATEGORIAS, default="equipo", max_length=20)),
                ("icono", models.CharField(choices=ICONOS, default="generico", max_length=20)),
                ("imagen", models.ImageField(blank=True, upload_to="elementos/")),
                ("color", models.CharField(default="#034481", max_length=7)),
                (
                    "prefijo_etiqueta",
                    models.CharField(
                        blank=True,
                        help_text="Ej.: PC → PC-01, PC-02…",
                        max_length=10,
                        verbose_name="prefijo de etiqueta",
                    ),
                ),
                ("descripcion", models.TextField(blank=True, verbose_name="descripción")),
                ("activo", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "elemento",
                "verbose_name_plural": "elementos",
                "ordering": ["nombre"],
            },
        ),
        migrations.CreateModel(
            name="Software",
            fields=[
                id_field(),
                *auditoria(),
                ("nombre", models.CharField(max_length=100)),
                ("version", models.CharField(blank=True, max_length=50, verbose_name="versión")),
                ("descripcion", models.TextField(blank=True, verbose_name="descripción")),
            ],
            options={
                "verbose_name": "programa",
                "verbose_name_plural": "software",
                "ordering": ["nombre", "version"],
                "constraints": [
                    models.UniqueConstraint(fields=("nombre", "version"), name="software_unico"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Laboratorio",
            fields=[
                id_field(),
                *auditoria(),
                ("codigo", models.CharField(max_length=20, unique=True, verbose_name="código")),
                ("nombre", models.CharField(max_length=100)),
                ("ubicacion", models.CharField(blank=True, max_length=150, verbose_name="ubicación")),
                ("capacidad", models.PositiveIntegerField(default=0, help_text="Estudiantes que caben.")),
                (
                    "filas",
                    models.PositiveSmallIntegerField(
                        default=8,
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(40),
                        ],
                    ),
                ),
                (
                    "columnas",
                    models.PositiveSmallIntegerField(
                        default=10,
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(40),
                        ],
                    ),
                ),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("operativo", "Operativo"),
                            ("mantenimiento", "En mantenimiento"),
                            ("cerrado", "Cerrado"),
                        ],
                        default="operativo",
                        max_length=20,
                    ),
                ),
                (
                    "notas",
                    models.TextField(
                        blank=True, help_text="Información útil: horarios de limpieza, llaves, etc."
                    ),
                ),
                ("activo", models.BooleanField(default=True)),
                (
                    "software",
                    models.ManyToManyField(
                        blank=True,
                        related_name="laboratorios",
                        to="laboratorios.software",
                        verbose_name="software instalado",
                    ),
                ),
            ],
            options={
                "verbose_name": "laboratorio",
                "verbose_name_plural": "laboratorios",
                "ordering": ["codigo"],
            },
        ),
        migrations.CreateModel(
            name="ElementoLaboratorio",
            fields=[
                id_field(),
                *auditoria(),
                ("fila", models.PositiveSmallIntegerField()),
                ("columna", models.PositiveSmallIntegerField()),
                ("etiqueta", models.CharField(blank=True, max_length=30)),
                ("ip", models.GenericIPAddressField(blank=True, null=True, verbose_name="IP")),
                ("mac", models.CharField(blank=True, max_length=17, verbose_name="MAC")),
                (
                    "codigo_activo",
                    models.CharField(blank=True, max_length=50, verbose_name="código de activo"),
                ),
                ("especificaciones", models.TextField(blank=True)),
                ("descripcion", models.TextField(blank=True, verbose_name="descripción")),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("operativo", "Operativo"),
                            ("con_falla", "Con falla"),
                            ("mantenimiento", "En mantenimiento"),
                            ("baja", "De baja"),
                        ],
                        default="operativo",
                        max_length=20,
                    ),
                ),
                (
                    "laboratorio",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="elementos",
                        to="laboratorios.laboratorio",
                    ),
                ),
                (
                    "tipo",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="ubicados",
                        to="laboratorios.tipoelemento",
                    ),
                ),
            ],
            options={
                "verbose_name": "elemento del laboratorio",
                "verbose_name_plural": "elementos del laboratorio",
                "ordering": ["fila", "columna"],
                "constraints": [
                    models.UniqueConstraint(
                        deferrable=models.Deferrable["DEFERRED"],
                        fields=("laboratorio", "fila", "columna"),
                        name="elemento_unico_por_celda",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="CredencialLaboratorio",
            fields=[
                id_field(),
                *auditoria(),
                ("descripcion", models.CharField(max_length=120, verbose_name="descripción")),
                ("usuario", models.CharField(blank=True, max_length=120)),
                ("password_cifrado", models.TextField(blank=True, editable=False)),
                ("notas", models.TextField(blank=True)),
                (
                    "laboratorio",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="credenciales",
                        to="laboratorios.laboratorio",
                    ),
                ),
            ],
            options={
                "verbose_name": "credencial",
                "verbose_name_plural": "credenciales",
                "ordering": ["descripcion"],
            },
        ),
        migrations.CreateModel(
            name="RevelacionCredencial",
            fields=[
                id_field(),
                ("fecha", models.DateTimeField(auto_now_add=True)),
                (
                    "credencial",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="revelaciones",
                        to="laboratorios.credenciallaboratorio",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-fecha"],
            },
        ),
    ]
