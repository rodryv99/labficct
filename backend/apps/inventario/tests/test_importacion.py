"""Importar activos de una planilla y exportar el inventario."""

import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.inventario.models import Activo, Lugar, MovimientoActivo, TipoActivo
from apps.laboratorios.models import Laboratorio

pytestmark = pytest.mark.django_db

BASE = f"/{settings.API_PREFIX}inventario/activos/"
IMPORTAR = f"{BASE}importar/"
EXPORTAR = f"{BASE}exportar/"


@pytest.fixture
def lab(db):
    return Laboratorio.objects.create(codigo="LAB-41", nombre="Laboratorio 41")


@pytest.fixture
def deposito(db):
    return Lugar.objects.get_or_create(nombre="Depósito", defaults={"tipo": "deposito"})[0]


def csv_subido(texto: str, nombre="inventario.csv"):
    return SimpleUploadedFile(nombre, ("﻿" + texto).encode("utf-8"), content_type="text/csv")


# Código; Descripción; Ubicación; Tipo; Marca; Estado; Fecha
PLANILLA = """Código;Descripción;Ubicación;Tipo;Marca;Estado;Fecha de compra
A-100;Silla giratoria negra;LAB-41;Silla;Forza;Bueno;05/03/2024
A-101;Mesa de melamina;Depósito;Banqueta;;Malo;2023-12-01
A-102;Monitor LED 24;Laboratorio 41;Monitor;Samsung;operativo;
"""


def test_preview_detecta_columnas_y_no_guarda(cliente, admin_lab, lab, deposito):
    r = cliente(admin_lab).post(
        IMPORTAR, {"archivo": csv_subido(PLANILLA), "confirmar": "false"}, format="multipart"
    )
    assert r.status_code == 200, r.data
    d = r.data
    assert d["con_titulos"] is True
    campos = {c["campo"] for c in d["columnas"]}
    assert {"codigo", "descripcion", "lugar", "tipo", "marca", "estado", "fecha_adquisicion"} <= campos
    assert d["total"] == 3
    assert d["validas"] == 3
    assert d["creados"] == 0
    assert not d["faltan"]
    assert len(d["ejemplo"]) == 3
    # Se avisa que se creará el tipo nuevo "Banqueta" (Silla y Monitor ya existen por la migración).
    assert any("Banqueta" in a for a in d["avisos"])
    assert Activo.objects.count() == 0  # nada se guardó


def test_confirmar_crea_activos_tipos_lugares_y_movimientos(cliente, admin_lab, lab, deposito):
    r = cliente(admin_lab).post(
        IMPORTAR, {"archivo": csv_subido(PLANILLA), "confirmar": "true"}, format="multipart"
    )
    assert r.status_code == 200, r.data
    assert r.data["creados"] == 3
    assert Activo.objects.count() == 3

    silla = Activo.objects.get(codigo="A-100")
    assert silla.descripcion == "Silla giratoria negra"
    assert silla.lugar == Lugar.objects.get(laboratorio=lab)  # "LAB-41" → el lugar del laboratorio
    assert silla.tipo.nombre == "Silla"
    assert silla.marca == "Forza"
    assert silla.estado == "operativo"  # "Bueno"
    assert str(silla.fecha_adquisicion) == "2024-03-05"
    # Cada activo importado deja su movimiento de alta.
    assert MovimientoActivo.objects.filter(activo=silla, tipo="alta").count() == 1

    mesa = Activo.objects.get(codigo="A-101")
    assert mesa.lugar == deposito
    assert mesa.estado == "danado"  # "Malo"
    assert TipoActivo.objects.filter(nombre="Banqueta").exists()  # tipo nuevo creado

    monitor = Activo.objects.get(codigo="A-102")
    assert monitor.lugar == Lugar.objects.get(laboratorio=lab)  # "Laboratorio 41" por nombre
    assert monitor.fecha_adquisicion is None


def test_segunda_importacion_omite_los_que_ya_estan(cliente, admin_lab, lab, deposito):
    c = cliente(admin_lab)
    c.post(IMPORTAR, {"archivo": csv_subido(PLANILLA), "confirmar": "true"}, format="multipart")
    r = c.post(IMPORTAR, {"archivo": csv_subido(PLANILLA), "confirmar": "true"}, format="multipart")
    assert r.data["existentes"] == 3
    assert r.data["creados"] == 0
    assert Activo.objects.count() == 3
    # Se informa cuáles se omitieron y por qué.
    assert r.data["omitidos_total"] == 3
    assert {o["codigo"] for o in r.data["omitidos"]} == {"A-100", "A-101", "A-102"}
    assert all(o["motivo"] == "ya estaba en el inventario" for o in r.data["omitidos"])


