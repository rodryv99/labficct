from django.http import FileResponse, Http404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import TienePermiso

from . import services
from .models import Respaldo
from .serializers import GenerarRespaldoSerializer, RespaldoSerializer


class RespaldoViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Respaldos de la base de datos. Solo el Admin los ve, genera, descarga y elimina."""

    serializer_class = RespaldoSerializer
    permission_classes = [TienePermiso]
    permisos = {
        "list": "respaldos.ver",
        "estado": "respaldos.ver",
        "generar": "respaldos.gestionar",
        "descargar": "respaldos.ver",
        "destroy": "respaldos.gestionar",
    }
    pagination_class = None
    queryset = Respaldo.objects.select_related("creado_por").all()
    ordering = ["-creado_en"]

    @extend_schema(request=None, responses={"type": "object"})
    @action(detail=False, methods=["get"])
    def estado(self, request):
        """Si el servidor puede crear respaldos (si tiene pg_dump) y cuántos hay guardados."""
        return Response(
            {
                "pg_dump_disponible": services.pg_dump_disponible(),
                "maximos": services.maximos(),
                "total": Respaldo.objects.count(),
            }
        )

    @extend_schema(request=GenerarRespaldoSerializer, responses=RespaldoSerializer)
    @action(detail=False, methods=["post"])
    def generar(self, request):
        """Crea un respaldo ahora con pg_dump."""
        serializer = GenerarRespaldoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        respaldo = services.generar(
            usuario=request.user, origen="manual", nota=serializer.validated_data.get("nota", "")
        )
        return Response(RespaldoSerializer(respaldo).data, status=status.HTTP_201_CREATED)

    @extend_schema(responses=None)
    @action(detail=True, methods=["get"])
    def descargar(self, request, pk=None):
        """Descarga el archivo .sql de un respaldo."""
        respaldo = self.get_object()
        ruta = services.ruta_de(respaldo)
        if not ruta.exists():
            raise Http404("El archivo del respaldo ya no está en el servidor.")
        respuesta = FileResponse(
            open(ruta, "rb"), as_attachment=True, filename=respaldo.archivo, content_type="application/sql"
        )
        return respuesta

    def perform_destroy(self, instance):
        services.eliminar(instance)
