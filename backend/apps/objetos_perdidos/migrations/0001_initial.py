import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

# Tercera capa de protección: aunque alguien intente borrar por SQL,
# PostgreSQL lo rechaza.
SQL_SIN_BORRADO = [
    """
    CREATE OR REPLACE FUNCTION impedir_borrado_objetos_perdidos() RETURNS trigger AS $$
    BEGIN
        RAISE EXCEPTION 'Los registros de objetos perdidos no se pueden eliminar.';
    END;
    $$ LANGUAGE plpgsql
    """,
    """
    CREATE TRIGGER objeto_sin_borrado
        BEFORE DELETE ON objetos_perdidos_objeto
        FOR EACH ROW EXECUTE FUNCTION impedir_borrado_objetos_perdidos()
    """,
    """
    CREATE TRIGGER evento_objeto_sin_borrado
        BEFORE DELETE ON objetos_perdidos_evento
        FOR EACH ROW EXECUTE FUNCTION impedir_borrado_objetos_perdidos()
    """,
]

SQL_REVERTIR = [
    "DROP TRIGGER IF EXISTS evento_objeto_sin_borrado ON objetos_perdidos_evento",
    "DROP TRIGGER IF EXISTS objeto_sin_borrado ON objetos_perdidos_objeto",
    "DROP FUNCTION IF EXISTS impedir_borrado_objetos_perdidos()",
]


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("laboratorios", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ObjetoPerdido",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
                ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
                ("descripcion", models.CharField(max_length=200, verbose_name="descripción")),
                (
                    "categoria",
                    models.CharField(
                        choices=[
                            ("electronico", "Electrónico"),
                            ("documento", "Documento o carnet"),
                            ("llaves", "Llaves"),
                            ("ropa", "Ropa"),
                            ("accesorio", "Accesorio"),
                            ("utiles", "Útiles"),
                            ("otro", "Otro"),
                        ],
                        default="otro",
                        max_length=20,
                        verbose_name="categoría",
                    ),
                ),
                (
                    "caracteristicas",
                    models.TextField(
                        blank=True,
                        help_text="Color, marca, detalles para reconocerlo.",
                        verbose_name="características",
                    ),
                ),
                ("foto", models.ImageField(blank=True, upload_to="objetos_perdidos/%Y/%m/")),
                (
                    "lugar",
                    models.CharField(
                        blank=True, help_text="Ej.: PC-12, debajo del escritorio.", max_length=150
                    ),
                ),
                ("fecha_hallazgo", models.DateTimeField(verbose_name="fecha y hora del hallazgo")),
                ("encontrado_por", models.CharField(blank=True, max_length=150)),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("en_custodia", "En custodia"),
                            ("entregado", "Entregado"),
                            ("anulado", "Anulado"),
                        ],
                        default="en_custodia",
                        max_length=20,
                    ),
                ),
                ("entregado_a", models.CharField(blank=True, max_length=150)),
                ("entregado_ci", models.CharField(blank=True, max_length=30, verbose_name="CI de quien recibe")),
                ("entregado_en", models.DateTimeField(blank=True, null=True)),
                ("motivo_anulacion", models.TextField(blank=True)),
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
                (
                    "entregado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "laboratorio",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="objetos_perdidos",
                        to="laboratorios.laboratorio",
                    ),
                ),
            ],
            options={
                "verbose_name": "objeto perdido",
                "verbose_name_plural": "objetos perdidos",
                "db_table": "objetos_perdidos_objeto",
                "ordering": ["-fecha_hallazgo"],
            },
        ),
        migrations.CreateModel(
            name="EventoObjeto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("registrado", "Registrado"),
                            ("editado", "Editado"),
                            ("entregado", "Entregado"),
                            ("anulado", "Anulado"),
                        ],
                        max_length=20,
                    ),
                ),
                ("detalle", models.TextField(blank=True)),
                ("fecha", models.DateTimeField(auto_now_add=True)),
                (
                    "objeto",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="eventos",
                        to="objetos_perdidos.objetoperdido",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "objetos_perdidos_evento",
                "ordering": ["-fecha", "-id"],
            },
        ),
        migrations.RunSQL(SQL_SIN_BORRADO, reverse_sql=SQL_REVERTIR),
    ]
