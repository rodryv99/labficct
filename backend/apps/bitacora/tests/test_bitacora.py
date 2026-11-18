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


# ── Mapa estilo OrganiLab ───────────────────────────────


@pytest.fixture
def lab_dibujado(lab):
    from apps.laboratorios.models import ElementoLaboratorio, TipoElemento

    pc = TipoElemento.objects.create(nombre="Computadora", icono="pc", prefijo_etiqueta="PC")
    # Dos filas de PCs que empiezan en la fila 2 y la columna 1: el mapa guarda solo ese rectángulo.
    for i, (fila, columna) in enumerate([(2, 1), (2, 2), (3, 1), (3, 3)], start=1):
        ElementoLaboratorio.objects.create(
            laboratorio=lab, tipo=pc, fila=fila, columna=columna, etiqueta=f"PC-{i:02d}", ip=f"10.0.0.{i}"
        )
    return lab


def _pintado(*marcas):
    return {
        "atributos": [
            {"nombre": "Funciona", "color": "#22A34A"},
            {"nombre": "Con falla", "color": "#E5383B"},
        ],
        "marcas": [{"fila": f, "columna": c, "atributo": a} for f, c, a in marcas],
    }


def test_plantilla_recorta_el_rectangulo_usado(cliente, auxiliar, lab_dibujado):
    r = cliente(auxiliar).get(f"{API}bitacora/plantilla/", {"laboratorio": lab_dibujado.id})
    assert r.status_code == 200, r.data
    assert (r.data["filas"], r.data["columnas"]) == (2, 3)
    assert r.data["origen"] == {"fila": 2, "columna": 1}
    assert [(c["fila"], c["columna"], c["etiqueta"]) for c in r.data["celdas"]][0] == (0, 0, "PC-01")
    assert len(r.data["atributos"]) == 2


def test_registrar_con_mapa_pintado(cliente, auxiliar, lab_dibujado):
    c = cliente(auxiliar)
    datos = {
        "laboratorio": lab_dibujado.id,
        "tipo": "revision",
        "titulo": "Revisión de equipos",
        "mapa": _pintado((0, 0, 0), (0, 1, 1), (0, 1, 0)),
    }
    r = c.post(f"{API}bitacora/", datos, format="json")
    assert r.status_code == 201, r.data
    # Si una casilla viene dos veces, gana la última.
    assert r.data["mapa"]["marcas"] == [
        {"fila": 0, "columna": 0, "atributo": 0},
        {"fila": 0, "columna": 1, "atributo": 0},
    ]
    assert r.data["mapa"]["celdas"][0]["ip"] == "10.0.0.1"

    # Cambiar la grilla después no cambia el mapa de la entrada (es una copia).
    lab_dibujado.elementos.all().delete()
    url = f"{API}bitacora/{r.data['id']}/"
    r = c.patch(url, {"mapa": _pintado((1, 2, 1))}, format="json")
    assert r.status_code == 200, r.data
    assert len(r.data["mapa"]["celdas"]) == 4
    assert r.data["mapa"]["marcas"] == [{"fila": 1, "columna": 2, "atributo": 1}]

    # Quitar el mapa.
    assert c.patch(url, {"mapa": None}, format="json").data["mapa"] is None


def test_mapa_invalido(cliente, auxiliar, lab_dibujado):
    base = {"laboratorio": lab_dibujado.id, "titulo": "Revisión"}
    c = cliente(auxiliar)
    # Casilla vacía (fila 1, columna 1 del rectángulo no tiene elemento).
    r = c.post(f"{API}bitacora/", {**base, "mapa": _pintado((1, 1, 0))}, format="json")
    assert r.status_code == 400
    assert r.data["codigo"] == "mapa_invalido"
    # Atributo que no existe.
    assert c.post(f"{API}bitacora/", {**base, "mapa": _pintado((0, 0, 5))}, format="json").status_code == 400
    # Sin atributos.
    assert c.post(f"{API}bitacora/", {**base, "mapa": {"atributos": []}}, format="json").status_code == 400


def test_sin_elementos_no_hay_mapa(cliente, auxiliar, lab):
    r = cliente(auxiliar).get(f"{API}bitacora/plantilla/", {"laboratorio": lab.id})
    assert r.status_code == 400
    assert "no tiene elementos" in r.data["mensaje"]


def test_exportar_e_importar(cliente, auxiliar, lab_dibujado):
    c = cliente(auxiliar)
    datos = {"laboratorio": lab_dibujado.id, "titulo": "Revisión de noviembre", "mapa": _pintado((0, 0, 1))}
    entrada = c.post(f"{API}bitacora/", datos, format="json").data
    url = f"{API}bitacora/{entrada['id']}/exportar/"

    jpg = c.get(url, {"formato": "jpg"})
    assert jpg.status_code == 200
    assert jpg["Content-Type"] == "image/jpeg"
    assert jpg.content[:2] == b"\xff\xd8"
    assert "attachment" in jpg["Content-Disposition"]
    assert c.get(url, {"formato": "pdf"}).content[:4] == b"%PDF"
    archivo = c.get(url, {"formato": "json"}).json()
    assert archivo["formato"] == "labficct-bitacora"

    # Importar en el mismo laboratorio (lo encuentra por el código del archivo).
    r = c.post(f"{API}bitacora/importar/", {"archivo": archivo}, format="json")
    assert r.status_code == 201, r.data
    assert r.data["laboratorio"] == lab_dibujado.id
    assert r.data["mapa"]["marcas"] == [{"fila": 0, "columna": 0, "atributo": 1}]
    assert EntradaBitacora.objects.count() == 2

    # Un archivo cualquiera no se importa.
    r = c.post(f"{API}bitacora/importar/", {"archivo": {"hola": 1}}, format="json")
    assert r.status_code == 400


def test_entrada_sin_mapa_solo_se_exporta_como_archivo(cliente, auxiliar, lab):
    c = cliente(auxiliar)
    entrada = c.post(f"{API}bitacora/", {"laboratorio": lab.id, "titulo": "Limpieza"}, format="json").data
    url = f"{API}bitacora/{entrada['id']}/exportar/"
    assert c.get(url, {"formato": "pdf"}).status_code == 400
    assert c.get(url, {"formato": "json"}).status_code == 200
