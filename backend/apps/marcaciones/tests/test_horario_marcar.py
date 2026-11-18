"""Marcar según el horario asignado: ventana de entrada, retrasos y su reporte."""

from datetime import timedelta

import pytest
from django.conf import settings
from django.utils import timezone

from apps.marcaciones.models import LugarAsistencia

pytestmark = pytest.mark.django_db

URL = f"/{settings.API_PREFIX}marcaciones/"
URL_HORARIOS = f"{URL}horarios/"
URL_AUXILIARES = f"{URL}auxiliares/"

FICCT = {"latitud": -17.776200, "longitud": -63.195000}
CERCA = {"latitud": -17.776300, "longitud": -63.195100}


@pytest.fixture
def lugar(db):
    return LugarAsistencia.objects.create(nombre="FICCT", radio_m=100, predeterminado=True, **FICCT)


def _marcar(cliente, usuario, tipo="entrada", **extra):
    datos = {"tipo": tipo, "precision_m": 12, "biometria": True, **CERCA, **extra}
    return cliente(usuario).post(f"{URL}marcar/", datos, format="json")


def _ahora_seguro():
    """La hora local; salta la prueba si está tan cerca de medianoche que los bloques cruzarían el día."""
    ahora = timezone.localtime()
    if ahora.hour < 3 or ahora.hour >= 20:
        pytest.skip("Corre muy cerca de medianoche; los bloques de prueba cruzarían el día.")
    return ahora


def _asignar_turno(cliente, admin, auxiliar, inicio_delta_min, dur_min=120):
    """Le crea y asigna al auxiliar un turno de hoy que empieza `inicio_delta_min` desde ahora."""
    ahora = _ahora_seguro()
    inicio = ahora + timedelta(minutes=inicio_delta_min)
    fin = inicio + timedelta(minutes=dur_min)
    datos = {
        "nombre": f"Turno {inicio:%H%M%S}",
        "descripcion": "",
        "activo": True,
        "bloques": [{"dia": ahora.weekday(), "inicio": inicio.strftime("%H:%M"), "fin": fin.strftime("%H:%M")}],
    }
    horario = cliente(admin).post(URL_HORARIOS, datos, format="json").data
    r = cliente(admin).put(f"{URL_AUXILIARES}{auxiliar.id}/horario/", {"horario": horario["id"]}, format="json")
    assert r.status_code == 200, r.data
    return horario


def test_entrada_puntual_sin_retraso(cliente, admin_lab, auxiliar, lugar):
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=0)
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 201, r.data
    assert r.data["retraso_min"] <= 1
    assert r.data["turno_inicio"] is not None


def test_entrada_con_retraso(cliente, admin_lab, auxiliar, lugar):
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=-30)
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 201, r.data
    assert 29 <= r.data["retraso_min"] <= 31


def test_entrada_muy_temprano_se_rechaza(cliente, admin_lab, auxiliar, lugar):
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=60)
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 400
    assert r.data["codigo"] == "fuera_de_horario_entrada"
    assert "desde" in r.data.get("extra", {})


def test_entrada_dentro_de_la_tolerancia(cliente, admin_lab, auxiliar, lugar):
    # Empieza en 10 minutos; con tolerancia de 15 ya puede marcar, sin retraso.
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=10)
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 201, r.data
    assert r.data["retraso_min"] == 0


def test_sin_horario_marca_libre(cliente, auxiliar, lugar):
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 201, r.data
    assert r.data["turno_inicio"] is None
    assert r.data["retraso_min"] == 0


def test_salida_temprana_se_registra(cliente, admin_lab, auxiliar, lugar):
    # Turno de hace una hora a dentro de una hora: la salida ahora sale ~60 min antes del fin.
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=-60, dur_min=120)
    assert _marcar(cliente, auxiliar).status_code == 201
    r = _marcar(cliente, auxiliar, tipo="salida")
    assert r.status_code == 200, r.data
    assert 59 <= r.data["salida_temprana_min"] <= 61


def test_resumen_y_filtros_de_retraso(cliente, admin_lab, auxiliar, lugar):
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=-40)
    assert _marcar(cliente, auxiliar).status_code == 201

    # Resumen: cuenta un retraso.
    resumen = cliente(admin_lab).get(f"{URL}resumen/").data
    fila = next(f for f in resumen if f["usuario"] == auxiliar.id)
    assert fila["retrasos"] == 1
    assert 39 <= fila["retraso_total_min"] <= 41

    # Filtro con_retraso.
    con = cliente(admin_lab).get(f"{URL}?con_retraso=true").data
    assert con["count"] == 1
    # Filtro retraso_min: 60 no incluye el de 40.
    assert cliente(admin_lab).get(f"{URL}?retraso_min=60").data["count"] == 0
    assert cliente(admin_lab).get(f"{URL}?retraso_min=20").data["count"] == 1
    # Resumen con min_retrasos.
    assert len(cliente(admin_lab).get(f"{URL}resumen/?min_retrasos=1").data) == 1
    assert len(cliente(admin_lab).get(f"{URL}resumen/?min_retrasos=2").data) == 0
