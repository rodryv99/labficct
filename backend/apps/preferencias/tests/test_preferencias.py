from datetime import date, time

import pytest
from django.conf import settings

from apps.laboratorios.models import Laboratorio
from apps.planificacion.models import Docente, Horario, Materia, PeriodoAcademico
from apps.preferencias.models import OpcionPreferencia

pytestmark = pytest.mark.django_db

API = f"/{settings.API_PREFIX}"


def test_hay_opciones_iniciales(cliente, docente):
    opciones = cliente(docente).get(f"{API}preferencias/opciones/").data
    assert len(opciones) >= 4
    assert "pizarra" in " ".join(o["pregunta"] for o in opciones)


def test_docente_marca_sus_preferencias(cliente, docente):
    c = cliente(docente)
    assert c.get(f"{API}preferencias/mias/").data["valores"] == {}
    entrar, pizarra = OpcionPreferencia.objects.order_by("orden")[:2]
    datos = {
        "valores": {str(entrar.id): False, str(pizarra.id): True},
        "nota": "Dejar el aire acondicionado.",
    }
    r = c.put(f"{API}preferencias/mias/", datos, format="json")
    assert r.status_code == 200, r.data
    assert r.data["resumen"] == [entrar.texto_no, pizarra.texto_si, "Dejar el aire acondicionado."]
    # Quitar una preferencia (null) la deja sin marcar.
    r = c.put(f"{API}preferencias/mias/", {"valores": {str(entrar.id): None}}, format="json")
    assert r.data["valores"] == {}


def test_opcion_que_no_existe(cliente, docente):
    r = cliente(docente).put(f"{API}preferencias/mias/", {"valores": {"99999": True}}, format="json")
    assert r.status_code == 400


def test_auxiliar_ve_pero_no_edita_y_el_admin_si(cliente, auxiliar, admin_lab):
    ficha = Docente.objects.create(nombres="Juan", apellidos="Soliz")
    opcion = OpcionPreferencia.objects.first()
    url = f"{API}preferencias/docentes/{ficha.id}/"
    assert cliente(auxiliar).get(url).status_code == 200
    assert cliente(auxiliar).put(url, {"valores": {str(opcion.id): True}}, format="json").status_code == 403
    r = cliente(admin_lab).put(url, {"valores": {str(opcion.id): True}}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["resumen"] == [opcion.texto_si]


def test_solo_el_admin_edita_la_lista(cliente, auxiliar, admin_lab):
    datos = {"pregunta": "¿Usas parlantes?", "texto_si": "Conectar parlantes.", "texto_no": "Sin parlantes."}
    assert cliente(auxiliar).post(f"{API}preferencias/opciones/", datos, format="json").status_code == 403
    assert cliente(admin_lab).post(f"{API}preferencias/opciones/", datos, format="json").status_code == 201


def test_la_pizarra_muestra_las_preferencias(cliente, auxiliar):
    ficha = Docente.objects.create(nombres="Rosa", apellidos="Vaca")
    opcion = OpcionPreferencia.objects.first()
    from apps.preferencias.models import PreferenciasDocente

    PreferenciasDocente.objects.create(docente=ficha, valores={str(opcion.id): True})
    periodo = PeriodoAcademico.objects.create(
        nombre="2-2026", fecha_inicio=date(2026, 8, 3), fecha_fin=date(2026, 12, 12)
    )
    Horario.objects.create(
        periodo=periodo,
        laboratorio=Laboratorio.objects.create(codigo="LAB-1", nombre="Laboratorio 1"),
        materia=Materia.objects.create(sigla="INF-110", nombre="Intro"),
        grupo="SA",
        docente=ficha,
        dia_semana=1,
        hora_inicio=time(7, 0),
        hora_fin=time(8, 30),
    )
    eventos = cliente(auxiliar).get(f"{API}agenda/", {"desde": "2026-09-28"}).data
    assert eventos[0]["docente_id"] == ficha.id
    assert eventos[0]["preferencias"] == [opcion.texto_si]
