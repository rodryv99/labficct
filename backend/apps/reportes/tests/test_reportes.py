from datetime import date, datetime, time, timedelta
from io import BytesIO

import pytest
from django.conf import settings
from django.utils import timezone
from openpyxl import load_workbook

from apps.asistencia.models import SolicitudAsistencia
from apps.bitacora.models import EntradaBitacora
from apps.core.roles import Rol
from apps.laboratorios.models import ElementoLaboratorio, Laboratorio, TipoElemento
from apps.objetos_perdidos.models import ObjetoPerdido
from apps.planificacion.models import (
    BloqueReserva,
    ExcepcionHorario,
    Horario,
    Materia,
    PeriodoAcademico,
    Reserva,
)
from conftest import crear_usuario

pytestmark = pytest.mark.django_db

URL = f"/{settings.API_PREFIX}reportes/"
# Del lunes 2/11/2026 al domingo 15/11/2026: 12 días de atención (lunes a sábado).
RANGO = {"desde": "2026-11-02", "hasta": "2026-11-15"}
HORAS_ATENCION = 12 * 15.75  # 07:00 a 22:45


def hora(dia, h, m=0):
    return timezone.make_aware(datetime.combine(dia, time(h, m)))


def seccion(datos, titulo):
    return next(s for s in datos["secciones"] if s["titulo"] == titulo)


@pytest.fixture
def labs(db):
    return (
        Laboratorio.objects.create(codigo="LAB-1", nombre="Laboratorio 1"),
        Laboratorio.objects.create(codigo="LAB-2", nombre="Laboratorio 2"),
    )


def _reserva(lab, dia, inicio, fin, estado="confirmada", **extra):
    reserva = Reserva.objects.create(titulo=extra.pop("titulo", f"Reserva {estado}"), estado=estado, **extra)
    BloqueReserva.objects.create(
        reserva=reserva,
        laboratorio=lab,
        inicio=hora(dia, inicio),
        fin=hora(dia, fin),
        activo=estado == "confirmada",
    )
    return reserva


# ── Catálogo y permisos ─────────────────────────────────


def test_lista_los_seis_reportes_con_sus_filtros(cliente, admin_lab, labs):
    r = cliente(admin_lab).get(URL)
    assert r.status_code == 200
    assert [x["codigo"] for x in r.data] == ["r1", "r2", "r3", "r4", "r5", "r6"]
    r4 = r.data[3]
    assert r4["con_fechas"] is False
    categoria = next(f for f in r4["filtros"] if f["clave"] == "categoria")
    assert categoria["multiple"] and categoria["por_defecto"] == ["equipo", "audiovisual", "red"]
    lab = next(f for f in r4["filtros"] if f["clave"] == "laboratorio")
    assert [o["etiqueta"] for o in lab["opciones"]] == ["LAB-1 · Laboratorio 1", "LAB-2 · Laboratorio 2"]


@pytest.mark.parametrize("rol", [Rol.AUXILIAR, Rol.DOCENTE, Rol.ADMINISTRATIVO])
def test_solo_el_admin_ve_reportes(cliente, rol):
    c = cliente(crear_usuario(rol))
    assert c.get(URL).status_code == 403
    assert c.get(f"{URL}r4/").status_code == 403
    assert c.get(f"{URL}r4/exportar/", {"formato": "pdf"}).status_code == 403


def test_superadmin_tambien_los_ve(cliente, superadmin):
    assert cliente(superadmin).get(f"{URL}r4/").status_code == 200


def test_reporte_inexistente_da_404(cliente, admin_lab):
    assert cliente(admin_lab).get(f"{URL}r99/").status_code == 404


# ── Validación de filtros ───────────────────────────────


def test_sin_fechas_usa_el_mes_actual(cliente, admin_lab):
    r = cliente(admin_lab).get(f"{URL}r5/")
    hoy = timezone.localdate()
    filtros = {f["clave"]: f for f in r.data["filtros"]}
    assert filtros["desde"]["valor"] == hoy.replace(day=1).isoformat()
    assert filtros["hasta"]["valor"][:7] == hoy.isoformat()[:7]
    assert filtros["laboratorio"]["texto"] == "Todos los activos"
    assert r.data["generado_por"] == admin_lab.nombre_completo


