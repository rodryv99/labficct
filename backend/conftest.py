import pytest
from rest_framework.test import APIClient

from apps.core.roles import Rol
from apps.usuarios.models import Usuario

PASSWORD = "Laboratorio-2026"


def crear_usuario(rol, email=None, **extra):
    email = email or f"{rol}@ficct.test"
    return Usuario.objects.create_user(
        email=email,
        password=PASSWORD,
        nombres=extra.pop("nombres", rol.capitalize()),
        apellidos=extra.pop("apellidos", "Prueba"),
        rol=rol,
        **extra,
    )


@pytest.fixture
def superadmin(db):
    return crear_usuario(Rol.SUPERADMIN, is_staff=True, is_superuser=True)


@pytest.fixture
def admin_lab(db):
    return crear_usuario(Rol.ADMIN)


@pytest.fixture
def auxiliar(db):
    return crear_usuario(Rol.AUXILIAR)


@pytest.fixture
def docente(db):
    return crear_usuario(Rol.DOCENTE)


@pytest.fixture
def administrativo(db):
    return crear_usuario(Rol.ADMINISTRATIVO)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def cliente():
    """Devuelve un APIClient con sesión iniciada para el usuario dado."""

    def _cliente(usuario):
        c = APIClient()
        c.force_authenticate(user=usuario)
        return c

    return _cliente
