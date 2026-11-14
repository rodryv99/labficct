"""Cualquier reporte → .pdf (A4 horizontal, encabezado de tabla repetido, "Página n de m")."""

from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .. import selectors as s
from . import fecha_generacion, texto

PAGINA = landscape(A4)
MARGEN = 12 * mm
ANCHO_UTIL = PAGINA[0] - 2 * MARGEN
AZUL = colors.HexColor("#034481")
FONDO_ENCABEZADO = colors.HexColor("#DCE6F1")
FONDO_TOTALES = colors.HexColor("#F2F2F2")
NUMERICOS = {s.ENTERO, s.DECIMAL, s.PORCENTAJE, s.HORAS, s.MINUTOS}

_base = getSampleStyleSheet()
ESTILO_INSTITUCION = ParagraphStyle("institucion", parent=_base["Normal"], fontSize=9, textColor=AZUL)
ESTILO_TITULO = ParagraphStyle("titulo", parent=_base["Title"], fontSize=16, alignment=0, spaceAfter=4)
ESTILO_DATOS = ParagraphStyle("datos", parent=_base["Normal"], fontSize=8, leading=10)
ESTILO_SECCION = ParagraphStyle("seccion", parent=_base["Heading2"], fontSize=11, spaceBefore=8, spaceAfter=4)
ESTILO_CELDA = ParagraphStyle("celda", parent=_base["Normal"], fontSize=7, leading=8.5)
# Columnas numéricas centradas (título y valores), igual que en la web.
ESTILO_NUMERO = ParagraphStyle("numero", parent=ESTILO_CELDA, alignment=TA_CENTER)
ESTILO_ENCABEZADO = ParagraphStyle("encabezado", parent=ESTILO_CELDA, fontName="Helvetica-Bold")
ESTILO_ENCABEZADO_NUMERO = ParagraphStyle("encabezado_numero", parent=ESTILO_ENCABEZADO, alignment=TA_CENTER)
ESTILO_NOTA = ParagraphStyle("nota", parent=_base["Italic"], fontSize=7.5, leading=9)


