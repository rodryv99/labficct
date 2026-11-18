"""Entender una planilla de activos: qué fila son los títulos y qué columna es cada dato.

Primero se miran los títulos ("Código", "Ubicación", "Nro. de serie"…). Las columnas
que no se reconocen por su título se adivinan por lo que contienen: fechas, estados,
lugares y tipos que ya existen, marcas conocidas, códigos que no se repiten, o el
texto más largo (la descripción).

Este módulo no usa Django: recibe la tabla y los nombres que ya existen.
"""

import re
import unicodedata
from datetime import date, datetime

# En el orden en que se muestran. Los tres primeros son los obligatorios.
CAMPOS = {
    "codigo": "Código",
    "descripcion": "Descripción",
    "lugar": "Lugar",
    "tipo": "Tipo",
    "marca": "Marca",
    "modelo": "Modelo",
    "serie": "Número de serie",
    "estado": "Estado",
    "fecha_adquisicion": "Fecha de adquisición",
    "observaciones": "Observaciones",
}
OBLIGATORIOS = ("codigo", "descripcion", "lugar")

# Cómo suele llamarse cada columna. Van ya "aplanados" (minúsculas, sin tildes ni signos).
TITULOS = {
    "codigo": [
        "codigo", "cod", "codigo activo", "codigo de activo", "codigo del activo", "cod activo", "nro activo",
        "numero de activo", "n activo", "activo fijo", "codigo activo fijo", "codigo patrimonial", "codigo inventario",
        "codigo de inventario", "codigo af", "id", "codigo interno", "codigo del bien",
    ],
    "descripcion": [
        "descripcion", "detalle", "nombre", "activo", "bien", "articulo", "denominacion", "descripcion del activo",
        "descripcion del bien", "item", "nombre del activo", "nombre del bien", "concepto",
    ],
    "lugar": [
        "lugar", "ubicacion", "laboratorio", "aula", "ambiente", "sala", "oficina", "dependencia", "localizacion",
        "ubicacion fisica", "ubicacion actual", "area",
    ],
    "tipo": ["tipo", "categoria", "clase", "rubro", "grupo", "tipo de activo", "tipo de bien", "familia"],
    "marca": ["marca", "fabricante"],
    "modelo": ["modelo"],
    "serie": [
        "serie", "nro serie", "nro de serie", "numero de serie", "n serie", "n de serie", "no serie", "serial",
        "s n", "sn", "num serie", "numero serie",
    ],
    "estado": ["estado", "condicion", "estado fisico", "estado del bien", "estado del activo", "situacion", "estado actual"],
    "fecha_adquisicion": [
        "fecha de adquisicion", "fecha adquisicion", "fecha de compra", "fecha compra", "adquisicion", "fecha",
        "fecha de ingreso", "fecha ingreso", "fecha de alta", "fecha de incorporacion",
    ],
    "observaciones": ["observaciones", "observacion", "obs", "notas", "nota", "comentarios", "comentario"],
}  # fmt: skip

ESTADOS = {
    "operativo": [
        "operativo", "operativa", "bueno", "buena", "buen estado", "funciona", "funcionando", "en uso", "ok",
        "optimo", "nuevo", "nueva", "regular", "activo", "b", "r", "en funcionamiento", "bien", "normal",
    ],
    "danado": [
        "danado", "danada", "malo", "mala", "mal estado", "defectuoso", "defectuosa", "averiado", "averiada",
        "con falla", "con fallas", "no funciona", "inservible", "roto", "rota", "deteriorado", "deteriorada", "m",
    ],
    "en_reparacion": ["en reparacion", "reparacion", "mantenimiento", "en mantenimiento", "en revision"],
    "baja": ["baja", "de baja", "dado de baja", "dada de baja", "descartado", "descartada", "obsoleto", "obsoleta"],
}  # fmt: skip
_ESTADO_DE = {texto: estado for estado, textos in ESTADOS.items() for texto in textos}

