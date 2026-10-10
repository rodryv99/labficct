from datetime import date, time

import pytest
from django.conf import settings
from django.db import IntegrityError, transaction

from apps.laboratorios.models import Laboratorio, Software
from apps.planificacion.models import Horario, Materia, PeriodoAcademico
from conftest import crear_usuario

pytestmark = pytest.mark.django_db

API = f"/{settings.API_PREFIX}"
LUNES = date(2026, 9, 28)  # lunes dentro del periodo de prueba


@pytest.fixture
def base(db):
    periodo = PeriodoAcademico.objects.create(
        nombre="2-2026", fecha_inicio=date(2026, 8, 3), fecha_fin=date(2026, 12, 12)
    )
    lab = Laboratorio.objects.create(codigo="LAB-1", nombre="Laboratorio 1")
    materia = Materia.objects.create(sigla="INF-110", nombre="Introducción a la Informática")
    return {"periodo": periodo, "lab": lab, "materia": materia}


def _horario(base, inicio="07:00", fin="08:30", dia=1, grupo="SA"):
    return {
        "periodo": base["periodo"].id,
        "laboratorio": base["lab"].id,
        "materia": base["materia"].id,
        "grupo": grupo,
        "dia_semana": dia,
        "hora_inicio": inicio,
        "hora_fin": fin,
    }


def _reserva(base, fecha=LUNES, inicio="08:00", fin="10:00", **extra):
    return {
        "titulo": "Curso de Python",
        "solicitante_externo": "Centro de estudiantes",
        "bloques": [
            {"laboratorio": base["lab"].id, "fecha": fecha.isoformat(), "hora_inicio": inicio, "hora_fin": fin}
        ],
        **extra,
    }


def test_crear_horario(cliente, admin_lab, base):
    r = cliente(admin_lab).post(f"{API}horarios/", _horario(base), format="json")
    assert r.status_code == 201, r.data
    assert r.data["hora_inicio"] == "07:00"


def test_horario_que_choca_devuelve_409_con_mensaje(cliente, admin_lab, base):
    c = cliente(admin_lab)
    c.post(f"{API}horarios/", _horario(base), format="json")
    r = c.post(f"{API}horarios/", _horario(base, "08:00", "09:30", grupo="SB"), format="json")
    assert r.status_code == 409
    assert "INF-110" in r.data["mensaje"]


def test_la_base_de_datos_tambien_impide_el_choque(base):
    datos = dict(periodo=base["periodo"], laboratorio=base["lab"], materia=base["materia"], dia_semana=1)
    Horario.objects.create(grupo="SA", hora_inicio=time(7), hora_fin=time(8, 30), **datos)
    with pytest.raises(IntegrityError), transaction.atomic():
        Horario.objects.create(grupo="SB", hora_inicio=time(8), hora_fin=time(9), **datos)


def test_horarios_contiguos_no_chocan(cliente, admin_lab, base):
    c = cliente(admin_lab)
    assert c.post(f"{API}horarios/", _horario(base, "07:00", "08:30"), format="json").status_code == 201
    r = c.post(f"{API}horarios/", _horario(base, "08:30", "10:00", grupo="SB"), format="json")
    assert r.status_code == 201


def test_reserva_que_choca_con_clase_queda_por_aprobar(cliente, admin_lab, auxiliar, base):
    cliente(admin_lab).post(f"{API}horarios/", _horario(base), format="json")
    r = cliente(auxiliar).post(f"{API}reservas/", _reserva(base), format="json")
    assert r.status_code == 201, r.data
    assert r.data["estado"] == "pendiente"
    assert "INF-110" in r.data["choques"][0]
    # Mientras no se apruebe, no ocupa el laboratorio: la pizarra solo muestra la clase.
    eventos = cliente(auxiliar).get(f"{API}agenda/", {"desde": LUNES.isoformat()}).data
    assert [(e["tipo"], e["estado"]) for e in eventos] == [("clase", "programada")]


def test_el_estado_no_se_elige_desde_el_formulario(cliente, admin_lab, auxiliar, base):
    cliente(admin_lab).post(f"{API}horarios/", _horario(base), format="json")
    r = cliente(auxiliar).post(f"{API}reservas/", _reserva(base, estado="confirmada"), format="json")
    assert r.data["estado"] == "pendiente"


