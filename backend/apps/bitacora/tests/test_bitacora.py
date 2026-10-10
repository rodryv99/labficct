from datetime import date, timedelta

import pytest
from django.conf import settings
from django.utils import timezone

from apps.bitacora.models import EntradaBitacora, RevisionProgramada
from apps.bitacora.services import revisiones_vencidas, sumar
from apps.core.roles import Rol
from apps.laboratorios.models import Laboratorio
from apps.notificaciones.models import Notificacion
from apps.tareas.models import Tarea
from conftest import crear_usuario

pytestmark = pytest.mark.django_db

API = f"/{settings.API_PREFIX}"


@pytest.fixture
def lab(db):
    return Laboratorio.objects.create(codigo="LAB-2", nombre="Laboratorio 2")


@pytest.fixture
def revision(lab):
    return RevisionProgramada.objects.create(
        laboratorio=lab,
        titulo="Revisión de equipos",
        instrucciones="Encender cada PC y revisar teclado y mouse.",
        cada=2,
        unidad="semanas",
        proxima_fecha=timezone.localdate() - timedelta(days=1),
    )


def test_sumar_fechas():
    assert sumar(date(2026, 1, 31), 1, "meses") == date(2026, 2, 28)
    assert sumar(date(2026, 11, 15), 3, "meses") == date(2027, 2, 15)
    assert sumar(date(2026, 9, 28), 2, "semanas") == date(2026, 10, 12)


def test_cada_quien_edita_lo_suyo(cliente, auxiliar, admin_lab, lab):
    otro = crear_usuario(Rol.AUXILIAR, "otro.aux@ficct.test")
    datos = {
        "laboratorio": lab.id,
        "tipo": "instalacion",
        "titulo": "Instalé Python 3.13",
        "elementos": "PC-01 a PC-20",
    }
    r = cliente(auxiliar).post(f"{API}bitacora/", datos, format="json")
    assert r.status_code == 201, r.data
    assert r.data["autor_nombre"] == "Auxiliar Prueba"
    url = f"{API}bitacora/{r.data['id']}/"

    assert cliente(otro).patch(url, {"titulo": "Otro"}, format="json").status_code == 403
    assert cliente(otro).delete(url).status_code == 403
    assert (
        cliente(admin_lab).patch(url, {"titulo": "Instalé Python 3.13 y VS Code"}, format="json").status_code
        == 200
    )
    assert cliente(auxiliar).delete(url).status_code == 204


def test_el_docente_no_ve_la_bitacora(cliente, docente):
    assert cliente(docente).get(f"{API}bitacora/").status_code == 403


def test_revision_vencida_pasa_al_pizarron_una_vez(revision, auxiliar):
    assert revisiones_vencidas() == 1
    assert revisiones_vencidas() == 0  # ya tiene una tarea abierta
    tarea = Tarea.objects.get(revision=revision)
    assert tarea.titulo == "Revisión de equipos · LAB-2"
    aviso = Notificacion.objects.get(destinatario=auxiliar, tipo="revision")
    assert aviso.datos["tarea_id"] == tarea.id


def test_registrar_revision_deja_bitacora_y_calcula_la_proxima(cliente, auxiliar, revision):
    revisiones_vencidas()
    r = cliente(auxiliar).post(
        f"{API}revisiones/{revision.id}/realizar/", {"nota": "Todo en orden, PC-07 sin mouse."}, format="json"
    )
    assert r.status_code == 200, r.data
    hoy = timezone.localdate()
    assert r.data["ultima_fecha"] == hoy.isoformat()
    assert r.data["proxima_fecha"] == (hoy + timedelta(weeks=2)).isoformat()
    assert r.data["tarea_abierta"] is None
    entrada = EntradaBitacora.objects.get(revision=revision)
    assert entrada.tipo == "revision"
    assert entrada.descripcion == "Todo en orden, PC-07 sin mouse."
    assert Tarea.objects.get(revision=revision).estado == "hecha"


def test_marcar_hecha_la_tarea_registra_la_revision(cliente, auxiliar, revision):
    revisiones_vencidas()
    tarea = Tarea.objects.get(revision=revision)
    r = cliente(auxiliar).post(
        f"{API}tareas/{tarea.id}/estado/", {"estado": "hecha", "nota": "Revisado."}, format="json"
    )
    assert r.status_code == 200, r.data
    revision.refresh_from_db()
    assert revision.ultima_fecha == timezone.localdate()
    assert EntradaBitacora.objects.get(revision=revision).descripcion == "Revisado."


def test_solo_el_admin_programa_revisiones(cliente, auxiliar, admin_lab, lab):
    datos = {
        "laboratorio": lab.id,
        "titulo": "Limpieza de teclados",
        "cada": 1,
        "unidad": "meses",
        "proxima_fecha": "2026-10-01",
    }
    assert cliente(auxiliar).post(f"{API}revisiones/", datos, format="json").status_code == 403
    r = cliente(admin_lab).post(f"{API}revisiones/", datos, format="json")
    assert r.status_code == 201, r.data
    assert r.data["frecuencia"] == "Cada mes"


def test_reabrir_la_tarea_no_registra_la_revision_dos_veces(cliente, auxiliar, revision):
    revisiones_vencidas()
    tarea = Tarea.objects.get(revision=revision)
    c = cliente(auxiliar)
    for estado in ("hecha", "en_progreso", "hecha"):
        c.post(f"{API}tareas/{tarea.id}/estado/", {"estado": estado}, format="json")
    assert EntradaBitacora.objects.filter(revision=revision).count() == 1
