"""Constructor dinámico de reportes (tabla pivote).

El Admin elige una entidad (reservas, tareas, equipos…), una dimensión para las
filas, opcionalmente otra para las columnas, y una medida (contar, promedio…).
El servidor arma la tabla agregada, con un gráfico.

Las entidades, dimensiones y medidas están en una lista blanca: solo se puede
agrupar y medir por lo que está declarado aquí, nunca por un campo arbitrario.
"""

from django.db.models import Avg, Count
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek

from apps.asistencia.models import CategoriaAsistencia, EstadoSolicitud, SolicitudAsistencia
from apps.bitacora.models import EntradaBitacora, TipoEntrada
from apps.inventario.models import Activo, EstadoActivo
from apps.laboratorios.models import ElementoLaboratorio, EstadoElemento
from apps.marcaciones.models import Marcacion
from apps.objetos_perdidos.models import CategoriaObjeto, EstadoObjeto, ObjetoPerdido
from apps.planificacion.models import EstadoReserva, Reserva
from apps.tareas.models import EstadoTarea, Prioridad, Tarea

from .base import BARRAS, BARRAS_APILADAS, NUMERO, TEXTO, Columna, Grafico, Resultado, color, serie
from .consulta import Filtros
from .selectors import _periodo_label

_TRUNC = {"dia": TruncDay, "semana": TruncWeek, "mes": TruncMonth}
_MAX_COLUMNAS = 20
_MAX_FILAS = 200


def _dim(label, campo, etiquetas=None, trunc=None):
    return {"label": label, "campo": campo, "etiquetas": etiquetas, "trunc": trunc}


def _medida(label, expr, tipo=NUMERO):
    return {"label": label, "expr": expr, "tipo": tipo}


_CONTEO = _medida("Cantidad", Count("id"))
_FECHA_MES = _dim("Mes", None, trunc="mes")
_FECHA_SEM = _dim("Semana", None, trunc="semana")


ENTIDADES: dict[str, dict] = {
    "reservas": {
        "label": "Reservas",
        "base": lambda: Reserva.objects.all(),
        "fecha": "creado_en",
        "lab": None,
        "dimensiones": {
            "estado": _dim("Estado", "estado", dict(EstadoReserva.choices)),
            "mes": {**_FECHA_MES, "campo": "creado_en"},
        },
        "medidas": {"conteo": _CONTEO},
    },
    "asistencia": {
        "label": "Solicitudes de asistencia",
        "base": lambda: SolicitudAsistencia.objects.all(),
        "fecha": "creado_en",
        "lab": "laboratorio",
        "dimensiones": {
            "estado": _dim("Estado", "estado", dict(EstadoSolicitud.choices)),
            "categoria": _dim("Categoría", "categoria", dict(CategoriaAsistencia.choices)),
            "laboratorio": _dim("Laboratorio", "laboratorio__nombre"),
            "mes": {**_FECHA_MES, "campo": "creado_en"},
        },
        "medidas": {"conteo": _CONTEO},
    },
    "bitacora": {
        "label": "Entradas de bitácora",
        "base": lambda: EntradaBitacora.objects.all(),
        "fecha": "fecha",
        "lab": "laboratorio",
        "dimensiones": {
            "tipo": _dim("Tipo", "tipo", dict(TipoEntrada.choices)),
            "laboratorio": _dim("Laboratorio", "laboratorio__nombre"),
            "mes": {**_FECHA_MES, "campo": "fecha"},
        },
        "medidas": {"conteo": _CONTEO},
    },
    "tareas": {
        "label": "Tareas",
        "base": lambda: Tarea.objects.all(),
        "fecha": "creado_en",
        "lab": "laboratorio",
        "dimensiones": {
            "estado": _dim("Estado", "estado", dict(EstadoTarea.choices)),
            "prioridad": _dim("Prioridad", "prioridad", dict(Prioridad.choices)),
            "laboratorio": _dim("Laboratorio", "laboratorio__nombre"),
        },
        "medidas": {
            "conteo": _CONTEO,
            "avance": _medida("Avance promedio (%)", Avg("progreso")),
        },
    },
    "objetos": {
        "label": "Objetos perdidos",
        "base": lambda: ObjetoPerdido.objects.all(),
        "fecha": "fecha_hallazgo",
        "lab": "laboratorio",
        "dimensiones": {
            "estado": _dim("Estado", "estado", dict(EstadoObjeto.choices)),
            "categoria": _dim("Categoría", "categoria", dict(CategoriaObjeto.choices)),
            "mes": {**_FECHA_MES, "campo": "fecha_hallazgo"},
        },
        "medidas": {"conteo": _CONTEO},
    },
    "equipos": {
        "label": "Equipos de laboratorio",
        "base": lambda: ElementoLaboratorio.objects.all(),
        "fecha": None,
        "lab": "laboratorio",
        "dimensiones": {
            "estado": _dim("Estado", "estado", dict(EstadoElemento.choices)),
            "laboratorio": _dim("Laboratorio", "laboratorio__nombre"),
            "tipo": _dim("Tipo", "tipo__nombre"),
        },
        "medidas": {"conteo": _CONTEO},
    },
    "activos": {
        "label": "Activos de inventario",
        "base": lambda: Activo.objects.all(),
        "fecha": None,
        "lab": None,
        "dimensiones": {
            "estado": _dim("Estado", "estado", dict(EstadoActivo.choices)),
            "lugar": _dim("Lugar", "lugar__nombre"),
            "tipo": _dim("Tipo", "tipo__nombre"),
        },
        "medidas": {"conteo": _CONTEO},
    },
    "marcaciones": {
        "label": "Marcaciones de asistencia",
        "base": lambda: Marcacion.objects.all(),
        "fecha": "fecha",
        "lab": None,
        "dimensiones": {
            "auxiliar": _dim("Auxiliar", "usuario__apellidos"),
            "mes": {**_FECHA_MES, "campo": "fecha"},
            "semana": {**_FECHA_SEM, "campo": "fecha"},
        },
        "medidas": {
            "conteo": _CONTEO,
            "retraso": _medida("Retraso promedio (min)", Avg("retraso_min")),
        },
    },
}