def test_rango_invertido(cliente, admin_lab):
    r = cliente(admin_lab).get(f"{URL}r2/", {"desde": "2026-11-10", "hasta": "2026-11-01"})
    assert r.status_code == 400
    assert r.data["codigo"] == "rango_invalido"


def test_rango_demasiado_largo(cliente, admin_lab):
    r = cliente(admin_lab).get(f"{URL}r2/", {"desde": "2025-01-01", "hasta": "2026-11-01"})
    assert r.data["codigo"] == "rango_invalido"


def test_formato_no_soportado(cliente, admin_lab):
    r = cliente(admin_lab).get(f"{URL}r4/exportar/", {"formato": "docx"})
    assert r.status_code == 400
    assert r.data["codigo"] == "formato_invalido"


@pytest.mark.parametrize("filtro", [{"laboratorio": 99999}, {"estado": "inventado"}, {"desde": "ayer"}])
def test_filtro_con_valor_que_no_existe(cliente, admin_lab, filtro):
    r = cliente(admin_lab).get(f"{URL}r2/", filtro)
    assert r.status_code == 400
    assert r.data["codigo"] == "validacion"


# ── R1 – Ocupación ──────────────────────────────────────


def test_r1_ocupacion(cliente, admin_lab, labs):
    lab1, _ = labs
    periodo = PeriodoAcademico.objects.create(
        nombre="2-2026", fecha_inicio=date(2026, 8, 1), fecha_fin=date(2026, 12, 15)
    )
    materia = Materia.objects.create(sigla="INF-110", nombre="Introducción")
    clase = Horario.objects.create(
        periodo=periodo,
        laboratorio=lab1,
        materia=materia,
        grupo="SA",
        dia_semana=1,
        hora_inicio=time(7),
        hora_fin=time(9, 15),
    )
    # Dos lunes en el rango (2 y 9); el 9 se suspendió.
    ExcepcionHorario.objects.create(horario=clase, fecha=date(2026, 11, 9), motivo="Feriado")
    _reserva(lab1, date(2026, 11, 3), 10, 12)  # martes, 2 h
    _reserva(lab1, date(2026, 11, 4), 10, 12, estado="pendiente")  # no ocupa

    r = cliente(admin_lab).get(f"{URL}r1/", RANGO)
    assert r.status_code == 200, r.data
    sec = seccion(r.data, "Ocupación por laboratorio")
    fila = sec["filas"][0]
    assert fila["horas_atencion"] == HORAS_ATENCION
    assert (fila["clases"], fila["suspendidas"], fila["horas_clase"]) == (1, 1, 2.25)
    assert (fila["bloques"], fila["horas_reserva"], fila["horas_ocupadas"]) == (1, 2.0, 4.25)
    assert fila["ocupacion"] == round(4.25 / HORAS_ATENCION, 4)
    # El total sale de las sumas (dos laboratorios), no del promedio de porcentajes.
    assert sec["totales"]["ocupacion"] == round(4.25 / (2 * HORAS_ATENCION), 4)

    por_dia = seccion(r.data, "Horas ocupadas por día de la semana")
    assert [c["titulo"] for c in por_dia["columnas"]][1:] == [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Total",
    ]
    assert (por_dia["filas"][0]["dia_1"], por_dia["filas"][0]["dia_2"]) == (2.25, 2.0)
    assert r.data["notas"]


# ── R2 – Reservas ───────────────────────────────────────


