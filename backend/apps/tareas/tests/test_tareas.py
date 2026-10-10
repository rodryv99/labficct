from datetime import timedelta

import pytest
from django.conf import settings
from django.utils import timezone

from apps.core.roles import Rol
from apps.notificaciones.models import Notificacion
from apps.tareas.models import Tarea
from conftest import crear_usuario

pytestmark = pytest.mark.django_db

URL = f"/{settings.API_PREFIX}tareas/"


def test_crear_asignada_avisa_al_responsable(cliente, admin_lab, auxiliar):
    r = cliente(admin_lab).post(
        URL,
        {"titulo": "Cambiar mouse de la PC-07", "prioridad": "alta", "responsables": [auxiliar.id]},
        format="json",
    )
    assert r.status_code == 201, r.data
    assert r.data["responsables_detalle"][0]["id"] == auxiliar.id
    assert (
        Notificacion.objects.get(destinatario=auxiliar).titulo
        == "Te asignaron una tarea: Cambiar mouse de la PC-07"
    )


def test_avance_con_progreso_la_pone_en_progreso(cliente, admin_lab, auxiliar):
    tarea = cliente(admin_lab).post(URL, {"titulo": "Instalar Docker en LAB-3"}, format="json").data
    r = cliente(auxiliar).post(
        f"{URL}{tarea['id']}/avances/", {"texto": "Van 10 de 30 PCs.", "progreso": 33}, format="json"
    )
    assert r.status_code == 201, r.data
    assert r.data["estado"] == "en_progreso"
    assert r.data["progreso"] == 33
    assert r.data["avances"][-1]["texto"] == "Van 10 de 30 PCs."
    assert Notificacion.objects.filter(
        destinatario=admin_lab, titulo="Avance en «Instalar Docker en LAB-3»"
    ).exists()


def test_marcar_hecha_avisa_a_quien_la_creo(cliente, admin_lab, auxiliar):
    tarea = cliente(admin_lab).post(URL, {"titulo": "Revisar cables"}, format="json").data
    r = cliente(auxiliar).post(f"{URL}{tarea['id']}/estado/", {"estado": "hecha"}, format="json")
    assert r.data["estado"] == "hecha"
    assert r.data["progreso"] == 100
    assert Notificacion.objects.filter(
        destinatario=admin_lab, titulo="Tarea terminada: Revisar cables"
    ).exists()


def test_las_hechas_viejas_salen_del_pizarron(cliente, auxiliar):
    Tarea.objects.create(titulo="Vieja", estado="hecha", completada_en=timezone.now() - timedelta(days=30))
    Tarea.objects.create(titulo="Nueva")
    c = cliente(auxiliar)
    assert [t["titulo"] for t in c.get(URL).data["results"]] == ["Nueva"]
    assert c.get(URL, {"archivadas": "true"}).data["count"] == 2


def test_solo_quien_la_creo_o_el_admin_la_borra(cliente, admin_lab, auxiliar):
    otro = crear_usuario(Rol.AUXILIAR, "otro.aux@ficct.test")
    tarea = cliente(auxiliar).post(URL, {"titulo": "Mía"}, format="json").data
    assert cliente(otro).delete(f"{URL}{tarea['id']}/").status_code == 403
    assert cliente(admin_lab).delete(f"{URL}{tarea['id']}/").status_code == 204


def test_docente_no_ve_el_pizarron(cliente, docente):
    assert cliente(docente).get(URL).status_code == 403
