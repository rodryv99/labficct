"""Leer y escribir planillas (Excel .xlsx, CSV) y escribir listados en PDF.

Todo con la biblioteca estándar de Python: un .xlsx es un zip con archivos XML y un PDF
de texto se arma a mano. Así no hace falta instalar nada más en el servidor.

Este módulo no usa Django: recibe y devuelve datos simples (listas de listas de texto).
"""

import csv
import io
import re
import zipfile
import zlib
from datetime import date, datetime, timedelta
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

MAX_FILAS = 5000
MAX_COLUMNAS = 40
MAX_DESCOMPRIMIDO = 40 * 1024 * 1024  # un .xlsx malicioso puede pesar poco y abrirse enorme
MAX_PAGINAS_PDF = 500


class ArchivoIlegible(ValueError):
    """El archivo no se pudo leer como planilla. El mensaje es para mostrar a la persona."""


# ── Leer ────────────────────────────────────────────────


def leer_tabla(nombre: str, contenido: bytes) -> list[list[str]]:
    """Devuelve las filas de la primera hoja como texto, sin filas ni columnas vacías al final."""
    extension = nombre.lower().rsplit(".", 1)[-1] if "." in nombre else ""
    if contenido[:4] == b"PK\x03\x04" or extension in ("xlsx", "xlsm"):
        filas = _leer_xlsx(contenido)
    elif contenido[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" or extension == "xls":
        raise ArchivoIlegible(
            "Es un Excel antiguo (.xls). Ábrelo y guárdalo como «Libro de Excel (.xlsx)» o como CSV."
        )
    elif contenido[:5] == b"%PDF-" or extension == "pdf":
        filas = _leer_pdf(contenido)
    else:
        filas = _leer_csv(contenido)
    return _ordenar(filas)


def _leer_pdf(contenido: bytes) -> list[list[str]]:
    """Saca las tablas de un PDF (el export de patrimonio de la UAGRM viene así).

    Junta las tablas de todas las páginas y descarta los encabezados que se repiten en cada
    página. Necesita pdfplumber instalado en el servidor."""
    try:
        import pdfplumber
    except ImportError as error:  # pragma: no cover - depende del servidor
        raise ArchivoIlegible(
            "Para leer PDF falta instalar «pdfplumber» en el servidor. Mientras tanto, "
            "subí el archivo como Excel (.xlsx) o CSV."
        ) from error

    filas: list[list[str]] = []
    try:
        with pdfplumber.open(io.BytesIO(contenido)) as pdf:
            if len(pdf.pages) > MAX_PAGINAS_PDF:
                raise ArchivoIlegible(f"El PDF tiene más de {MAX_PAGINAS_PDF} páginas. Divídelo en varios.")
            for pagina in pdf.pages:
                for tabla in pagina.extract_tables() or []:
                    for fila in tabla:
                        filas.append([(celda or "").replace("\n", " ").strip() for celda in fila])
                if len(filas) > MAX_FILAS + 200:
                    break
    except ArchivoIlegible:
        raise
    except Exception as error:  # pdfplumber/pdfminer lanzan de todo ante un PDF raro
        raise ArchivoIlegible(
            "No se pudo leer la tabla del PDF. Probá exportándolo como Excel (.xlsx) o CSV."
        ) from error

    if not filas:
        raise ArchivoIlegible(
            "No se encontró ninguna tabla en el PDF. Si es un escaneo (imagen), exportalo como Excel o CSV."
        )
    # Los PDF repiten la fila de títulos en cada página: se deja la primera y se quitan las demás.
    encabezado = filas[0]
    clave = encabezado[0].strip().lower() if encabezado else ""
    limpias = [encabezado]
    for fila in filas[1:]:
        if fila == encabezado or (clave and fila and fila[0].strip().lower() == clave):
            continue
        limpias.append(fila)
    return limpias


def _ordenar(filas: list[list[str]]) -> list[list[str]]:
    filas = [[(c or "").strip() for c in fila[:MAX_COLUMNAS]] for fila in filas]
    filas = [f for f in filas if any(f)]
    if not filas:
        raise ArchivoIlegible("El archivo está vacío.")
    if len(filas) > MAX_FILAS + 1:
        raise ArchivoIlegible(f"El archivo tiene más de {MAX_FILAS} filas. Divídelo en varios.")
    ancho = max(len(f) for f in filas)
    filas = [f + [""] * (ancho - len(f)) for f in filas]
    # Columnas sin ningún dato: fuera (suelen ser columnas de adorno).
    usadas = [i for i in range(ancho) if any(f[i] for f in filas)]
    return [[f[i] for i in usadas] for f in filas]


def _leer_csv(contenido: bytes) -> list[list[str]]:
    texto = None
    for codificacion in ("utf-8-sig", "cp1252"):
        try:
            texto = contenido.decode(codificacion)
            break
        except UnicodeDecodeError:
            continue
    if texto is None or "\x00" in texto:
        raise ArchivoIlegible("No se pudo leer el archivo. Usa un Excel (.xlsx) o un CSV.")
    # El separador es el que más aparece fuera de comillas en las primeras líneas (Excel en español usa ;).
    muestra = re.sub(r'"[^"]*"', "", "\n".join(texto.splitlines()[:20]))
    separador = max(";,\t|", key=muestra.count)
    return [list(fila) for fila in csv.reader(io.StringIO(texto), delimiter=separador)]


_NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "p": "http://schemas.openxmlformats.org/package/2006/relationships",
}
# Formatos de número de Excel que son fechas (los que trae incorporados).
_FORMATOS_FECHA = set(range(14, 23)) | set(range(27, 37)) | {45, 46, 47} | set(range(50, 59))