def test_r2_reservas(cliente, admin_lab, labs):
    lab1, lab2 = labs
    _reserva(lab1, date(2026, 11, 3), 8, 10, titulo="Directa")
    _reserva(lab2, date(2026, 11, 4), 8, 10, estado="pendiente")
    _reserva(lab1, date(2026, 11, 5), 8, 9, estado="cancelada", motivo_cancelacion="Se postergó")
    aprobada = _reserva(lab1, date(2026, 11, 9), 7, 9, titulo="Aprobada", aprobada_por=admin_lab)
    Reserva.objects.filter(pk=aprobada.pk).update(
        creado_en=hora(date(2026, 11, 1), 8), aprobada_en=hora(date(2026, 11, 1), 11)
    )
    periodo = PeriodoAcademico.objects.create(
        nombre="2-2026", fecha_inicio=date(2026, 8, 1), fecha_fin=date(2026, 12, 15)
    )
    clase = Horario.objects.create(
        periodo=periodo,
        laboratorio=lab1,
        materia=Materia.objects.create(sigla="X", nombre="X"),
        grupo="SA",
        dia_semana=1,
        hora_inicio=time(7),
        hora_fin=time(9),
    )
    ExcepcionHorario.objects.create(
        horario=clase, fecha=date(2026, 11, 9), motivo="Reserva", reserva=aprobada
    )
    _reserva(lab1, date(2026, 11, 20), 8, 10, titulo="Fuera del rango")

    r = cliente(admin_lab).get(f"{URL}r2/", RANGO)
    assert r.status_code == 200, r.data
    resumen = {f["estado"]: f for f in seccion(r.data, "Resumen por estado")["filas"]}
    assert resumen["Confirmada"]["reservas"] == 2 and resumen["Confirmada"]["horas"] == 4.0
    assert resumen["Por aprobar"]["reservas"] == 1
    assert resumen["Cancelada"]["horas"] == 1.0

    lab = seccion(r.data, "Por laboratorio")["filas"][0]
    assert (lab["laboratorio"], lab["confirmadas"], lab["canceladas"], lab["suspendidas"]) == (
        "LAB-1",
        2,
        1,
        1,
    )

    detalle = {f["titulo"]: f for f in seccion(r.data, "Detalle")["filas"]}
    assert "Fuera del rango" not in detalle
    assert detalle["Aprobada"]["horas_aprobacion"] == 3.0
    assert detalle["Aprobada"]["suspendidas"] == 1
    assert detalle["Directa"]["horas_aprobacion"] is None
    assert detalle["Reserva cancelada"]["motivo_cancelacion"] == "Se postergó"

    solo_lab2 = cliente(admin_lab).get(f"{URL}r2/", {**RANGO, "laboratorio": lab2.id})
    assert [f["titulo"] for f in seccion(solo_lab2.data, "Detalle")["filas"]] == ["Reserva pendiente"]


# ── R3 – Asistencia ─────────────────────────────────────


def test_r3_asistencia(cliente, admin_lab, auxiliar, docente, labs):
    lab1, _ = labs
    dia = date(2026, 11, 3)

    def solicitud(estado, respuesta=None, resolucion=None, **extra):
        s = SolicitudAsistencia.objects.create(
            solicitante=docente,
            laboratorio=extra.pop("laboratorio", lab1),
            descripcion="Ayuda",
            estado=estado,
            atendida_por=auxiliar if respuesta else None,
            **extra,
        )
        creado = hora(dia, 8)
        SolicitudAsistencia.objects.filter(pk=s.pk).update(
            creado_en=creado,
            atendida_en=creado + timedelta(minutes=respuesta) if respuesta else None,
            cerrada_en=creado + timedelta(minutes=resolucion) if resolucion else None,
        )

    solicitud("resuelta", 10, 40, categoria="proyector", urgente=True)
    solicitud("en_curso", 20, categoria="proyector")
    solicitud("pendiente")
    solicitud("cancelada", resolucion=5)
    solicitud("pendiente", laboratorio=None, lugar="Pasillo del 2.º piso")

    r = cliente(admin_lab).get(f"{URL}r3/", RANGO)
    assert r.status_code == 200, r.data
    resumen = seccion(r.data, "Resumen")["filas"][0]
    assert (resumen["total"], resumen["pendientes"], resumen["resueltas"], resumen["urgentes"]) == (
        5,
        2,
        1,
        1,
    )
    assert (resumen["respuesta"], resumen["resolucion"]) == (15.0, 40.0)

    proyector = next(
        f for f in seccion(r.data, "Por categoría")["filas"] if f["categoria"] == "Proyector o audio"
    )
    assert (proyector["solicitudes"], proyector["respuesta"]) == (2, 15.0)

    aux = seccion(r.data, "Por auxiliar")["filas"]
    assert [(f["auxiliar"], f["atendidas"], f["resueltas"]) for f in aux] == [
        (auxiliar.nombre_completo, 2, 1)
    ]

    lugares = [(f["laboratorio"], f["solicitudes"]) for f in seccion(r.data, "Por laboratorio")["filas"]]
    assert lugares == [("LAB-1", 4), ("Otro lugar", 1)]


