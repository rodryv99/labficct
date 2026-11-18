"""Mapa pintado de una entrada de bitácora, al estilo OrganiLab.

Sobre la distribución del laboratorio se "pintan" los elementos con el color de un
atributo (p. ej. verde = Funciona, rojo = Con falla). Se guarda dentro de la entrada
(`EntradaBitacora.mapa`) con esta forma:

    {
      "version": 1,
      "filas": 6, "columnas": 9,             # solo el rectángulo que usan los elementos
      "origen": {"fila": 1, "columna": 0},   # dónde empieza ese rectángulo en la grilla
      "celdas": [{"fila": 0, "columna": 0, "tipo": 3, "tipo_nombre": "Computadora",
                  "icono": "pc", "color": "#0F6CBD", "etiqueta": "PC-01", "ip": "…",
                  "mac": "…", "codigo_activo": "…", "especificaciones": "…",
                  "descripcion": "…", "estado": "operativo"}, …],
      "atributos": [{"nombre": "Funciona", "color": "#22A34A"}, …],
      "marcas": [{"fila": 0, "columna": 0, "atributo": 0}, …]   # atributo = posición
    }

Las celdas son una copia: si después se cambia la grilla del laboratorio, el mapa
de una entrada vieja sigue mostrando cómo estaba ese día.
"""

import io
import json
import re
from datetime import timedelta
from pathlib import Path

from django.utils import timezone

from apps.core.errores import ErrorNegocio

VERSION = 1
FORMATO_ARCHIVO = "labficct-bitacora"
MAX_ATRIBUTOS = 8
MAX_LADO = 200
# Colores que se asignan solos a los atributos (se pueden cambiar).
PALETA = ["#22A34A", "#E5383B", "#F2A900", "#2F7DE1", "#8E44AD", "#16A6A6", "#E86A17", "#7F8C8D"]
ATRIBUTOS_INICIALES = [
    {"nombre": "Funciona", "color": PALETA[0]},
    {"nombre": "Con falla", "color": PALETA[1]},
]
_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
_TEXTOS_CELDA = {
    "tipo_nombre": 60,
    "icono": 30,
    "etiqueta": 30,
    "ip": 45,
    "mac": 17,
    "codigo_activo": 50,
    "especificaciones": 1000,
    "descripcion": 1000,
    "estado": 20,
}


def _error(mensaje: str):
    return ErrorNegocio(mensaje, codigo="mapa_invalido", campos={"mapa": [mensaje]})


# ── Plantilla: la grilla actual del laboratorio ─────────


def plantilla(laboratorio) -> dict:
    """Mapa vacío con la distribución actual del laboratorio (solo el rectángulo usado)."""
    elementos = list(laboratorio.elementos.select_related("tipo"))
    if not elementos:
        raise _error(f"{laboratorio.codigo} todavía no tiene elementos dibujados: no hay nada que pintar.")
    fila0 = min(e.fila for e in elementos)
    col0 = min(e.columna for e in elementos)
    filas = max(e.fila for e in elementos) - fila0 + 1
    columnas = max(e.columna for e in elementos) - col0 + 1
    celdas = [
        {
            "fila": e.fila - fila0,
            "columna": e.columna - col0,
            "tipo": e.tipo_id,
            "tipo_nombre": e.tipo.nombre,
            "icono": getattr(e.tipo, "icono", "") or "",
            "color": getattr(e.tipo, "color", "") or "",
            "etiqueta": e.etiqueta,
            "ip": e.ip or "",
            "mac": e.mac,
            "codigo_activo": e.codigo_activo,
            "especificaciones": e.especificaciones,
            "descripcion": e.descripcion,
            "estado": e.estado,
        }
        for e in sorted(elementos, key=lambda e: (e.fila, e.columna))
    ]
    return {
        "version": VERSION,
        "filas": filas,
        "columnas": columnas,
        "origen": {"fila": fila0, "columna": col0},
        "celdas": celdas,
        "atributos": [dict(a) for a in ATRIBUTOS_INICIALES],
        "marcas": [],
    }