def _es_formato_fecha(codigo: str) -> bool:
    """Un formato propio es de fecha si usa d, m, y o h fuera de comillas y corchetes."""
    limpio = re.sub(r'"[^"]*"|\[[^\]]*\]|\\.', "", codigo.lower())
    return bool(re.search(r"[dmyh]", limpio)) and "general" not in limpio


def _numero(texto: str) -> str:
    """Excel guarda 41 como "41" o "41.0", y a veces con ruido: 0.30000000000000004."""
    try:
        valor = float(texto)
    except ValueError:
        return texto
    if valor == int(valor) and abs(valor) < 1e15:
        return str(int(valor))
    return repr(round(valor, 10))


def _fecha_de_serie(serie: float, base_1904: bool) -> str:
    """Número de serie de Excel → "AAAA-MM-DD" (o con hora si la tiene)."""
    origen = datetime(1904, 1, 1) if base_1904 else datetime(1899, 12, 30)
    momento = origen + timedelta(days=serie)
    if momento.hour or momento.minute:
        return momento.strftime("%Y-%m-%d %H:%M")
    return momento.strftime("%Y-%m-%d")


def _columna(referencia: str) -> int:
    """ "C7" → 2"""
    indice = 0
    for letra in referencia:
        if not letra.isalpha():
            break
        indice = indice * 26 + (ord(letra.upper()) - 64)
    return indice - 1