MARCAS = {
    "hp", "dell", "lenovo", "samsung", "lg", "epson", "asus", "acer", "forza", "apc", "genius", "logitech", "delux",
    "tp link", "tplink", "cisco", "d link", "dlink", "kingston", "canon", "sony", "toshiba", "intel", "amd", "apple",
    "benq", "viewsonic", "aoc", "msi", "gigabyte", "huawei", "xiaomi", "panasonic", "brother", "mikrotik", "ubiquiti",
    "microsoft", "hewlett packard", "compaq", "ibm", "philips", "hikvision", "dahua", "nexxt", "xtech", "klip xtreme",
    "omega", "halion", "targus", "western digital", "seagate", "adata", "corsair", "cooler master", "thermaltake",
}  # fmt: skip

# Palabras con las que suele nombrarse un tipo de activo.
PALABRAS_TIPO = {
    "silla", "mesa", "escritorio", "computadora", "computador", "cpu", "pc", "monitor", "teclado", "mouse", "raton",
    "estabilizador", "ups", "proyector", "impresora", "switch", "router", "pizarra", "parlante", "parlantes",
    "laptop", "portatil", "servidor", "estante", "armario", "gavetero", "aire", "ventilador", "regulador",
    "camara", "telefono", "televisor", "tv", "scanner", "escaner", "rack", "mueble", "banco", "pupitre", "data",
    "access", "cable", "extintor", "reloj", "casillero", "vitrina", "sillon", "taburete", "tablet", "disco",
}  # fmt: skip
PALABRAS_LUGAR = (
    "lab", "aula", "deposito", "oficina", "modulo", "sala", "almacen", "direccion", "secretaria", "piso", "bloque",
    "biblioteca", "auditorio", "decanato", "jefatura", "centro",
)  # fmt: skip

PATRON_CODIGO = re.compile(r"^[A-Z0-9]+(-[A-Z0-9]+)*$")


def aplanar(texto) -> str:
    """Minúsculas, sin tildes y con los signos convertidos en espacios: "N° de Serie" → "n de serie"."""
    sin_tildes = unicodedata.normalize("NFD", str(texto).lower())
    sin_tildes = "".join(c for c in sin_tildes if unicodedata.category(c) != "Mn")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", sin_tildes).split())


def limpiar_codigo(texto: str) -> str:
    """ " a-123 45 " → "A-12345" """
    return re.sub(r"\s+", "", str(texto)).upper()


def codigo_valido(codigo: str) -> bool:
    return bool(PATRON_CODIGO.match(codigo)) and len(codigo) <= 30


def leer_estado(texto: str) -> str | None:
    """ "Bueno" → "operativo". None si no se reconoce."""
    return _ESTADO_DE.get(aplanar(texto))


_MESES = {m: i for i, m in enumerate("ene feb mar abr may jun jul ago sep oct nov dic".split(), start=1)}
_MESES.update(set=9, jan=1, apr=4, aug=8, dec=12)


def leer_fecha(texto: str) -> date | None:
    """Acepta 05/03/2024, 5-3-24, 2024-03-05, "2024-03-05 00:00" y "5 de marzo de 2024"."""
    t = str(texto).strip()
    if not t:
        return None
    m = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$", t)
    if m:
        anio, mes, dia = (int(g) for g in m.groups())
    else:
        m = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$", t)
        if m:
            dia, mes, anio = (int(g) for g in m.groups())
        else:
            m = re.match(
                r"^(\d{1,2})(?:\s+de)?[\s\-/]+([a-z]{3})[a-z]*\.?(?:\s+de)?[\s\-/]+(\d{2}|\d{4})$",
                aplanar(t),
            )
            if not m or m.group(2) not in _MESES:
                return None
            dia, mes, anio = int(m.group(1)), _MESES[m.group(2)], int(m.group(3))
        if anio < 100:
            anio += 2000 if anio < 70 else 1900
    try:
        fecha = date(anio, mes, dia)
    except ValueError:
        return None
    return fecha if 1950 <= fecha.year <= datetime.now().year + 1 else None


def numero_de_aula(texto: str) -> str | None:
    """ "Lab. 41", "LAB-41", "Laboratorio 41", "Aula 41" → "41" """
    m = re.match(
        r"^(?:lab|laboratorio|aula|sala)\s*(?:de\s+computo\s*)?(?:n|no|nro|numero)?\s*(\d{1,3})$",
        aplanar(texto),
    )
    return m.group(1) if m else None


# ── Títulos ─────────────────────────────────────────────