# ── Validación ──────────────────────────────────────────


def _entero(valor, nombre: str) -> int:
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise _error(f"«{nombre}» debe ser un número entero.")
    return valor


def limpiar_atributos(atributos) -> list[dict]:
    if not isinstance(atributos, list) or not atributos:
        raise _error("Agrega al menos un atributo (p. ej. «Funciona»).")
    if len(atributos) > MAX_ATRIBUTOS:
        raise _error(f"Como máximo {MAX_ATRIBUTOS} atributos.")
    limpios = []
    for i, a in enumerate(atributos):
        if not isinstance(a, dict):
            raise _error("Cada atributo necesita nombre y color.")
        nombre = str(a.get("nombre") or "").strip()[:40]
        if not nombre:
            raise _error(f"El atributo {i + 1} no tiene nombre.")
        color = str(a.get("color") or "").strip()
        if not _COLOR.match(color):
            color = PALETA[i % len(PALETA)]
        limpios.append({"nombre": nombre, "color": color.upper()})
    return limpios


def limpiar_marcas(marcas, celdas: list[dict], total_atributos: int) -> list[dict]:
    """Solo se pintan casillas con un elemento. Si una casilla viene dos veces, gana la última."""
    if marcas is None:
        return []
    if not isinstance(marcas, list):
        raise _error("Las casillas pintadas deben ser una lista.")
    ocupadas = {(c["fila"], c["columna"]) for c in celdas}
    por_casilla = {}
    for m in marcas:
        if not isinstance(m, dict):
            raise _error("Cada casilla pintada necesita fila, columna y atributo.")
        fila = _entero(m.get("fila"), "fila")
        columna = _entero(m.get("columna"), "columna")
        atributo = _entero(m.get("atributo"), "atributo")
        if (fila, columna) not in ocupadas:
            raise _error(f"La casilla fila {fila + 1}, columna {columna + 1} no tiene un elemento.")
        if not 0 <= atributo < total_atributos:
            raise _error("Una casilla está pintada con un atributo que no existe.")
        por_casilla[(fila, columna)] = atributo
    return [{"fila": f, "columna": c, "atributo": a} for (f, c), a in sorted(por_casilla.items())]


def _limpiar_celdas(celdas, filas: int, columnas: int) -> list[dict]:
    if not isinstance(celdas, list) or not celdas:
        raise _error("El mapa no tiene elementos.")
    limpias, vistas = [], set()
    for c in celdas:
        if not isinstance(c, dict):
            raise _error("Hay una casilla con un formato que no se entiende.")
        fila = _entero(c.get("fila"), "fila")
        columna = _entero(c.get("columna"), "columna")
        if not (0 <= fila < filas and 0 <= columna < columnas):
            raise _error("Hay un elemento fuera de la grilla del mapa.")
        if (fila, columna) in vistas:
            raise _error("Hay dos elementos en la misma casilla.")
        vistas.add((fila, columna))
        tipo = c.get("tipo")
        limpia = {
            "fila": fila,
            "columna": columna,
            "tipo": tipo if isinstance(tipo, int) and not isinstance(tipo, bool) else None,
        }
        for campo, largo in _TEXTOS_CELDA.items():
            limpia[campo] = str(c.get(campo) or "")[:largo]
        color = limpia.pop("color", "") or str(c.get("color") or "")
        limpia["color"] = color if _COLOR.match(color) else ""
        limpias.append(limpia)
    return sorted(limpias, key=lambda c: (c["fila"], c["columna"]))


