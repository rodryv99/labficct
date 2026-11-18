"""Pruebas del módulo de reportes.

Corren con la base vacía: cada reporte debe responder 200 aunque no haya datos.
"""

import pytest
from django.urls import reverse

from apps.reportes.catalogo import REPORTES

pytestmark = pytest.mark.django_db

FORMATOS = ["xlsx", "csv", "pdf", "docx"]
TIPOS_MIME = {
    "xlsx": "spreadsheetml",
    "csv": "text/csv",
    "pdf": "application/pdf",
    "docx": "wordprocessingml",
}


def test_catalogo_para_admin(cliente, admin_lab):
    r = cliente(admin_lab).get(reverse("reportes-catalogo"))
    assert r.status_code == 200
    assert "grupos" in r.data
    assert "filtros" in r.data
    # Hay reportes registrados.
    assert sum(len(g["reportes"]) for g in r.data["grupos"]) == len(REPORTES)


def test_catalogo_denegado_a_auxiliar(cliente, auxiliar):
    r = cliente(auxiliar).get(reverse("reportes-catalogo"))
    assert r.status_code == 403


def test_catalogo_denegado_a_docente(cliente, docente):
    r = cliente(docente).get(reverse("reportes-catalogo"))
    assert r.status_code == 403


def test_dashboard(cliente, admin_lab):
    r = cliente(admin_lab).get(reverse("reportes-dashboard"))
    assert r.status_code == 200
    assert "kpis" in r.data and len(r.data["kpis"]) > 0


@pytest.mark.parametrize("reporte_id", sorted(REPORTES))
def test_cada_reporte_responde(cliente, admin_lab, reporte_id):
    r = cliente(admin_lab).get(reverse("reportes-datos", args=[reporte_id]))
    assert r.status_code == 200, (reporte_id, r.status_code)
    assert "columnas" in r.data
    assert "kpis" in r.data
    assert "graficos" in r.data


def test_reporte_inexistente(cliente, admin_lab):
    r = cliente(admin_lab).get(reverse("reportes-datos", args=["no_existe"]))
    assert r.status_code == 404


@pytest.mark.parametrize("formato", FORMATOS)
def test_exportar_cada_formato(cliente, admin_lab, formato):
    url = reverse("reportes-exportar", args=["usuarios_rol"]) + f"?formato={formato}"
    r = cliente(admin_lab).get(url)
    assert r.status_code == 200, (formato, r.status_code)
    assert int(r["Content-Length"]) > 0
    assert TIPOS_MIME[formato] in r["Content-Type"]
    assert r["Content-Disposition"].endswith(f'.{formato}"')


def test_exportar_formato_invalido(cliente, admin_lab):
    url = reverse("reportes-exportar", args=["usuarios_rol"]) + "?formato=rtf"
    r = cliente(admin_lab).get(url)
    assert r.status_code == 400
    assert r.data["codigo"] == "formato_invalido"


def test_exportar_denegado_a_auxiliar(cliente, auxiliar):
    url = reverse("reportes-exportar", args=["usuarios_rol"]) + "?formato=pdf"
    assert cliente(auxiliar).get(url).status_code == 403


# ── Constructor dinámico (pivote) ───────────────────────


def test_pivote_meta(cliente, admin_lab):
    r = cliente(admin_lab).get(reverse("reportes-pivote-meta"))
    assert r.status_code == 200
    assert len(r.data["entidades"]) > 0


def test_pivote_una_dimension(cliente, admin_lab):
    r = cliente(admin_lab).post(
        reverse("reportes-pivote"),
        {"entidad": "tareas", "filas": "estado", "medida": "conteo"},
        format="json",
    )
    assert r.status_code == 200
    assert "filas" in r.data and "graficos" in r.data


def test_pivote_tabla_cruzada(cliente, admin_lab):
    from apps.tareas.models import EstadoTarea, Prioridad, Tarea

    Tarea.objects.create(titulo="T1", prioridad=Prioridad.ALTA, estado=EstadoTarea.PENDIENTE)
    Tarea.objects.create(titulo="T2", prioridad=Prioridad.ALTA, estado=EstadoTarea.HECHA)
    Tarea.objects.create(titulo="T3", prioridad=Prioridad.NORMAL, estado=EstadoTarea.PENDIENTE)

    r = cliente(admin_lab).post(
        reverse("reportes-pivote"),
        {"entidad": "tareas", "filas": "prioridad", "columnas": "estado", "medida": "conteo"},
        format="json",
    )
    assert r.status_code == 200
    # La primera columna es la dimensión de filas y hay al menos una columna por valor.
    assert r.data["columnas"][0]["titulo"] == "Prioridad"
    assert len(r.data["columnas"]) >= 2
    assert len(r.data["filas"]) >= 2


def test_pivote_entidad_invalida(cliente, admin_lab):
    r = cliente(admin_lab).post(
        reverse("reportes-pivote"),
        {"entidad": "inexistente", "filas": "estado", "medida": "conteo"},
        format="json",
    )
    assert r.status_code == 400


def test_pivote_exportar(cliente, admin_lab):
    url = reverse("reportes-pivote-exportar") + "?formato=xlsx"
    r = cliente(admin_lab).post(
        url, {"entidad": "objetos", "filas": "estado", "medida": "conteo"}, format="json"
    )
    assert r.status_code == 200
    assert int(r["Content-Length"]) > 0


def test_pivote_denegado_a_auxiliar(cliente, auxiliar):
    r = cliente(auxiliar).post(
        reverse("reportes-pivote"),
        {"entidad": "tareas", "filas": "estado", "medida": "conteo"},
        format="json",
    )
    assert r.status_code == 403
