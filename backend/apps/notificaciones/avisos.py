"""Avisos a los auxiliares para alistar o cerrar un aula antes y después de cada clase o reserva.

- Automáticos: Celery los revisa cada minuto (CELERY_BEAT_SCHEDULE en la configuración).
  "Alistar" sale AVISO_ALISTAR_MINUTOS antes del inicio, con las preferencias del docente;
  "Cerrar", al terminar, salvo que en ese laboratorio empiece otra actividad enseguida.
- Manuales: desde la pizarra, con una nota opcional (avisar_manual).
"""

from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone

from apps.core.errores import ErrorNegocio
from apps.planificacion import selectors
from apps.planificacion.models import Reserva

from .models import TipoNotificacion
from .services import auxiliares, notificar

# Si el aviso se atrasó (worker apagado un rato), todavía sirve un poco después.
GRACIA_ALISTAR = timedelta(minutes=5)
GRACIA_CERRAR = timedelta(minutes=30)


def _momento(fecha, hora) -> datetime:
    return timezone.make_aware(datetime.combine(fecha, hora))


def _hhmm(hora) -> str:
    return hora.strftime("%H:%M")


def _destinatarios(evento) -> list:
    """Reserva con auxiliares asignados: solo ellos. En los demás casos, todos los auxiliares."""
    if evento["reserva_id"]:
        reserva = Reserva.objects.filter(pk=evento["reserva_id"]).first()
        if reserva:
            asignados = list(reserva.auxiliares.filter(is_active=True))
            if asignados:
                return asignados
    return list(auxiliares())


def _texto(evento, tipo: str, nota: str = "") -> tuple[str, str]:
    lab = evento["laboratorio_codigo"]
    inicio, fin = _hhmm(evento["hora_inicio"]), _hhmm(evento["hora_fin"])
    if tipo == TipoNotificacion.ALISTAR:
        titulo = f"Alistar {lab} · {inicio}"
    else:
        titulo = f"Cerrar {lab} · {fin}"

    lineas = []
    if evento["tipo"] == "clase":
        materia = f" ({evento['detalle']})" if evento["detalle"] else ""
        lineas.append(f"Clase {evento['titulo']}{materia}, de {inicio} a {fin}.")
        if evento["responsable"]:
            lineas.append(f"Docente: {evento['responsable']}.")
    else:
        lineas.append(f"Reserva «{evento['titulo']}», de {inicio} a {fin}.")
        if evento["responsable"]:
            lineas.append(f"Solicita: {evento['responsable']}.")
        if tipo == TipoNotificacion.ALISTAR and evento["programas"]:
            lineas.append(f"Programas: {', '.join(evento['programas'])}.")
        if evento["requiere_apoyo"]:
            lineas.append("Requiere apoyo de auxiliares durante el evento.")
    if evento.get("preferencias"):
        lineas.append("Preferencias del docente:")
        lineas += [f"• {p}" for p in evento["preferencias"]]
    if nota.strip():
        lineas.append(f"Nota: {nota.strip()}")
    return titulo, "\n".join(lineas)


def _datos(evento) -> dict:
    return {
        "evento": evento["id"],
        "fecha": evento["fecha"].isoformat(),
        "laboratorio": evento["laboratorio"],
        "horario_id": evento["horario_id"],
        "reserva_id": evento["reserva_id"],
    }


def _enviar(evento, tipo: str, *, nota: str = "", clave: str = "", excepto=None) -> int:
    titulo, mensaje = _texto(evento, tipo, nota)
    return notificar(
        _destinatarios(evento),
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        enlace=f"/pizarra?fecha={evento['fecha'].isoformat()}",
        datos=_datos(evento),
        clave=clave,
        excepto=excepto,
    )


def _sigue_ocupado(evento, eventos, fin: datetime, anticipo: timedelta) -> bool:
    """True si en el mismo laboratorio otra actividad sigue en curso o empieza enseguida."""
    for otro in eventos:
        if otro["id"] == evento["id"] or otro["laboratorio"] != evento["laboratorio"]:
            continue
        otro_inicio = _momento(otro["fecha"], otro["hora_inicio"])
        otro_fin = _momento(otro["fecha"], otro["hora_fin"])
        if otro_inicio <= fin + anticipo and otro_fin > fin:
            return True
    return False


def avisos_de_aulas(ahora=None) -> dict:
    """Envía los avisos que tocan en este momento. Se puede llamar muchas veces: no repite."""
    ahora = ahora or timezone.now()
    hoy = timezone.localtime(ahora).date()
    anticipo = timedelta(minutes=settings.AVISO_ALISTAR_MINUTOS)
    eventos = [e for e in selectors.agenda(desde=hoy, hasta=hoy) if e["estado"] != "suspendida"]

    enviados = {"alistar": 0, "cerrar": 0}
    for e in eventos:
        inicio = _momento(e["fecha"], e["hora_inicio"])
        fin = _momento(e["fecha"], e["hora_fin"])
        if inicio - anticipo <= ahora < inicio + GRACIA_ALISTAR:
            if _enviar(e, TipoNotificacion.ALISTAR, clave=f"alistar:{e['id']}"):
                enviados["alistar"] += 1
        if fin <= ahora < fin + GRACIA_CERRAR and not _sigue_ocupado(e, eventos, fin, anticipo):
            if _enviar(e, TipoNotificacion.CERRAR, clave=f"cerrar:{e['id']}"):
                enviados["cerrar"] += 1
    return enviados


def avisar_manual(*, tipo: str, evento_id: str, fecha, nota: str, usuario) -> int:
    """Aviso enviado a mano desde la pizarra. Devuelve a cuántos auxiliares se avisó."""
    evento = next((e for e in selectors.agenda(desde=fecha, hasta=fecha) if e["id"] == evento_id), None)
    if evento is None:
        raise ErrorNegocio("Esa clase o reserva ya no está en la pizarra.", codigo="evento_inexistente")
    return _enviar(evento, tipo, nota=nota, excepto=usuario)
