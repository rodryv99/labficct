"""Portada del módulo: tarjetas (KPI) y unos pocos gráficos de un vistazo.

No va en el catálogo; tiene su propio endpoint `/reportes/dashboard/`.
"""

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.asistencia.models import EstadoSolicitud, SolicitudAsistencia
from apps.bitacora.models import RevisionProgramada
from apps.laboratorios.models import ElementoLaboratorio, EstadoElemento, Laboratorio
from apps.objetos_perdidos.models import EstadoObjeto, ObjetoPerdido
from apps.planificacion.models import EstadoReserva, Reserva
from apps.tareas.models import EstadoTarea, Tarea

from .base import DONA, KPI, LINEAS, PASTEL, Grafico, Resultado, serie
from .selectors import _por_choices, _serie_tiempo


def resumen() -> Resultado:
    hoy = timezone.localdate()

    elem = _por_choices(ElementoLaboratorio.objects.all(), "estado", EstadoElemento.choices)
    con_falla = next((n for v, _, n in elem if v == "con_falla"), 0)

    reservas = _por_choices(Reserva.objects.all(), "estado", EstadoReserva.choices)
    por_aprobar = next((n for v, _, n in reservas if v == "pendiente"), 0)

    asis_abiertas = SolicitudAsistencia.objects.filter(
        estado__in=[EstadoSolicitud.PENDIENTE, EstadoSolicitud.EN_CURSO]
    ).count()

    tareas = Tarea.objects.aggregate(
        pendientes=Count("id", filter=~Q(estado=EstadoTarea.HECHA)),
        vencidas=Count("id", filter=Q(fecha_limite__lt=hoy) & ~Q(estado=EstadoTarea.HECHA)),
    )
    revisiones_vencidas = RevisionProgramada.objects.filter(activa=True, proxima_fecha__lt=hoy).count()
    en_custodia = ObjetoPerdido.objects.filter(estado=EstadoObjeto.EN_CUSTODIA).count()

    labs = Laboratorio.objects.filter(activo=True).aggregate(
        total=Count("id"),
        mantenimiento=Count("id", filter=Q(estado="mantenimiento")),
    )

    kpis = [
        KPI("Laboratorios activos", str(labs["total"]), "info"),
        KPI("Equipos con falla", str(con_falla), "peligro" if con_falla else "exito"),
        KPI("Reservas por aprobar", str(por_aprobar), "aviso" if por_aprobar else "exito"),
        KPI("Asistencias abiertas", str(asis_abiertas), "aviso" if asis_abiertas else "exito"),
        KPI("Tareas sin terminar", str(tareas["pendientes"]), "info"),
        KPI("Tareas vencidas", str(tareas["vencidas"]), "peligro" if tareas["vencidas"] else "exito"),
        KPI("Revisiones vencidas", str(revisiones_vencidas), "peligro" if revisiones_vencidas else "exito"),
        KPI("Objetos en custodia", str(en_custodia), "neutro"),
    ]

    graficos = [
        Grafico(DONA, "Reservas por estado",
                etiquetas=[e for _, e, _ in reservas], series=[serie("n", [n for _, _, n in reservas])]),
        Grafico(PASTEL, "Equipos por estado",
                etiquetas=[e for _, e, _ in elem], series=[serie("n", [n for _, _, n in elem])]),
    ]
    desde = hoy - timedelta(days=180)
    qs_asis = SolicitudAsistencia.objects.filter(creado_en__date__gte=desde)
    etq, val = _serie_tiempo(qs_asis, "creado_en", "mes")
    if etq:
        graficos.append(Grafico(LINEAS, "Solicitudes de asistencia (últimos meses)",
                                etiquetas=etq, series=[serie("Solicitudes", val)], ancho=2))

    tareas_estado = _por_choices(Tarea.objects.all(), "estado", EstadoTarea.choices)
    graficos.append(Grafico(DONA, "Tareas por estado",
                            etiquetas=[e for _, e, _ in tareas_estado],
                            series=[serie("n", [n for _, _, n in tareas_estado])]))

    return Resultado(columnas=[], filas=[], graficos=graficos, kpis=kpis)
