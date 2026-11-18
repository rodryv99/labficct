"""Filtros de un reporte: se arman desde los parámetros de la URL.

Cada reporte declara qué filtros admite (`rango`, `laboratorio`, `periodo`,
`agrupar`, o claves extra). La vista llama a `parsear` y le pasa el resultado al
selector.
"""

from dataclasses import dataclass, field
from datetime import date, datetime

AGRUPACIONES = ("dia", "semana", "mes")


@dataclass
class Filtros:
    desde: date | None = None
    hasta: date | None = None
    laboratorio: int | None = None
    periodo: int | None = None
    agrupar: str = "mes"
    buscar: str = ""
    extra: dict = field(default_factory=dict)

    def entre(self, qs, campo: str):
        """Aplica el rango de fechas al queryset sobre `campo`.

        Sirve tanto para campos de fecha-hora (DateTimeField, usa `__date`) como
        para campos de fecha pura (DateField, filtra directo).
        """
        if not (self.desde or self.hasta):
            return qs
        from django.db.models import DateTimeField

        try:
            es_fecha_hora = isinstance(qs.model._meta.get_field(campo), DateTimeField)
        except Exception:  # noqa: BLE001 — si no se puede resolver, se asume fecha-hora
            es_fecha_hora = True
        sufijo = "__date" if es_fecha_hora else ""
        if self.desde:
            qs = qs.filter(**{f"{campo}{sufijo}__gte": self.desde})
        if self.hasta:
            qs = qs.filter(**{f"{campo}{sufijo}__lte": self.hasta})
        return qs

    def por_laboratorio(self, qs, campo: str = "laboratorio"):
        if self.laboratorio:
            qs = qs.filter(**{f"{campo}_id": self.laboratorio})
        return qs


def _fecha(texto: str | None) -> date | None:
    if not texto:
        return None
    try:
        return datetime.strptime(texto[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _entero(texto: str | None) -> int | None:
    return int(texto) if (texto or "").isdigit() else None


def parsear(parametros, permitidos: list[str]) -> Filtros:
    """`parametros` es request.query_params; `permitidos`, las claves que admite el reporte."""
    f = Filtros()
    if "rango" in permitidos:
        f.desde = _fecha(parametros.get("desde"))
        f.hasta = _fecha(parametros.get("hasta"))
    if "laboratorio" in permitidos:
        f.laboratorio = _entero(parametros.get("laboratorio"))
    if "periodo" in permitidos:
        f.periodo = _entero(parametros.get("periodo"))
    if "agrupar" in permitidos:
        agrupar = (parametros.get("agrupar") or "mes").lower()
        f.agrupar = agrupar if agrupar in AGRUPACIONES else "mes"
    if "buscar" in permitidos:
        f.buscar = (parametros.get("buscar") or "").strip()
    for clave in permitidos:
        if clave.startswith("extra:"):
            nombre = clave.split(":", 1)[1]
            valor = parametros.get(nombre)
            if valor not in (None, ""):
                f.extra[nombre] = valor
    return f
