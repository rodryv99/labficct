from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

from .models import Usuario


def buscar_usuario(identificador: str):
    """Busca por correo o por código institucional, sin distinguir mayúsculas."""
    identificador = (identificador or "").strip()
    if not identificador:
        return None
    return Usuario.objects.filter(
        Q(email__iexact=identificador) | Q(codigo__iexact=identificador)
    ).first()


class CorreoOCodigoBackend(ModelBackend):
    """Permite entrar al panel técnico de Django con correo o código."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        usuario = buscar_usuario(username or kwargs.get("email"))
        if usuario and usuario.check_password(password) and self.user_can_authenticate(usuario):
            return usuario
        return None
