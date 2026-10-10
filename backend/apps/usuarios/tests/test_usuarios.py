import pytest
from django.conf import settings

from apps.core.roles import Rol
from apps.usuarios.models import Usuario
from conftest import crear_usuario

pytestmark = pytest.mark.django_db

URL = f"/{settings.API_PREFIX}usuarios/"


def _datos(rol, email):
    return {
        "email": email,
        "nombres": "Ana",
        "apellidos": "Rojas",
        "rol": rol,
        "password": "Ficct-Segura-2026",
    }


def test_admin_crea_auxiliar(cliente, admin_lab):
    r = cliente(admin_lab).post(URL, _datos(Rol.AUXILIAR, "ana@ficct.test"), format="json")
    assert r.status_code == 201, r.data
    assert Usuario.objects.get(email="ana@ficct.test").check_password("Ficct-Segura-2026")


def test_admin_no_puede_crear_admin(cliente, admin_lab):
    r = cliente(admin_lab).post(URL, _datos(Rol.ADMIN, "otro@ficct.test"), format="json")
    assert r.status_code == 403


def test_admin_no_ve_superadmins_ni_admins(cliente, admin_lab, superadmin, auxiliar):
    r = cliente(admin_lab).get(URL)
    emails = {u["email"] for u in r.data["results"]}
    assert auxiliar.email in emails
    assert superadmin.email not in emails
    assert admin_lab.email not in emails


def test_superadmin_crea_admin(cliente, superadmin):
    r = cliente(superadmin).post(URL, _datos(Rol.ADMIN, "jefe@ficct.test"), format="json")
    assert r.status_code == 201


def test_auxiliar_no_gestiona_usuarios(cliente, auxiliar):
    assert cliente(auxiliar).get(URL).status_code == 403


def test_no_puede_desactivarse_a_si_mismo(cliente, superadmin):
    r = cliente(superadmin).post(f"{URL}{superadmin.pk}/desactivar/")
    assert r.status_code == 400


def test_desactivar_y_activar(cliente, admin_lab):
    docente = crear_usuario(Rol.DOCENTE, "doc@ficct.test")
    c = cliente(admin_lab)
    assert c.post(f"{URL}{docente.pk}/desactivar/").data["is_active"] is False
    assert c.post(f"{URL}{docente.pk}/activar/").data["is_active"] is True


def test_codigo_vacio_se_guarda_como_nulo(cliente, admin_lab):
    c = cliente(admin_lab)
    for email in ("a@ficct.test", "b@ficct.test"):
        datos = _datos(Rol.DOCENTE, email)
        datos["codigo"] = ""
        assert c.post(URL, datos, format="json").status_code == 201
    assert Usuario.objects.filter(codigo__isnull=True).count() >= 2


def test_opciones_para_auxiliar(cliente, auxiliar):
    crear_usuario(Rol.DOCENTE, "doc2@ficct.test")
    r = cliente(auxiliar).get(f"{URL}opciones/?rol=docente")
    assert r.status_code == 200
    assert all(u["rol"] == "docente" for u in r.data)