def test_aprobar_da_prioridad_a_la_reserva(cliente, admin_lab, auxiliar, base):
    c = cliente(admin_lab)
    c.post(f"{API}horarios/", _horario(base), format="json")
    reserva = cliente(auxiliar).post(f"{API}reservas/", _reserva(base), format="json").data

    assert cliente(auxiliar).post(f"{API}reservas/{reserva['id']}/aprobar/").status_code == 403
    r = c.post(f"{API}reservas/{reserva['id']}/aprobar/")
    assert r.status_code == 200, r.data
    assert r.data["estado"] == "confirmada"
    assert r.data["aprobada_por_nombre"]
    assert len(r.data["clases_suspendidas"]) == 1
    eventos = c.get(f"{API}agenda/", {"desde": LUNES.isoformat()}).data
    assert [(e["tipo"], e["estado"]) for e in eventos] == [("clase", "suspendida"), ("reserva", "confirmada")]

    # La clase no se puede reanudar a mano mientras la reserva siga en pie...
    horario_id = eventos[0]["horario_id"]
    r = c.post(f"{API}horarios/{horario_id}/reanudar/", {"fecha": LUNES.isoformat()}, format="json")
    assert r.data["codigo"] == "suspendida_por_reserva"
    # ...pero vuelve sola si la reserva se cancela.
    c.post(f"{API}reservas/{reserva['id']}/cancelar/", {"motivo": "Se postergó"}, format="json")
    eventos = c.get(f"{API}agenda/", {"desde": LUNES.isoformat()}).data
    assert [(e["tipo"], e["estado"]) for e in eventos] == [("clase", "programada")]


def test_editar_el_titulo_no_quita_la_aprobacion(cliente, admin_lab, base):
    c = cliente(admin_lab)
    c.post(f"{API}horarios/", _horario(base), format="json")
    reserva = c.post(f"{API}reservas/", _reserva(base), format="json").data
    c.post(f"{API}reservas/{reserva['id']}/aprobar/")
    r = c.put(f"{API}reservas/{reserva['id']}/", _reserva(base, titulo="Curso de Python II"), format="json")
    assert r.status_code == 200, r.data
    assert r.data["estado"] == "confirmada"
    assert len(r.data["clases_suspendidas"]) == 1
    # Si se mueve pero sigue encima de la misma clase, conserva la prioridad.
    r = c.put(f"{API}reservas/{reserva['id']}/", _reserva(base, inicio="08:00", fin="09:30"), format="json")
    assert r.data["estado"] == "confirmada"
    assert len(r.data["clases_suspendidas"]) == 1
    # Si ya no choca, la clase vuelve.
    r = c.put(f"{API}reservas/{reserva['id']}/", _reserva(base, inicio="10:00", fin="12:00"), format="json")
    assert r.data["estado"] == "confirmada"
    assert r.data["clases_suspendidas"] == []


def test_la_clase_desplazada_se_puede_editar(cliente, admin_lab, base):
    c = cliente(admin_lab)
    horario = c.post(f"{API}horarios/", _horario(base), format="json").data
    reserva = c.post(f"{API}reservas/", _reserva(base), format="json").data
    c.post(f"{API}reservas/{reserva['id']}/aprobar/")
    r = c.patch(f"{API}horarios/{horario['id']}/", {"grupo": "SB"}, format="json")
    assert r.status_code == 200, r.data


def test_cancelar_una_reserva_no_deja_la_clase_encima_de_otra(cliente, admin_lab, base):
    c = cliente(admin_lab)
    c.post(f"{API}horarios/", _horario(base, "07:00", "10:00"), format="json")
    r1 = c.post(f"{API}reservas/", _reserva(base, inicio="07:00", fin="08:00"), format="json").data
    c.post(f"{API}reservas/{r1['id']}/aprobar/")
    # Con la clase ya suspendida ese día, esta queda confirmada directamente.
    r2 = c.post(f"{API}reservas/", _reserva(base, titulo="Examen", inicio="09:00", fin="10:00"), format="json").data
    assert r2["estado"] == "confirmada"
    c.post(f"{API}reservas/{r1['id']}/cancelar/", {"motivo": ""}, format="json")
    # La clase sigue suspendida: ahora por «Examen».
    eventos = c.get(f"{API}agenda/", {"desde": LUNES.isoformat()}).data
    clase = next(e for e in eventos if e["tipo"] == "clase")
    assert clase["estado"] == "suspendida"
    assert "Examen" in clase["nota"]


