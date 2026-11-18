"""Dibuja los gráficos de los reportes con Pillow (la misma librería que usa la
bitácora). No hace falta matplotlib ni ninguna dependencia nueva.

Se dibuja al doble de tamaño y se reduce al final (supersampling) para que las
líneas y el texto queden nítidos. Devuelve imágenes PIL en RGB con fondo blanco,
listas para incrustar en el PDF y en el Word, o para guardar como PNG.
"""

import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from . import base

SS = 2  # factor de supersampling

_GRIS_EJE = (156, 163, 175)
_GRIS_REJILLA = (229, 231, 235)
_GRIS_TEXTO = (55, 65, 81)
_GRIS_SUAVE = (107, 114, 128)
_BLANCO = (255, 255, 255)

# Fuentes: se reutilizan las DejaVu que ya trae la bitácora; si no están, la de PIL.
_CARPETAS_FUENTE = [
    Path(__file__).resolve().parents[1] / "bitacora" / "fuentes",
    Path("/usr/share/fonts/truetype/dejavu"),
]


def _buscar_fuente(nombres: list[str]):
    for carpeta in _CARPETAS_FUENTE:
        for nombre in nombres:
            ruta = carpeta / nombre
            if ruta.exists():
                return str(ruta)
    return None


_REGULAR = _buscar_fuente(["DejaVuSans.ttf"])
_NEGRITA = _buscar_fuente(["DejaVuSans-Bold.ttf"])


def _fuente(tamano: int, negrita: bool = False):
    ruta = _NEGRITA if negrita else _REGULAR
    try:
        if ruta:
            return ImageFont.truetype(ruta, tamano)
    except OSError:
        pass
    return ImageFont.load_default()