def _leer_xlsx(contenido: bytes) -> list[list[str]]:
    try:
        with zipfile.ZipFile(io.BytesIO(contenido)) as libro:
            if sum(i.file_size for i in libro.infolist()) > MAX_DESCOMPRIMIDO:
                raise ArchivoIlegible("El archivo es demasiado grande.")
            nombres = set(libro.namelist())

            def xml(ruta):
                return ET.fromstring(libro.read(ruta))

            # Textos compartidos: cada celda de texto apunta a uno por su posición.
            textos = []
            if "xl/sharedStrings.xml" in nombres:
                for si in xml("xl/sharedStrings.xml").findall("m:si", _NS):
                    # Se juntan los trozos con formato; la guía fonética (rPh) no cuenta.
                    trozos = [t.text or "" for t in si.findall("m:t", _NS)]
                    trozos += [t.text or "" for t in si.findall("m:r/m:t", _NS)]
                    textos.append("".join(trozos))

            # Qué estilos son de fecha, para convertir el número de serie.
            estilos_fecha = set()
            if "xl/styles.xml" in nombres:
                estilos = xml("xl/styles.xml")
                propios = {
                    int(f.get("numFmtId", "0")): f.get("formatCode", "")
                    for f in estilos.findall("m:numFmts/m:numFmt", _NS)
                }
                for i, xf in enumerate(estilos.findall("m:cellXfs/m:xf", _NS)):
                    formato = int(xf.get("numFmtId", "0"))
                    if formato in _FORMATOS_FECHA or _es_formato_fecha(propios.get(formato, "")):
                        estilos_fecha.add(i)

            cuaderno = xml("xl/workbook.xml")
            propiedades = cuaderno.find("m:workbookPr", _NS)
            base_1904 = propiedades is not None and propiedades.get("date1904") in ("1", "true")

            # La primera hoja, según el orden del libro.
            ruta_hoja = "xl/worksheets/sheet1.xml"
            hoja = cuaderno.find("m:sheets/m:sheet", _NS)
            if hoja is not None and "xl/_rels/workbook.xml.rels" in nombres:
                relacion = hoja.get(f"{{{_NS['r']}}}id")
                for rel in xml("xl/_rels/workbook.xml.rels").findall("p:Relationship", _NS):
                    if rel.get("Id") == relacion:
                        destino = rel.get("Target", "").lstrip("/")
                        ruta_hoja = destino if destino.startswith("xl/") else f"xl/{destino}"
            if ruta_hoja not in nombres:
                raise ArchivoIlegible("El Excel no tiene ninguna hoja con datos.")

            filas = []
            for fila_xml in xml(ruta_hoja).findall("m:sheetData/m:row", _NS):
                fila: list[str] = []
                for celda in fila_xml.findall("m:c", _NS):
                    posicion = _columna(celda.get("r", "")) if celda.get("r") else len(fila)
                    if posicion >= MAX_COLUMNAS or posicion < 0:
                        continue
                    tipo = celda.get("t", "n")
                    valor = celda.find("m:v", _NS)
                    crudo = valor.text or "" if valor is not None else ""
                    if tipo == "s":
                        texto = textos[int(crudo)] if crudo.isdigit() and int(crudo) < len(textos) else ""
                    elif tipo == "inlineStr":
                        texto = "".join(t.text or "" for t in celda.iter(f"{{{_NS['m']}}}t"))
                    elif tipo == "b":
                        texto = "Sí" if crudo == "1" else "No"
                    elif tipo == "e":
                        texto = ""
                    elif tipo == "n" and crudo:
                        estilo = int(celda.get("s", "0") or 0)
                        try:
                            texto = (
                                _fecha_de_serie(float(crudo), base_1904)
                                if estilo in estilos_fecha and 1 <= float(crudo) < 2958466
                                else _numero(crudo)
                            )
                        except (ValueError, OverflowError):
                            texto = crudo
                    else:  # "str" (resultado de una fórmula) y "d" (fecha ISO)
                        texto = crudo
                    fila.extend([""] * (posicion + 1 - len(fila)))
                    fila[posicion] = texto
                filas.append(fila)
                if len(filas) > MAX_FILAS + 50:
                    break
            return filas
    except ArchivoIlegible:
        raise
    except (zipfile.BadZipFile, ET.ParseError, KeyError, ValueError, OSError):
        raise ArchivoIlegible("No se pudo abrir el Excel. Guárdalo de nuevo como .xlsx e inténtalo otra vez.")


# ── Escribir Excel y CSV ────────────────────────────────

_NO_XML = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _letra(indice: int) -> str:
    letras = ""
    indice += 1
    while indice:
        indice, resto = divmod(indice - 1, 26)
        letras = chr(65 + resto) + letras
    return letras