def _puntos_titulo(celda: str) -> tuple[str, int] | None:
    """A qué campo se parece el título de una columna, y qué tan seguro (100 = igual)."""
    texto = aplanar(celda)
    if not texto or len(texto) > 40:
        return None
    mejor = None
    for campo, titulos in TITULOS.items():
        for titulo in titulos:
            if texto == titulo:
                puntos = 100 + len(titulo)
            elif len(titulo) >= 4 and re.search(rf"\b{re.escape(titulo)}\b", texto):
                # "Código SIAF" contiene "codigo": vale, pero menos (y más cuanto más largo el parecido).
                puntos = 50 + len(titulo)
            else:
                continue
            if mejor is None or puntos > mejor[1]:
                mejor = (campo, puntos)
    return mejor


def buscar_titulos(tabla: list[list[str]]) -> int | None:
    """La fila de los títulos (entre las primeras): la que más columnas reconocibles tiene.

    Con un solo título reconocible también vale, si esa fila no tiene ningún número
    (una fila de datos casi siempre trae el código).
    """
    mejor, mejor_cuenta = None, 0
    for i, fila in enumerate(tabla[:15]):
        campos = {p[0] for p in map(_puntos_titulo, fila) if p}
        sin_numeros = not any(re.search(r"\d", celda) for celda in fila)
        if len(campos) > mejor_cuenta and (len(campos) >= 2 or sin_numeros):
            mejor, mejor_cuenta = i, len(campos)
    return mejor


# ── Contenido ───────────────────────────────────────────


def _perfil(valores: list[str], conocidos: dict) -> dict:
    """Qué hay en una columna: proporción de fechas, estados, lugares conocidos, etc."""
    llenos = [v for v in valores if v]
    n = len(llenos) or 1
    planos = [aplanar(v) for v in llenos]

    def parte(condicion) -> float:
        return sum(1 for x in condicion if x) / n

    codigos = [limpiar_codigo(v) for v in llenos]
    enteros = [int(v) for v in llenos if v.isdigit()]
    return {
        "llenos": len(llenos),
        "ocupacion": len(llenos) / (len(valores) or 1),
        "unicos": len(set(planos)) / n,
        "distintos": len(set(planos)),
        "largo": sum(len(v) for v in llenos) / n,
        "con_espacios": parte(" " in v.strip() for v in llenos),
        "con_letras": parte(re.search(r"[a-zA-Z]", v) for v in llenos),
        "fechas": parte(leer_fecha(v) for v in llenos),
        "estados": parte(p in _ESTADO_DE for p in planos),
        "lugares": parte(p in conocidos["lugares"] or numero_de_aula(p) for p in planos),
        "palabras_lugar": parte(any(p.startswith(w) or f" {w}" in p for w in PALABRAS_LUGAR) for p in planos),
        "tipos": parte(p in conocidos["tipos"] or p.rstrip("s") in conocidos["tipos"] for p in planos),
        "palabras_tipo": parte(
            p.split(" ")[0].rstrip("s") in PALABRAS_TIPO or p.split(" ")[0] in PALABRAS_TIPO for p in planos
        ),
        "marcas": parte(p in MARCAS for p in planos),
        "codigos": parte(codigo_valido(c) and re.search(r"\d", c) and len(c) >= 3 for c in codigos),
        "letra_y_numeros": parte(re.match(r"^[A-Z]{1,4}-?\d{2,}$", c) for c in codigos),
        "mixtos": parte(re.search(r"\d", c) and re.search(r"[A-Z]", c) for c in codigos),
        # 1, 2, 3… es el número de fila de la planilla, no un código.
        "correlativo": len(enteros) == len(llenos) > 2
        and enteros == list(range(enteros[0], enteros[0] + len(enteros))),
    }


