"""Convierten la estructura común de un reporte en un archivo (Excel o PDF)."""

from datetime import date, datetime

from django.utils import timezone

from .. import selectors as s

SIN_DATO = "—"


def texto(valor, tipo) -> str:
    """Valor → texto para mostrar (PDF). El Excel guarda los números como números."""
    if valor == "":
        return ""
    if valor is None:
        return SIN_DATO if tipo != s.TEXTO else ""
    if tipo == s.ENTERO:
        return f"{int(valor):,}".replace(",", ".")
    if tipo == s.PORCENTAJE:
        return f"{valor * 100:.1f} %".replace(".", ",")
    if tipo in (s.DECIMAL, s.HORAS):
        return f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if tipo == s.MINUTOS:
        return f"{valor:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if tipo == s.FECHAHORA and isinstance(valor, datetime):
        return (
            timezone.localtime(valor).strftime("%d/%m/%Y %H:%M")
            if timezone.is_aware(valor)
            else valor.strftime("%d/%m/%Y %H:%M")
        )
    if tipo == s.FECHA and isinstance(valor, date):
        return valor.strftime("%d/%m/%Y")
    return str(valor)


def fecha_generacion(reporte) -> str:
    return reporte["generado_en"].strftime("%d/%m/%Y %H:%M")