# ── R4 – Inventario ─────────────────────────────────────


def test_r4_inventario_y_exportaciones(cliente, admin_lab, labs):
    lab1, _ = labs
    pc = TipoElemento.objects.create(nombre="PC", categoria="equipo")
    silla = TipoElemento.objects.create(nombre="Silla", categoria="mobiliario")
    ElementoLaboratorio.objects.create(
        laboratorio=lab1, tipo=pc, fila=0, columna=0, etiqueta="PC-01", ip="10.0.0.1"
    )
    ElementoLaboratorio.objects.create(
        laboratorio=lab1, tipo=pc, fila=0, columna=1, etiqueta="PC-02", estado="con_falla"
    )
    ElementoLaboratorio.objects.create(laboratorio=lab1, tipo=silla, fila=1, columna=0)
    c = cliente(admin_lab)

    r = c.get(f"{URL}r4/")
    assert r.status_code == 200, r.data
    por_lab = seccion(r.data, "Por laboratorio")
    assert [(f["laboratorio"], f["total"], f["operativos"], f["con_falla"]) for f in por_lab["filas"]] == [
        ("LAB-1", 2, 1, 1),
        ("LAB-2", 0, 0, 0),
    ]
    assert por_lab["totales"]["total"] == 2
    detalle = seccion(r.data, "Detalle")["filas"]
    assert (detalle[1]["etiqueta"], detalle[1]["fila"], detalle[1]["columna"]) == ("PC-02", 1, 2)

    # Mobiliario solo si se filtra a propósito.
    muebles = c.get(f"{URL}r4/", {"categoria": "mobiliario"})
    assert [f["tipo"] for f in seccion(muebles.data, "Por tipo")["filas"]] == ["Silla"]

    # Excel: una hoja por sección, números como números, encabezado fijo y autofiltro.
    xlsx = c.get(f"{URL}r4/exportar/", {"formato": "xlsx"})
    assert xlsx.status_code == 200
    hoy = timezone.localdate().isoformat()
    assert xlsx["Content-Disposition"] == f'attachment; filename="reporte-r4-{hoy}.xlsx"'
    libro = load_workbook(BytesIO(xlsx.content))
    assert libro.sheetnames == ["Filtros", "Por laboratorio", "Por tipo", "Detalle"]
    hoja = libro["Por laboratorio"]
    assert hoja["A1"].value == "Laboratorio" and hoja["A1"].font.bold
    assert hoja["B2"].value == 2 and isinstance(hoja["B2"].value, int)
    assert hoja.freeze_panes == "A2"
    assert hoja.auto_filter.ref == "A1:F3"
    assert hoja["A4"].value == "Total"

    archivo = c.get(f"{URL}r4/exportar/", {"formato": "pdf"})
    assert archivo.status_code == 200
    assert archivo["Content-Type"] == "application/pdf"
    assert archivo.content.startswith(b"%PDF")


# ── R5 – Bitácora ───────────────────────────────────────