def escribir_xlsx(encabezados: list[str], filas: list[list[str]], hoja: str = "Hoja1") -> bytes:
    """Un Excel de una hoja: títulos en negrita, fila de títulos fija, filtros y anchos a medida."""

    def celda(columna: int, fila: int, valor: str, estilo: int) -> str:
        texto = escape(_NO_XML.sub("", str(valor)))
        return f'<c r="{_letra(columna)}{fila}" t="inlineStr" s="{estilo}"><is><t xml:space="preserve">{texto}</t></is></c>'

    anchos = []
    for i, titulo in enumerate(encabezados):
        largo = max([len(titulo)] + [len(str(f[i])) for f in filas[:500] if i < len(f)])
        anchos.append(min(60, max(10, largo + 2)))
    columnas = "".join(
        f'<col min="{i + 1}" max="{i + 1}" width="{a}" customWidth="1"/>' for i, a in enumerate(anchos)
    )
    xml_filas = ['<row r="1">' + "".join(celda(i, 1, t, 1) for i, t in enumerate(encabezados)) + "</row>"]
    for n, fila in enumerate(filas, start=2):
        xml_filas.append(f'<row r="{n}">' + "".join(celda(i, n, v, 0) for i, v in enumerate(fila)) + "</row>")
    rango = f"A1:{_letra(len(encabezados) - 1)}{len(filas) + 1}"
    principal = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    paquete = "http://schemas.openxmlformats.org/package/2006"
    oficina = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    cabecera = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

    archivos = {
        "[Content_Types].xml": (
            f'<Types xmlns="{paquete}/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            "</Types>"
        ),
        "_rels/.rels": (
            f'<Relationships xmlns="{paquete}/relationships">'
            f'<Relationship Id="rId1" Type="{oficina}/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>"
        ),
        "xl/workbook.xml": (
            f'<workbook xmlns="{principal}" xmlns:r="{oficina}">'
            f'<sheets><sheet name="{escape(hoja[:31])}" sheetId="1" r:id="rId1"/></sheets>'
            "</workbook>"
        ),
        "xl/_rels/workbook.xml.rels": (
            f'<Relationships xmlns="{paquete}/relationships">'
            f'<Relationship Id="rId1" Type="{oficina}/worksheet" Target="worksheets/sheet1.xml"/>'
            f'<Relationship Id="rId2" Type="{oficina}/styles" Target="styles.xml"/>'
            "</Relationships>"
        ),
        "xl/styles.xml": (
            f'<styleSheet xmlns="{principal}">'
            '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
            '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
            '<fills count="3"><fill><patternFill patternType="none"/></fill>'
            '<fill><patternFill patternType="gray125"/></fill>'
            '<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill></fills>'
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            '<cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
            '<xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs>'
            "</styleSheet>"
        ),
        "xl/worksheets/sheet1.xml": (
            f'<worksheet xmlns="{principal}">'
            '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            f"<cols>{columnas}</cols><sheetData>{''.join(xml_filas)}</sheetData>"
            f'<autoFilter ref="{rango}"/></worksheet>'
        ),
    }
    salida = io.BytesIO()
    with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as libro:
        for ruta, texto in archivos.items():
            libro.writestr(ruta, cabecera + texto)
    return salida.getvalue()


def escribir_csv(encabezados: list[str], filas: list[list[str]]) -> bytes:
    """CSV que Excel en español abre bien con doble clic: separado por ; y con marca UTF-8."""
    salida = io.StringIO()
    escritor = csv.writer(salida, delimiter=";", lineterminator="\r\n")
    escritor.writerow(encabezados)
    escritor.writerows(filas)
    return salida.getvalue().encode("utf-8-sig")


# ── Escribir PDF ────────────────────────────────────────

# Ancho de cada letra de Helvetica (en milésimas del tamaño), para saber cuánto texto entra en una columna.
_ANCHOS = {
    **dict.fromkeys(" .,:;/\\|!'ijl", 278),
    **dict.fromkeys("ftI", 300),
    **dict.fromkeys('r-()[]"`*', 340),
    **dict.fromkeys("ckssvxyzJ", 500),
    **dict.fromkeys("abdeghnopqu0123456789L_#$?", 556),
    **dict.fromkeys("FTZ+=<>~", 611),
    **dict.fromkeys("ABEKPSVXY&", 667),
    **dict.fromkeys("wCDHNRU", 722),
    **dict.fromkeys("GOQ", 778),
    **dict.fromkeys("mM", 833),
    **dict.fromkeys("W%", 944),
    "@": 1015,
}
_SIN_TILDE = str.maketrans("áéíóúüñÁÉÍÓÚÜÑ", "aeiouunAEIOUUN")


def _ancho(texto: str, tamano: float, negrita: bool = False) -> float:
    milesimas = sum(_ANCHOS.get(c, 600) for c in texto.translate(_SIN_TILDE))
    return milesimas * tamano / 1000 * (1.08 if negrita else 1.02)


def _recortar(texto: str, ancho: float, tamano: float, negrita: bool = False) -> str:
    texto = " ".join(str(texto).split())
    if _ancho(texto, tamano, negrita) <= ancho:
        return texto
    while texto and _ancho(texto + "...", tamano, negrita) > ancho:
        texto = texto[:-1]
    return texto.rstrip() + "..."


