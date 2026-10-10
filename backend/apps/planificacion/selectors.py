"""Lecturas de planificación. La agenda une clases y reservas en una sola lista."""

from collections import defaultdict
from datetime import datetime, time, timedelta

from django.utils import timezone

from apps.core.errores import ErrorNegocio
from apps.preferencias.services import resumenes_por_docente

from .models import BloqueReserva, EstadoReserva, ExcepcionHorario, Horario

MAX_DIAS_AGENDA = 62


def agenda(*, desde, hasta, laboratorios=None) -> list[dict]:
    """Eventos entre `desde` y `hasta` (inclusive), ordenados por fecha y hora.

    Las clases no se guardan día por día: se calculan a partir de los horarios
    semanales del periodo, menos las clases suspendidas.
    """
    if hasta < desde:
        raise ErrorNegocio("La fecha final no puede ser anterior a la inicial.", codigo="rango_invalido")
    if (hasta - desde).days > MAX_DIAS_AGENDA:
        raise ErrorNegocio(
            f"El rango máximo de la agenda es de {MAX_DIAS_AGENDA} días.", codigo="rango_invalido"
        )

    eventos = []

    # ── Clases ──
    horarios = Horario.objects.filter(
        activo=True, periodo__fecha_inicio__lte=hasta, periodo__fecha_fin__gte=desde
    ).select_related("periodo", "laboratorio", "materia", "docente")
    if laboratorios:
        horarios = horarios.filter(laboratorio_id__in=laboratorios)
    horarios = list(horarios)

    bloques = _bloques_confirmados(desde, hasta, laboratorios)
    # Preferencias de los docentes (de las clases y de las reservas pedidas por un docente).
    fichas = {h.docente_id for h in horarios} | {_ficha_de(b.reserva) for b in bloques}
    preferencias = resumenes_por_docente(fichas)

    suspendidas = {
        (e.horario_id, e.fecha): e.motivo
        for e in ExcepcionHorario.objects.filter(
            horario_id__in=[h.id for h in horarios], fecha__range=(desde, hasta)
        )
    }
    por_dia = defaultdict(list)
    for h in horarios:
        por_dia[h.dia_semana].append(h)

    dia = desde
    while dia <= hasta:
        for h in por_dia.get(dia.isoweekday(), []):
            if not (h.periodo.fecha_inicio <= dia <= h.periodo.fecha_fin):
                continue
            suspendida = (h.id, dia) in suspendidas
            motivo = suspendidas.get((h.id, dia), "")
            eventos.append(
                {
                    "id": f"clase-{h.id}-{dia.isoformat()}",
                    "tipo": "clase",
                    "titulo": f"{h.materia.sigla} · {h.grupo}",
                    "detalle": h.materia.nombre,
                    "responsable": h.docente.nombre_completo if h.docente_id else "",
                    "laboratorio": h.laboratorio_id,
                    "laboratorio_codigo": h.laboratorio.codigo,
                    "fecha": dia,
                    "hora_inicio": h.hora_inicio,
                    "hora_fin": h.hora_fin,
                    "estado": "suspendida" if suspendida else "programada",
                    "nota": motivo,
                    "horario_id": h.id,
                    "reserva_id": None,
                    "requiere_apoyo": False,
                    "programas": [],
                    "docente_id": h.docente_id,
                    "preferencias": preferencias.get(h.docente_id, []),
                }
            )
        dia += timedelta(days=1)

    # ── Reservas ──
    for b in bloques:
        r = b.reserva
        ficha = _ficha_de(r)
        inicio, fin = timezone.localtime(b.inicio), timezone.localtime(b.fin)
        eventos.append(
            {
                "id": f"reserva-{b.id}",
                "tipo": "reserva",
                "titulo": r.titulo,
                "detalle": r.descripcion,
                "responsable": r.nombre_solicitante,
                "laboratorio": b.laboratorio_id,
                "laboratorio_codigo": b.laboratorio.codigo,
                "fecha": inicio.date(),
                "hora_inicio": inicio.time(),
                "hora_fin": fin.time(),
                "estado": r.estado,
                "nota": "",
                "horario_id": None,
                "reserva_id": r.id,
                "requiere_apoyo": r.requiere_apoyo,
                "programas": [str(p) for p in r.programas.all()],
                "docente_id": ficha,
                "preferencias": preferencias.get(ficha, []),
            }
        )

    eventos.sort(key=lambda e: (e["fecha"], e["hora_inicio"], e["laboratorio_codigo"]))
    return eventos


def _bloques_confirmados(desde, hasta, laboratorios) -> list:
    """Bloques de reservas de esas fechas. Solo las confirmadas: las que están por
    aprobar todavía no ocupan el laboratorio."""
    inicio_rango = timezone.make_aware(datetime.combine(desde, time.min))
    fin_rango = timezone.make_aware(datetime.combine(hasta + timedelta(days=1), time.min))
    bloques = (
        BloqueReserva.objects.filter(
            activo=True,
            reserva__estado=EstadoReserva.CONFIRMADA,
            inicio__lt=fin_rango,
            fin__gt=inicio_rango,
        )
        .select_related("laboratorio", "reserva", "reserva__solicitante__ficha_docente")
        .prefetch_related("reserva__programas")
    )
    if laboratorios:
        bloques = bloques.filter(laboratorio_id__in=laboratorios)
    return list(bloques)


def _ficha_de(reserva) -> int | None:
    """La ficha Docente de quien pidió la reserva, si es un docente."""
    if not reserva.solicitante_id:
        return None
    ficha = getattr(reserva.solicitante, "ficha_docente", None)
    return ficha.pk if ficha else None