def _rgb(hex_color: str) -> tuple[int, int, int]:
    h = (hex_color or "#0969c3").lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _aclarar(rgb: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    return tuple(round(c + (255 - c) * factor) for c in rgb)  # type: ignore[return-value]


def _ancho_texto(dibujo, texto, fuente) -> int:
    izq, _, der, _ = dibujo.textbbox((0, 0), texto, font=fuente)
    return der - izq


def _maximo_bonito(valor: float) -> float:
    """Redondea el máximo del eje hacia arriba a 1/2/5 × 10ⁿ para una escala limpia."""
    if valor <= 0:
        return 1.0
    import math

    exp = math.floor(math.log10(valor))
    base10 = 10**exp
    for paso in (1, 2, 2.5, 5, 10):
        if valor <= paso * base10:
            return paso * base10
    return 10 * base10


def _texto(dibujo, xy, texto, fuente, fill, ancla="la"):
    dibujo.text(xy, texto, font=fuente, fill=fill, anchor=ancla)


# ── API ─────────────────────────────────────────────────


def dibujar(grafico: base.Grafico, ancho: int = 760, alto: int = 430) -> Image.Image:
    """Devuelve la imagen PIL (RGB, fondo blanco) del gráfico."""
    W, H = ancho * SS, alto * SS
    img = Image.new("RGB", (W, H), _BLANCO)
    d = ImageDraw.Draw(img)
    f_titulo = _fuente(17 * SS, negrita=True)
    f_normal = _fuente(12 * SS)
    f_chico = _fuente(11 * SS)

    _texto(d, (16 * SS, 12 * SS), grafico.titulo, f_titulo, _GRIS_TEXTO)

    try:
        if grafico.tipo in (base.PASTEL, base.DONA):
            _pastel(d, grafico, W, H, f_normal, f_chico, dona=grafico.tipo == base.DONA)
        elif grafico.tipo == base.HEATMAP:
            _heatmap(d, grafico, W, H, f_normal, f_chico)
        elif grafico.tipo == base.LINEAS:
            _lineas(d, grafico, W, H, f_normal, f_chico)
        else:  # barras y barras apiladas
            _barras(d, grafico, W, H, f_normal, f_chico, apiladas=grafico.tipo == base.BARRAS_APILADAS)
    except Exception:  # noqa: BLE001 — un gráfico roto no debe tumbar la exportación
        _texto(d, (16 * SS, H // 2), "No se pudo dibujar el gráfico.", f_normal, _GRIS_SUAVE)

    return img.resize((ancho, alto), Image.LANCZOS)


def a_png(img: Image.Image) -> bytes:
    salida = io.BytesIO()
    img.save(salida, format="PNG")
    return salida.getvalue()


def png(grafico: base.Grafico, ancho: int = 760, alto: int = 430) -> bytes:
    return a_png(dibujar(grafico, ancho, alto))


# ── Dibujos concretos ───────────────────────────────────


def _marco(d, W, H):
    """Área de trazado (deja margen para título, ejes y leyenda). Devuelve (x0,y0,x1,y1)."""
    return 56 * SS, 48 * SS, W - 20 * SS, H - 56 * SS


def _leyenda(d, nombres, colores, W, H, fuente):
    y = H - 30 * SS
    x = 56 * SS
    for nombre, col in zip(nombres, colores, strict=False):
        d.rectangle([x, y, x + 14 * SS, y + 14 * SS], fill=col)
        _texto(d, (x + 20 * SS, y + 1 * SS), nombre, fuente, _GRIS_TEXTO)
        x += 20 * SS + _ancho_texto(d, nombre, fuente) + 24 * SS


def _ejes_valores(d, x0, y0, x1, y1, maximo, fuente):
    """Rejilla horizontal y números del eje Y."""
    pasos = 4
    for i in range(pasos + 1):
        y = y1 - (y1 - y0) * i / pasos
        d.line([x0, y, x1, y], fill=_GRIS_REJILLA, width=1 * SS)
        etiqueta = f"{round(maximo * i / pasos):g}"
        _texto(d, (x0 - 8 * SS, y), etiqueta, fuente, _GRIS_SUAVE, ancla="rm")
    d.line([x0, y0, x0, y1], fill=_GRIS_EJE, width=1 * SS)
    d.line([x0, y1, x1, y1], fill=_GRIS_EJE, width=1 * SS)


def _barras(d, g, W, H, f_normal, f_chico, apiladas=False):
    x0, y0, x1, y1 = _marco(d, W, H)
    etiquetas = g.etiquetas or [""]
    series = g.series or [base.serie("", [0] * len(etiquetas))]
    colores = [_rgb(s.get("color") or base.color(i)) for i, s in enumerate(series)]

    if apiladas:
        maximo = _maximo_bonito(max((sum(vals) for vals in zip(*[s["datos"] for s in series], strict=False)), default=1))
    else:
        maximo = _maximo_bonito(max((max(s["datos"], default=0) for s in series), default=1))
    maximo = maximo or 1
    _ejes_valores(d, x0, y0, x1, y1, maximo, f_chico)

    n = len(etiquetas)
    ancho_grupo = (x1 - x0) / max(n, 1)
    hueco = ancho_grupo * 0.22
    if apiladas:
        for j in range(n):
            cx = x0 + ancho_grupo * j + hueco / 2
            cw = ancho_grupo - hueco
            acum = 0.0
            for s, col in zip(series, colores, strict=False):
                val = s["datos"][j] if j < len(s["datos"]) else 0
                h = (y1 - y0) * (val / maximo)
                d.rectangle([cx, y1 - acum - h, cx + cw, y1 - acum], fill=col)
                acum += h
            _etiqueta_x(d, etiquetas[j], cx + cw / 2, y1, f_chico)
    else:
        m = len(series)
        for j in range(n):
            base_x = x0 + ancho_grupo * j + hueco / 2
            cw = (ancho_grupo - hueco) / max(m, 1)
            for k, (s, col) in enumerate(zip(series, colores, strict=False)):
                val = s["datos"][j] if j < len(s["datos"]) else 0
                h = (y1 - y0) * (val / maximo)
                bx = base_x + cw * k
                d.rectangle([bx, y1 - h, bx + cw * 0.92, y1], fill=col)
                if m == 1 and val:
                    _texto(d, (bx + cw * 0.46, y1 - h - 4 * SS), f"{val:g}", f_chico, _GRIS_SUAVE, ancla="mb")
            _etiqueta_x(d, etiquetas[j], base_x + (cw * m) / 2, y1, f_chico)

    if len([s for s in series if s.get("nombre")]) > 1:
        _leyenda(d, [s["nombre"] for s in series], colores, W, H, f_chico)


def _etiqueta_x(d, texto, cx, y1, fuente):
    texto = (texto or "")[:22]
    _texto(d, (cx, y1 + 6 * SS), texto, fuente, _GRIS_SUAVE, ancla="ma")


def _lineas(d, g, W, H, f_normal, f_chico):
    x0, y0, x1, y1 = _marco(d, W, H)
    etiquetas = g.etiquetas or [""]
    series = g.series or []
    colores = [_rgb(s.get("color") or base.color(i)) for i, s in enumerate(series)]
    maximo = _maximo_bonito(max((max(s["datos"], default=0) for s in series), default=1)) or 1
    _ejes_valores(d, x0, y0, x1, y1, maximo, f_chico)

    n = len(etiquetas)
    paso = (x1 - x0) / max(n - 1, 1)
    for s, col in zip(series, colores, strict=False):
        puntos = []
        for j, val in enumerate(s["datos"][:n]):
            x = x0 + paso * j
            y = y1 - (y1 - y0) * (val / maximo)
            puntos.append((x, y))
        if len(puntos) >= 2:
            d.line(puntos, fill=col, width=3 * SS, joint="curve")
        for x, y in puntos:
            d.ellipse([x - 4 * SS, y - 4 * SS, x + 4 * SS, y + 4 * SS], fill=col, outline=_BLANCO, width=1 * SS)
    for j in range(0, n, max(1, n // 8)):
        _etiqueta_x(d, etiquetas[j], x0 + paso * j, y1, f_chico)
    if len([s for s in series if s.get("nombre")]) > 1:
        _leyenda(d, [s["nombre"] for s in series], colores, W, H, f_chico)


def _pastel(d, g, W, H, f_normal, f_chico, dona=False):
    serie0 = g.series[0]["datos"] if g.series else []
    etiquetas = g.etiquetas or []
    total = sum(serie0) or 1
    cx, cy = (W * 0.36), (H * 0.56)
    r = min(W * 0.22, H * 0.34)
    caja = [cx - r, cy - r, cx + r, cy + r]
    ang = -90.0
    colores = [_rgb(base.color(i)) for i in range(len(serie0))]
    for i, val in enumerate(serie0):
        barrido = 360 * (val / total)
        d.pieslice(caja, ang, ang + barrido, fill=colores[i], outline=_BLANCO, width=2 * SS)
        ang += barrido
    if dona:
        rr = r * 0.55
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=_BLANCO)
        _texto(d, (cx, cy), f"{round(total):g}", _fuente(16 * SS, negrita=True), _GRIS_TEXTO, ancla="mm")
    # Leyenda a la derecha con valores y porcentaje.
    lx, ly = W * 0.64, H * 0.28
    for i, val in enumerate(serie0):
        etq = etiquetas[i] if i < len(etiquetas) else ""
        d.rectangle([lx, ly, lx + 14 * SS, ly + 14 * SS], fill=colores[i])
        pct = round(100 * val / total)
        _texto(d, (lx + 20 * SS, ly), f"{etq}  ·  {val:g} ({pct}%)", f_chico, _GRIS_TEXTO)
        ly += 24 * SS


def _heatmap(d, g, W, H, f_normal, f_chico):
    filas = g.filas or []
    columnas = g.columnas or []
    matriz = g.matriz or []
    if not filas or not columnas:
        _texto(d, (16 * SS, H // 2), "Sin datos.", f_normal, _GRIS_SUAVE)
        return
    izq = 56 * SS + max((_ancho_texto(d, f, f_chico) for f in filas), default=0)
    arriba = 60 * SS
    x1, y1 = W - 20 * SS, H - 30 * SS
    cw = (x1 - izq) / len(columnas)
    ch = (y1 - arriba) / len(filas)
    maximo = max((max(fila, default=0) for fila in matriz), default=1) or 1
    azul = _rgb("#0969c3")
    for ci, col in enumerate(columnas):
        _texto(d, (izq + cw * ci + cw / 2, arriba - 6 * SS), str(col)[:6], f_chico, _GRIS_SUAVE, ancla="mb")
    for fi, fila_lbl in enumerate(filas):
        _texto(d, (izq - 8 * SS, arriba + ch * fi + ch / 2), str(fila_lbl), f_chico, _GRIS_TEXTO, ancla="rm")
        for ci in range(len(columnas)):
            val = matriz[fi][ci] if fi < len(matriz) and ci < len(matriz[fi]) else 0
            factor = 1 - (val / maximo) * 0.85
            color_celda = _aclarar(azul, factor) if val else (243, 244, 246)
            x = izq + cw * ci
            y = arriba + ch * fi
            d.rectangle([x + 1 * SS, y + 1 * SS, x + cw - 1 * SS, y + ch - 1 * SS], fill=color_celda)
            if val:
                tono = _BLANCO if factor < 0.5 else _GRIS_TEXTO
                _texto(d, (x + cw / 2, y + ch / 2), f"{val:g}", f_chico, tono, ancla="mm")