def _literal(texto: str) -> bytes:
    """Texto como cadena de PDF (WinAnsi: tiene las tildes y la ñ; lo demás sale como ?)."""
    crudo = texto.encode("cp1252", "replace")
    return b"(" + crudo.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)") + b")"


def escribir_pdf(
    titulo: str,
    subtitulo: str,
    encabezados: list[str],
    filas: list[list[str]],
    proporciones: list[float],
    pie: str = "Laboratorios FICCT",
) -> bytes:
    """Listado en hojas A4 horizontales, con los títulos repetidos en cada hoja.

    `proporciones` reparte el ancho entre las columnas (una por encabezado). El texto
    que no entra en su columna se corta con "...".
    """
    ancho_hoja, alto_hoja, margen = 841.89, 595.28, 34.0
    tamano, alto_fila, relleno = 8.0, 15.0, 4.0
    util = ancho_hoja - 2 * margen
    total = sum(proporciones)
    anchos = [util * p / total for p in proporciones]
    arriba = alto_hoja - margen - 48  # debajo del título
    por_hoja = max(1, int((arriba - margen - 8) // alto_fila) - 1)
    hojas = [filas[i : i + por_hoja] for i in range(0, len(filas), por_hoja)] or [[]]

    def texto(x: float, y: float, valor: str, fuente: str, cuerpo: float, gris: float = 0.0) -> bytes:
        return b"BT /%s %.1f Tf %.2f g %.2f %.2f Td %s Tj ET\n" % (
            fuente.encode(),
            cuerpo,
            gris,
            x,
            y,
            _literal(valor),
        )

    contenidos = []
    for numero, hoja in enumerate(hojas, start=1):
        c = bytearray()
        c += texto(margen, alto_hoja - margen - 12, _recortar(titulo, util, 15, True), "F2", 15)
        c += texto(margen, alto_hoja - margen - 28, _recortar(subtitulo, util, 9), "F1", 9, 0.35)
        # Franja de títulos.
        y = arriba
        c += b"0.90 g %.2f %.2f %.2f %.2f re f\n" % (margen, y - alto_fila + 4, util, alto_fila)
        x = margen
        for titulo_columna, ancho in zip(encabezados, anchos, strict=True):
            valor = _recortar(titulo_columna, ancho - 2 * relleno, tamano, True)
            c += texto(x + relleno, y - alto_fila + 8.5, valor, "F2", tamano)
            x += ancho
        y -= alto_fila
        for fila in hoja:
            x = margen
            for valor, ancho in zip(fila, anchos, strict=True):
                c += texto(
                    x + relleno,
                    y - alto_fila + 8.5,
                    _recortar(valor, ancho - 2 * relleno, tamano),
                    "F1",
                    tamano,
                )
                x += ancho
            # Raya fina bajo cada fila.
            c += b"0.85 G 0.4 w %.2f %.2f m %.2f %.2f l S\n" % (
                margen,
                y - alto_fila + 4,
                margen + util,
                y - alto_fila + 4,
            )
            y -= alto_fila
        if not filas:
            c += texto(
                margen + relleno, y - alto_fila + 8.5, "No hay datos para mostrar.", "F1", tamano, 0.35
            )
        c += texto(margen, margen - 12, f"{pie} · Página {numero} de {len(hojas)}", "F1", 8, 0.45)
        contenidos.append(bytes(c))

    # Objetos: 1 catálogo, 2 páginas, 3 y 4 fuentes, y por cada hoja su página y su contenido.
    objetos: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"",  # se completa abajo, cuando se saben los números de las páginas
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ]
    paginas = []
    for contenido in contenidos:
        comprimido = zlib.compress(contenido)
        numero_pagina = len(objetos) + 1
        paginas.append(numero_pagina)
        objetos.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] "
            b"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>"
            % (ancho_hoja, alto_hoja, numero_pagina + 1)
        )
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
    inicio_tabla = len(salida)
    salida += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objetos) + 1)
    for posicion in posiciones:
        salida += b"%010d 00000 n \n" % posicion
    salida += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objetos) + 1,
        inicio_tabla,
    )
    return bytes(salida)


def fecha_corta(valor: date | None) -> str:
    return valor.strftime("%d/%m/%Y") if valor else ""
