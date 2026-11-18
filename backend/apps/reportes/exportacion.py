"""Exporta un reporte a Excel, CSV, PDF o Word.

- Excel y CSV: solo la tabla de datos (se reutiliza `apps.inventario.hojas`).
- PDF y Word: título, filtros aplicados, tarjetas (KPI), los gráficos incrustados
  y la tabla.

Como en el resto del proyecto, no se usa ninguna dependencia nueva: el PDF se
arma a mano, el Word es un zip de XML armado a mano y los gráficos se dibujan con
Pillow (`graficos.py`).
"""

import io
import zipfile
import zlib
from xml.sax.saxutils import escape

from apps.inventario.hojas import _ancho, _literal, _recortar, escribir_csv, escribir_xlsx

from . import base, graficos

FORMATOS = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv; charset=utf-8",
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def exportar(nombre_base: str, titulo: str, subtitulo: str, resultado: base.Resultado, formato: str):
    """Devuelve (contenido_bytes, tipo_mime, nombre_archivo)."""
    if formato not in FORMATOS:
        from apps.core.errores import ErrorNegocio

        raise ErrorNegocio("Formato no válido: usa xlsx, csv, pdf o word.", codigo="formato_invalido")

    encabezados = [c.titulo for c in resultado.columnas]
    filas = [[_celda(v) for v in fila] for fila in resultado.filas]
    nombre = f"{nombre_base}.{formato}"

    if formato == "xlsx":
        return escribir_xlsx(encabezados, filas, titulo[:31]), FORMATOS[formato], nombre
    if formato == "csv":
        return escribir_csv(encabezados, filas), FORMATOS[formato], nombre
    imagenes = _render_graficos(resultado.graficos)
    if formato == "pdf":
        return _pdf(titulo, subtitulo, resultado, encabezados, filas, imagenes), FORMATOS[formato], nombre
    return _docx(titulo, subtitulo, resultado, encabezados, filas, imagenes), FORMATOS[formato], nombre


def _celda(valor) -> str:
    if valor is None:
        return ""
    if isinstance(valor, float):
        return f"{valor:g}"
    return str(valor)


def _render_graficos(graficos_def: list[base.Grafico]) -> list:
    """Renderiza cada gráfico una sola vez: (imagen_png_bytes, ancho_px, alto_px, rgb_bytes)."""
    salida = []
    for g in graficos_def:
        img = graficos.dibujar(g, ancho=760, alto=430)
        salida.append((graficos.a_png(img), img.width, img.height, img.tobytes()))
    return salida


# ══════════════════════════════════════════════════════════
#  PDF  (A4 horizontal, armado a mano)
# ══════════════════════════════════════════════════════════

_ANCHO, _ALTO, _MARGEN = 841.89, 595.28, 40.0


class _LienzoPDF:
    """Acumula páginas; cada una es un flujo de operadores y las imágenes que usa."""

    def __init__(self):
        self.paginas: list[bytearray] = []
        self.imagenes_por_pagina: list[set] = []
        self._nueva()
        self.y = _MARGEN  # distancia desde arriba

    def _nueva(self):
        self.paginas.append(bytearray())
        self.imagenes_por_pagina.append(set())
        self.y = _MARGEN

    @property
    def c(self) -> bytearray:
        return self.paginas[-1]

    def espacio(self, alto: float) -> bool:
        return self.y + alto <= _ALTO - _MARGEN

    def salto(self):
        self._nueva()

    def texto(self, x, s, fuente="F1", tam=9.0, gris=0.0, dy=0.0):
        yp = _ALTO - (self.y + dy)
        self.c.extend(
            b"BT /%s %.1f Tf %.3f g %.2f %.2f Td %s Tj ET\n"
            % (fuente.encode(), tam, gris, x, yp, _literal(s))
        )

    def rect(self, x, ancho, alto, gris=None, rgb=None):
        yp = _ALTO - (self.y + alto)
        if rgb is not None:
            self.c.extend(b"%.3f %.3f %.3f rg " % rgb)
        else:
            self.c.extend(b"%.3f g " % gris)
        self.c.extend(b"%.2f %.2f %.2f %.2f re f\n" % (x, yp, ancho, alto))

    def linea(self, x0, x1, gris=0.85, grosor=0.4):
        yp = _ALTO - self.y
        self.c.extend(b"%.2f G %.2f w %.2f %.2f m %.2f %.2f l S\n" % (gris, grosor, x0, yp, x1, yp))

    def imagen(self, indice, x, ancho, alto):
        yp = _ALTO - (self.y + alto)
        self.imagenes_por_pagina[-1].add(indice)
        self.c.extend(b"q %.2f 0 0 %.2f %.2f %.2f cm /Im%d Do Q\n" % (ancho, alto, x, yp, indice))


