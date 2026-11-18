"""Convierte un `Resultado` en algo que la web puede dibujar (JSON)."""

from dataclasses import asdict

from .base import Resultado


def serializar(resultado: Resultado) -> dict:
    return {
        "kpis": [asdict(k) for k in resultado.kpis],
        "graficos": [asdict(g) for g in resultado.graficos],
        "columnas": [asdict(c) for c in resultado.columnas],
        "filas": resultado.filas,
        "total": resultado.total,
    }