def test_no_se_aprueba_si_choca_con_otra_reserva_confirmada(cliente, admin_lab, auxiliar, base):
    c = cliente(auxiliar)
    c.post(f"{API}reservas/", _reserva(base), format="json")
    otra = c.post(f"{API}reservas/", _reserva(base, titulo="Examen", inicio="09:00", fin="11:00"), format="json").data
    assert otra["estado"] == "pendiente"
    r = cliente(admin_lab).post(f"{API}reservas/{otra['id']}/aprobar/")
    assert r.status_code == 409
    assert "Curso de Python" in r.data["mensaje"]


def test_disponibilidad_dice_si_requiere_aprobacion(cliente, admin_lab, auxiliar, base):
    cliente(admin_lab).post(f"{API}horarios/", _horario(base), format="json")
    datos = {"laboratorio": base["lab"].id, "fecha": LUNES.isoformat(), "hora_inicio": "08:00", "hora_fin": "10:00"}
    r = cliente(auxiliar).post(f"{API}disponibilidad/", datos, format="json")
    assert r.data["disponible"] is False
    assert r.data["requiere_aprobacion"] is True
    r = cliente(auxiliar).post(f"{API}disponibilidad/", {**datos, "hora_inicio": "21:00", "hora_fin": "23:00"}, format="json")
    assert r.data["requiere_aprobacion"] is False


def test_suspender_clase_libera_el_laboratorio(cliente, admin_lab, auxiliar, base):
    c = cliente(admin_lab)
    horario = c.post(f"{API}horarios/", _horario(base), format="json").data
    c.post(f"{API}horarios/{horario['id']}/suspender/", {"fecha": LUNES.isoformat(), "motivo": "Feriado"}, format="json")
    r = cliente(auxiliar).post(f"{API}reservas/", _reserva(base), format="json")
    assert r.status_code == 201, r.data
    assert r.data["estado"] == "confirmada"


def test_advertencia_si_falta_un_programa(cliente, auxiliar, base):
    autocad = Software.objects.create(nombre="AutoCAD", version="2026")
    r = cliente(auxiliar).post(f"{API}reservas/", _reserva(base, programas=[autocad.id]), format="json")
    assert r.status_code == 201
    assert "AutoCAD" in r.data["advertencias"][0]


def test_cancelar_libera_el_horario(cliente, auxiliar, base):
    c = cliente(auxiliar)
    reserva = c.post(f"{API}reservas/", _reserva(base), format="json").data
    c.post(f"{API}reservas/{reserva['id']}/cancelar/", {"motivo": "Se suspendió"}, format="json")
    r = c.post(f"{API}reservas/", _reserva(base, titulo="Otra"), format="json")
    assert r.status_code == 201


def test_agenda_une_clases_y_reservas(cliente, admin_lab, auxiliar, base):
    cliente(admin_lab).post(f"{API}horarios/", _horario(base), format="json")
    cliente(auxiliar).post(f"{API}reservas/", _reserva(base, inicio="10:00", fin="12:00"), format="json")
    r = cliente(auxiliar).get(f"{API}agenda/?desde={LUNES.isoformat()}&hasta={LUNES.isoformat()}")
    assert r.status_code == 200
    assert [e["tipo"] for e in r.data] == ["clase", "reserva"]


def test_docente_no_ve_la_pizarra(cliente, docente):
    assert cliente(docente).get(f"{API}agenda/").status_code == 403


def test_reservas_no_se_borran(cliente, admin_lab, base):
    c = cliente(admin_lab)
    reserva = c.post(f"{API}reservas/", _reserva(base), format="json").data
    assert c.delete(f"{API}reservas/{reserva['id']}/").status_code == 405


