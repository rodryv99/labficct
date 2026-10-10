"""Docentes como fichas propias, con usuario opcional.

Antes, Horario.docente apuntaba a un Usuario. Ahora apunta a una ficha Docente,
que puede existir sin cuenta. Los docentes que ya tenían usuario reciben su
ficha vinculada y sus horarios pasan a ella; no se pierde nada.

El cambio va en dos migraciones: PostgreSQL no deja alterar una tabla en la
misma transacción en que se actualizaron sus filas (0003 quita el campo viejo).
"""

import django.db.models.deletion
import django.db.models.functions.text
from django.conf import settings
from django.db import migrations, models


def crear_fichas(apps, schema_editor):
    Usuario = apps.get_model("usuarios", "Usuario")
    Docente = apps.get_model("planificacion", "Docente")
    Horario = apps.get_model("planificacion", "Horario")

    con_horarios = Horario.objects.exclude(docente_id=None).values_list("docente_id", flat=True)
    usuarios = Usuario.objects.filter(models.Q(rol="docente") | models.Q(pk__in=con_horarios)).distinct()
    ficha_de = {}
    for u in usuarios:
        ficha_de[u.pk] = Docente.objects.create(
            nombres=u.nombres,
            apellidos=u.apellidos,
            email=u.email or "",
            telefono=u.telefono or "",
            usuario_id=u.pk,
            activo=u.is_active,
        )
    for h in Horario.objects.exclude(docente_id=None):
        h.docente_ficha_id = ficha_de[h.docente_id].pk
        h.save(update_fields=["docente_ficha"])
    schema_editor.execute("SET CONSTRAINTS ALL IMMEDIATE")


def deshacer(apps, schema_editor):
    Horario = apps.get_model("planificacion", "Horario")
    for h in Horario.objects.exclude(docente_ficha_id=None).select_related("docente_ficha"):
        h.docente_id = h.docente_ficha.usuario_id
        h.save(update_fields=["docente"])
    # Las claves foráneas diferidas dejarían eventos pendientes y PostgreSQL no
    # permitiría el ALTER TABLE siguiente: se comprueban ya.
    schema_editor.execute("SET CONSTRAINTS ALL IMMEDIATE")


class Migration(migrations.Migration):
    dependencies = [
        ("planificacion", "0001_initial"),
        ("usuarios", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Docente",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("creado_en", models.DateTimeField(auto_now_add=True, verbose_name="creado el")),
                ("actualizado_en", models.DateTimeField(auto_now=True, verbose_name="actualizado el")),
                ("nombres", models.CharField(max_length=100)),
                ("apellidos", models.CharField(max_length=100)),
                ("email", models.EmailField(blank=True, max_length=254, verbose_name="correo")),
                ("telefono", models.CharField(blank=True, max_length=30, verbose_name="teléfono")),
                ("activo", models.BooleanField(default=True)),
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
                (
                    "usuario",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ficha_docente",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "docente",
                "verbose_name_plural": "docentes",
                "ordering": ["apellidos", "nombres"],
                "constraints": [
                    models.UniqueConstraint(
                        django.db.models.functions.text.Lower("email"),
                        condition=models.Q(("email", ""), _negated=True),
                        name="docente_email_unico",
                    ),
                ],
            },
        ),
        migrations.AddField(
            model_name="horario",
            name="docente_ficha",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="planificacion.docente",
            ),
        ),
        migrations.RunPython(crear_fichas, deshacer),
    ]
