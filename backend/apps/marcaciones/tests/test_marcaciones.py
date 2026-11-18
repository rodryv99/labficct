from datetime import timedelta

import pytest
from django.conf import settings
from django.utils import timezone

from apps.core.roles import Rol
from apps.marcaciones import services
from apps.marcaciones.models import AsignacionLugar, LugarAsistencia, Marcacion
from conftest import crear_usuario

pytestmark = pytest.mark.django_db

URL = f"/{settings.API_PREFIX}marcaciones/"
URL_LUGARES = f"{URL}lugares/"
URL_AUXILIARES = f"{URL}auxiliares/"

# El módulo 236 de la FICCT y dos puntos: uno a unos metros y otro a más de un kilómetro.
FICCT = {"latitud": -17.776200, "longitud": -63.195000}
CERCA = {"latitud": -17.776300, "longitud": -63.195100}
LEJOS = {"latitud": -17.786200, "longitud": -63.195000}


@pytest.fixture
def lugar(db):
    return LugarAsistencia.objects.create(nombre="FICCT", radio_m=100, predeterminado=True, **FICCT)


def _marcar(cliente, usuario, tipo="entrada", **extra):
    datos = {"tipo": tipo, "precision_m": 12, "biometria": True, **CERCA, **extra}
    return cliente(usuario).post(f"{URL}marcar/", datos, format="json")


def test_distancia_entre_dos_puntos():
    assert services.distancia_m(-17.7762, -63.195, -17.7762, -63.195) == 0
    # Un grado de latitud son unos 111 km.
    assert 110_000 < services.distancia_m(0, 0, 1, 0) < 112_000
    assert 10 < services.distancia_m(**_par(FICCT, CERCA)) < 20


def _par(a, b):
    return {
        "latitud_1": a["latitud"],
        "longitud_1": a["longitud"],
        "latitud_2": b["latitud"],
        "longitud_2": b["longitud"],
    }


def test_entrada_y_salida(cliente, auxiliar, lugar):
    r = _marcar(cliente, auxiliar)
    assert r.status_code == 201, r.data
    assert r.data["abierta"] is True
    assert r.data["lugar_nombre"] == "FICCT"
    assert r.data["entrada_distancia_m"] < 20
    assert r.data["minutos"] is None

    estado = cliente(auxiliar).get(f"{URL}estado/").data
    assert estado["abierta"]["id"] == r.data["id"]
    assert estado["lugar"]["radio_m"] == 100

    # Como si hubiera entrado hace hora y media.
    Marcacion.objects.filter(pk=r.data["id"]).update(entrada_en=timezone.now() - timedelta(minutes=90))
    r = _marcar(cliente, auxiliar, "salida")
    assert r.status_code == 200, r.data
    assert r.data["abierta"] is False
    assert r.data["minutos"] == 90
    assert r.data["salida_manual"] is False

    estado = cliente(auxiliar).get(f"{URL}estado/").data
    assert estado["abierta"] is None
    assert estado["minutos_hoy"] == 90
    assert len(estado["hoy"]) == 1


def test_se_puede_volver_a_entrar_despues_de_salir(cliente, auxiliar, lugar):
    assert _marcar(cliente, auxiliar).status_code == 201
    assert _marcar(cliente, auxiliar, "salida").status_code == 200
    assert _marcar(cliente, auxiliar).status_code == 201
    assert Marcacion.objects.filter(usuario=auxiliar).count() == 2


def test_fuera_del_lugar_no_marca(cliente, auxiliar, lugar):
    r = _marcar(cliente, auxiliar, **LEJOS)
    assert r.status_code == 400
    assert r.data["codigo"] == "fuera_de_lugar"
    assert r.data["radio_m"] == 100
    assert r.data["distancia_m"] > 1000
    assert not Marcacion.objects.exists()


def test_la_salida_tambien_exige_estar_en_el_lugar(cliente, auxiliar, lugar):
    assert _marcar(cliente, auxiliar).status_code == 201
    r = _marcar(cliente, auxiliar, "salida", **LEJOS)
    assert r.data["codigo"] == "fuera_de_lugar"
    assert Marcacion.objects.get().salida_en is None


def test_sin_huella_no_marca(cliente, auxiliar, lugar):
    r = _marcar(cliente, auxiliar, biometria=False)
    assert r.status_code == 400
    assert r.data["codigo"] == "sin_huella"


def test_ubicacion_simulada_no_marca(cliente, auxiliar, lugar):
    r = _marcar(cliente, auxiliar, simulada=True)
    assert r.data["codigo"] == "ubicacion_simulada"


def test_gps_impreciso_no_marca(cliente, auxiliar, lugar):
    r = _marcar(cliente, auxiliar, precision_m=900)
    assert r.data["codigo"] == "gps_impreciso"


