import pytest
from django.conf import settings

from apps.laboratorios.models import (
    ElementoLaboratorio,
    Laboratorio,
    RevelacionCredencial,
    TipoElemento,
)

pytestmark = pytest.mark.django_db

API = f"/{settings.API_PREFIX}"


@pytest.fixture
def pc(db):
    return TipoElemento.objects.create(nombre="PC", icono="pc", prefijo_etiqueta="PC")


@pytest.fixture
def lab(db):
    return Laboratorio.objects.create(codigo="LAB-1", nombre="Laboratorio 1", filas=4, columnas=5)


def test_admin_guarda_distribucion(cliente, admin_lab, lab, pc):
    datos = {
        "filas": 4,
        "columnas": 5,
        "celdas": [
            {"fila": 0, "columna": 0, "tipo": pc.id, "etiqueta": "PC-01", "ip": "192.168.1.10"},
            {"fila": 0, "columna": 1, "tipo": pc.id, "etiqueta": "PC-02", "ip": ""},
        ],
    }
    r = cliente(admin_lab).put(f"{API}laboratorios/{lab.id}/distribucion/", datos, format="json")
    assert r.status_code == 200, r.data
    assert len(r.data["celdas"]) == 2
    assert ElementoLaboratorio.objects.get(etiqueta="PC-02").ip is None


def test_intercambiar_dos_elementos(cliente, admin_lab, lab, pc):
    a = ElementoLaboratorio.objects.create(laboratorio=lab, tipo=pc, fila=0, columna=0, etiqueta="A")
    b = ElementoLaboratorio.objects.create(laboratorio=lab, tipo=pc, fila=0, columna=1, etiqueta="B")
    datos = {
        "filas": 4,
        "columnas": 5,
        "celdas": [
            {"id": a.id, "fila": 0, "columna": 1, "tipo": pc.id, "etiqueta": "A"},
            {"id": b.id, "fila": 0, "columna": 0, "tipo": pc.id, "etiqueta": "B"},
        ],
    }
    r = cliente(admin_lab).put(f"{API}laboratorios/{lab.id}/distribucion/", datos, format="json")
    assert r.status_code == 200, r.data
    a.refresh_from_db()
    assert (a.fila, a.columna) == (0, 1)


def test_casilla_fuera_de_grilla(cliente, admin_lab, lab, pc):
    datos = {"filas": 2, "columnas": 2, "celdas": [{"fila": 3, "columna": 0, "tipo": pc.id}]}
    r = cliente(admin_lab).put(f"{API}laboratorios/{lab.id}/distribucion/", datos, format="json")
    assert r.status_code == 400
    assert r.data["codigo"] == "fuera_de_grilla"


def test_auxiliar_ve_pero_no_edita(cliente, auxiliar, lab):
    c = cliente(auxiliar)
    assert c.get(f"{API}laboratorios/{lab.id}/distribucion/").status_code == 200
    r = c.put(f"{API}laboratorios/{lab.id}/distribucion/", {"filas": 1, "columnas": 1, "celdas": []}, format="json")
    assert r.status_code == 403


def test_credencial_cifrada_y_revelacion_registrada(cliente, admin_lab, auxiliar, lab):
    r = cliente(admin_lab).post(
        f"{API}credenciales/",
        {"laboratorio": lab.id, "descripcion": "Administrador Windows", "usuario": "admin", "password": "S3creta!"},
        format="json",
    )
    assert r.status_code == 201, r.data
    assert "password" not in r.data
    assert r.data["tiene_password"] is True

    revelado = cliente(auxiliar).post(f"{API}credenciales/{r.data['id']}/revelar/")
    assert revelado.data["password"] == "S3creta!"
    assert RevelacionCredencial.objects.filter(usuario=auxiliar).count() == 1


def test_docente_no_ve_credenciales(cliente, docente, lab):
    assert cliente(docente).get(f"{API}credenciales/?laboratorio={lab.id}").status_code == 403


def test_auxiliar_edita_el_software_del_laboratorio(cliente, admin_lab, auxiliar, lab):
    c = cliente(auxiliar)
    # Puede agregar un programa al catálogo y marcarlo como instalado…
    python = c.post(f"{API}software/", {"nombre": "Python", "version": "3.13"}, format="json")
    assert python.status_code == 201, python.data
    r = c.put(f"{API}laboratorios/{lab.id}/software/", {"software": [python.data["id"]]}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["software"] == [python.data["id"]]
    # …pero no editar el resto de la ficha ni borrar programas del catálogo.
    assert c.patch(f"{API}laboratorios/{lab.id}/", {"nombre": "Otro"}, format="json").status_code == 403
    assert c.delete(f"{API}software/{python.data['id']}/").status_code == 403


def test_docente_no_edita_el_software(cliente, docente, lab):
    r = cliente(docente).put(f"{API}laboratorios/{lab.id}/software/", {"software": []}, format="json")
    assert r.status_code == 403
