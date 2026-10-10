import pytest
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import DatabaseError, connection, transaction
from django.utils import timezone

from apps.laboratorios.models import Laboratorio
from apps.objetos_perdidos.models import EstadoObjeto, ObjetoPerdido

pytestmark = pytest.mark.django_db

URL = f"/{settings.API_PREFIX}objetos-perdidos/"


@pytest.fixture
def lab(db):
    return Laboratorio.objects.create(codigo="LAB-2", nombre="Laboratorio 2")


def _datos(lab, **extra):
    return {
        "descripcion": "Mochila negra",
        "categoria": "accesorio",
        "laboratorio": lab.id,
        "lugar": "PC-12",
        "fecha_hallazgo": timezone.now().isoformat(),
        **extra,
    }


def test_registrar_crea_historial(cliente, auxiliar, lab):
    r = cliente(auxiliar).post(URL, _datos(lab), format="json")
    assert r.status_code == 201, r.data
    assert r.data["codigo"].startswith("OP-")
    assert r.data["eventos"][0]["tipo"] == "registrado"


def test_no_existe_delete_en_la_api(cliente, admin_lab, lab):
    c = cliente(admin_lab)
    objeto = c.post(URL, _datos(lab), format="json").data
    assert c.delete(f"{URL}{objeto['id']}/").status_code == 405


def test_el_modelo_no_se_deja_borrar(auxiliar, lab):
    objeto = ObjetoPerdido.objects.create(descripcion="Llaves", fecha_hallazgo=timezone.now(), laboratorio=lab)
    with pytest.raises(PermissionDenied):
        objeto.delete()


def test_la_base_de_datos_rechaza_el_borrado(lab):
    objeto = ObjetoPerdido.objects.create(descripcion="Carnet", fecha_hallazgo=timezone.now(), laboratorio=lab)
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("DELETE FROM objetos_perdidos_objeto WHERE id = %s", [objeto.pk])


def test_entregar_y_luego_no_editar(cliente, auxiliar, lab):
    c = cliente(auxiliar)
    objeto = c.post(URL, _datos(lab), format="json").data
    r = c.post(f"{URL}{objeto['id']}/entregar/", {"entregado_a": "Juan Pérez", "entregado_ci": "1234567"}, format="json")
    assert r.data["estado"] == EstadoObjeto.ENTREGADO
    assert len(r.data["eventos"]) == 2
    r = c.patch(f"{URL}{objeto['id']}/", {"descripcion": "Otra"}, format="json")
    assert r.status_code == 400


def test_solo_admin_anula(cliente, admin_lab, auxiliar, lab):
    objeto = cliente(auxiliar).post(URL, _datos(lab), format="json").data
    assert cliente(auxiliar).post(f"{URL}{objeto['id']}/anular/", {"motivo": "Duplicado"}).status_code == 403
    r = cliente(admin_lab).post(f"{URL}{objeto['id']}/anular/", {"motivo": "Duplicado"}, format="json")
    assert r.data["estado"] == EstadoObjeto.ANULADO


def test_buscar_por_codigo(cliente, auxiliar, lab):
    c = cliente(auxiliar)
    objeto = c.post(URL, _datos(lab), format="json").data
    r = c.get(f"{URL}?search={objeto['codigo']}")
    assert [o["id"] for o in r.data["results"]] == [objeto["id"]]


def test_docente_no_accede(cliente, docente):
    assert cliente(docente).get(URL).status_code == 403


def _imagen(nombre="ci.png"):
    import io

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), "white").save(buffer, format="PNG")
    return SimpleUploadedFile(nombre, buffer.getvalue(), content_type="image/png")


def test_entregar_con_fotos_opcionales_y_verlas_solo_con_sesion(cliente, api, auxiliar, lab):
    c = cliente(auxiliar)
    objeto = c.post(URL, _datos(lab), format="json").data
    r = c.post(
        f"{URL}{objeto['id']}/entregar/",
        {"entregado_a": "Ana Pérez", "ci_anverso": _imagen(), "foto_persona": _imagen("cara.png")},
        format="multipart",
    )
    assert r.status_code == 200, r.data
    assert sorted(r.data["fotos_entrega"]) == ["ci-anverso", "persona"]
    assert "Fotos:" in r.data["eventos"][0]["detalle"]

    foto = c.get(f"{URL}{objeto['id']}/entrega/ci-anverso/")
    assert foto.status_code == 200
    assert foto["Content-Type"] == "image/png"
    assert c.get(f"{URL}{objeto['id']}/entrega/ci-reverso/").status_code == 404
    assert api.get(f"{URL}{objeto['id']}/entrega/ci-anverso/").status_code == 401


def test_entregar_sin_fotos_sigue_funcionando(cliente, auxiliar, lab):
    c = cliente(auxiliar)
    objeto = c.post(URL, _datos(lab), format="json").data
    r = c.post(f"{URL}{objeto['id']}/entregar/", {"entregado_a": "Luis"}, format="json")
    assert r.status_code == 200
    assert r.data["fotos_entrega"] == []