def test_no_se_entra_dos_veces_ni_se_sale_sin_entrar(cliente, auxiliar, lugar):
    assert _marcar(cliente, auxiliar, "salida").data["codigo"] == "sin_entrada"
    assert _marcar(cliente, auxiliar).status_code == 201
    assert _marcar(cliente, auxiliar).data["codigo"] == "entrada_repetida"


def test_sin_lugar_no_marca(cliente, auxiliar):
    r = _marcar(cliente, auxiliar)
    assert r.data["codigo"] == "sin_lugar"
    assert cliente(auxiliar).get(f"{URL}estado/").data["lugar"] is None


def test_el_lugar_propio_manda_sobre_el_predeterminado(cliente, auxiliar, admin_lab, lugar):
    otro = LugarAsistencia.objects.create(nombre="Módulo lejano", radio_m=100, **LEJOS)
    r = cliente(admin_lab).put(f"{URL_AUXILIARES}{auxiliar.id}/", {"lugar": otro.id}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["lugar"] == otro.id
    assert r.data["usa_predeterminado"] is False

    # Ya no vale marcar en la FICCT: su lugar es el otro.
    assert _marcar(cliente, auxiliar).data["codigo"] == "fuera_de_lugar"
    assert _marcar(cliente, auxiliar, **LEJOS).status_code == 201

    # Al quitarle el lugar propio vuelve al predeterminado.
    r = cliente(admin_lab).put(f"{URL_AUXILIARES}{auxiliar.id}/", {"lugar": None}, format="json")
    assert r.data["usa_predeterminado"] is True
    assert r.data["lugar_nombre"] == "FICCT"
    assert not AsignacionLugar.objects.exists()


def test_lista_de_auxiliares_con_su_situacion(cliente, auxiliar, admin_lab, lugar):
    r = cliente(admin_lab).get(URL_AUXILIARES)
    assert r.status_code == 200
    assert [(f["id"], f["situacion"], f["lugar_nombre"]) for f in r.data] == [(auxiliar.id, "sin_marcar", "FICCT")]
    _marcar(cliente, auxiliar)
    assert cliente(admin_lab).get(URL_AUXILIARES).data[0]["situacion"] == "presente"
    _marcar(cliente, auxiliar, "salida")
    assert cliente(admin_lab).get(URL_AUXILIARES).data[0]["situacion"] == "salio"


def test_cada_auxiliar_ve_solo_lo_suyo_y_el_admin_todo(cliente, auxiliar, admin_lab, lugar):
    otro = crear_usuario(Rol.AUXILIAR, email="otro@ficct.test", nombres="Otra", apellidos="Persona")
    _marcar(cliente, auxiliar)
    _marcar(cliente, otro)

    r = cliente(auxiliar).get(URL)
    assert r.data["count"] == 1
    assert r.data["results"][0]["usuario"] == auxiliar.id

    r = cliente(admin_lab).get(URL)
    assert r.data["count"] == 2
    assert cliente(admin_lab).get(URL, {"usuario": otro.id}).data["count"] == 1
    hoy = timezone.localdate().isoformat()
    assert cliente(admin_lab).get(URL, {"desde": hoy, "hasta": hoy, "abiertas": "true"}).data["count"] == 2

    ajena = Marcacion.objects.get(usuario=otro)
    assert cliente(auxiliar).get(f"{URL}{ajena.id}/").status_code == 404


def test_solo_los_auxiliares_marcan(cliente, docente, admin_lab, superadmin, lugar):
    assert _marcar(cliente, docente).status_code == 403
    assert _marcar(cliente, admin_lab).status_code == 403
    # El Superadmin tiene todos los permisos, pero no es auxiliar.
    r = _marcar(cliente, superadmin)
    assert r.status_code == 403
    assert r.data["codigo"] == "no_es_auxiliar"
    assert cliente(docente).get(URL).status_code == 403


def test_el_admin_pone_la_salida_que_falto(cliente, auxiliar, admin_lab, lugar):
    marcacion = _marcar(cliente, auxiliar).data["id"]
    Marcacion.objects.filter(pk=marcacion).update(entrada_en=timezone.now() - timedelta(hours=5))
    url = f"{URL}{marcacion}/cerrar/"
    salida = (timezone.now() - timedelta(hours=1)).isoformat()

    assert cliente(auxiliar).post(url, {"salida_en": salida, "nota": "x"}, format="json").status_code == 403

    futura = (timezone.now() + timedelta(hours=1)).isoformat()
    r = cliente(admin_lab).post(url, {"salida_en": futura, "nota": "Olvidó marcar"}, format="json")
    assert r.data["codigo"] == "salida_invalida"
    antes = (timezone.now() - timedelta(hours=6)).isoformat()
    r = cliente(admin_lab).post(url, {"salida_en": antes, "nota": "Olvidó marcar"}, format="json")
    assert r.data["codigo"] == "salida_invalida"

    r = cliente(admin_lab).post(url, {"salida_en": salida, "nota": "Olvidó marcar"}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["salida_manual"] is True
    assert r.data["nota"] == "Olvidó marcar"
    assert 235 <= r.data["minutos"] <= 240

    r = cliente(admin_lab).post(url, {"salida_en": salida, "nota": "Otra vez"}, format="json")
    assert r.data["codigo"] == "ya_cerrada"


def test_lugares_solo_un_predeterminado(cliente, admin_lab, auxiliar, lugar):
    c = cliente(admin_lab)
    r = c.post(
        URL_LUGARES,
        {"nombre": "Módulo 225", "referencia": "Planta baja", "predeterminado": True, **LEJOS},
        format="json",
    )
    assert r.status_code == 201, r.data
    assert r.data["radio_m"] == 100
    assert r.data["asignados"] == 0
    lugar.refresh_from_db()
    assert lugar.predeterminado is False
    assert LugarAsistencia.objects.filter(predeterminado=True).count() == 1

    # Volver a dejar el primero como predeterminado.
    r = c.patch(f"{URL_LUGARES}{lugar.id}/", {"predeterminado": True, "radio_m": 150}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["radio_m"] == 150
    assert list(LugarAsistencia.objects.filter(predeterminado=True)) == [lugar]

    r = c.patch(f"{URL_LUGARES}{lugar.id}/", {"activo": False}, format="json")
    assert r.status_code == 400
    assert c.post(URL_LUGARES, {"nombre": "Mal", "latitud": 120, "longitud": 0}, format="json").status_code == 400
    assert c.post(URL_LUGARES, {"nombre": "Chico", "radio_m": 5, **FICCT}, format="json").status_code == 400
    assert cliente(auxiliar).get(URL_LUGARES).status_code == 403


def test_un_lugar_con_marcaciones_no_se_elimina(cliente, admin_lab, auxiliar, lugar):
    libre = LugarAsistencia.objects.create(nombre="Sin uso", **LEJOS)
    AsignacionLugar.objects.create(usuario=auxiliar, lugar=libre)
    assert cliente(admin_lab).delete(f"{URL_LUGARES}{libre.id}/").status_code == 204
    assert not AsignacionLugar.objects.exists()

    _marcar(cliente, auxiliar)
    r = cliente(admin_lab).delete(f"{URL_LUGARES}{lugar.id}/")
    assert r.status_code == 409
    assert r.data["codigo"] == "protegido"


def test_un_lugar_desactivado_no_se_asigna_ni_se_usa(cliente, admin_lab, auxiliar, lugar):
    apagado = LugarAsistencia.objects.create(nombre="Apagado", activo=False, **LEJOS)
    r = cliente(admin_lab).put(f"{URL_AUXILIARES}{auxiliar.id}/", {"lugar": apagado.id}, format="json")
    assert r.data["codigo"] == "lugar_inactivo"

    # Si el lugar propio se desactiva después, el auxiliar vuelve al predeterminado.
    AsignacionLugar.objects.create(usuario=auxiliar, lugar=apagado)
    assert services.lugar_de(auxiliar) == lugar


def test_resumen_y_exportacion(cliente, admin_lab, auxiliar, lugar):
    primera = _marcar(cliente, auxiliar).data["id"]
    Marcacion.objects.filter(pk=primera).update(entrada_en=timezone.now() - timedelta(minutes=125))
    _marcar(cliente, auxiliar, "salida")
    _marcar(cliente, auxiliar)  # queda abierta

    c = cliente(admin_lab)
    r = c.get(f"{URL}resumen/")
    assert r.status_code == 200
    assert len(r.data) == 1
    fila = r.data[0]
    assert fila["usuario"] == auxiliar.id
    assert (fila["dias"], fila["marcaciones"], fila["sin_salida"]) == (1, 2, 1)
    assert fila["minutos"] == 125
    assert fila["horas"] == "2:05"

    r = c.get(f"{URL}exportar/", {"formato": "csv"})
    assert r.status_code == 200
    assert "attachment" in r["Content-Disposition"]
    assert auxiliar.nombre_completo.encode() in r.content
    assert b"Sin salida" in r.content
    assert c.get(f"{URL}exportar/", {"formato": "xlsx"}).content[:2] == b"PK"
    assert c.get(f"{URL}exportar/", {"formato": "pdf"}).content[:4] == b"%PDF"
    assert c.get(f"{URL}exportar/", {"formato": "doc"}).status_code == 400
    assert cliente(auxiliar).get(f"{URL}resumen/").status_code == 403