def test_filas_con_error_se_informan_y_no_frenan_al_resto(cliente, admin_lab, deposito):
    planilla = """Código;Descripción;Lugar
A-1;Silla buena;Depósito
;Sin código;Depósito
A 2 malo!;Código inválido;Depósito
A-1;Código repetido;Depósito
A-3;;Depósito
A-4;Mesa correcta;Depósito
"""
    r = cliente(admin_lab).post(
        IMPORTAR, {"archivo": csv_subido(planilla), "confirmar": "true"}, format="multipart"
    )
    assert r.status_code == 200, r.data
    assert r.data["creados"] == 2  # A-1 y A-4
    # Errores: sin código, código inválido y descripción vacía.
    assert r.data["con_error"] == 3
    assert len(r.data["errores"]) == 3
    # El código repetido en el archivo no es error: se omite y se informa.
    assert r.data["repetidos"] == 1
    assert any(o["codigo"] == "A-1" and o["motivo"] == "repetido en el archivo" for o in r.data["omitidos"])
    assert {a.codigo for a in Activo.objects.all()} == {"A-1", "A-4"}


def test_formato_patrimonio_activo_es_codigo_y_mapea_responsable(cliente, admin_lab, lab, deposito):
    # Formato UAGRM: la columna «Activo» es el código, «Grupo» el tipo, «Ubicación» el lugar,
    # y hay una columna «Responsable». No trae descripción: el grupo hace de descripción.
    planilla = (
        "Activo;Grupo;Estado;Fecha;Ubicación;Responsable\n"
        "U-100;SILLA;BUENO;23/10/2025;LAB-41;5599-HIGUERAS HUANCA\n"
        "U-101;MESA;REGULAR;22/10/2025;Depósito;5599-HIGUERAS HUANCA\n"
    )
    c = cliente(admin_lab)
    # El preview reconoce «Activo» como código y no reclama la descripción.
    prev = c.post(IMPORTAR, {"archivo": csv_subido(planilla), "confirmar": "false"}, format="multipart")
    assert prev.status_code == 200, prev.data
    assert not prev.data["faltan"]
    campos = {col["titulo"]: col["campo"] for col in prev.data["columnas"]}
    assert campos["Activo"] == "codigo"
    assert campos["Responsable"] == "responsable"

    r = c.post(IMPORTAR, {"archivo": csv_subido(planilla), "confirmar": "true"}, format="multipart")
    assert r.status_code == 200, r.data
    assert r.data["creados"] == 2
    a = Activo.objects.get(codigo="U-100")
    assert a.descripcion == "SILLA"  # el grupo sirve de descripción
    assert a.tipo.nombre == "SILLA"
    assert a.estado == "operativo"  # "BUENO"
    assert a.responsable == "5599-HIGUERAS HUANCA"
    assert a.lugar == Lugar.objects.get(laboratorio=lab)  # "LAB-41"


def test_sin_columna_lugar_pide_una_y_el_lugar_por_defecto_la_resuelve(cliente, admin_lab, deposito):
    planilla = "Código;Descripción\nA-1;Silla\nA-2;Mesa\n"
    c = cliente(admin_lab)
    # Sin lugar: avisa que falta y no deja confirmar.
    r = c.post(IMPORTAR, {"archivo": csv_subido(planilla), "confirmar": "false"}, format="multipart")
    assert "Lugar" in r.data["faltan"]
    assert r.data["validas"] == 0
    r = c.post(IMPORTAR, {"archivo": csv_subido(planilla), "confirmar": "true"}, format="multipart")
    assert r.status_code == 400
    assert r.data["codigo"] == "faltan_columnas"
    # Con un lugar por defecto, entran todas ahí.
    r = c.post(
        IMPORTAR,
        {"archivo": csv_subido(planilla), "confirmar": "true", "lugar_por_defecto": deposito.id},
        format="multipart",
    )
    assert r.data["creados"] == 2
    assert all(a.lugar_id == deposito.id for a in Activo.objects.all())


def test_mapeo_manual_manda_sobre_la_deteccion(cliente, admin_lab, deposito):
    # Sin títulos; se dice a mano qué columna es cada cosa.
    planilla = "X-1;un texto cualquiera;Depósito\nX-2;otro texto;Depósito\n"
    r = cliente(admin_lab).post(
        IMPORTAR,
        {
            "archivo": csv_subido(planilla),
            "confirmar": "true",
            "titulos": "no",
            "mapeo": '["codigo", "descripcion", "lugar"]',
        },
        format="multipart",
    )
    assert r.status_code == 200, r.data
    assert r.data["creados"] == 2
    assert Activo.objects.get(codigo="X-1").descripcion == "un texto cualquiera"