def _pdf(titulo, subtitulo, resultado, encabezados, filas, imagenes) -> bytes:
    util = _ANCHO - 2 * _MARGEN
    L = _LienzoPDF()

    # Título y subtítulo.
    L.texto(_MARGEN, _recortar(titulo, util, 16, True), "F2", 16, 0.12, dy=14)
    L.y += 22
    if subtitulo:
        L.texto(_MARGEN, _recortar(subtitulo, util, 9.5), "F1", 9.5, 0.4, dy=10)
        L.y += 18
    L.y += 4

    # KPIs: tarjetas de 4 por fila.
    if resultado.kpis:
        _pdf_kpis(L, resultado.kpis, util)

    # Gráficos: uno por banda, centrado.
    for indice, (_png, pw, ph, _raw) in enumerate(imagenes):
        ancho_img = min(util, 520.0)
        alto_img = ancho_img * ph / pw
        if not L.espacio(alto_img + 16):
            L.salto()
        L.imagen(indice, _MARGEN + (util - ancho_img) / 2, ancho_img, alto_img)
        L.y += alto_img + 16

    # Tabla.
    _pdf_tabla(L, encabezados, filas, resultado.columnas, util)

    # Pie en cada página.
    _pdf_pies(L, titulo)

    return _ensamblar_pdf(L, imagenes)


def _pdf_kpis(L: _LienzoPDF, kpis, util):
    por_fila = 4
    ancho_t = (util - (por_fila - 1) * 10) / por_fila
    alto_t = 48
    tonos = {
        "exito": (0.09, 0.64, 0.29),
        "aviso": (0.95, 0.56, 0.0),
        "peligro": (0.89, 0.0, 0.10),
        "info": (0.04, 0.41, 0.76),
        "marca": (0.01, 0.22, 0.45),
        "neutro": (0.42, 0.45, 0.50),
    }
    for inicio in range(0, len(kpis), por_fila):
        if not L.espacio(alto_t + 10):
            L.salto()
        fila = kpis[inicio : inicio + por_fila]
        for i, k in enumerate(fila):
            x = _MARGEN + i * (ancho_t + 10)
            y0 = L.y
            L.rect(x, ancho_t, alto_t, gris=0.965)
            rgb = tonos.get(k.tono, tonos["neutro"])
            L.rect(x, 3, alto_t, rgb=rgb)
            guardar_y = L.y
            L.y = y0 + 18
            L.texto(x + 12, _recortar(k.valor, ancho_t - 20, 16, True), "F2", 16, 0.12)
            L.y = y0 + 34
            L.texto(x + 12, _recortar(k.etiqueta, ancho_t - 20, 8.5), "F1", 8.5, 0.42)
            L.y = guardar_y
        L.y += alto_t + 10


def _pdf_tabla(L: _LienzoPDF, encabezados, filas, columnas, util):
    total = sum(c.ancho for c in columnas) or 1
    anchos = [util * c.ancho / total for c in columnas]
    alto_fila = 15.0
    relleno = 4.0

    def cabecera():
        L.rect(_MARGEN, util, alto_fila, gris=0.90)
        x = _MARGEN
        guardar = L.y
        L.y = guardar + alto_fila - 4.5
        for titulo, ancho in zip(encabezados, anchos, strict=True):
            L.texto(x + relleno, _recortar(titulo, ancho - 2 * relleno, 8, True), "F2", 8, 0.1)
            x += ancho
        L.y = guardar + alto_fila

    if not L.espacio(alto_fila * 2):
        L.salto()
    cabecera()
    if not filas:
        L.y += 2
        L.texto(_MARGEN + relleno, "No hay datos para mostrar.", "F1", 8, 0.4, dy=10)
        L.y += alto_fila
        return
    for fila in filas:
        if not L.espacio(alto_fila):
            L.salto()
            cabecera()
        x = _MARGEN
        guardar = L.y
        L.y = guardar + alto_fila - 4.5
        for valor, ancho, col in zip(fila, anchos, columnas, strict=True):
            s = _recortar(valor, ancho - 2 * relleno, 8)
            dx = (ancho - 2 * relleno - _ancho(s, 8)) if col.tipo in (base.NUMERO, base.PORCENTAJE) else 0
            L.texto(x + relleno + max(dx, 0), s, "F1", 8, 0.15)
            x += ancho
        L.y = guardar + alto_fila
        L.linea(_MARGEN, _MARGEN + util, 0.88, 0.3)