"""Marcar según el horario asignado: ventana de entrada, retrasos y su reporte."""

from datetime import timedelta

import pytest
from django.conf import settings
from django.utils import timezone

from apps.marcaciones.models import LugarAsistencia

pytestmark = pytest.mark.django_db

URL = f"/{settings.API_PREFIX}marcaciones/"
URL_HORARIOS = f"{URL}horarios/"
URL_AUXILIARES = f"{URL}auxiliares/"

FICCT = {"latitud": -17.776200, "longitud": -63.195000}
CERCA = {"latitud": -17.776300, "longitud": -63.195100}


@pytest.fixture
def lugar(db):
    return LugarAsistencia.objects.create(nombre="FICCT", radio_m=100, predeterminado=True, **FICCT)


def _marcar(cliente, usuario, tipo="entrada", **extra):
    datos = {"tipo": tipo, "precision_m": 12, "biometria": True, **CERCA, **extra}
    return cliente(usuario).post(f"{URL}marcar/", datos, format="json")


def _ahora_seguro():
    """La hora local; salta la prueba si está tan cerca de medianoche que los bloques cruzarían el día."""
    ahora = timezone.localtime()
    if ahora.hour < 3 or ahora.hour >= 20:
        pytest.skip("Corre muy cerca de medianoche; los bloques de prueba cruzarían el día.")
    return ahora


def _asignar_turno(cliente, admin, auxiliar, inicio_delta_min, dur_min=120):
    """Le crea y asigna al auxiliar un turno de hoy que empieza `inicio_delta_min` desde ahora."""
    ahora = _ahora_seguro()
    inicio = ahora + timedelta(minutes=inicio_delta_min)
    fin = inicio + timedelta(minutes=dur_min)
    datos = {
        "nombre": f"Turno {inicio:%H%M%S}",
        "descripcion": "",
        "activo": True,
        "bloques": [{"dia": ahora.weekday(), "inicio": inicio.strftime("%H:%M"), "fin": fin.strftime("%H:%M")}],
    }
    horario = cliente(admin).post(URL_HORARIOS, datos, format="json").data
    r = cliente(admin).put(f"{URL_AUXILIARES}{auxiliar.id}/horario/", {"horario": horario["id"]}, format="json")
    assert r.status_code == 200, r.data
    return horario


def test_entrada_puntual_sin_retraso(cliente, admin_lab, auxiliar, lugar):
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=0)
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 201, r.data
    assert r.data["retraso_min"] <= 1
    assert r.data["turno_inicio"] is not None


def test_entrada_con_retraso(cliente, admin_lab, auxiliar, lugar):
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=-30)
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 201, r.data
    assert 29 <= r.data["retraso_min"] <= 31


def test_entrada_muy_temprano_se_rechaza(cliente, admin_lab, auxiliar, lugar):
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=60)
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 400
    assert r.data["codigo"] == "fuera_de_horario_entrada"
    assert "desde" in r.data


def test_entrada_dentro_de_la_tolerancia(cliente, admin_lab, auxiliar, lugar):
    # Empieza en 10 minutos; con tolerancia de 15 ya puede marcar, sin retraso.
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=10)
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 201, r.data
    assert r.data["retraso_min"] == 0


def test_sin_horario_marca_libre(cliente, auxiliar, lugar):
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 201, r.data
    assert r.data["turno_inicio"] is None
    assert r.data["retraso_min"] == 0


def test_salida_temprana_se_registra(cliente, admin_lab, auxiliar, lugar):
    # Turno de hace una hora a dentro de una hora: la salida ahora sale ~60 min antes del fin.
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=-60, dur_min=120)
    assert _marcar(cliente, auxiliar).status_code == 201
    r = _marcar(cliente, auxiliar, tipo="salida")
    assert r.status_code == 200, r.data
    assert 59 <= r.data["salida_temprana_min"] <= 61


def test_resumen_y_filtros_de_retraso(cliente, admin_lab, auxiliar, lugar):
    _asignar_turno(cliente, admin_lab, auxiliar, inicio_delta_min=-40)
    assert _marcar(cliente, auxiliar).status_code == 201

    # Resumen: cuenta un retraso.
    resumen = cliente(admin_lab).get(f"{URL}resumen/").data
    fila = next(f for f in resumen if f["usuario"] == auxiliar.id)
    assert fila["retrasos"] == 1
    assert 39 <= fila["retraso_total_min"] <= 41

    # Filtro con_retraso.
    con = cliente(admin_lab).get(f"{URL}?con_retraso=true").data
    assert con["count"] == 1
    # Filtro retraso_min: 60 no incluye el de 40.
    assert cliente(admin_lab).get(f"{URL}?retraso_min=60").data["count"] == 0
    assert cliente(admin_lab).get(f"{URL}?retraso_min=20").data["count"] == 1
    # Resumen con min_retrasos.
    assert len(cliente(admin_lab).get(f"{URL}resumen/?min_retrasos=1").data) == 1
    assert len(cliente(admin_lab).get(f"{URL}resumen/?min_retrasos=2").data) == 0