def test_mapeo_con_un_campo_repetido_se_rechaza(cliente, admin_lab, deposito):
    r = cliente(admin_lab).post(
        IMPORTAR,
        {
            "archivo": csv_subido("A-1;Silla\n"),
            "confirmar": "true",
            "titulos": "no",
            "mapeo": '["codigo", "codigo"]',
        },
        format="multipart",
    )
    assert r.status_code == 400
    assert r.data["codigo"] == "mapeo_invalido"


def test_archivo_ilegible_da_error_claro(cliente, admin_lab):
    malo = SimpleUploadedFile("datos.xlsx", b"no soy un excel", content_type="application/octet-stream")
    r = cliente(admin_lab).post(IMPORTAR, {"archivo": malo, "confirmar": "true"}, format="multipart")
    assert r.status_code == 400
    assert r.data["codigo"] == "archivo_ilegible"


def test_formato_de_archivo_no_permitido(cliente, admin_lab):
    r = cliente(admin_lab).post(
        IMPORTAR,
        {"archivo": SimpleUploadedFile("foto.png", b"\x89PNG\r\n", content_type="image/png")},
        format="multipart",
    )
    assert r.status_code == 400
    assert "archivo" in r.data["campos"]


def test_el_auxiliar_no_puede_importar(cliente, auxiliar, deposito):
    r = cliente(auxiliar).post(
        IMPORTAR, {"archivo": csv_subido(PLANILLA), "confirmar": "true"}, format="multipart"
    )
    assert r.status_code == 403
    assert Activo.objects.count() == 0


# ── Exportar ──


@pytest.fixture
def unos_activos(cliente, admin_lab, lab, deposito):
    cliente(admin_lab).post(
        IMPORTAR, {"archivo": csv_subido(PLANILLA), "confirmar": "true"}, format="multipart"
    )
    return Activo.objects.all()


def test_exportar_csv(cliente, admin_lab, unos_activos):
    r = cliente(admin_lab).get(EXPORTAR, {"formato": "csv"})
    assert r.status_code == 200
    assert r["Content-Type"].startswith("text/csv")
    assert "inventario-" in r["Content-Disposition"]
    cuerpo = b"".join(r.streaming_content) if r.streaming else r.content
    texto = cuerpo.decode("utf-8-sig")
    assert "A-100" in texto and "Silla giratoria negra" in texto


def test_exportar_xlsx_y_pdf(cliente, admin_lab, unos_activos):
    xlsx = cliente(admin_lab).get(EXPORTAR, {"formato": "xlsx"})
    assert xlsx.status_code == 200
    assert xlsx.content[:4] == b"PK\x03\x04"
    pdf = cliente(admin_lab).get(EXPORTAR, {"formato": "pdf"})
    assert pdf.status_code == 200
    assert pdf["Content-Type"] == "application/pdf"
    assert pdf.content[:5] == b"%PDF-"


def test_exportar_respeta_los_filtros(cliente, admin_lab, unos_activos):
    r = cliente(admin_lab).get(EXPORTAR, {"formato": "csv", "search": "monitor"})
    texto = r.content.decode("utf-8-sig")
    assert "A-102" in texto
    assert "A-100" not in texto


def test_formato_invalido(cliente, admin_lab, unos_activos):
    r = cliente(admin_lab).get(EXPORTAR, {"formato": "docx"})
    assert r.status_code == 400
    assert r.data["codigo"] == "formato_invalido"


def test_el_auxiliar_si_puede_exportar(cliente, auxiliar, unos_activos):
    r = cliente(auxiliar).get(EXPORTAR, {"formato": "csv"})
    assert r.status_code == 200


def test_activo_sin_tipo_se_crea_y_se_exporta(cliente, admin_lab, deposito):
    c = cliente(admin_lab)
    r = c.post(BASE, {"codigo": "S-1", "descripcion": "Silla sin tipo", "lugar": deposito.id}, format="json")
    assert r.status_code == 201, r.data
    assert r.data["tipo"] is None
    assert r.data["tipo_nombre"] == ""
    texto = c.get(EXPORTAR, {"formato": "csv"}).content.decode("utf-8-sig")
    assert "S-1" in texto
