"""Reglas de negocio de usuarios. Las vistas solo llaman a estas funciones."""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.core.errores import ErrorNegocio
from apps.core.roles import ROLES_GESTIONABLES_POR_ADMIN, Rol

from .models import Usuario


def puede_gestionar_rol(actor, rol: str) -> bool:
    if actor.rol == Rol.SUPERADMIN:
        return True
    if actor.rol == Rol.ADMIN:
        return rol in ROLES_GESTIONABLES_POR_ADMIN
    return False


def _verificar(actor, *, usuario=None, rol_nuevo=None):
    if usuario is not None and not puede_gestionar_rol(actor, usuario.rol):
        raise PermissionDenied(
            f"No puedes gestionar usuarios con rol {usuario.get_rol_display()}."
        )
    if rol_nuevo is not None and not puede_gestionar_rol(actor, rol_nuevo):
        raise PermissionDenied(
            f"No puedes asignar el rol {Rol(rol_nuevo).label}."
        )


def _validar_password(password, usuario=None, campo="password"):
    try:
        validate_password(password, usuario)
    except DjangoValidationError as error:
        raise ErrorNegocio(
            error.messages[0], codigo="password_debil", campos={campo: error.messages}
        ) from error


def cerrar_sesiones(usuario):
    """Invalida todos los tokens de renovación del usuario."""
    for token in OutstandingToken.objects.filter(user=usuario):
        BlacklistedToken.objects.get_or_create(token=token)


def _ficha_docente(usuario: Usuario, ficha_id: int | None) -> None:
    """Un docente con cuenta queda unido a su ficha (la elegida, una con su correo o una nueva)."""
    if usuario.rol != Rol.DOCENTE and ficha_id is None:
        return
    if usuario.rol != Rol.DOCENTE:
        raise ErrorNegocio(
            "Solo un usuario con rol Docente se puede vincular a una ficha de docente.",
            codigo="ficha_solo_docente",
            campos={"vincular_docente": ["Cambia el rol a Docente para vincularlo."]},
        )
    from apps.planificacion.services import asegurar_ficha_docente

    asegurar_ficha_docente(usuario=usuario, ficha_id=ficha_id)


@transaction.atomic
def crear_usuario(*, actor, datos: dict, password: str, ficha_docente: int | None = None) -> Usuario:
    _verificar(actor, rol_nuevo=datos.get("rol", Rol.AUXILIAR))
    usuario = Usuario(**datos)
    _validar_password(password, usuario)
    usuario.set_password(password)
    usuario.is_staff = usuario.rol == Rol.SUPERADMIN
    usuario.is_superuser = usuario.rol == Rol.SUPERADMIN
    usuario.save()
    _ficha_docente(usuario, ficha_docente)
    return usuario


@transaction.atomic
def actualizar_usuario(*, actor, usuario: Usuario, datos: dict, ficha_docente: int | None = None) -> Usuario:
    _verificar(actor, usuario=usuario)
    rol_nuevo = datos.get("rol")
    if rol_nuevo and rol_nuevo != usuario.rol:
        if usuario.pk == actor.pk:
            raise ErrorNegocio("No puedes cambiar tu propio rol.", codigo="propio_rol")
        _verificar(actor, rol_nuevo=rol_nuevo)
    for campo, valor in datos.items():
        setattr(usuario, campo, valor)
    usuario.is_staff = usuario.rol == Rol.SUPERADMIN
    usuario.is_superuser = usuario.rol == Rol.SUPERADMIN
    usuario.save()
    _ficha_docente(usuario, ficha_docente)
    return usuario


@transaction.atomic
def cambiar_estado(*, actor, usuario: Usuario, activo: bool) -> Usuario:
    if usuario.pk == actor.pk:
        raise ErrorNegocio("No puedes desactivar tu propia cuenta.", codigo="propia_cuenta")
    _verificar(actor, usuario=usuario)
    usuario.is_active = activo
    usuario.save(update_fields=["is_active", "actualizado_en"])
    if not activo:
        cerrar_sesiones(usuario)
    return usuario


@transaction.atomic
def eliminar_usuario(*, actor, usuario: Usuario) -> None:
    if usuario.pk == actor.pk:
        raise ErrorNegocio("No puedes eliminar tu propia cuenta.", codigo="propia_cuenta")
    _verificar(actor, usuario=usuario)
    # Si tiene horarios, reservas u otros registros, la base de datos lo impide
    # (ProtectedError) y la API responde 409 sugiriendo desactivarlo.
    usuario.delete()


@transaction.atomic
def restablecer_password(*, actor, usuario: Usuario, password: str) -> None:
    _verificar(actor, usuario=usuario)
    _validar_password(password, usuario)
    usuario.set_password(password)
    usuario.save(update_fields=["password", "actualizado_en"])
    cerrar_sesiones(usuario)


@transaction.atomic
def cambiar_password_propia(*, usuario: Usuario, actual: str, nueva: str) -> None:
    if not usuario.check_password(actual):
        raise ErrorNegocio(
            "La contraseña actual no es correcta.",
            codigo="password_incorrecta",
            campos={"actual": ["La contraseña actual no es correcta."]},
        )
    _validar_password(nueva, usuario, campo="nueva")
    usuario.set_password(nueva)
    usuario.save(update_fields=["password", "actualizado_en"])
