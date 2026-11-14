"""Lista de reportes. Agregar un reporte = su consulta en selectors.py + una entrada aquí.

`generar()` no depende de la petición HTTP: recibe filtros ya validados y el
usuario, y devuelve un dict. Así se puede pasar a una tarea de Celery más adelante.
"""

from collections.abc import Callable
from dataclasses import dataclass, field

from django.utils import timezone

from apps.asistencia.models import CategoriaAsistencia
from apps.bitacora.models import TipoEntrada
from apps.core.roles import Rol
from apps.laboratorios.models import CategoriaElemento, EstadoElemento, Laboratorio, TipoElemento
from apps.objetos_perdidos.models import CategoriaObjeto, EstadoObjeto
from apps.planificacion.models import EstadoReserva
from apps.usuarios.models import Usuario

from . import selectors

# Tipos de filtro
FECHA = "fecha"
LABORATORIO = "laboratorio"
OPCION = "opcion"  # una de una lista fija (choices)
TIPO_ELEMENTO = "tipo_elemento"
USUARIO = "usuario"


@dataclass(frozen=True)
class Filtro:
    clave: str
    etiqueta: str
    tipo: str
    choices: type | None = None  # para OPCION
    multiple: bool = False
    por_defecto: tuple = ()


@dataclass(frozen=True)
class Reporte:
    codigo: str
    titulo: str
    descripcion: str
    permiso: str
    funcion: Callable[[dict], dict]
    filtros: tuple[Filtro, ...] = field(default_factory=tuple)

    @property
    def con_fechas(self) -> bool:
        return any(f.tipo == FECHA for f in self.filtros)


DESDE = Filtro("desde", "Desde", FECHA)
HASTA = Filtro("hasta", "Hasta", FECHA)
LAB = Filtro("laboratorio", "Laboratorio", LABORATORIO)

REPORTES: tuple[Reporte, ...] = (
    Reporte(
        "r1",
        "Ocupación de laboratorios",
        "Horas de clase y de reserva frente a las horas de atención de cada laboratorio.",
        "reportes.ver",
        selectors.ocupacion,
        (DESDE, HASTA, LAB),
    ),
    Reporte(
        "r2",
        "Reservas",
        "Reservas por estado y laboratorio, con el tiempo que tardó cada aprobación.",
        "reportes.ver",
        selectors.reservas,
        (DESDE, HASTA, LAB, Filtro("estado", "Estado", OPCION, EstadoReserva)),
    ),
    Reporte(
        "r3",
        "Solicitudes de asistencia",
        "Solicitudes a los auxiliares y sus tiempos de respuesta y resolución.",
        "reportes.ver",
        selectors.asistencia,
        (DESDE, HASTA, LAB, Filtro("categoria", "Categoría", OPCION, CategoriaAsistencia)),
    ),
    Reporte(
        "r4",
        "Inventario de equipos",
        "Situación actual de los equipos de cada laboratorio.",
        "reportes.ver",
        selectors.inventario,
        (
            LAB,
            Filtro("tipo", "Tipo", TIPO_ELEMENTO),
            Filtro(
                "categoria",
                "Categoría",
                OPCION,
                CategoriaElemento,
                multiple=True,
                por_defecto=tuple(selectors.CATEGORIAS_EQUIPOS),
            ),
            Filtro("estado", "Estado", OPCION, EstadoElemento),
        ),
    ),
    Reporte(
        "r5",
        "Bitácora",
        "Trabajos registrados en la bitácora, por laboratorio, tipo y autor.",
        "reportes.ver",
        selectors.bitacora,
        (DESDE, HASTA, LAB, Filtro("tipo", "Tipo", OPCION, TipoEntrada), Filtro("autor", "Autor", USUARIO)),
    ),
    Reporte(
        "r6",
        "Objetos perdidos",
        "Objetos registrados, entregados y en custodia, con los días que pasaron guardados.",
        "reportes.ver",
        selectors.objetos_perdidos,
        (
            DESDE,
            HASTA,
            LAB,
            Filtro("categoria", "Categoría", OPCION, CategoriaObjeto),
            Filtro("estado", "Estado", OPCION, EstadoObjeto),
        ),
    ),
)