def test_r5_bitacora(cliente, admin_lab, auxiliar, labs):
    lab1, lab2 = labs
    for lab, tipo, autor in [
        (lab1, "incidencia", auxiliar),
        (lab1, "incidencia", auxiliar),
        (lab1, "revision", admin_lab),
        (lab2, "limpieza", auxiliar),
    ]:
        EntradaBitacora.objects.create(
            laboratorio=lab,
            tipo=tipo,
            titulo=f"{tipo} {lab.codigo}",
            fecha=hora(date(2026, 11, 4), 9),
            creado_por=autor,
        )
    EntradaBitacora.objects.create(
        laboratorio=lab1, tipo="otro", titulo="Vieja", fecha=hora(date(2026, 10, 1), 9)
    )

    r = cliente(admin_lab).get(f"{URL}r5/", RANGO)
    assert r.status_code == 200, r.data
    por_lab = {f["laboratorio"]: f for f in seccion(r.data, "Por laboratorio y tipo")["filas"]}
    assert (por_lab["LAB-1"]["incidencia"], por_lab["LAB-1"]["revision"], por_lab["LAB-1"]["total"]) == (
        2,
        1,
        3,
    )
    assert por_lab["LAB-2"]["limpieza"] == 1
    autores = {f["autor"]: f for f in seccion(r.data, "Por autor")["filas"]}
    assert autores[auxiliar.nombre_completo]["incidencias"] == 2
    assert len(seccion(r.data, "Detalle")["filas"]) == 4

    solo_aux = cliente(admin_lab).get(f"{URL}r5/", {**RANGO, "autor": auxiliar.id, "tipo": "incidencia"})
    assert len(seccion(solo_aux.data, "Detalle")["filas"]) == 2


# ── R6 – Objetos perdidos ───────────────────────────────


def test_r6_objetos_perdidos(cliente, admin_lab, labs):
    lab1, _ = labs
    ahora = timezone.now()
    entregado = ObjetoPerdido.objects.create(
        descripcion="Mochila negra",
        categoria="accesorio",
        laboratorio=lab1,
        fecha_hallazgo=ahora - timedelta(days=10),
        estado="entregado",
        entregado_a="Ana Pérez",
        entregado_ci="1234567",
        entregado_en=ahora - timedelta(days=6),
        entregado_por=admin_lab,
    )
    ObjetoPerdido.objects.create(
        descripcion="Llaves", categoria="llaves", lugar="Pasillo", fecha_hallazgo=ahora - timedelta(days=40)
    )
    ObjetoPerdido.objects.create(
        descripcion="Error",
        categoria="otro",
        laboratorio=lab1,
        fecha_hallazgo=ahora - timedelta(days=2),
        estado="anulado",
    )
    filtros = {
        "desde": (timezone.localdate() - timedelta(days=60)).isoformat(),
        "hasta": timezone.localdate().isoformat(),
    }

    r = cliente(admin_lab).get(f"{URL}r6/", filtros)
    assert r.status_code == 200, r.data
    resumen = seccion(r.data, "Resumen")["filas"][0]
    assert (resumen["registrados"], resumen["en_custodia"], resumen["entregados"], resumen["anulados"]) == (
        3,
        1,
        1,
        1,
    )
    assert (resumen["promedio_dias"], resumen["mas_de_30"]) == (4.0, 1)

    detalle = {f["descripcion"]: f for f in seccion(r.data, "Detalle")["filas"]}
    mochila = detalle["Mochila negra"]
    assert (mochila["codigo"], mochila["dias"], mochila["entregado_a"]) == (entregado.codigo, 4, "Ana Pérez")
    assert detalle["Llaves"]["dias"] == 40 and detalle["Llaves"]["donde"] == "Pasillo"
    assert detalle["Error"]["dias"] is None
    # De quien recibe, solo el nombre: nunca el CI.
    assert "1234567" not in str(r.data)

    xlsx = cliente(admin_lab).get(f"{URL}r6/exportar/", {**filtros, "formato": "xlsx"})
    assert xlsx["Content-Disposition"].endswith(f'reporte-r6-{filtros["desde"]}_{filtros["hasta"]}.xlsx"')
    assert b"1234567" not in xlsx.content