def test_agenda_marca_suspendida_aunque_no_haya_motivo(cliente, admin_lab, base):
    c = cliente(admin_lab)
    horario = c.post(f"{API}horarios/", _horario(base), format="json").data
    c.post(f"{API}horarios/{horario['id']}/suspender/", {"fecha": LUNES.isoformat()}, format="json")
    eventos = c.get(f"{API}agenda/", {"desde": LUNES.isoformat()}).data
    assert eventos[0]["estado"] == "suspendida"


# ── Varios días, horario de atención y clonado ──


def test_crear_la_misma_clase_en_varios_dias(cliente, admin_lab, base):
    datos = {**_horario(base), "dias": [1, 3, 5]}
    datos.pop("dia_semana")
    r = cliente(admin_lab).post(f"{API}horarios/lote/", datos, format="json")
    assert r.status_code == 201, r.data
    assert [h["dia_semana"] for h in r.data] == [1, 3, 5]


def test_varios_dias_es_todo_o_nada(cliente, admin_lab, base):
    c = cliente(admin_lab)
    c.post(f"{API}horarios/", _horario(base, dia=3), format="json")
    datos = {**_horario(base, grupo="SB"), "dias": [1, 3, 5]}
    r = c.post(f"{API}horarios/lote/", datos, format="json")
    assert r.status_code == 409
    assert "miércoles" in r.data["mensaje"]
    assert Horario.objects.count() == 1


def test_editar_una_clase_de_varios_dias(cliente, admin_lab, base):
    c = cliente(admin_lab)
    datos = {**_horario(base), "dias": [1, 3, 5]}
    datos.pop("dia_semana")
    creados = c.post(f"{API}horarios/lote/", datos, format="json").data
    ids = [h["id"] for h in creados]

    cambio = {**datos, "ids": ids, "dias": [1, 3, 4], "hora_inicio": "09:15", "hora_fin": "11:30"}
    r = c.post(f"{API}horarios/lote/editar/", cambio, format="json")
    assert r.status_code == 200, r.data
    assert [(h["dia_semana"], h["hora_inicio"]) for h in r.data] == [(1, "09:15"), (3, "09:15"), (4, "09:15")]
    # Lunes y miércoles son los mismos registros (conservan sus suspensiones); el viernes se borró.
    assert {h["id"] for h in r.data} >= set(ids[:2])
    assert Horario.objects.count() == 3


def test_editar_varios_dias_es_todo_o_nada(cliente, admin_lab, base):
    c = cliente(admin_lab)
    c.post(f"{API}horarios/", _horario(base, dia=2, grupo="SB"), format="json")
    datos = {**_horario(base), "dias": [1, 3]}
    datos.pop("dia_semana")
    ids = [h["id"] for h in c.post(f"{API}horarios/lote/", datos, format="json").data]
    r = c.post(f"{API}horarios/lote/editar/", {**datos, "ids": ids, "dias": [1, 2, 3]}, format="json")
    assert r.status_code == 409
    assert "martes" in r.data["mensaje"]
    assert Horario.objects.count() == 3


def test_fuera_del_horario_de_atencion(cliente, admin_lab, auxiliar, base):
    r = cliente(admin_lab).post(f"{API}horarios/", _horario(base, "06:00", "07:30"), format="json")
    assert r.status_code == 400
    assert "07:00" in r.data["mensaje"]
    r = cliente(auxiliar).post(f"{API}reservas/", _reserva(base, inicio="21:00", fin="23:00"), format="json")
    assert r.status_code == 400


def test_configuracion_trae_atencion_y_franjas(cliente, docente):
    r = cliente(docente).get(f"{API}configuracion/")
    assert r.data["atencion_inicio"] == "07:00"
    assert ["07:00", "09:15"] in r.data["franjas"]