CATALOGO: dict[str, Reporte] = {r.codigo: r for r in REPORTES}


def obtener(codigo: str) -> Reporte | None:
    return CATALOGO.get(codigo.lower())


# ── Opciones de los filtros (para la pantalla) ──────────


def autores():
    """Quienes pueden escribir en la bitácora."""
    return Usuario.objects.filter(rol__in=[Rol.SUPERADMIN, Rol.ADMIN, Rol.AUXILIAR]).order_by(
        "apellidos", "nombres"
    )


def opciones(filtro: Filtro) -> list[dict]:
    if filtro.tipo == OPCION:
        return [{"valor": v, "etiqueta": e} for v, e in filtro.choices.choices]
    if filtro.tipo == LABORATORIO:
        return [
            {"valor": lab.id, "etiqueta": f"{lab.codigo} · {lab.nombre}"}
            for lab in Laboratorio.objects.filter(activo=True).order_by("codigo")
        ]
    if filtro.tipo == TIPO_ELEMENTO:
        return [{"valor": t.id, "etiqueta": t.nombre} for t in TipoElemento.objects.order_by("nombre")]
    if filtro.tipo == USUARIO:
        return [{"valor": u.id, "etiqueta": u.nombre_completo} for u in autores()]
    return []


def describir(reporte: Reporte) -> dict:
    return {
        "codigo": reporte.codigo,
        "titulo": reporte.titulo,
        "descripcion": reporte.descripcion,
        "con_fechas": reporte.con_fechas,
        "filtros": [
            {
                "clave": f.clave,
                "etiqueta": f.etiqueta,
                "tipo": f.tipo,
                "multiple": f.multiple,
                "por_defecto": list(f.por_defecto),
                "opciones": opciones(f),
            }
            for f in reporte.filtros
        ],
    }


# ── Generación ──────────────────────────────────────────


def _texto_filtro(filtro: Filtro, valor) -> str:
    if valor in (None, "", [], ()):
        return "Todos los activos" if filtro.tipo == LABORATORIO else "Todos"
    if filtro.tipo == FECHA:
        return valor.strftime("%d/%m/%Y")
    if filtro.tipo == LABORATORIO:
        return f"{valor.codigo} · {valor.nombre}"
    if filtro.tipo == TIPO_ELEMENTO:
        return valor.nombre
    if filtro.tipo == USUARIO:
        return valor.nombre_completo
    etiquetas = dict(filtro.choices.choices)
    if filtro.multiple:
        return ", ".join(etiquetas.get(v, v) for v in valor)
    return etiquetas.get(valor, valor)


def _valor_crudo(filtro: Filtro, valor):
    if valor in (None, "", [], ()):
        return None
    if filtro.tipo == FECHA:
        return valor.isoformat()
    if filtro.tipo in (LABORATORIO, TIPO_ELEMENTO, USUARIO):
        return valor.pk
    return list(valor) if filtro.multiple else valor


def generar(reporte: Reporte, filtros: dict, usuario) -> dict:
    """Cabecera + secciones + notas. Ver docs/cu24-reportes.md, sección 4."""
    cuerpo = reporte.funcion(filtros)
    return {
        "codigo": reporte.codigo,
        "titulo": reporte.titulo,
        "filtros": [
            {
                "clave": f.clave,
                "etiqueta": f.etiqueta,
                "valor": _valor_crudo(f, filtros.get(f.clave)),
                "texto": _texto_filtro(f, filtros.get(f.clave)),
            }
            for f in reporte.filtros
        ],
        "generado_en": timezone.localtime(),
        "generado_por": usuario.nombre_completo,
        "secciones": cuerpo["secciones"],
        "notas": cuerpo.get("notas", []),
    }


def nombre_archivo(reporte: Reporte, filtros: dict, extension: str) -> str:
    if reporte.con_fechas:
        sufijo = f"{filtros['desde'].isoformat()}_{filtros['hasta'].isoformat()}"
    else:
        sufijo = timezone.localdate().isoformat()  # R4: situación al día de hoy
    return f"reporte-{reporte.codigo}-{sufijo}.{extension}"
