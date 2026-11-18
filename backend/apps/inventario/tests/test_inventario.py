import pytest
from django.conf import settings

from apps.core.roles import Rol
from apps.inventario.models import Activo, Lugar, MovimientoActivo, TipoActivo
from apps.laboratorios.models import Laboratorio
from apps.notificaciones.models import Notificacion
from apps.tareas.models import Tarea
from conftest import crear_usuario

pytestmark = pytest.mark.django_db

BASE = f"/{settings.API_PREFIX}inventario/"
ACTIVOS = f"{BASE}activos/"
VERIFICACIONES = f"{BASE}verificaciones/"
TAREAS = f"/{settings.API_PREFIX}tareas/"


@pytest.fixture
def lab(db):
    return Laboratorio.objects.create(codigo="LAB-41", nombre="Laboratorio 41")


@pytest.fixture
def lugar_lab(lab):
    # El lugar del laboratorio se crea solo al guardar el laboratorio.
    return Lugar.objects.get(laboratorio=lab)


@pytest.fixture
def deposito(db):
    return Lugar.objects.get_or_create(nombre="Depósito", defaults={"tipo": "deposito"})[0]


@pytest.fixture
def silla(db):
    return TipoActivo.objects.get_or_create(nombre="Silla")[0]


@pytest.fixture
def mesa(db):
    return TipoActivo.objects.get_or_create(nombre="Mesa")[0]


def _alta(cliente, usuario, tipo, lugar, codigo="s1001", **extra):
    datos = {
        "codigo": codigo,
        "descripcion": "Silla giratoria negra",
        "tipo": tipo.id,
        "lugar": lugar.id,
        **extra,
    }
    return cliente(usuario).post(ACTIVOS, datos, format="json")


def test_cada_laboratorio_es_un_lugar(lab, lugar_lab):
    assert lugar_lab.nombre == "LAB-41 · Laboratorio 41"
    assert lugar_lab.tipo == "laboratorio"
    lab.nombre = "Redes"
    lab.save()
    lugar_lab.refresh_from_db()
    assert lugar_lab.nombre == "LAB-41 · Redes"
    assert Lugar.objects.filter(laboratorio=lab).count() == 1


def test_alta_normaliza_el_codigo_y_deja_el_movimiento(cliente, admin_lab, silla, lugar_lab):
    r = _alta(cliente, admin_lab, silla, lugar_lab, codigo=" s1001 ")
    assert r.status_code == 201, r.data
    assert r.data["codigo"] == "S1001"
    assert r.data["estado"] == "operativo"
    assert [m["tipo"] for m in r.data["movimientos"]] == ["alta"]
    assert r.data["movimientos"][0]["lugar_destino_nombre"] == "LAB-41 · Laboratorio 41"


def test_codigo_repetido_o_con_simbolos_se_rechaza(cliente, admin_lab, silla, lugar_lab):
    assert _alta(cliente, admin_lab, silla, lugar_lab).status_code == 201
    r = _alta(cliente, admin_lab, silla, lugar_lab, codigo="S1001")
    assert r.status_code == 400
    assert "codigo" in r.data["campos"]
    assert _alta(cliente, admin_lab, silla, lugar_lab, codigo="S 10/02").status_code == 400


def test_trasladar_y_dar_de_baja(cliente, admin_lab, silla, lugar_lab, deposito):
    c = cliente(admin_lab)
    activo = _alta(cliente, admin_lab, silla, lugar_lab).data["id"]

    r = c.post(
        f"{ACTIVOS}{activo}/trasladar/", {"lugar": deposito.id, "motivo": "Sobra en el aula"}, format="json"
    )
    assert r.status_code == 200, r.data
    assert r.data["lugar"] == deposito.id
    assert r.data["movimientos"][0]["tipo"] == "traslado"
    assert r.data["movimientos"][0]["lugar_origen_nombre"] == "LAB-41 · Laboratorio 41"
    # Al mismo lugar no se traslada.
    assert c.post(f"{ACTIVOS}{activo}/trasladar/", {"lugar": deposito.id}, format="json").status_code == 400

    # La baja pide motivo.
    assert c.post(f"{ACTIVOS}{activo}/baja/", {"motivo": " "}, format="json").status_code == 400
    r = c.post(
        f"{ACTIVOS}{activo}/baja/", {"motivo": "Respaldo roto", "documento": "Acta 12/2026"}, format="json"
    )
    assert r.status_code == 200, r.data
    assert r.data["estado"] == "baja"
    assert r.data["movimientos"][0]["documento"] == "Acta 12/2026"
    # Dado de baja ya no se traslada, pero sigue en el inventario.
    assert c.post(f"{ACTIVOS}{activo}/trasladar/", {"lugar": lugar_lab.id}, format="json").status_code == 400
    assert c.get(ACTIVOS, {"vigentes": "true"}).data["count"] == 0
    assert c.get(ACTIVOS).data["count"] == 1
    # Reincorporar (la baja fue un error): cambio de estado.
    r = c.post(
        f"{ACTIVOS}{activo}/estado/", {"estado": "operativo", "motivo": "Baja por error"}, format="json"
    )
    assert r.data["estado"] == "operativo"


