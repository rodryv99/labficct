"""Horarios de trabajo de los auxiliares: gestión (Admin) y asignación."""

import pytest
from django.conf import settings

from apps.marcaciones.models import AsignacionHorario, BloqueHorario, HorarioTrabajo

pytestmark = pytest.mark.django_db

URL = f"/{settings.API_PREFIX}marcaciones/horarios/"
URL_AUXILIARES = f"/{settings.API_PREFIX}marcaciones/auxiliares/"


def _horario(nombre="Mañana", bloques=None):
    return {
        "nombre": nombre,
        "descripcion": "",
        "activo": True,
        # Una lista vacía es un argumento válido (prueba «sin bloques»): por eso `is None`, no `or`.
        "bloques": (
            bloques
            if bloques is not None
            else [
                {"dia": 0, "inicio": "08:00", "fin": "12:00"},
                {"dia": 2, "inicio": "08:00", "fin": "12:00"},
            ]
        ),
    }


def test_admin_crea_horario_con_bloques(cliente, admin_lab):
    r = cliente(admin_lab).post(URL, _horario(), format="json")
    assert r.status_code == 201, r.data
    assert r.data["nombre"] == "Mañana"
    assert r.data["asignados"] == 0
    assert len(r.data["bloques"]) == 2
    assert HorarioTrabajo.objects.count() == 1
    assert BloqueHorario.objects.count() == 2


def test_sin_bloques_no_se_crea(cliente, admin_lab):
    r = cliente(admin_lab).post(URL, _horario(bloques=[]), format="json")
    assert r.status_code == 400
    assert not HorarioTrabajo.objects.exists()


def test_fin_antes_del_inicio_falla(cliente, admin_lab):
    datos = _horario(bloques=[{"dia": 0, "inicio": "12:00", "fin": "08:00"}])
    r = cliente(admin_lab).post(URL, datos, format="json")
    assert r.status_code == 400
    assert r.data["codigo"] == "bloque_invalido"
    assert not HorarioTrabajo.objects.exists()


def test_bloques_encimados_fallan(cliente, admin_lab):
    datos = _horario(
        bloques=[
            {"dia": 0, "inicio": "08:00", "fin": "12:00"},
            {"dia": 0, "inicio": "11:00", "fin": "14:00"},
        ]
    )
    r = cliente(admin_lab).post(URL, datos, format="json")
    assert r.status_code == 400
    assert r.data["codigo"] == "bloques_encimados"


def test_editar_reemplaza_los_bloques(cliente, admin_lab):
    creado = cliente(admin_lab).post(URL, _horario(), format="json").data
    nuevos = {**_horario(), "bloques": [{"dia": 4, "inicio": "14:00", "fin": "18:00"}]}
    r = cliente(admin_lab).put(f"{URL}{creado['id']}/", nuevos, format="json")
    assert r.status_code == 200, r.data
    assert len(r.data["bloques"]) == 1
    assert r.data["bloques"][0]["dia"] == 4
    assert BloqueHorario.objects.filter(horario_id=creado["id"]).count() == 1


def test_asignar_horario_a_auxiliar(cliente, admin_lab, auxiliar):
    horario = cliente(admin_lab).post(URL, _horario(), format="json").data
    r = cliente(admin_lab).put(
        f"{URL_AUXILIARES}{auxiliar.pk}/horario/", {"horario": horario["id"]}, format="json"
    )
    assert r.status_code == 200, r.data
    assert r.data["horario"] == horario["id"]
    assert r.data["horario_nombre"] == "Mañana"
    assert AsignacionHorario.objects.filter(usuario=auxiliar).count() == 1
    # Ahora el horario reporta un asignado.
    lista = cliente(admin_lab).get(URL).data
    assert lista[0]["asignados"] == 1


def test_quitar_horario_del_auxiliar(cliente, admin_lab, auxiliar):
    horario = cliente(admin_lab).post(URL, _horario(), format="json").data
    cliente(admin_lab).put(
        f"{URL_AUXILIARES}{auxiliar.pk}/horario/", {"horario": horario["id"]}, format="json"
    )
    r = cliente(admin_lab).put(f"{URL_AUXILIARES}{auxiliar.pk}/horario/", {"horario": None}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["horario"] is None
    assert not AsignacionHorario.objects.filter(usuario=auxiliar).exists()


def test_no_se_asigna_horario_a_un_docente(cliente, admin_lab, docente):
    horario = cliente(admin_lab).post(URL, _horario(), format="json").data
    r = cliente(admin_lab).put(
        f"{URL_AUXILIARES}{docente.pk}/horario/", {"horario": horario["id"]}, format="json"
    )
    assert r.status_code == 404


def test_un_auxiliar_no_gestiona_horarios(cliente, auxiliar):
    assert cliente(auxiliar).get(URL).status_code == 403
    assert cliente(auxiliar).post(URL, _horario(), format="json").status_code == 403
