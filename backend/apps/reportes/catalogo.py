"""Catálogo de reportes: el registro central de todos los reportes disponibles.

Cada reporte se registra con el decorador `@registrar(...)` desde `selectors.py`.
La web lee el catálogo desde `/reportes/` para armar el menú y los filtros.
"""

from collections.abc import Callable
from dataclasses import dataclass

# Grupos en el orden en que se muestran en la web.
GRUPOS = [
    ("uso", "Uso de laboratorios"),
    ("equipos", "Inventario y equipos"),
    ("mantenimiento", "Mantenimiento y bitácora"),
    ("asistencia", "Solicitudes de asistencia"),
    ("marcaciones", "Puntualidad de auxiliares"),
    ("tareas", "Tareas"),
    ("objetos", "Objetos perdidos"),
    ("sistema", "Usuarios y sistema"),
]
_TITULO_GRUPO = dict(GRUPOS)


@dataclass
class Reporte:
    id: str
    nombre: str
    grupo: str
    descripcion: str
    filtros: list[str]
    selector: Callable
    icono: str = "chart"


REPORTES: dict[str, Reporte] = {}


def registrar(id: str, nombre: str, grupo: str, descripcion: str, filtros: list[str], icono: str = "chart"):
    """Decorador: ata una función selector a un reporte del catálogo."""

    def decorador(funcion: Callable) -> Callable:
        if grupo not in _TITULO_GRUPO:
            raise ValueError(f"Grupo desconocido: {grupo}")
        REPORTES[id] = Reporte(id, nombre, grupo, descripcion, list(filtros), funcion, icono)
        return funcion

    return decorador


def obtener(id: str) -> Reporte | None:
    return REPORTES.get(id)


def _meta(reporte: Reporte) -> dict:
    return {
        "id": reporte.id,
        "nombre": reporte.nombre,
        "grupo": reporte.grupo,
        "descripcion": reporte.descripcion,
        "filtros": reporte.filtros,
        "icono": reporte.icono,
    }


def catalogo() -> list[dict]:
    """Lista de grupos con sus reportes, para el menú de la web."""
    grupos = []
    for clave, titulo in GRUPOS:
        items = [_meta(r) for r in REPORTES.values() if r.grupo == clave]
        if items:
            grupos.append({"clave": clave, "titulo": titulo, "reportes": items})
    return grupos
