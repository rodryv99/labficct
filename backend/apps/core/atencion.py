"""Horario de atención de los laboratorios (ATENCION_INICIO y ATENCION_FIN del .env)."""

from datetime import time

from django.conf import settings


def _hora(texto: str) -> time:
    horas, minutos = texto.strip().split(":")
    return time(int(horas), int(minutos))


def inicio() -> time:
    return _hora(settings.ATENCION_INICIO)


def fin() -> time:
    return _hora(settings.ATENCION_FIN)


def mensaje_fuera_de_atencion(hora_inicio, hora_fin) -> str | None:
    """Devuelve el aviso si el rango no cabe en el horario de atención; None si cabe."""
    if hora_inicio is None or hora_fin is None:
        return None
    if hora_inicio < inicio() or hora_fin > fin():
        return (
            f"Los laboratorios atienden de {settings.ATENCION_INICIO} a {settings.ATENCION_FIN}. "
            "Ajusta el horario."
        )
    return None


def franjas() -> list[list[str]]:
    """Franjas habituales como [["07:00", "09:15"], …], en el orden del .env."""
    salida = []
    for texto in settings.FRANJAS_HABITUALES:
        partes = [p.strip() for p in texto.split("-")]
        if len(partes) == 2 and all(partes):
            salida.append(partes)
    return salida