def mapa_completo(datos) -> dict:
    """Valida un mapa entero (el de un archivo importado)."""
    if not isinstance(datos, dict):
        raise _error("El mapa tiene un formato que no se entiende.")
    filas = _entero(datos.get("filas"), "filas")
    columnas = _entero(datos.get("columnas"), "columnas")
    if not (1 <= filas <= MAX_LADO and 1 <= columnas <= MAX_LADO):
        raise _error(f"La grilla del mapa debe medir entre 1 y {MAX_LADO} casillas por lado.")
    origen = datos.get("origen") if isinstance(datos.get("origen"), dict) else {}
    celdas = _limpiar_celdas(datos.get("celdas"), filas, columnas)
    atributos = limpiar_atributos(datos.get("atributos"))
    return {
        "version": VERSION,
        "filas": filas,
        "columnas": columnas,
        "origen": {
            "fila": origen.get("fila") if isinstance(origen.get("fila"), int) else 0,
            "columna": origen.get("columna") if isinstance(origen.get("columna"), int) else 0,
        },
        "celdas": celdas,
        "atributos": atributos,
        "marcas": limpiar_marcas(datos.get("marcas"), celdas, len(atributos)),
    }


def armar(*, base: dict | None, laboratorio, pintado) -> dict | None:
    """Mapa para guardar a partir de lo que manda la web o la app.

    `pintado` es `{"atributos": [...], "marcas": [...]}` o None (quitar el mapa).
    `base` es el mapa que ya tenía la entrada: se conserva su copia de la grilla.
    Si no tenía, se toma la distribución actual del laboratorio.
    """
    if pintado is None:
        return None
    if not isinstance(pintado, dict):
        raise _error("El mapa tiene un formato que no se entiende.")
    mapa = dict(base) if base else plantilla(laboratorio)
    mapa["atributos"] = limpiar_atributos(pintado.get("atributos"))
    mapa["marcas"] = limpiar_marcas(pintado.get("marcas"), mapa["celdas"], len(mapa["atributos"]))
    mapa["version"] = VERSION
    return mapa


# ── Exportar ────────────────────────────────────────────


def nombre_archivo(entrada, extension: str) -> str:
    fecha = timezone.localtime(entrada.fecha)
    return f"bitacora-{entrada.laboratorio.codigo}-{fecha:%Y%m%d-%H%M}-{entrada.pk}.{extension}"


def como_archivo(entrada) -> dict:
    """Formato propio para compartir la bitácora e importarla en otro lado (web o app)."""
    return {
        "formato": FORMATO_ARCHIVO,
        "version": VERSION,
        "laboratorio": {"codigo": entrada.laboratorio.codigo, "nombre": entrada.laboratorio.nombre},
        "tipo": entrada.tipo,
        "titulo": entrada.titulo,
        "descripcion": entrada.descripcion,
        "fecha": timezone.localtime(entrada.fecha).isoformat(),
        "elementos": entrada.elementos,
        "mapa": entrada.mapa,
    }


FUENTES = Path(__file__).resolve().parent / "fuentes"


def _fuente(tamano: int, negrita: bool = False):
    """DejaVu viene con la app (fuentes/), así las tildes y la ñ salen bien en cualquier servidor."""
    from PIL import ImageFont

    archivo = "DejaVuSans-Bold.ttf" if negrita else "DejaVuSans.ttf"
    for nombre in (str(FUENTES / archivo), archivo, f"/usr/share/fonts/truetype/dejavu/{archivo}"):
        try:
            return ImageFont.truetype(nombre, tamano)
        except OSError:
            continue
    return ImageFont.load_default(size=tamano)


def _rgb(color: str, defecto=(156, 163, 175)) -> tuple[int, int, int]:
    if color and _COLOR.match(color):
        return tuple(int(color[i : i + 2], 16) for i in (1, 3, 5))
    return defecto


def _texto_sobre(fondo: tuple[int, int, int]) -> tuple[int, int, int]:
    luz = 0.299 * fondo[0] + 0.587 * fondo[1] + 0.114 * fondo[2]
    return (17, 24, 39) if luz > 150 else (255, 255, 255)


def _recortar(dibujo, texto: str, fuente, ancho: int) -> str:
    if dibujo.textlength(texto, font=fuente) <= ancho:
        return texto
    while texto and dibujo.textlength(texto + "…", font=fuente) > ancho:
        texto = texto[:-1]
    return texto + "…"


