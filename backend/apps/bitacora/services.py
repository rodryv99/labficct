"""Bitácora y revisiones periódicas.

Ciclo de una revisión: llega su fecha → pasa al pizarrón de tareas (y se avisa) →
alguien la registra (o marca la tarea como hecha) → queda en la bitácora y se
calcula la próxima fecha desde ese día.
"""

import calendar
from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone

from .models import EntradaBitacora, RevisionProgramada, TipoEntrada, UnidadFrecuencia


def sumar(fecha: date, cada: int, unidad: str) -> date:
    """La fecha que sigue: 31/01 + 1 mes = 28/02 (o 29/02 en año bisiesto)."""
    if unidad == UnidadFrecuencia.DIAS:
        return fecha + timedelta(days=cada)
    if unidad == UnidadFrecuencia.SEMANAS:
        return fecha + timedelta(weeks=cada)
    meses = fecha.month - 1 + cada
    anio, mes = fecha.year + meses // 12, meses % 12 + 1
    return date(anio, mes, min(fecha.day, calendar.monthrange(anio, mes)[1]))


@transaction.atomic
def registrar_revision(
    *, revision: RevisionProgramada, usuario, nota: str = "", tarea=None
) -> EntradaBitacora:
    """Deja la revisión en la bitácora, calcula la próxima fecha y cierra su tarea en el pizarrón.

    `tarea`: la tarea del pizarrón desde la que se registró (ya se está cerrando).
    """
    hoy = timezone.localdate()
    entrada = EntradaBitacora.objects.create(
        laboratorio=revision.laboratorio,
        tipo=TipoEntrada.REVISION,
        titulo=revision.titulo,
        descripcion=nota.strip() or "Revisión realizada.",
        fecha=timezone.now(),
        revision=revision,
        creado_por=usuario,
        actualizado_por=usuario,
    )
    revision.ultima_fecha = hoy
    revision.proxima_fecha = sumar(hoy, revision.cada, revision.unidad)
    revision.actualizado_por = usuario
    revision.save(update_fields=["ultima_fecha", "proxima_fecha", "actualizado_por", "actualizado_en"])

    from apps.tareas.services import cerrar_tareas_de_revision

    cerrar_tareas_de_revision(revision=revision, usuario=usuario, excepto=tarea)
    return entrada


def revisiones_vencidas(hoy: date | None = None) -> int:
    """Pasa al pizarrón (y avisa) cada revisión cuya fecha llegó. No repite si ya tiene una tarea abierta.
    Si alguien borra esa tarea sin registrar la revisión, vuelve a aparecer: una revisión
    vencida sigue pendiente hasta que se registra. Devuelve cuántas tareas creó."""
    from apps.tareas.models import EstadoTarea, Tarea
    from apps.tareas.services import crear_tarea_de_revision

    hoy = hoy or timezone.localdate()
    vencidas = RevisionProgramada.objects.filter(
        activa=True, proxima_fecha__lte=hoy, laboratorio__activo=True
    ).select_related("laboratorio", "responsable")
    creadas = 0
    for revision in vencidas:
        if Tarea.objects.filter(revision=revision).exclude(estado=EstadoTarea.HECHA).exists():
            continue
        crear_tarea_de_revision(revision)
        creadas += 1
    return creadas
