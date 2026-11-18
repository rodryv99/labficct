"""Recordatorio: "tu turno empieza pronto".

Celery lo revisa cada minuto (CELERY_BEAT_SCHEDULE). A cada auxiliar con horario
asignado se le avisa una sola vez, en los minutos previos al inicio de su bloque de
hoy (RECORDATORIO_TURNO_MINUTOS antes). La clave única evita que se repita.
"""

from __future__ import annotations

from django.conf import settings
from django.utils import timezone

from .models import TipoNotificacion
from .services import notificar


def _minutos_recordatorio() -> int:
    return int(getattr(settings, "RECORDATORIO_TURNO_MINUTOS", 15))


def recordatorios(ahora=None) -> int:
    """Envía los recordatorios de turno que tocan ahora. Devuelve a cuántos se avisó.

    Se puede llamar muchas veces sin duplicar: cada aviso lleva una clave por
    persona, día y bloque.
    """
    from apps.marcaciones.models import AsignacionHorario
    from apps.marcaciones.services import _hhmm, _minutos

    ahora = ahora or timezone.now()
    local = timezone.localtime(ahora)
    dia = local.weekday()
    t = _minutos(local.time())
    antelacion = _minutos_recordatorio()

    asignaciones = AsignacionHorario.objects.select_related("horario", "usuario").prefetch_related(
        "horario__bloques"
    )

    enviados = 0
    for asignacion in asignaciones:
        horario = asignacion.horario
        usuario = asignacion.usuario
        if not horario.activo or not usuario.is_active:
            continue
        for bloque in horario.bloques.all():
            if bloque.dia != dia:
                continue
            faltan = _minutos(bloque.inicio) - t
            # Solo en la ventana previa al inicio (entre "antelación" min antes y el inicio).
            if 0 < faltan <= antelacion:
                clave = f"turno:{usuario.pk}:{local.date().isoformat()}:{bloque.dia}:{_hhmm(bloque.inicio)}"
                avisados = notificar(
                    [usuario.pk],
                    tipo=TipoNotificacion.TURNO,
                    titulo=f"Tu turno empieza a las {_hhmm(bloque.inicio)}",
                    mensaje=(
                        f"Faltan {faltan} minuto{'s' if faltan != 1 else ''} para tu turno "
                        f"({_hhmm(bloque.inicio)}–{_hhmm(bloque.fin)}). No olvides marcar tu entrada."
                    ),
                    datos={
                        "turno": local.date().isoformat(),
                        "inicio": _hhmm(bloque.inicio),
                        "fin": _hhmm(bloque.fin),
                    },
                    clave=clave,
                    push=True,
                )
                enviados += avisados
    return enviados
