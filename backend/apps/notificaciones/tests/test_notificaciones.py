from datetime import date, datetime, time

import pytest
from django.conf import settings
from django.utils import timezone

from apps.core.roles import Rol
from apps.laboratorios.models import Laboratorio
from apps.notificaciones.avisos import avisos_de_aulas
from apps.notificaciones.models import Notificacion
from apps.notificaciones.services import notificar
from apps.planificacion.models import Docente, Horario, Materia, PeriodoAcademico
from apps.preferencias.models import OpcionPreferencia, PreferenciasDocente
from conftest import crear_usuario

pytestmark = pytest.mark.django_db

API = f"/{settings.API_PREFIX}"
LUNES = date(2026, 9, 28)


def _a_las(hora, minuto=0, dia=LUNES):
    return timezone.make_aware(datetime.combine(dia, time(hora, minuto)))


@pytest.fixture
def clase(db):
    periodo = PeriodoAcademico.objects.create(
        nombre="2-2026", fecha_inicio=date(2026, 8, 3), fecha_fin=date(2026, 12, 12)
    )
    lab = Laboratorio.objects.create(codigo="LAB-1", nombre="Laboratorio 1")
    materia = Materia.objects.create(sigla="INF-110", nombre="Introducción a la Informática")
    docente = Docente.objects.create(nombres="Rosa", apellidos="Vaca")
    opcion = OpcionPreferencia.objects.order_by("orden").first()
    PreferenciasDocente.objects.create(
        docente=docente, valores={str(opcion.pk): False}, nota="Traer marcadores."
    )
    return Horario.objects.create(
        periodo=periodo,
        laboratorio=lab,
        materia=materia,
        grupo="SA",
        docente=docente,
        dia_semana=1,
        hora_inicio=time(10, 0),
        hora_fin=time(11, 30),
    )


def test_notificar_con_clave_no_repite(auxiliar):
    notificar([auxiliar], titulo="Hola", clave="prueba")
    notificar([auxiliar], titulo="Hola", clave="prueba")
    assert Notificacion.objects.filter(destinatario=auxiliar).count() == 1


def test_campana_resumen_y_marcar_leidas(cliente, auxiliar, docente):
    notificar([auxiliar], titulo="Uno")
    notificar([auxiliar], titulo="Dos")
    notificar([docente], titulo="De otro")
    c = cliente(auxiliar)
    resumen = c.get(f"{API}notificaciones/resumen/").data
    assert resumen["no_leidas"] == 2

    lista = c.get(f"{API}notificaciones/").data["results"]
    assert [n["titulo"] for n in lista] == ["Dos", "Uno"]
    c.post(f"{API}notificaciones/{lista[0]['id']}/leer/")
    assert c.get(f"{API}notificaciones/resumen/").data["no_leidas"] == 1
    assert c.post(f"{API}notificaciones/leer-todas/").data["marcadas"] == 1
    assert c.get(f"{API}notificaciones/resumen/").data == {"no_leidas": 0, "ultima_id": None}


def test_no_se_leen_las_de_otro(cliente, auxiliar, docente):
    notificar([docente], titulo="Privada")
    ajena = Notificacion.objects.get(destinatario=docente)
    assert cliente(auxiliar).post(f"{API}notificaciones/{ajena.id}/leer/").status_code == 404


def test_avisa_alistar_con_preferencias_y_cerrar(clase, auxiliar):
    avisos_de_aulas(ahora=_a_las(9, 50))
    avisos_de_aulas(ahora=_a_las(9, 55))  # no se repite
    alistar = Notificacion.objects.get(destinatario=auxiliar, tipo="alistar")
    assert alistar.titulo == "Alistar LAB-1 · 10:00"
    assert "Rosa Vaca" in alistar.mensaje
    assert "Los estudiantes esperan afuera" in alistar.mensaje
    assert "Traer marcadores." in alistar.mensaje

    avisos_de_aulas(ahora=_a_las(11, 35))
    assert Notificacion.objects.get(destinatario=auxiliar, tipo="cerrar").titulo == "Cerrar LAB-1 · 11:30"


def test_no_avisa_cerrar_si_sigue_otra_clase(clase, auxiliar):
    Horario.objects.create(
        periodo=clase.periodo,
        laboratorio=clase.laboratorio,
        materia=clase.materia,
        grupo="SB",
        dia_semana=1,
        hora_inicio=time(11, 30),
        hora_fin=time(13, 0),
    )
    avisos_de_aulas(ahora=_a_las(11, 32))
    assert not Notificacion.objects.filter(destinatario=auxiliar, titulo="Cerrar LAB-1 · 11:30").exists()


def test_aviso_manual_desde_la_pizarra(cliente, clase, auxiliar, docente):
    otro = crear_usuario(Rol.AUXILIAR, "otro.aux@ficct.test")
    datos = {
        "tipo": "alistar",
        "evento": f"clase-{clase.id}-{LUNES.isoformat()}",
        "fecha": LUNES.isoformat(),
        "nota": "Llegan 40 estudiantes",
    }
    r = cliente(auxiliar).post(f"{API}avisos/aula/", datos, format="json")
    assert r.status_code == 200, r.data
    aviso = Notificacion.objects.get(destinatario=otro)
    assert "Llegan 40 estudiantes" in aviso.mensaje
    assert not Notificacion.objects.filter(destinatario=auxiliar).exists()  # quien avisa no se avisa
    assert cliente(docente).post(f"{API}avisos/aula/", datos, format="json").status_code == 403
