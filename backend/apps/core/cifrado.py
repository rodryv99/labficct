"""Cifrado simétrico (Fernet) para las contraseñas de los laboratorios."""

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

from .errores import ErrorNegocio


def _fernet() -> Fernet:
    clave = settings.FIELD_ENCRYPTION_KEY
    if not clave:
        raise ErrorNegocio(
            "Falta FIELD_ENCRYPTION_KEY en el .env del backend.", codigo="configuracion"
        )
    try:
        return Fernet(clave.encode() if isinstance(clave, str) else clave)
    except (ValueError, TypeError) as error:
        raise ErrorNegocio(
            "FIELD_ENCRYPTION_KEY no es una clave válida. Genera una con "
            "'python manage.py generar_claves'.",
            codigo="configuracion",
        ) from error


def cifrar(texto: str) -> str:
    if not texto:
        return ""
    return _fernet().encrypt(texto.encode()).decode()


def descifrar(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as error:
        raise ErrorNegocio(
            "No se pudo descifrar la contraseña: la clave de cifrado cambió.",
            codigo="cifrado",
        ) from error
