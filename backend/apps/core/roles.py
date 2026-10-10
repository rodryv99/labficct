from django.db import models


class Rol(models.TextChoices):
    SUPERADMIN = "superadmin", "Superadmin"
    ADMIN = "admin", "Admin (jefe de laboratorio)"
    AUXILIAR = "auxiliar", "Auxiliar"
    DOCENTE = "docente", "Docente"
    ADMINISTRATIVO = "administrativo", "Administrativo"


# Roles que un Admin puede crear, editar o eliminar.
ROLES_GESTIONABLES_POR_ADMIN = (Rol.AUXILIAR, Rol.DOCENTE, Rol.ADMINISTRATIVO)
