from django.db import migrations, models

import apps.usuarios.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="Usuario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                (
                    "is_superuser",
                    models.BooleanField(
                        default=False,
                        help_text="Designates that this user has all permissions without explicitly assigning them.",
                        verbose_name="superuser status",
                    ),
                ),
                ("email", models.EmailField(max_length=254, unique=True, verbose_name="correo")),
                (
                    "codigo",
                    models.CharField(
                        blank=True, max_length=30, null=True, unique=True, verbose_name="código institucional"
                    ),
                ),
                ("nombres", models.CharField(max_length=100)),
                ("apellidos", models.CharField(max_length=100)),
                (
                    "rol",
                    models.CharField(
                        choices=[
                            ("superadmin", "Superadmin"),
                            ("admin", "Admin (jefe de laboratorio)"),
                            ("auxiliar", "Auxiliar"),
                            ("docente", "Docente"),
                            ("administrativo", "Administrativo"),
                        ],
                        default="auxiliar",
                        max_length=20,
                    ),
                ),
                ("telefono", models.CharField(blank=True, max_length=30, verbose_name="teléfono")),
                ("is_active", models.BooleanField(default=True, verbose_name="activo")),
                ("is_staff", models.BooleanField(default=False, verbose_name="acceso al panel técnico")),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.group",
                        verbose_name="groups",
                    ),
                ),
                (
                    "user_permissions",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Specific permissions for this user.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.permission",
                        verbose_name="user permissions",
                    ),
                ),
            ],
            options={
                "verbose_name": "usuario",
                "verbose_name_plural": "usuarios",
                "ordering": ["apellidos", "nombres"],
            },
            managers=[
                ("objects", apps.usuarios.models.UsuarioManager()),
            ],
        ),
    ]
