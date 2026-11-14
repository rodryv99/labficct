from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from apps.core.permisos import tiene_permiso
from apps.core.permissions import TienePermiso

from . import catalogo
from .exportadores import excel, pdf
from .serializers import FORMATOS, validar_filtros, validar_formato

EXPORTADORES = {"xlsx": excel.generar, "pdf": pdf.generar}


class ReporteViewSet(viewsets.ViewSet):
    """CU24. Reportes generados en el momento, en JSON (pantalla), Excel o PDF.

    `reportes.ver` abre la sección; además, cada reporte declara su propio permiso
    en catalogo.py (hoy todos usan `reportes.ver`).
    """

    permission_classes = [TienePermiso]
    permisos = {"list": "reportes.ver", "retrieve": "reportes.ver", "exportar": "reportes.ver"}
    lookup_field = "codigo"
    lookup_value_regex = "[^/]+"

    def _reporte(self, codigo) -> catalogo.Reporte:
        reporte = catalogo.obtener(codigo)
        if reporte is None:
            raise NotFound("Ese reporte no existe.")
        if not tiene_permiso(self.request.user, reporte.permiso):
            raise PermissionDenied("No tienes permiso para ver este reporte.")
        return reporte

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def list(self, request):
        """Reportes que el usuario puede ver, con sus filtros y opciones."""
        return Response(
            [catalogo.describir(r) for r in catalogo.REPORTES if tiene_permiso(request.user, r.permiso)]
        )

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def retrieve(self, request, codigo=None):
        """Datos del reporte para mostrarlos en pantalla."""
        reporte = self._reporte(codigo)
        filtros = validar_filtros(reporte, request.query_params)
        return Response(catalogo.generar(reporte, filtros, request.user))

    @extend_schema(
        parameters=[OpenApiParameter("formato", str, enum=[*FORMATOS], required=True)],
        responses={(200, "application/octet-stream"): OpenApiTypes.BINARY},
    )
    @action(detail=True, methods=["get"])
    def exportar(self, request, codigo=None):
        """El reporte como archivo para descargar (?formato=xlsx|pdf)."""
        reporte = self._reporte(codigo)
        formato = validar_formato(request.query_params.get("formato"))
        filtros = validar_filtros(reporte, request.query_params)
        contenido = EXPORTADORES[formato](catalogo.generar(reporte, filtros, request.user))
        respuesta = HttpResponse(contenido, content_type=FORMATOS[formato])
        nombre = catalogo.nombre_archivo(reporte, filtros, formato)
        respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
        return respuesta
