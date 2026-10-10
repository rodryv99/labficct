import re

from django.conf import settings
from rest_framework import serializers

EXTENSIONES_IMAGEN = {"jpg", "jpeg", "png", "webp"}
PATRON_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


def validar_imagen(archivo):
    if not archivo:
        return archivo
    extension = archivo.name.rsplit(".", 1)[-1].lower() if "." in archivo.name else ""
    if extension not in EXTENSIONES_IMAGEN:
        raise serializers.ValidationError("La imagen debe ser JPG, PNG o WEBP.")
    if archivo.size > settings.TAMANO_MAXIMO_IMAGEN:
        maximo = settings.TAMANO_MAXIMO_IMAGEN // (1024 * 1024)
        raise serializers.ValidationError(f"La imagen no puede pesar más de {maximo} MB.")
    return archivo


def validar_color(valor):
    if not PATRON_COLOR.match(valor or ""):
        raise serializers.ValidationError("Usa un color en formato #RRGGBB.")
    return valor.upper()
