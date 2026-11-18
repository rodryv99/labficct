"""Envío de notificaciones push por Firebase Cloud Messaging (FCM).

Todo es "mejor esfuerzo": si Firebase no está configurado (falta `firebase-admin`
o el archivo de credenciales), no se envía nada y la app sigue funcionando con la
campana. Igual que con `pg_dump` en los respaldos: la falta de push nunca rompe nada.

Para activarlo:
  1. Crea un proyecto en Firebase y descarga la clave de cuenta de servicio (JSON).
  2. Monta ese archivo en el contenedor y apunta FCM_CREDENCIALES a su ruta.
"""

from __future__ import annotations

import logging
import os

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

_app = None  # app de firebase_admin, se inicializa una sola vez


def _ruta_credenciales() -> str:
    return getattr(settings, "FCM_CREDENCIALES", "") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")


def push_disponible() -> bool:
    """True si se puede enviar push: hay librería y credenciales a mano."""
    if not getattr(settings, "PUSH_HABILITADO", True):
        return False
    try:
        import firebase_admin  # noqa: F401
    except Exception:
        return False
    ruta = _ruta_credenciales()
    return bool(ruta) and os.path.exists(ruta)


def _firebase():
    """Devuelve la app de firebase_admin ya inicializada, o None si no se puede."""
    global _app
    if _app is not None:
        return _app
    if not push_disponible():
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials

        cred = credentials.Certificate(_ruta_credenciales())
        # initialize_app falla si ya existe; reusamos la que haya.
        try:
            _app = firebase_admin.initialize_app(cred)
        except ValueError:
            _app = firebase_admin.get_app()
        return _app
    except Exception:
        logger.exception("No se pudo inicializar Firebase para push")
        return None


# ── A quién enviar ──────────────────────────────────────


def _en_turno(usuario, ahora) -> bool:
    """True si el auxiliar está dentro de su horario de trabajo (con la tolerancia).

    Sin horario asignado se considera "siempre en turno" (no tendría sentido callarle
    todo a quien no tiene horario). Si algo falla, no bloquea el push."""
    try:
        from apps.marcaciones.services import _minutos, horario_de, tolerancia_min

        horario = horario_de(usuario)
        if horario is None:
            return True
        local = timezone.localtime(ahora)
        t = _minutos(local.time())
        tol = tolerancia_min()
        for b in horario.bloques.all():
            if b.dia == local.weekday() and _minutos(b.inicio) - tol <= t <= _minutos(b.fin) + tol:
                return True
        return False
    except Exception:
        logger.exception("No se pudo evaluar 'en turno'; se permite el push")
        return True


def destinatarios_de_push(ids):
    """De una lista de ids de usuario, cuáles aceptan push ahora mismo.

    Respeta la preferencia de cada quien: el interruptor general y el "solo en turno".
    """
    from apps.usuarios.models import Usuario

    from .models import PreferenciaPush

    ids = {int(i) for i in ids if i is not None}
    if not ids:
        return set()

    prefs = {p.usuario_id: p for p in PreferenciaPush.objects.filter(usuario_id__in=ids)}
    ahora = timezone.now()
    permitidos = set()
    usuarios = {u.pk: u for u in Usuario.objects.filter(pk__in=ids)}
    for i in ids:
        pref = prefs.get(i)
        if pref is not None and not pref.habilitado:
            continue
        if pref is not None and pref.solo_en_turno:
            usuario = usuarios.get(i)
            if usuario is None or not _en_turno(usuario, ahora):
                continue
        permitidos.add(i)
    return permitidos


# ── Envío ───────────────────────────────────────────────


def _a_texto(datos: dict) -> dict:
    """FCM solo acepta strings en `data`. Convierte todo y descarta None."""
    salida = {}
    for clave, valor in (datos or {}).items():
        if valor is None:
            continue
        salida[str(clave)] = valor if isinstance(valor, str) else str(valor)
    return salida


def enviar_push_a(ids, *, titulo: str, mensaje: str = "", enlace: str = "", datos=None, tipo: str = "") -> int:
    """Envía un push a los usuarios de `ids` que lo acepten. Devuelve a cuántos tokens llegó.

    No lanza nunca: cualquier problema se registra y se devuelve 0.
    """
    app = _firebase()
    if app is None:
        return 0

    permitidos = destinatarios_de_push(ids)
    if not permitidos:
        return 0

    from .models import DispositivoPush

    dispositivos = list(DispositivoPush.objects.filter(usuario_id__in=permitidos, activo=True))
    tokens = [d.token for d in dispositivos]
    if not tokens:
        return 0

    try:
        from firebase_admin import messaging

        data = _a_texto({**(datos or {}), "tipo": tipo, "enlace": enlace})
        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=titulo[:200], body=mensaje[:1000]),
            data=data,
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(channel_id="labficct_avisos"),
            ),
        )
        respuesta = messaging.send_each_for_multicast(message)
    except Exception:
        logger.exception("Falló el envío de push")
        return 0

    _limpiar_tokens_muertos(dispositivos, respuesta)
    return respuesta.success_count


def _limpiar_tokens_muertos(dispositivos, respuesta) -> None:
    """Da de baja los tokens que FCM reporta como inválidos (app desinstalada, token viejo)."""
    try:
        from firebase_admin import messaging

        muertos = []
        for dispositivo, resultado in zip(dispositivos, respuesta.responses):
            if resultado.success:
                continue
            exc = resultado.exception
            if isinstance(exc, (messaging.UnregisteredError,)) or (
                exc is not None and "registration-token-not-registered" in str(exc)
            ):
                muertos.append(dispositivo.pk)
        if muertos:
            from .models import DispositivoPush

            DispositivoPush.objects.filter(pk__in=muertos).update(activo=False)
    except Exception:
        logger.exception("No se pudieron limpiar tokens muertos")
