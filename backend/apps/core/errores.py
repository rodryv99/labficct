"""Errores con una sola forma para web y móvil:

    {"codigo": "choque_horario", "mensaje": "Texto para mostrar", "campos": {...}}

La web y la app muestran `mensaje` tal cual y pintan `campos` en el formulario.
"""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler, set_rollback


class ErrorNegocio(exceptions.APIException):
    """Regla de negocio incumplida. Se lanza desde services.py."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "error_negocio"
    default_detail = "No se pudo completar la operación."

    def __init__(self, mensaje, codigo=None, campos=None, extra=None, status_code=None):
        self.mensaje = mensaje
        self.codigo = codigo or self.default_code
        self.campos = campos or {}
        self.extra = extra or {}
        if status_code:
            self.status_code = status_code
        super().__init__(detail=mensaje, code=self.codigo)


class Conflicto(ErrorNegocio):
    """El dato choca con otro existente (horarios, reservas, casillas)."""

    status_code = status.HTTP_409_CONFLICT
    default_code = "conflicto"


# Mensajes para restricciones de la base de datos, por nombre de restricción.
MENSAJES_RESTRICCION = {
    "horario_sin_choque": "Ese laboratorio ya tiene una clase en ese día y horario.",
    "bloque_sin_choque": "Ese laboratorio ya está reservado en ese horario.",
    "elemento_unico_por_celda": "Ya hay un elemento en esa casilla.",
    "usuarios_usuario_email_key": "Ya existe un usuario con ese correo.",
    "usuarios_usuario_codigo_key": "Ya existe un usuario con ese código.",
    "docente_email_unico": "Ya hay un docente registrado con ese correo.",
    "planificacion_docente_usuario_id_key": "Ese usuario ya está vinculado a otra ficha de docente.",
}


def _primer_mensaje(datos):
    if isinstance(datos, dict):
        for valor in datos.values():
            mensaje = _primer_mensaje(valor)
            if mensaje:
                return mensaje
    elif isinstance(datos, (list, tuple)):
        for valor in datos:
            mensaje = _primer_mensaje(valor)
            if mensaje:
                return mensaje
    elif datos:
        return str(datos)
    return None


def _respuesta(codigo, mensaje, campos=None, status_code=400, extra=None):
    cuerpo = {"codigo": codigo, "mensaje": mensaje, "campos": campos or {}}
    if extra:
        cuerpo.update(extra)
    return Response(cuerpo, status=status_code)


def manejador_de_errores(exc, context):
    if isinstance(exc, ErrorNegocio):
        set_rollback()
        return _respuesta(exc.codigo, exc.mensaje, exc.campos, exc.status_code, exc.extra)

    if isinstance(exc, DjangoValidationError):
        set_rollback()
        campos = exc.message_dict if hasattr(exc, "error_dict") else {}
        mensaje = exc.messages[0] if exc.messages else "Revisa los datos ingresados."
        return _respuesta("validacion", mensaje, campos, 400)

    if isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied(str(exc) or None)

    if isinstance(exc, ProtectedError):
        set_rollback()
        return _respuesta(
            "protegido",
            "No se puede eliminar porque tiene registros relacionados. Desactívalo en su lugar.",
            status_code=409,
        )

    if isinstance(exc, IntegrityError):
        set_rollback()
        texto = str(exc)
        mensaje = next(
            (m for nombre, m in MENSAJES_RESTRICCION.items() if nombre in texto),
            "Los datos chocan con un registro que ya existe.",
        )
        return _respuesta("integridad", mensaje, status_code=409)

    respuesta = exception_handler(exc, context)
    if respuesta is None:
        return None

    datos = respuesta.data
    if isinstance(exc, exceptions.ValidationError):
        campos = datos if isinstance(datos, dict) else {"non_field_errors": datos}
        mensaje = _primer_mensaje(campos) or "Revisa los datos ingresados."
        respuesta.data = {"codigo": "validacion", "mensaje": mensaje, "campos": campos}
    else:
        detalle = datos.get("detail") if isinstance(datos, dict) else datos
        codigo = getattr(detalle, "code", None) or getattr(exc, "default_code", "error")
        mensaje = str(detalle) if detalle else "Ocurrió un error."
        if isinstance(exc, exceptions.NotAuthenticated):
            mensaje = "Tu sesión terminó. Vuelve a iniciar sesión."
        respuesta.data = {"codigo": str(codigo), "mensaje": mensaje, "campos": {}}
    return respuesta
