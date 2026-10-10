"""Enviar notificaciones. Cualquier módulo avisa con `notificar(...)`.

Se guardan en la base de datos; la web y la app las consultan cada pocos segundos
(no hace falta WebSocket ni servicios externos).
"""

from datetime import timedelta

from django.utils import timezone

from apps.core.roles import Rol

from .models import Notificacion, TipoNotificacion


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
) -> int:
    """Crea una notificación para cada destinatario (usuarios o ids).

    - `excepto`: quien hizo la acción; no se avisa a sí mismo.
    - `clave`: si ya existe una con la misma clave para esa persona, no se repite.

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
    return len(ids)


def limpiar(dias_leidas: int = 60, dias_no_leidas: int = 120) -> int:
    """Borra las notificaciones viejas para que la tabla no crezca sin fin."""
    ahora = timezone.now()
    viejas = Notificacion.objects.filter(
        leida_en__isnull=False, creado_en__lt=ahora - timedelta(days=dias_leidas)
    ) | Notificacion.objects.filter(creado_en__lt=ahora - timedelta(days=dias_no_leidas))
    borradas, _ = viejas.delete()
    return borradas
