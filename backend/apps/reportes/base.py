"""Estructuras comunes del módulo de reportes.

Un reporte produce un `Resultado`: unas tarjetas (KPI), uno o varios gráficos y
una tabla (columnas + filas). La web lo dibuja interactivo; el motor de
exportación lo convierte en Excel, CSV, PDF o Word.

Este archivo no usa Django a propósito: son solo datos. Así se puede probar el
motor de exportación sin levantar la base.
"""

from dataclasses import dataclass, field

# Tipos de columna (deciden cómo se alinea y se formatea en la tabla).
TEXTO = "texto"
NUMERO = "numero"
PORCENTAJE = "porcentaje"
FECHA = "fecha"
DURACION = "duracion"  # minutos → "2 h 15 min"

# Tipos de gráfico que sabe dibujar `graficos.py`.
BARRAS = "barras"
BARRAS_APILADAS = "barras_apiladas"
LINEAS = "lineas"
PASTEL = "pastel"
DONA = "dona"
HEATMAP = "heatmap"


@dataclass
class Columna:
    """Una columna de la tabla. `ancho` reparte el espacio en el PDF."""

    clave: str
    titulo: str
    tipo: str = TEXTO
    ancho: float = 1.0


@dataclass
class Grafico:
    """Un gráfico listo para dibujar.

    Para barras/líneas/pastel: `etiquetas` (eje X o porciones) y `series`
    (`[{"nombre": str, "datos": [float, ...], "color": "#rrggbb"|None}]`).
    Para heatmap: `filas`, `columnas` y `matriz` (lista de filas de números).
    """

    tipo: str
    titulo: str
    etiquetas: list[str] = field(default_factory=list)
    series: list[dict] = field(default_factory=list)
    filas: list[str] = field(default_factory=list)
    columnas: list[str] = field(default_factory=list)
    matriz: list[list[float]] = field(default_factory=list)
    # Pista para la web sobre el tamaño (1 = media fila, 2 = fila completa).
    ancho: int = 1


@dataclass
class KPI:
    """Una tarjeta de resumen."""

    etiqueta: str
    valor: str
    tono: str = "neutro"  # exito, aviso, peligro, info, marca, neutro
    ayuda: str = ""


@dataclass
class Resultado:
    """Lo que devuelve cada reporte."""

    columnas: list[Columna] = field(default_factory=list)
    filas: list[list] = field(default_factory=list)
    graficos: list[Grafico] = field(default_factory=list)
    kpis: list[KPI] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.filas)


# Paleta categórica de la FICCT (azul del logo primero), para web y gráficos.
PALETA = [
    "#0969c3",  # azul FICCT
    "#22A34A",  # verde
    "#F89000",  # oro
    "#E3001B",  # rojo FICCT
    "#8E44AD",  # morado
    "#16A6A6",  # teal
    "#E86A17",  # naranja
    "#7F8C8D",  # gris
    "#2F7DE1",  # azul claro
    "#B5179E",  # magenta
]


def color(indice: int) -> str:
    return PALETA[indice % len(PALETA)]


def serie(nombre: str, datos: list, color_hex: str | None = None) -> dict:
    return {"nombre": nombre, "datos": list(datos), "color": color_hex}
