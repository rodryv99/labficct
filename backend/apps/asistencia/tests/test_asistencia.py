import pytest
from django.conf import settings

from apps.core.roles import Rol
from apps.laboratorios.models import Laboratorio
from apps.notificaciones.models import Notificacion
from conftest import crear_usuario

pytestmark = pytest.mark.django_db

URL = f"/{settings.API_PREFIX}asistencia/"


@pytest.fixture
def lab(db):
    return Laboratorio.objects.create(codigo="LAB-4", nombre="Laboratorio 4")


def _pedir(cliente, usuario, lab, **extra):
    datos = {
        "laboratorio": lab.id,
        "categoria": "proyector",
        "descripcion": "El proyector no enciende",
        **extra,
    }
    return cliente(usuario).post(URL, datos, format="json")


def test_flujo_completo_con_avisos(cliente, docente, auxiliar, lab):
    r = _pedir(cliente, docente, lab, urgente=True)
    assert r.status_code == 201, r.data
    solicitud = r.data["id"]
    aviso = Notificacion.objects.get(destinatario=auxiliar)
    assert aviso.titulo == "Urgente · Asistencia en LAB-4"
    assert aviso.datos == {"solicitud_id": solicitud}

    c = cliente(auxiliar)
    r = c.post(f"{URL}{solicitud}/tomar/")
    assert r.data["estado"] == "en_curso"
    assert Notificacion.objects.filter(destinatario=docente, titulo__endswith="va en camino").exists()

    r = c.post(f"{URL}{solicitud}/resolver/", {"respuesta": "Cambié el cable HDMI."}, format="json")
    assert r.data["estado"] == "resuelta"
    assert (
        Notificacion.objects.get(destinatario=docente, titulo__startswith="Resuelta").mensaje
        == "Cambié el cable HDMI."
    )


def test_no_se_toma_dos_veces(cliente, administrativo, auxiliar, lab):
    otro = crear_usuario(Rol.AUXILIAR, "otro.aux@ficct.test")
    solicitud = _pedir(cliente, administrativo, lab).data["id"]
    assert cliente(auxiliar).post(f"{URL}{solicitud}/tomar/").status_code == 200
    r = cliente(otro).post(f"{URL}{solicitud}/tomar/")
    assert r.status_code == 400
    assert "Auxiliar Prueba" in r.data["mensaje"]


def test_cada_quien_ve_las_suyas(cliente, docente, administrativo, auxiliar, lab):
    _pedir(cliente, docente, lab)
    _pedir(cliente, administrativo, lab)
    assert cliente(docente).get(URL).data["count"] == 1
    assert cliente(auxiliar).get(URL).data["count"] == 2
    assert cliente(auxiliar).get(URL, {"abiertas": "true"}).data["count"] == 2


def test_el_auxiliar_no_la_pide_y_hace_falta_un_lugar(cliente, docente, auxiliar, lab):
    assert _pedir(cliente, auxiliar, lab).status_code == 403
    r = cliente(docente).post(URL, {"descripcion": "Ayuda", "categoria": "otro"}, format="json")
    assert r.status_code == 400
    assert "lugar" in r.data["campos"]


def test_quien_la_pidio_la_cancela(cliente, docente, administrativo, lab):
    solicitud = _pedir(cliente, docente, lab).data["id"]
    assert cliente(administrativo).post(f"{URL}{solicitud}/cancelar/").status_code == 404  # no la ve
    r = cliente(docente).post(f"{URL}{solicitud}/cancelar/")
    assert r.data["estado"] == "cancelada"