def imagen(entrada):
    """Dibuja la bitácora: título, datos, leyenda de colores y la grilla pintada."""
    from PIL import Image, ImageDraw

    mapa = entrada.mapa
    if not mapa:
        raise ErrorNegocio(
            "Esta entrada no tiene mapa: solo se puede exportar como archivo.", codigo="sin_mapa"
        )

    celda, separacion, margen = 80, 8, 36
    titulo_f, sub_f, leyenda_f = _fuente(28, True), _fuente(17), _fuente(17)
    # La etiqueta se achica si no entra (p. ej. "PC-DOC-01").
    etiqueta_fs = [_fuente(15, True), _fuente(13, True), _fuente(11, True)]
    tipo_f, pie_f = _fuente(11), _fuente(13)

    atributos = mapa["atributos"]
    conteo = [0] * len(atributos)
    marcas = {(m["fila"], m["columna"]): m["atributo"] for m in mapa["marcas"]}
    for a in marcas.values():
        conteo[a] += 1
    sin_pintar = len(mapa["celdas"]) - len(marcas)

    fecha = timezone.localtime(entrada.fecha)
    lab = entrada.laboratorio
    subtitulo = f"{lab.codigo} · {lab.nombre} · {fecha:%d/%m/%Y %H:%M} · {entrada.get_tipo_display()}"
    leyenda = [(a["color"], f"{a['nombre']} ({conteo[i]})") for i, a in enumerate(atributos)]
    if sin_pintar:
        leyenda.append(("", f"Sin marcar ({sin_pintar})"))

    medir = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    ancho_grilla = mapa["columnas"] * celda + (mapa["columnas"] - 1) * separacion
    alto_grilla = mapa["filas"] * celda + (mapa["filas"] - 1) * separacion
    ancho_leyenda = sum(28 + medir.textlength(t, font=leyenda_f) + 28 for _, t in leyenda)
    ancho = int(
        max(
            ancho_grilla,
            min(ancho_leyenda, 1400),
            medir.textlength(entrada.titulo, font=titulo_f),
            medir.textlength(subtitulo, font=sub_f),
            480,
        )
        + 2 * margen
    )
    # La leyenda baja de renglón si no entra.
    renglones, x = 1, 0
    for _, t in leyenda:
        paso = 28 + medir.textlength(t, font=leyenda_f) + 28
        if x and x + paso > ancho - 2 * margen:
            renglones, x = renglones + 1, 0
        x += paso
    alto_cabecera = margen + 38 + 30 + 18 + renglones * 30 + 18
    alto = int(alto_cabecera + alto_grilla + 24 + 24 + margen)

    fondo = (255, 255, 255)
    im = Image.new("RGB", (ancho, alto), fondo)
    d = ImageDraw.Draw(im)
    y = margen
    d.text((margen, y), entrada.titulo, font=titulo_f, fill=(17, 24, 39))
    y += 38
    d.text((margen, y), subtitulo, font=sub_f, fill=(75, 85, 99))
    y += 30 + 18

    x = margen
    for color, texto in leyenda:
        paso = 28 + medir.textlength(texto, font=leyenda_f) + 28
        if x > margen and x + paso > ancho - margen:
            x, y = margen, y + 30
        if color:
            d.rounded_rectangle((x, y + 1, x + 20, y + 21), radius=4, fill=_rgb(color))
        else:
            d.rounded_rectangle(
                (x, y + 1, x + 20, y + 21), radius=4, fill=(243, 244, 246), outline=(156, 163, 175)
            )
        d.text((x + 28, y + 1), texto, font=leyenda_f, fill=(31, 41, 55))
        x += paso
    y += 30 + 18

    x0 = margen + (ancho - 2 * margen - ancho_grilla) // 2
    ocupadas = {(c["fila"], c["columna"]): c for c in mapa["celdas"]}
    for f in range(mapa["filas"]):
        for c in range(mapa["columnas"]):
            cx = x0 + c * (celda + separacion)
            cy = y + f * (celda + separacion)
            caja = (cx, cy, cx + celda, cy + celda)
            elemento = ocupadas.get((f, c))
            if elemento is None:
                d.rounded_rectangle(caja, radius=10, outline=(229, 231, 235), width=1)
                continue
            atributo = marcas.get((f, c))
            relleno = _rgb(atributos[atributo]["color"]) if atributo is not None else (243, 244, 246)
            borde = _rgb(elemento.get("color", ""))
            d.rounded_rectangle(caja, radius=10, fill=relleno, outline=borde, width=3)
            tinta = _texto_sobre(relleno)
            texto = elemento["etiqueta"] or elemento["tipo_nombre"]
            etiqueta_f = next(
                (f for f in etiqueta_fs if d.textlength(texto, font=f) <= celda - 10), etiqueta_fs[-1]
            )
            etiqueta = _recortar(d, texto, etiqueta_f, celda - 10)
            tipo = _recortar(d, elemento["tipo_nombre"], tipo_f, celda - 10)
            d.text((cx + celda / 2, cy + celda / 2 - 6), etiqueta, font=etiqueta_f, fill=tinta, anchor="mm")
            d.text((cx + celda / 2, cy + celda / 2 + 14), tipo, font=tipo_f, fill=tinta, anchor="mm")

    y += alto_grilla + 24
    d.text(
        (margen, y),
        f"Laboratorios FICCT · registró {entrada.creado_por.nombre_completo if entrada.creado_por_id else 'Sistema'}",
        font=pie_f,
        fill=(107, 114, 128),
    )
    return im


