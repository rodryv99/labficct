import pytest
from django.conf import settings

from conftest import PASSWORD

pytestmark = pytest.mark.django_db

LOGIN = f"/{settings.API_PREFIX}auth/login/"
REFRESH = f"/{settings.API_PREFIX}auth/refresh/"
ME = f"/{settings.API_PREFIX}auth/me/"


def test_login_web_deja_refresh_en_cookie(api, auxiliar):
    r = api.post(LOGIN, {"usuario": auxiliar.email, "password": PASSWORD}, format="json")
    assert r.status_code == 200
    assert "access" in r.data
    assert "refresh" not in r.data
    assert settings.JWT_REFRESH_COOKIE_NAME in r.cookies
    assert r.cookies[settings.JWT_REFRESH_COOKIE_NAME]["httponly"]


def test_login_movil_recibe_refresh_en_el_cuerpo(api, auxiliar):
    r = api.post(
        LOGIN,
        {"usuario": auxiliar.email, "password": PASSWORD},
        format="json",
        HTTP_X_CLIENTE="movil",
    )
    assert r.status_code == 200
    assert "refresh" in r.data


def test_login_con_codigo(api, auxiliar):
    auxiliar.codigo = "219012345"
    auxiliar.save()
    r = api.post(LOGIN, {"usuario": "219012345", "password": PASSWORD}, format="json")
    assert r.status_code == 200


def test_login_incorrecto_da_401_con_mensaje(api, auxiliar):
    r = api.post(LOGIN, {"usuario": auxiliar.email, "password": "otra"}, format="json")
    assert r.status_code == 401
    assert r.data["codigo"] == "credenciales_invalidas"


def test_cuenta_inactiva_no_entra(api, auxiliar):
    auxiliar.is_active = False
    auxiliar.save()
    r = api.post(LOGIN, {"usuario": auxiliar.email, "password": PASSWORD}, format="json")
    assert r.status_code == 403


def test_refresh_con_cookie_y_me(api, admin_lab):
    api.post(LOGIN, {"usuario": admin_lab.email, "password": PASSWORD}, format="json")
    r = api.post(REFRESH, {}, format="json")
    assert r.status_code == 200
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    me = api.get(ME)
    assert me.status_code == 200
    assert me.data["rol"] == "admin"
    assert "usuarios.gestionar" in me.data["permisos"]