def test_clonar_horarios_salta_los_que_chocan(cliente, admin_lab, base):
    c = cliente(admin_lab)
    c.post(f"{API}horarios/", _horario(base, "07:00", "09:15"), format="json")
    c.post(f"{API}horarios/", _horario(base, "09:15", "11:30", grupo="SB"), format="json")
    destino = PeriodoAcademico.objects.create(
        nombre="1-2027", fecha_inicio=date(2027, 2, 1), fecha_fin=date(2027, 6, 30)
    )
    ocupa = {**_horario(base, "10:00", "11:00", grupo="Z1"), "periodo": destino.id}
    c.post(f"{API}horarios/", ocupa, format="json")

    r = c.post(f"{API}periodos/{base['periodo'].id}/clonar-horarios/", {"destino": destino.id}, format="json")
    assert r.status_code == 200, r.data
    assert r.data["creados"] == 1
    assert len(r.data["omitidos"]) == 1
    assert Horario.objects.filter(periodo=destino).count() == 2


# ── Docentes con y sin usuario ──


def test_docente_sin_usuario_y_luego_vinculado(cliente, admin_lab, base):
    from apps.planificacion.models import Docente

    c = cliente(admin_lab)
    ficha = c.post(f"{API}docentes/", {"nombres": "Rosa", "apellidos": "Vaca"}, format="json").data
    assert ficha["tiene_usuario"] is False
    c.post(f"{API}horarios/", {**_horario(base), "docente": ficha["id"]}, format="json")

    r = c.post(
        f"{API}usuarios/",
        {
            "email": "rosa.vaca@ficct.test",
            "nombres": "Rosa",
            "apellidos": "Vaca",
            "rol": "docente",
            "password": "Clases-2026!",
            "vincular_docente": ficha["id"],
        },
        format="json",
    )
    assert r.status_code == 201, r.data
    assert r.data["ficha_docente"]["id"] == ficha["id"]
    assert Docente.objects.get(pk=ficha["id"]).usuario_id == r.data["id"]

    from apps.usuarios.models import Usuario

    rosa = Usuario.objects.get(pk=r.data["id"])
    clases = cliente(rosa).get(f"{API}horarios/").data["results"]
    assert len(clases) == 1


def test_docente_nuevo_se_vincula_por_correo_o_recibe_ficha(cliente, admin_lab):
    from apps.planificacion.models import Docente

    c = cliente(admin_lab)
    c.post(f"{API}docentes/", {"nombres": "Juan", "apellidos": "Soliz", "email": "juan@ficct.test"}, format="json")
    for email in ("juan@ficct.test", "otro@ficct.test"):
        c.post(
            f"{API}usuarios/",
            {"email": email, "nombres": "X", "apellidos": "Y", "rol": "docente", "password": "Clases-2026!"},
            format="json",
        )
    assert Docente.objects.count() == 2
    assert Docente.objects.filter(usuario__isnull=True).count() == 0


# ── Avisos de reservas ──


def test_reserva_por_aprobar_avisa_a_los_admin(cliente, admin_lab, auxiliar, base):
    from apps.notificaciones.models import Notificacion

    cliente(admin_lab).post(f"{API}horarios/", _horario(base), format="json")
    reserva = cliente(auxiliar).post(f"{API}reservas/", _reserva(base), format="json").data
    aviso = Notificacion.objects.get(destinatario=admin_lab)
    assert aviso.titulo == "Reserva por aprobar: «Curso de Python»"
    assert aviso.datos == {"reserva_id": reserva["id"]}


def test_aprobar_avisa_al_docente_y_cancelar_le_devuelve_la_clase(cliente, admin_lab, base):
    from apps.notificaciones.models import Notificacion
    from apps.planificacion.models import Docente

    rosa = crear_usuario("docente", "rosa@ficct.test", nombres="Rosa", apellidos="Vaca")
    ficha = Docente.objects.create(nombres="Rosa", apellidos="Vaca", usuario=rosa)
    c = cliente(admin_lab)
    c.post(f"{API}horarios/", {**_horario(base), "docente": ficha.id}, format="json")
    reserva = c.post(f"{API}reservas/", _reserva(base), format="json").data
    c.post(f"{API}reservas/{reserva['id']}/aprobar/")
    assert Notificacion.objects.get(destinatario=rosa).titulo == "Clase suspendida: INF-110 SA del 28/09"

    c.post(f"{API}reservas/{reserva['id']}/cancelar/", {"motivo": ""}, format="json")
    assert Notificacion.objects.filter(destinatario=rosa, titulo="Tu clase vuelve: INF-110 SA del 28/09").exists()