def meta() -> list[dict]:
    """Descripción serializable de las entidades, para que la web arme los selectores."""
    salida = []
    for clave, ent in ENTIDADES.items():
        salida.append({
            "id": clave,
            "label": ent["label"],
            "filtros": (["rango"] if ent["fecha"] else []) + (["laboratorio"] if ent["lab"] else []),
            "dimensiones": [{"id": k, "label": d["label"]} for k, d in ent["dimensiones"].items()],
            "medidas": [{"id": k, "label": m["label"]} for k, m in ent["medidas"].items()],
        })
    return salida


def _resolver(dim: dict, clave: str):
    """Devuelve (annotate, key, formateador) para agrupar por esta dimensión."""
    if dim.get("trunc"):
        trunc = _TRUNC[dim["trunc"]]
        key = f"_d_{clave}"
        return {key: trunc(dim["campo"])}, key, lambda v: _periodo_label(v, dim["trunc"])
    etiquetas = dim.get("etiquetas")
    if etiquetas:
        return {}, dim["campo"], lambda v: etiquetas.get(v, "—" if v in (None, "") else str(v))
    return {}, dim["campo"], lambda v: "—" if v in (None, "") else str(v)


def _num(valor):
    if valor is None:
        return 0
    if isinstance(valor, float):
        return round(valor, 1)
    try:
        return round(float(valor), 1) if valor % 1 else int(valor)
    except (TypeError, ValueError):
        return valor


def construir(entidad_id: str, dim_filas: str, dim_columnas: str | None, medida_id: str, f: Filtros) -> Resultado:
    from apps.core.errores import ErrorNegocio

    ent = ENTIDADES.get(entidad_id)
    if not ent:
        raise ErrorNegocio("Entidad no válida.", codigo="entidad_invalida")
    if dim_filas not in ent["dimensiones"]:
        raise ErrorNegocio("Dimensión de filas no válida.", codigo="dimension_invalida")
    if medida_id not in ent["medidas"]:
        raise ErrorNegocio("Medida no válida.", codigo="medida_invalida")
    if dim_columnas and dim_columnas not in ent["dimensiones"]:
        raise ErrorNegocio("Dimensión de columnas no válida.", codigo="dimension_invalida")

    qs = ent["base"]()
    if ent["fecha"]:
        qs = f.entre(qs, ent["fecha"])
    if ent["lab"] and f.laboratorio:
        qs = qs.filter(**{f"{ent['lab']}_id": f.laboratorio})

    dim_f = ent["dimensiones"][dim_filas]
    medida = ent["medidas"][medida_id]
    anot_f, key_f, fmt_f = _resolver(dim_f, "f")

    if dim_columnas:
        dim_c = ent["dimensiones"][dim_columnas]
        anot_c, key_c, fmt_c = _resolver(dim_c, "c")
        filas_bd = qs.annotate(**anot_f, **anot_c).values(key_f, key_c).annotate(v=medida["expr"])
        datos: dict = {}
        cols_vistas: list = []
        filas_vistas: list = []
        for r in filas_bd:
            fv, cv = r[key_f], r[key_c]
            datos[(fv, cv)] = r["v"]
            if cv not in cols_vistas:
                cols_vistas.append(cv)
            if fv not in filas_vistas:
                filas_vistas.append(fv)
        cols_vistas = cols_vistas[:_MAX_COLUMNAS]
        filas_vistas = filas_vistas[:_MAX_FILAS]
        columnas = [Columna("dim", dim_f["label"], TEXTO, 2)]
        columnas += [Columna(f"c{i}", fmt_c(c), NUMERO, 1) for i, c in enumerate(cols_vistas)]
        filas = []
        series = []
        for i, c in enumerate(cols_vistas):
            series.append(serie(fmt_c(c), [_num(datos.get((fv, c), 0)) for fv in filas_vistas], color(i)))
        etiquetas_x = [fmt_f(fv) for fv in filas_vistas]
        filas = [[fmt_f(fv)] + [_num(datos.get((fv, c), 0)) for c in cols_vistas] for fv in filas_vistas]
        graf = [Grafico(BARRAS_APILADAS, f"{ent['label']}: {dim_f['label']} × {dim_c['label']}",
                        etiquetas=etiquetas_x[:14], series=[{**s, "datos": s["datos"][:14]} for s in series], ancho=2)]
        return Resultado(columnas, filas, graf, [])

    filas_bd = qs.annotate(**anot_f).values(key_f).annotate(v=medida["expr"]).order_by("-v")[:_MAX_FILAS]
    etiquetas, valores, filas = [], [], []
    for r in filas_bd:
        etq = fmt_f(r[key_f])
        val = _num(r["v"])
        etiquetas.append(etq)
        valores.append(val)
        filas.append([etq, val])
    columnas = [Columna("dim", dim_f["label"], TEXTO, 2.5), Columna("v", medida["label"], NUMERO, 1)]
    graf = [Grafico(BARRAS, f"{ent['label']} por {dim_f['label'].lower()}",
                    etiquetas=etiquetas[:14], series=[serie(medida["label"], valores[:14])], ancho=2)]
    return Resultado(columnas, filas, graf, [])