class CanvasNumerado(canvas.Canvas):
    """Guarda las páginas y al final escribe "Página n de m" en cada una."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._paginas = []

    def showPage(self):
        self._paginas.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._paginas)
        for estado in self._paginas:
            self.__dict__.update(estado)
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.grey)
            self.drawRightString(PAGINA[0] - MARGEN, 7 * mm, f"Página {self._pageNumber} de {total}")
            super().showPage()
        super().save()


def _celda(valor, columna, estilo=None):
    contenido = escape(texto(valor, columna["tipo"]))
    return Paragraph(contenido, estilo or (ESTILO_NUMERO if columna["tipo"] in NUMERICOS else ESTILO_CELDA))


RELLENO = 13  # relleno izquierdo + derecho de cada celda, más un margen
ANCHO_MAXIMO_TEXTO = 220
ANCHO_PALABRA = 90


def _ancho(cadena, negrita=False) -> float:
    fuente = "Helvetica-Bold" if negrita else "Helvetica"
    return stringWidth(cadena, fuente, ESTILO_CELDA.fontSize) + RELLENO


def _anchos(sec) -> list[float]:
    """Ancho de cada columna, medido con la fuente real.

    Mínimo: que no se corte ninguna palabra del encabezado ni ningún número o fecha.
    Deseado: el contenido más largo (las columnas de texto, con tope; luego se parten en líneas).
    Si no cabe todo, las columnas de texto ceden espacio; si sobra, se reparte entre todas.
    """
    filas = sec["filas"][:300] + ([sec["totales"]] if sec.get("totales") else [])
    minimos, deseados, de_texto = [], [], []
    for c in sec["columnas"]:
        valores = [texto(f.get(c["clave"], ""), c["tipo"]) for f in filas]
        minimo = max(_ancho(p, negrita=True) for p in c["titulo"].split())
        contenido = max((_ancho(v) for v in valores), default=0)
        if c["tipo"] == s.TEXTO:
            # Palabras sueltas enteras, salvo las muy largas (MAC, especificaciones), que se parten.
            palabra = max((_ancho(p) for v in valores for p in v.split()), default=0)
            minimo = max(minimo, min(palabra, ANCHO_PALABRA))
            deseado = max(minimo, min(contenido, ANCHO_MAXIMO_TEXTO))
        else:
            minimo = deseado = max(minimo, contenido)
        minimos.append(minimo)
        deseados.append(deseado)
        de_texto.append(c["tipo"] == s.TEXTO)

    if sum(deseados) <= ANCHO_UTIL:
        extra = ANCHO_UTIL / sum(deseados)
        return [d * extra for d in deseados]
    if sum(minimos) >= ANCHO_UTIL:
        return [m * ANCHO_UTIL / sum(minimos) for m in minimos]
    # Las columnas de texto se achican en proporción a lo que les sobra sobre su mínimo.
    holgura = ANCHO_UTIL - sum(minimos)
    pedido = sum(d - m for d, m in zip(deseados, minimos, strict=True))
    return [m + (d - m) * holgura / pedido for d, m in zip(deseados, minimos, strict=True)]


def _tabla(sec):
    columnas = sec["columnas"]
    datos = [
        [
            Paragraph(
                escape(c["titulo"]),
                ESTILO_ENCABEZADO_NUMERO if c["tipo"] in NUMERICOS else ESTILO_ENCABEZADO,
            )
            for c in columnas
        ]
    ]
    datos += [[_celda(f.get(c["clave"]), c) for c in columnas] for f in sec["filas"]]
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), FONDO_ENCABEZADO),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#BFBFBF")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]
    if sec.get("totales"):
        datos.append(
            [
                _celda(
                    sec["totales"].get(c["clave"], ""),  # columnas que no se suman: vacías
                    c,
                    ParagraphStyle(
                        "t",
                        parent=ESTILO_NUMERO if c["tipo"] in NUMERICOS else ESTILO_CELDA,
                        fontName="Helvetica-Bold",
                    ),
                )
                for c in columnas
            ]
        )
        estilo.append(("BACKGROUND", (0, -1), (-1, -1), FONDO_TOTALES))
    if not sec["filas"]:
        datos.insert(
            1, [Paragraph("Sin datos para estos filtros.", ESTILO_CELDA)] + [""] * (len(columnas) - 1)
        )
        estilo.append(("SPAN", (0, 1), (-1, 1)))
    # repeatRows=1: el encabezado se repite al cambiar de página.
    tabla = Table(datos, colWidths=_anchos(sec), repeatRows=1)
    tabla.setStyle(TableStyle(estilo))
    return tabla


def generar(reporte: dict) -> bytes:
    salida = BytesIO()
    doc = SimpleDocTemplate(
        salida,
        pagesize=PAGINA,
        leftMargin=MARGEN,
        rightMargin=MARGEN,
        topMargin=MARGEN,
        bottomMargin=14 * mm,
        title=reporte["titulo"],
        author="Laboratorios FICCT",
    )
    filtros = " · ".join(f"<b>{escape(f['etiqueta'])}:</b> {escape(f['texto'])}" for f in reporte["filtros"])
    historia = [
        Paragraph("Laboratorios FICCT", ESTILO_INSTITUCION),
        Paragraph(escape(reporte["titulo"]), ESTILO_TITULO),
        Paragraph(filtros, ESTILO_DATOS),
        Paragraph(
            f"Generado el {fecha_generacion(reporte)} por {escape(reporte['generado_por'])}", ESTILO_DATOS
        ),
        Spacer(1, 4 * mm),
    ]
    for sec in reporte["secciones"]:
        bloque = [Paragraph(escape(sec["titulo"]), ESTILO_SECCION), _tabla(sec)]
        # Las tablas cortas no se parten; las largas sí, repitiendo el encabezado.
        historia += [KeepTogether(bloque)] if len(sec["filas"]) < 15 else bloque
    if reporte["notas"]:
        historia.append(Spacer(1, 4 * mm))
        historia += [Paragraph(f"Nota: {escape(n)}", ESTILO_NOTA) for n in reporte["notas"]]
    doc.build(historia, canvasmaker=CanvasNumerado)
    return salida.getvalue()