def _puntos_contenido(p: dict) -> dict[str, float]:
    """Qué tan probable es que una columna sea cada campo, mirando solo sus datos (0 a 1)."""
    if p["llenos"] == 0:
        return {}
    puntos: dict[str, float] = {}
    es_texto = p["con_letras"] >= 0.7
    if p["fechas"] >= 0.8:
        puntos["fecha_adquisicion"] = p["fechas"]
        return puntos  # una columna de fechas no es otra cosa
    if p["estados"] >= 0.8 and p["distintos"] <= 8:
        puntos["estado"] = 0.6 + 0.4 * p["estados"]
    if p["lugares"] >= 0.5:
        puntos["lugar"] = 0.6 + 0.4 * p["lugares"]
    elif p["palabras_lugar"] >= 0.6 and p["unicos"] <= 0.6:
        puntos["lugar"] = 0.5 * p["palabras_lugar"]
    if p["marcas"] >= 0.5:
        puntos["marca"] = 0.6 + 0.4 * p["marcas"]
    if p["tipos"] >= 0.5 and p["unicos"] <= 0.7:
        puntos["tipo"] = 0.6 + 0.4 * p["tipos"]
    elif p["palabras_tipo"] >= 0.6 and p["unicos"] <= 0.5 and p["largo"] <= 25:
        puntos["tipo"] = 0.5 * p["palabras_tipo"]
    if p["codigos"] >= 0.85 and p["unicos"] >= 0.95 and not p["correlativo"] and p["largo"] <= 20:
        # Entre dos columnas con pinta de código, gana la de "una letra y números".
        puntos["codigo"] = 0.5 + 0.3 * p["letra_y_numeros"] + 0.1 * p["ocupacion"]
        puntos["serie"] = 0.3 + 0.2 * p["mixtos"] + min(p["largo"], 20) / 100
    elif p["codigos"] >= 0.6 and p["mixtos"] >= 0.5 and p["unicos"] < 0.95 and p["largo"] <= 25:
        puntos["modelo"] = 0.3 + 0.2 * p["mixtos"]
    if es_texto and p["largo"] >= 8 and "estado" not in puntos and "lugar" not in puntos:
        # La descripción es el texto más largo y casi siempre está llena.
        puntos["descripcion"] = min(0.9, 0.2 + p["largo"] / 60 + 0.2 * p["con_espacios"]) * (
            0.5 + 0.5 * p["ocupacion"]
        )
        if p["ocupacion"] < 0.7 and p["con_espacios"] >= 0.5:
            puntos["observaciones"] = 0.35
    return puntos


def detectar(tabla: list[list[str]], conocidos: dict, con_titulos: bool | None = None) -> dict:
    """Devuelve dónde empiezan los datos y qué campo es cada columna.

    `conocidos` = {"lugares": {...}, "tipos": {...}} con los nombres aplanados que ya existen.
    `con_titulos`: None = averiguarlo; True/False = lo que dijo la persona.

    Resultado: {"fila_titulos": int | None, "inicio": int, "campos": [campo | None por columna]}
    """
    columnas = len(tabla[0]) if tabla else 0
    fila_titulos = buscar_titulos(tabla) if con_titulos is not False else None
    if con_titulos and fila_titulos is None:
        fila_titulos = 0
    inicio = 0 if fila_titulos is None else fila_titulos + 1
    datos = tabla[inicio : inicio + 300]

    candidatos: list[tuple[float, int, str]] = []  # (puntos, columna, campo)
    for c in range(columnas):
        titulo = _puntos_titulo(tabla[fila_titulos][c]) if fila_titulos is not None else None
        if titulo:
            # Un título reconocido pesa más que cualquier pista del contenido.
            candidatos.append((10 + titulo[1] / 100, c, titulo[0]))
        for campo, puntos in _puntos_contenido(_perfil([f[c] for f in datos], conocidos)).items():
            candidatos.append((puntos, c, campo))

    campos: list[str | None] = [None] * columnas
    usados: set[str] = set()
    # De mayor a menor seguridad; a igualdad, la columna de más a la izquierda.
    for puntos, c, campo in sorted(candidatos, key=lambda x: (-x[0], x[1])):
        if puntos < 0.3 or campos[c] is not None or campo in usados:
            continue
        campos[c] = campo
        usados.add(campo)

    # El modelo suele estar justo a la derecha de la marca.
    if "marca" in usados and "modelo" not in usados:
        derecha = campos.index("marca") + 1
        if derecha < columnas and campos[derecha] is None and any(f[derecha] for f in datos):
            campos[derecha] = "modelo"
    return {"fila_titulos": fila_titulos, "inicio": inicio, "campos": campos}