def _pdf_pies(L: _LienzoPDF, titulo):
    for i, pagina in enumerate(L.paginas, start=1):
        yp = _MARGEN - 2
        pagina.extend(
            b"BT /F1 7.5 Tf 0.45 g %.2f %.2f Td %s Tj ET\n"
            % (_MARGEN, yp, _literal(f"Laboratorios FICCT · {titulo} · Página {i} de {len(L.paginas)}"))
        )


def _ensamblar_pdf(L: _LienzoPDF, imagenes) -> bytes:
    objetos: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"",  # Pages, se completa luego
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ]
    # Imágenes como XObjects (RGB crudo comprimido con zlib → nítidas, sin JPEG).
    num_imagen = {}
    for indice, (_png, pw, ph, raw) in enumerate(imagenes):
        comprimido = zlib.compress(raw)
        objetos.append(
            b"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB "
            b"/BitsPerComponent 8 /Filter /FlateDecode /Length %d >>\nstream\n" % (pw, ph, len(comprimido))
            + comprimido
            + b"\nendstream"
        )
        num_imagen[indice] = len(objetos)

    paginas = []
    for pagina, usadas in zip(L.paginas, L.imagenes_por_pagina, strict=True):
        comprimido = zlib.compress(bytes(pagina))
        recursos = b"/Font << /F1 3 0 R /F2 4 0 R >>"
        if usadas:
            xobj = b" ".join(b"/Im%d %d 0 R" % (i, num_imagen[i]) for i in sorted(usadas))
            recursos += b" /XObject << %s >>" % xobj
        num_contenido = len(objetos) + 2
        objetos.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] /Resources << %s >> /Contents %d 0 R >>"
            % (_ANCHO, _ALTO, recursos, num_contenido)
        )
        paginas.append(len(objetos))
        objetos.append(
            b"<< /Length %d /Filter /FlateDecode >>\nstream\n" % len(comprimido) + comprimido + b"\nendstream"
        )

    hijos = b" ".join(b"%d 0 R" % n for n in paginas)
    objetos[1] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (hijos, len(paginas))

    salida = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    posiciones = []
    for numero, cuerpo in enumerate(objetos, start=1):
        posiciones.append(len(salida))
        salida += b"%d 0 obj\n" % numero + cuerpo + b"\nendobj\n"
    inicio = len(salida)
    salida += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objetos) + 1)
    for p in posiciones:
        salida += b"%010d 00000 n \n" % p
    salida += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objetos) + 1, inicio)
    return bytes(salida)


# ══════════════════════════════════════════════════════════
#  Word .docx  (zip de XML, armado a mano)
# ══════════════════════════════════════════════════════════

_EMU = 9525  # EMU por píxel (96 ppp)
_ANCHO_IMG_EMU = 5760000  # ~6 pulgadas de ancho para los gráficos


def _p(texto: str, *, negrita=False, tam=None, gris=None, estilo=None) -> str:
    rpr = ""
    if negrita:
        rpr += "<w:b/>"
    if tam:
        rpr += f'<w:sz w:val="{tam * 2}"/>'
    if gris:
        rpr += f'<w:color w:val="{gris}"/>'
    rpr = f"<w:rPr>{rpr}</w:rPr>" if rpr else ""
    ppr = f'<w:pStyle w:val="{estilo}"/>' if estilo else ""
    ppr = f"<w:pPr>{ppr}</w:pPr>" if ppr else ""
    return f"<w:p>{ppr}<w:r>{rpr}<w:t xml:space=\"preserve\">{escape(texto)}</w:t></w:r></w:p>"


def _docx(titulo, subtitulo, resultado, encabezados, filas, imagenes) -> bytes:
    cuerpo = [_p(titulo, negrita=True, tam=18)]
    if subtitulo:
        cuerpo.append(_p(subtitulo, tam=10, gris="6B7280"))

    if resultado.kpis:
        for inicio in range(0, len(resultado.kpis), 4):
            cuerpo.append(_tabla_kpis(resultado.kpis[inicio : inicio + 4]))
    cuerpo.append(_p(""))

    relaciones = []
    medios = {}
    for indice, (png_bytes, pw, ph, _raw) in enumerate(imagenes):
        rid = f"rIdImg{indice}"
        relaciones.append(
            f'<Relationship Id="{rid}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
            f'Target="media/imagen{indice}.png"/>'
        )
        medios[f"word/media/imagen{indice}.png"] = png_bytes
        cuerpo.append(_dibujo(rid, indice, pw, ph))

    cuerpo.append(_tabla_datos(encabezados, filas, resultado.columnas))

    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        "<w:body>" + "".join(cuerpo) + '<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>'
        '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>'
    )

    rels_doc = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rIdStyles" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + "".join(relaciones)
        + "</Relationships>"
    )

    tipos = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Default Extension="png" ContentType="image/png"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        "</Types>"
    )

    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/></Relationships>'
    )

    salida = io.BytesIO()
    with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", tipos)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)
        z.writestr("word/_rels/document.xml.rels", rels_doc)
        z.writestr("word/styles.xml", _ESTILOS_DOCX)
        for ruta, datos in medios.items():
            z.writestr(ruta, datos)
    return salida.getvalue()


