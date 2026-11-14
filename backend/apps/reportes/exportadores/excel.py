"""Cualquier reporte → .xlsx. Una hoja por sección; la primera, con los filtros."""

import re
from datetime import datetime
from io import BytesIO

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from .. import selectors as s
from . import fecha_generacion

FORMATOS = {
    s.ENTERO: "#,##0",
    s.DECIMAL: "#,##0.00",
    s.PORCENTAJE: "0.0%",
    s.HORAS: "#,##0.00",
    s.MINUTOS: "#,##0.0",
    s.FECHA: "DD/MM/YYYY",
    s.FECHAHORA: "DD/MM/YYYY HH:MM",
}
NEGRITA = Font(bold=True)
TITULO = Font(bold=True, size=14)
FONDO_ENCABEZADO = PatternFill("solid", fgColor="DCE6F1")
ANCHO_MAXIMO = 60


def _valor(valor, tipo):
    """Los números quedan como números; las fechas, sin zona horaria (Excel no la admite)."""
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime) and timezone.is_aware(valor):
        return timezone.localtime(valor).replace(tzinfo=None)
    return valor


def _nombre_hoja(titulo, usados) -> str:
    nombre = re.sub(r"[\[\]:*?/\\]", "", titulo)[:31] or "Hoja"
    base, n = nombre, 2
    while nombre in usados:
        sufijo = f" ({n})"
        nombre = base[: 31 - len(sufijo)] + sufijo
        n += 1
    usados.add(nombre)
    return nombre


def _hoja_filtros(hoja, reporte):
    hoja.append(["Laboratorios FICCT"])
    hoja.append([reporte["titulo"]])
    hoja["A2"].font = TITULO
    hoja.append([])
    for f in reporte["filtros"]:
        hoja.append([f["etiqueta"], f["texto"]])
    hoja.append(["Generado el", fecha_generacion(reporte)])
    hoja.append(["Generado por", reporte["generado_por"]])
    for fila in hoja.iter_rows(min_row=4, max_col=1):
        fila[0].font = NEGRITA
    if reporte["notas"]:
        hoja.append([])
        hoja.append(["Notas"])
        hoja.cell(row=hoja.max_row, column=1).font = NEGRITA
        for nota in reporte["notas"]:
            hoja.append([nota])
    hoja.column_dimensions["A"].width = 22
    hoja.column_dimensions["B"].width = 50


def _hoja_seccion(hoja, sec):
    columnas = sec["columnas"]
    hoja.append([c["titulo"] for c in columnas])
    for celda in hoja[1]:
        celda.font = NEGRITA
        celda.fill = FONDO_ENCABEZADO
        celda.alignment = Alignment(wrap_text=True, vertical="center")

    for fila in sec["filas"]:
        hoja.append([_valor(fila.get(c["clave"]), c["tipo"]) for c in columnas])
    ultima_fila_datos = hoja.max_row

    if sec.get("totales"):
        hoja.append([_valor(sec["totales"].get(c["clave"]), c["tipo"]) for c in columnas])
        for celda in hoja[hoja.max_row]:
            celda.font = NEGRITA

    anchos = [len(c["titulo"]) for c in columnas]
    for i, c in enumerate(columnas, start=1):
        formato = FORMATOS.get(c["tipo"])
        for (celda,) in hoja.iter_rows(min_row=2, min_col=i, max_col=i):
            if formato:
                celda.number_format = formato
            largo = 16 if c["tipo"] == s.FECHAHORA else len(str(celda.value or ""))
            anchos[i - 1] = max(anchos[i - 1], largo)
        hoja.column_dimensions[get_column_letter(i)].width = min(anchos[i - 1] + 2, ANCHO_MAXIMO)

    # Encabezado fijo y autofiltro (sin la fila de totales, para que no se ordene con los datos).
    hoja.freeze_panes = "A2"
    hoja.auto_filter.ref = f"A1:{get_column_letter(len(columnas))}{max(ultima_fila_datos, 1)}"


def generar(reporte: dict) -> bytes:
    libro = Workbook()
    usados = set()
    portada = libro.active
    portada.title = _nombre_hoja("Filtros", usados)
    _hoja_filtros(portada, reporte)
    for sec in reporte["secciones"]:
        _hoja_seccion(libro.create_sheet(_nombre_hoja(sec["titulo"], usados)), sec)
    salida = BytesIO()
    libro.save(salida)
    return salida.getvalue()