def exportar(entrada, formato: str) -> tuple[bytes, str, str]:
    """Devuelve (contenido, tipo MIME, nombre de archivo)."""
    if formato == "json":
        contenido = json.dumps(como_archivo(entrada), ensure_ascii=False, indent=2).encode("utf-8")
        return contenido, "application/json", nombre_archivo(entrada, "bitacora.json")
    im = imagen(entrada)
    salida = io.BytesIO()
    if formato == "pdf":
        im.save(salida, "PDF", resolution=150.0, title=entrada.titulo)
        return salida.getvalue(), "application/pdf", nombre_archivo(entrada, "pdf")
    if formato == "png":
        im.save(salida, "PNG", optimize=True)
        return salida.getvalue(), "image/png", nombre_archivo(entrada, "png")
    im.save(salida, "JPEG", quality=92)
    return salida.getvalue(), "image/jpeg", nombre_archivo(entrada, "jpg")


# ── Importar ────────────────────────────────────────────


def leer_archivo(datos) -> dict:
    """Valida un archivo de bitácora y devuelve los campos para crear la entrada."""
    from .models import TipoEntrada

    if isinstance(datos, (bytes, str)):
        try:
            datos = json.loads(datos)
        except ValueError:
            raise _error("El archivo no es una bitácora de Laboratorios FICCT.") from None
    if not isinstance(datos, dict) or datos.get("formato") != FORMATO_ARCHIVO:
        raise _error("El archivo no es una bitácora de Laboratorios FICCT.")
    titulo = str(datos.get("titulo") or "").strip()[:150] or "Bitácora importada"
    tipo = datos.get("tipo") if datos.get("tipo") in TipoEntrada.values else TipoEntrada.OTRO
    fecha = timezone.now()
    try:
        from datetime import datetime

        leida = datetime.fromisoformat(str(datos.get("fecha")))
        if timezone.is_naive(leida):
            leida = timezone.make_aware(leida)
        if leida <= timezone.now() + timedelta(minutes=5):
            fecha = leida
    except ValueError:
        pass
    laboratorio = datos.get("laboratorio") if isinstance(datos.get("laboratorio"), dict) else {}
    return {
        "codigo_laboratorio": str(laboratorio.get("codigo") or ""),
        "tipo": tipo,
        "titulo": titulo,
        "descripcion": str(datos.get("descripcion") or "")[:5000],
        "fecha": fecha,
        "elementos": str(datos.get("elementos") or "")[:200],
        "mapa": mapa_completo(datos["mapa"]) if datos.get("mapa") else None,
    }
