"""Enviar notificaciones. Cualquier módulo avisa con `notificar(...)`.

Se guardan en la base de datos; la web y la app las consultan cada pocos segundos
(no hace falta WebSocket ni servicios externos).
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.core.roles import Rol

from .models import DispositivoPush, Notificacion, PreferenciaPush, Plataforma, TipoNotificacion


def usuarios_activos(*roles):
    from apps.usuarios.models import Usuario

    return Usuario.objects.filter(is_active=True, rol__in=roles)


def auxiliares():
    return usuarios_activos(Rol.AUXILIAR)


def administradores():
    """Quienes aprueban reservas: Admin y Superadmin."""
    return usuarios_activos(Rol.ADMIN, Rol.SUPERADMIN)


def notificar(
    destinatarios,
    *,
    tipo: str = TipoNotificacion.GENERAL,
    titulo: str,
    mensaje: str = "",
    enlace: str = "",
    datos: dict | None = None,
    clave: str = "",
    excepto=None,
    push: bool = False,
) -> int:
    """Crea una notificación para cada destinatario (usuarios o ids).

    - `excepto`: quien hizo la acción; no se avisa a sí mismo.
    - `clave`: si ya existe una con la misma clave para esa persona, no se repite.
    - `push`: además de la campana, manda una notificación push al teléfono. El envío
      ocurre tras confirmar la transacción y respeta las preferencias de cada quien.

    Devuelve a cuántas personas se avisó.
    """
    ids = set()
    for d in destinatarios:
        if d is None:
            continue
        ids.add(d.pk if hasattr(d, "pk") else int(d))
    if excepto is not None:
        ids.discard(excepto.pk)
    if clave and ids:
        ya_avisados = Notificacion.objects.filter(clave=clave[:120], destinatario_id__in=ids)
        ids -= set(ya_avisados.values_list("destinatario_id", flat=True))
    if not ids:
        return 0
    Notificacion.objects.bulk_create(
        [
            Notificacion(
                destinatario_id=i,
                tipo=tipo,
                titulo=titulo[:150],
                mensaje=mensaje,
                enlace=enlace[:200],
                datos=datos or {},
                clave=clave[:120],
            )
            for i in ids
        ],
        ignore_conflicts=bool(clave),
    )
    if push:
        _enviar_push_tras_commit(
            sorted(ids),
            titulo=titulo[:200],
            mensaje=mensaje,
            enlace=enlace[:200],
            datos=datos or {},
            tipo=str(tipo),
        )
    return len(ids)


def _enviar_push_tras_commit(ids, *, titulo, mensaje, enlace, datos, tipo) -> None:
    """Encola el push para cuando la transacción confirme (nunca a mitad de un rollback)."""

    def _encolar():
        from .tasks import enviar_push

        try:
            enviar_push.delay(ids, titulo=titulo, mensaje=mensaje, enlace=enlace, datos=datos, tipo=tipo)
        except Exception:
            # Sin broker de Celery (p. ej. en un test), se intenta en el momento.
            try:
                from . import push

                push.enviar_push_a(ids, titulo=titulo, mensaje=mensaje, enlace=enlace, datos=datos, tipo=tipo)
            except Exception:
                pass

    transaction.on_commit(_encolar)


# ── Dispositivos y preferencias de push ─────────────────


def registrar_dispositivo(*, usuario, token: str, plataforma: str = Plataforma.ANDROID) -> DispositivoPush:
    """Guarda (o reactiva) el token de FCM de un teléfono para ese usuario.

    Si el token ya existía (incluso de otra cuenta), queda reasignado a quien inicia
    sesión ahora: un mismo teléfono no debe recibir los avisos de otra persona.
    """
    dispositivo, creado = DispositivoPush.objects.update_or_create(
        token=token,
        defaults={"usuario": usuario, "plataforma": plataforma, "activo": True},
    )
    return dispositivo


def baja_dispositivo(*, usuario, token: str) -> int:
    """Da de baja el token al cerrar sesión. Devuelve cuántos se desactivaron."""
    return DispositivoPush.objects.filter(usuario=usuario, token=token).update(activo=False)


def preferencia_de(usuario) -> PreferenciaPush:
    """La preferencia de push del usuario; la crea con los valores por defecto si no existe."""
    pref, _ = PreferenciaPush.objects.get_or_create(usuario=usuario)
    return pref


def guardar_preferencia(*, usuario, habilitado=None, solo_en_turno=None) -> PreferenciaPush:
    pref = preferencia_de(usuario)
    if habilitado is not None:
        pref.habilitado = habilitado
    if solo_en_turno is not None:
        pref.solo_en_turno = solo_en_turno
    pref.save()
    return pref


def limpiar(dias_leidas: int = 60, dias_no_leidas: int = 120) -> int:
    """Borra las notificaciones viejas para que la tabla no crezca sin fin."""
    ahora = timezone.now()
    viejas = Notificacion.objects.filter(
        leida_en__isnull=False, creado_en__lt=ahora - timedelta(days=dias_leidas)
    ) | Notificacion.objects.filter(creado_en__lt=ahora - timedelta(days=dias_no_leidas))
    borradas, _ = viejas.delete()
    return borradas
