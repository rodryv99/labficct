from rest_framework.permissions import BasePermission

from .permisos import tiene_permiso

LECTURA = ("list", "retrieve")
ESCRITURA = ("create", "update", "partial_update", "destroy")


def permisos_crud(ver: str, gestionar: str, **extra) -> dict:
    """Atajo: lectura con un permiso, escritura con otro, más acciones extra."""
    permisos = {accion: ver for accion in LECTURA}
    permisos.update({accion: gestionar for accion in ESCRITURA})
    permisos.update(extra)
    return permisos


class TienePermiso(BasePermission):
    """Consulta la matriz de permisos según la acción de la vista.

    Cada vista declara `permisos = {"list": "reservas.ver", "create": ...}`.
    En vistas sin `action` (APIView) la clave es el método: "get", "post"...
    Una acción con varios métodos puede distinguirlos: "distribucion:put".
    Una acción que no está declarada se rechaza: mejor olvidar abrir algo
    que olvidar cerrarlo.
    """

    message = "No tienes permiso para realizar esta acción."

    def has_permission(self, request, view):
        permisos = getattr(view, "permisos", {})
        metodo = request.method.lower()
        accion = getattr(view, "action", None) or metodo
        codigo = permisos.get(f"{accion}:{metodo}", permisos.get(accion, permisos.get("*")))
        if codigo is None:
            return False
        return tiene_permiso(request.user, codigo)