def test_editar_no_mueve_el_activo_y_queda_registrado(cliente, admin_lab, silla, mesa, lugar_lab, deposito):
    c = cliente(admin_lab)
    activo = _alta(cliente, admin_lab, silla, lugar_lab).data["id"]
    r = c.patch(
        f"{ACTIVOS}{activo}/",
        {"marca": "Ergo", "tipo": mesa.id, "lugar": deposito.id, "estado": "baja"},
        format="json",
    )
    assert r.status_code == 200, r.data
    assert r.data["marca"] == "Ergo"
    # El lugar y el estado solo cambian con un movimiento.
    assert r.data["lugar"] == lugar_lab.id
    assert r.data["estado"] == "operativo"
    cambios = r.data["cambios"][0]
    assert cambios["usuario_nombre"] == admin_lab.nombre_completo
    assert {"campo": "Marca", "antes": "", "despues": "Ergo"} in cambios["cambios"]
    assert {"campo": "Tipo", "antes": "Silla", "despues": "Mesa"} in cambios["cambios"]


def test_corregir_un_movimiento_queda_en_el_historial(cliente, admin_lab, silla, lugar_lab):
    c = cliente(admin_lab)
    activo = _alta(cliente, admin_lab, silla, lugar_lab).data
    movimiento = activo["movimientos"][0]["id"]
    r = c.patch(f"{BASE}movimientos/{movimiento}/", {"motivo": "Donación de la gestión 2025"}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["corregido"] is True
    detalle = c.get(f"{ACTIVOS}{activo['id']}/").data
    assert detalle["cambios"][0]["movimiento"] == movimiento
    assert detalle["cambios"][0]["cambios"][0]["campo"] == "Motivo"


def test_no_hay_borrado_de_activos(cliente, admin_lab, silla, lugar_lab):
    activo = _alta(cliente, admin_lab, silla, lugar_lab).data["id"]
    # No existe la acción de borrar: la API la rechaza (403 o 405 según el orden de las revisiones).
    assert cliente(admin_lab).delete(f"{ACTIVOS}{activo}/").status_code in (403, 405)
    assert Activo.objects.filter(pk=activo).exists()


def test_el_auxiliar_ve_pero_no_gestiona(cliente, admin_lab, auxiliar, docente, silla, lugar_lab, deposito):
    activo = _alta(cliente, admin_lab, silla, lugar_lab).data["id"]
    c = cliente(auxiliar)
    assert c.get(ACTIVOS, {"search": "s1001"}).data["count"] == 1
    assert c.get(f"{ACTIVOS}{activo}/").status_code == 200
    assert _alta(cliente, auxiliar, silla, lugar_lab, codigo="S1002").status_code == 403
    assert c.post(f"{ACTIVOS}{activo}/trasladar/", {"lugar": deposito.id}, format="json").status_code == 403
    assert c.post(f"{ACTIVOS}{activo}/baja/", {"motivo": "x"}, format="json").status_code == 403
    assert c.post(VERIFICACIONES, {"titulo": "Todo"}, format="json").status_code == 403
    assert cliente(docente).get(ACTIVOS).status_code == 403


def test_filtros_por_tipo_y_lugar(cliente, admin_lab, silla, mesa, lugar_lab, deposito):
    _alta(cliente, admin_lab, silla, lugar_lab, codigo="S1")
    _alta(cliente, admin_lab, silla, deposito, codigo="S2")
    _alta(cliente, admin_lab, mesa, lugar_lab, codigo="M1")
    c = cliente(admin_lab)
    assert c.get(ACTIVOS, {"tipos": f"{silla.id}"}).data["count"] == 2
    assert c.get(ACTIVOS, {"lugares": f"{lugar_lab.id},{deposito.id}"}).data["count"] == 3
    assert c.get(ACTIVOS, {"tipos": f"{silla.id}", "lugares": f"{lugar_lab.id}"}).data["count"] == 1


def test_verificacion_completa_con_tarea_y_avisos(
    cliente, admin_lab, auxiliar, silla, mesa, lugar_lab, deposito
):
    _alta(cliente, admin_lab, silla, lugar_lab, codigo="S1")
    _alta(cliente, admin_lab, silla, lugar_lab, codigo="S2")
    _alta(cliente, admin_lab, mesa, lugar_lab, codigo="M1")
    _alta(cliente, admin_lab, silla, deposito, codigo="S9")  # otro lugar: no entra

    r = cliente(admin_lab).post(
        VERIFICACIONES,
        {"titulo": "LAB-41 fin de gestión", "lugares": [lugar_lab.id], "responsables": [auxiliar.id]},
        format="json",
    )
    assert r.status_code == 201, r.data
    v = r.data
    assert v["conteo"]["total"] == 3
    assert v["alcance"] == "Lugar: LAB-41 · Laboratorio 41"
    assert sorted(i["codigo"] for i in v["items"]) == ["M1", "S1", "S2"]
    # Aparece en el pizarrón y se avisa al responsable.
    tarea = Tarea.objects.get(pk=v["tarea"])
    assert tarea.titulo == "Verificar inventario: LAB-41 fin de gestión"
    assert list(tarea.responsables.all()) == [auxiliar]
    aviso = Notificacion.objects.get(destinatario=auxiliar)
    assert aviso.enlace == f"/inventario?verificacion={v['id']}"

    # El auxiliar marca dos de tres: la tarea avanza sola.
    c = cliente(auxiliar)
    ids = {i["codigo"]: i["id"] for i in v["items"]}
    r = c.post(
        f"{VERIFICACIONES}{v['id']}/marcar/",
        {"items": [ids["S1"], ids["M1"]], "resultado": "esta"},
        format="json",
    )
    assert r.status_code == 200, r.data
    assert r.data["conteo"]["revisados"] == 2
    assert r.data["progreso"] == 66
    tarea.refresh_from_db()
    assert (tarea.estado, tarea.progreso) == ("en_progreso", 66)

    # Esa tarea no se mueve a mano mientras la verificación está abierta.
    r = c.post(f"{TAREAS}{tarea.id}/estado/", {"estado": "hecha"}, format="json")
    assert r.status_code == 400
    assert r.data["codigo"] == "tarea_de_verificacion"
    assert c.get(f"{TAREAS}{tarea.id}/").data["verificacion"] == v["id"]

    # El último: en otro lugar. Con todo revisado se avisa al Admin.
    r = c.post(
        f"{VERIFICACIONES}{v['id']}/marcar/",
        {
            "items": [ids["S2"]],
            "resultado": "otro_lugar",
            "lugar_encontrado": deposito.id,
            "nota": "Está en el depósito",
        },
        format="json",
    )
    assert r.data["conteo"] == {
        "total": 3, "revisados": 3, "pendientes": 0, "esta": 2, "falta": 0, "otro_lugar": 1, "danado": 0,
    }  # fmt: skip
    assert Notificacion.objects.filter(
        destinatario=admin_lab, titulo__startswith="Lista para cerrar"
    ).exists()
    tarea.refresh_from_db()
    assert (tarea.estado, tarea.progreso) == ("en_progreso", 100)
    # Verificar no mueve nada: el activo sigue donde estaba.
    assert Activo.objects.get(codigo="S2").lugar_id == lugar_lab.id
    assert MovimientoActivo.objects.filter(tipo="traslado").count() == 0

    # Solo el Admin cierra; al cerrar, la tarea queda hecha.
    assert c.post(f"{VERIFICACIONES}{v['id']}/cerrar/").status_code == 403
    r = cliente(admin_lab).post(
        f"{VERIFICACIONES}{v['id']}/cerrar/", {"conclusion": "Mover S2 al aula."}, format="json"
    )
    assert r.status_code == 200, r.data
    assert r.data["estado"] == "cerrada"
    tarea.refresh_from_db()
    assert (tarea.estado, tarea.progreso) == ("hecha", 100)
    # Cerrada ya no se marca.
    assert (
        c.post(
            f"{VERIFICACIONES}{v['id']}/marcar/", {"items": [ids["S1"]], "resultado": "falta"}, format="json"
        ).status_code
        == 400
    )


def test_verificacion_por_seleccion_por_tipo_y_de_todo(cliente, admin_lab, silla, mesa, lugar_lab, deposito):
    c = cliente(admin_lab)
    s1 = _alta(cliente, admin_lab, silla, lugar_lab, codigo="S1").data["id"]
    _alta(cliente, admin_lab, silla, deposito, codigo="S2")
    m1 = _alta(cliente, admin_lab, mesa, lugar_lab, codigo="M1").data["id"]
    c.post(f"{ACTIVOS}{m1}/baja/", {"motivo": "Rota"}, format="json")

    r = c.post(VERIFICACIONES, {"titulo": "Dos puntuales", "activos": [s1, m1]}, format="json")
    assert r.data["conteo"]["total"] == 1  # el dado de baja no entra
    assert r.data["alcance"] == "Selección de 1 activo"
    r = c.post(VERIFICACIONES, {"titulo": "Sillas", "tipos": [silla.id]}, format="json")
    assert r.data["conteo"]["total"] == 2
    r = c.post(VERIFICACIONES, {"titulo": "Todo"}, format="json")
    assert r.data["conteo"]["total"] == 2
    assert r.data["alcance"] == "Todos los activos"
    r = c.post(VERIFICACIONES, {"titulo": "Mesas", "tipos": [mesa.id]}, format="json")
    assert r.status_code == 400
    assert r.data["codigo"] == "sin_activos"


def test_sin_responsables_marca_cualquier_auxiliar_y_asignada_solo_ellos(
    cliente, admin_lab, auxiliar, silla, lugar_lab
):
    otro = crear_usuario(Rol.AUXILIAR, "otro.aux@ficct.test")
    _alta(cliente, admin_lab, silla, lugar_lab, codigo="S1")

    libre = cliente(admin_lab).post(VERIFICACIONES, {"titulo": "Libre"}, format="json").data
    # Sin responsables se avisa a todos los auxiliares.
    assert (
        Notificacion.objects.filter(destinatario__in=[auxiliar, otro], titulo__endswith="Libre").count() == 2
    )
    cuerpo = {"items": [libre["items"][0]["id"]], "resultado": "danado"}
    assert (
        cliente(otro).post(f"{VERIFICACIONES}{libre['id']}/marcar/", cuerpo, format="json").status_code == 200
    )

    asignada = (
        cliente(admin_lab)
        .post(VERIFICACIONES, {"titulo": "Asignada", "responsables": [auxiliar.id]}, format="json")
        .data
    )
    cuerpo = {"items": [asignada["items"][0]["id"]], "resultado": "esta"}
    assert (
        cliente(otro).post(f"{VERIFICACIONES}{asignada['id']}/marcar/", cuerpo, format="json").status_code
        == 403
    )
    assert (
        cliente(auxiliar).post(f"{VERIFICACIONES}{asignada['id']}/marcar/", cuerpo, format="json").status_code
        == 200
    )
    # Un activo de otra verificación no se marca aquí.
    ajeno = {"items": [libre["items"][0]["id"]], "resultado": "esta"}
    assert (
        cliente(auxiliar).post(f"{VERIFICACIONES}{asignada['id']}/marcar/", ajeno, format="json").status_code
        == 400
    )


def test_cancelar_quita_la_tarea_del_pizarron(cliente, admin_lab, silla, lugar_lab):
    _alta(cliente, admin_lab, silla, lugar_lab, codigo="S1")
    c = cliente(admin_lab)
    v = c.post(VERIFICACIONES, {"titulo": "Por error"}, format="json").data
    r = c.post(f"{VERIFICACIONES}{v['id']}/cancelar/")
    assert r.status_code == 200, r.data
    assert r.data["estado"] == "cancelada"
    assert r.data["tarea"] is None
    assert not Tarea.objects.filter(pk=v["tarea"]).exists()


def test_lugares_el_de_un_laboratorio_no_se_edita_ni_borra_aqui(cliente, admin_lab, lugar_lab, deposito):
    c = cliente(admin_lab)
    url = f"{BASE}lugares/"
    assert c.patch(f"{url}{lugar_lab.id}/", {"nombre": "Otro nombre"}, format="json").status_code == 400
    assert c.delete(f"{url}{lugar_lab.id}/").status_code == 400
    assert c.post(url, {"nombre": "Depósito"}, format="json").status_code == 400  # repetido
    r = c.post(url, {"nombre": "Depósito 2", "tipo": "deposito"}, format="json")
    assert r.status_code == 201, r.data
    assert c.delete(f"{url}{r.data['id']}/").status_code == 204
