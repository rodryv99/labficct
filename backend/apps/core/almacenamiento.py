"""Almacenamiento privado: archivos que no deben tener URL pública."""

import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils import timezone


def almacen_privado():
    """Carpeta PRIVADO_ROOT. Django nunca la sirve: los archivos salen solo por la API."""
    return FileSystemStorage(location=settings.PRIVADO_ROOT)


def _ruta(carpeta: str, nombre_original: str) -> str:
    """carpeta/AAAA/MM/<uuid>.jpg: un nombre imposible de adivinar."""
    extension = Path(nombre_original).suffix.lower() or ".jpg"
    return f"{carpeta}/{timezone.localdate():%Y/%m}/{uuid.uuid4().hex}{extension}"


def ruta_entrega(_instancia, nombre_original: str) -> str:
    return _ruta("entregas", nombre_original)