_ESTILOS_DOCX = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'
    '<w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>'
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
    "</w:styles>"
)


def _dibujo(rid, indice, pw, ph) -> str:
    cx = _ANCHO_IMG_EMU
    cy = int(cx * ph / pw)
    return (
        '<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{cx}" cy="{cy}"/><wp:docPr id="{indice + 1}" name="Grafico{indice}"/>'
        "<a:graphic><a:graphicData "
        'uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
        f'<pic:nvPicPr><pic:cNvPr id="{indice + 1}" name="Grafico{indice}"/><pic:cNvPicPr/></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>"
    )


def _celda_docx(texto, *, negrita=False, sombra=None, ancho=None) -> str:
    tcpr = "<w:tcPr>"
    if ancho:
        tcpr += f'<w:tcW w:w="{ancho}" w:type="dxa"/>'
    if sombra:
        tcpr += f'<w:shd w:val="clear" w:fill="{sombra}"/>'
    tcpr += "</w:tcPr>"
    rpr = "<w:rPr><w:b/></w:rPr>" if negrita else ""
    return (
        f"<w:tc>{tcpr}<w:p><w:r>{rpr}"
        f'<w:t xml:space="preserve">{escape(str(texto))}</w:t></w:r></w:p></w:tc>'
    )


def _tabla_datos(encabezados, filas, columnas) -> str:
    total = sum(c.ancho for c in columnas) or 1
    ancho_total = 15120  # dxa ≈ ancho útil horizontal
    anchos = [int(ancho_total * c.ancho / total) for c in columnas]
    grid = "".join(f'<w:gridCol w:w="{a}"/>' for a in anchos)
    cabecera = "<w:tr><w:trPr><w:tblHeader/></w:trPr>" + "".join(
        _celda_docx(t, negrita=True, sombra="E5E7EB", ancho=a) for t, a in zip(encabezados, anchos, strict=True)
    ) + "</w:tr>"
    cuerpo = []
    for fila in filas or []:
        cuerpo.append(
            "<w:tr>"
            + "".join(_celda_docx(v, ancho=a) for v, a in zip(fila, anchos, strict=True))
            + "</w:tr>"
        )
    if not filas:
        cuerpo.append(
            f'<w:tr>{_celda_docx("No hay datos para mostrar.", ancho=ancho_total)}</w:tr>'
        )
    return (
        "<w:tbl><w:tblPr><w:tblStyle w:val=\"Normal\"/>"
        '<w:tblW w:w="15120" w:type="dxa"/>'
        '<w:tblBorders>'
        '<w:top w:val="single" w:sz="4" w:color="D1D5DB"/>'
        '<w:bottom w:val="single" w:sz="4" w:color="D1D5DB"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="E5E7EB"/>'
        '<w:insideV w:val="single" w:sz="4" w:color="E5E7EB"/></w:tblBorders></w:tblPr>'
        f"<w:tblGrid>{grid}</w:tblGrid>{cabecera}{''.join(cuerpo)}</w:tbl>"
    )


def _tabla_kpis(kpis) -> str:
    ancho = 15120 // max(len(kpis), 1)
    grid = "".join(f'<w:gridCol w:w="{ancho}"/>' for _ in kpis)
    celdas_valor = "".join(
        _celda_docx(k.valor, negrita=True, sombra="F3F4F6", ancho=ancho) for k in kpis
    )
    celdas_etq = "".join(_celda_docx(k.etiqueta, sombra="F3F4F6", ancho=ancho) for k in kpis)
    return (
        '<w:tbl><w:tblPr><w:tblW w:w="15120" w:type="dxa"/></w:tblPr>'
        f"<w:tblGrid>{grid}</w:tblGrid>"
        f"<w:tr>{celdas_valor}</w:tr><w:tr>{celdas_etq}</w:tr></w:tbl>"
    )
