"""API del módulo de reportes (solo Admin/Superadmin).

- `GET  reportes/`                     catálogo + opciones de filtro
- `GET  reportes/dashboard/`           tarjetas y gráficos de portada
- `GET  reportes/<id>/`                datos de un reporte (tabla + gráficos + KPI)
- `GET  reportes/<id>/exportar/`       descarga (?formato=xlsx|csv|pdf|docx)
- `GET  reportes/pivote/meta/`         entidades/dimensiones/medidas del constructor
- `POST reportes/pivote/`              construir una tabla dinámica
- `POST reportes/pivote/exportar/`     descargar la tabla dinámica
"""

from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.errores import ErrorNegocio
from apps.core.permissions import TienePermiso

from . import dashboard, pivote
from .catalogo import catalogo, obtener
from .consulta import Filtros, parsear
from .exportacion import exportar
from .selectors import laboratorios_disponibles, periodos_disponibles
from .serializacion import serializar

_PERMISO = {"get": "reportes.ver", "post": "reportes.ver"}


def _fecha(valor):
    from .consulta import _fecha as parse

    return parse(valor)


def _texto_filtros(f: Filtros, total: int) -> str:
    partes = []
    if f.desde and f.hasta:
        partes.append(f"Del {f.desde:%d/%m/%Y} al {f.hasta:%d/%m/%Y}")
    elif f.desde:
        partes.append(f"Desde el {f.desde:%d/%m/%Y}")
    elif f.hasta:
        partes.append(f"Hasta el {f.hasta:%d/%m/%Y}")
    if f.laboratorio:
        from apps.laboratorios.models import Laboratorio

        lab = Laboratorio.objects.filter(pk=f.laboratorio).first()
        if lab:
            partes.append(f"Lab: {lab.nombre}")
    partes.append(f"{total} {'fila' if total == 1 else 'filas'}")
    partes.append(timezone.localtime().strftime("%d/%m/%Y %H:%M"))
    return " · ".join(partes)


class CatalogoView(APIView):
    permission_classes = [TienePermiso]
    permisos = _PERMISO

    @extend_schema(responses=None)
    def get(self, request):
        return Response({
            "grupos": catalogo(),
            "filtros": {
                "laboratorios": laboratorios_disponibles(),
                "periodos": periodos_disponibles(),
            },
        })


class DashboardView(APIView):
    permission_classes = [TienePermiso]
    permisos = _PERMISO

    @extend_schema(responses=None)
    def get(self, request):
        return Response(serializar(dashboard.resumen()))


class ReporteDatosView(APIView):
    permission_classes = [TienePermiso]
    permisos = _PERMISO

    @extend_schema(responses=None)
    def get(self, request, reporte_id):
        reporte = obtener(reporte_id)
        if not reporte:
            raise ErrorNegocio("Reporte no encontrado.", codigo="reporte_invalido", status_code=404)
        filtros = parsear(request.query_params, reporte.filtros)
        datos = serializar(reporte.selector(filtros))
        datos["reporte"] = {"id": reporte.id, "nombre": reporte.nombre, "descripcion": reporte.descripcion}
        return Response(datos)


class ReporteExportarView(APIView):
    permission_classes = [TienePermiso]
    permisos = _PERMISO

    @extend_schema(responses=None)
    def get(self, request, reporte_id):
        reporte = obtener(reporte_id)
        if not reporte:
            raise ErrorNegocio("Reporte no encontrado.", codigo="reporte_invalido", status_code=404)
        formato = request.query_params.get("formato", "pdf")
        filtros = parsear(request.query_params, reporte.filtros)
        resultado = reporte.selector(filtros)
        subtitulo = _texto_filtros(filtros, resultado.total)
        base = f"{reporte.id}-{timezone.localdate():%Y-%m-%d}"
        contenido, mime, nombre = exportar(base, reporte.nombre, subtitulo, resultado, formato)
        return _descarga(contenido, mime, nombre)


class PivoteMetaView(APIView):
    permission_classes = [TienePermiso]
    permisos = _PERMISO

    @extend_schema(responses=None)
    def get(self, request):
        return Response({
            "entidades": pivote.meta(),
            "filtros": {
                "laboratorios": laboratorios_disponibles(),
                "periodos": periodos_disponibles(),
            },
        })


def _filtros_de_cuerpo(data) -> Filtros:
    f = Filtros()
    f.desde = _fecha(data.get("desde"))
    f.hasta = _fecha(data.get("hasta"))
    lab = data.get("laboratorio")
    f.laboratorio = int(lab) if str(lab or "").isdigit() else None
    return f


def _construir_pivote(data):
    entidad = data.get("entidad")
    dim_filas = data.get("filas")
    dim_columnas = data.get("columnas") or None
    medida = data.get("medida", "conteo")
    if not entidad or not dim_filas:
        raise ErrorNegocio("Falta la entidad o la dimensión de filas.", codigo="pivote_incompleto")
    filtros = _filtros_de_cuerpo(data)
    resultado = pivote.construir(entidad, dim_filas, dim_columnas, medida, filtros)
    return resultado, filtros


class PivoteDatosView(APIView):
    permission_classes = [TienePermiso]
    permisos = _PERMISO

    @extend_schema(request=None, responses=None)
    def post(self, request):
        resultado, _filtros = _construir_pivote(request.data)
        return Response(serializar(resultado))


class PivoteExportarView(APIView):
    permission_classes = [TienePermiso]
    permisos = _PERMISO

    @extend_schema(request=None, responses=None)
    def post(self, request):
        resultado, filtros = _construir_pivote(request.data)
        formato = request.query_params.get("formato") or request.data.get("formato") or "pdf"
        subtitulo = _texto_filtros(filtros, resultado.total)
        base = f"reporte-dinamico-{timezone.localdate():%Y-%m-%d}"
        contenido, mime, nombre = exportar(base, "Reporte dinámico", subtitulo, resultado, formato)
        return _descarga(contenido, mime, nombre)


def _descarga(contenido: bytes, mime: str, nombre: str) -> HttpResponse:
    respuesta = HttpResponse(contenido, content_type=mime)
    respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
    respuesta["Content-Length"] = len(contenido)
    return respuesta
