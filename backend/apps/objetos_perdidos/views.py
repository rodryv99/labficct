import mimetypes
import re

import django_filters
from django.db.models import Prefetch
from django.http import FileResponse, Http404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.permissions import TienePermiso

from . import services
from .models import FOTOS_ENTREGA, EventoObjeto, ObjetoPerdido
from .serializers import AnularSerializer, EntregarSerializer, ObjetoPerdidoSerializer

PATRON_CODIGO = re.compile(r"^(?:OP-)?(?:\d{4}-)?0*(\d+)$", re.IGNORECASE)


class BusquedaConCodigo(filters.SearchFilter):
    """Además del texto, encuentra un objeto por su código: OP-2026-0012 o 12."""

    def filter_queryset(self, request, queryset, view):
        resultado = super().filter_queryset(request, queryset, view)
        termino = request.query_params.get(self.search_param, "").strip()
        coincidencia = PATRON_CODIGO.match(termino)
        if coincidencia:
            resultado = resultado | queryset.filter(pk=int(coincidencia.group(1)))
        return resultado


class ObjetoPerdidoFilter(django_filters.FilterSet):
    desde = django_filters.DateFilter(field_name="fecha_hallazgo", lookup_expr="date__gte")
    hasta = django_filters.DateFilter(field_name="fecha_hallazgo", lookup_expr="date__lte")

    class Meta:
        model = ObjetoPerdido
        fields = ["estado", "categoria", "laboratorio"]


class ObjetoPerdidoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """7. Objetos perdidos. No hay DELETE: un registro se entrega o se anula."""

    serializer_class = ObjetoPerdidoSerializer
    permission_classes = [TienePermiso]
    permisos = {
        "list": "objetos.ver",
        "retrieve": "objetos.ver",
        "create": "objetos.registrar",
        "update": "objetos.registrar",
        "partial_update": "objetos.registrar",
        "entregar": "objetos.registrar",
        "foto_entrega": "objetos.ver",
        "anular": "objetos.anular",
    }
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filter_backends = [
        django_filters.rest_framework.DjangoFilterBackend,
        BusquedaConCodigo,
        filters.OrderingFilter,
    ]
    filterset_class = ObjetoPerdidoFilter
    search_fields = ["descripcion", "caracteristicas", "lugar", "encontrado_por", "entregado_a"]
    ordering_fields = ["fecha_hallazgo", "creado_en", "estado"]
    ordering = ["-fecha_hallazgo"]

    def get_queryset(self):
        eventos = EventoObjeto.objects.select_related("usuario")
        return ObjetoPerdido.objects.select_related(
            "laboratorio", "creado_por", "entregado_por"
        ).prefetch_related(Prefetch("eventos", queryset=eventos))

    def perform_create(self, serializer):
        serializer.instance = services.registrar(datos=serializer.validated_data, usuario=self.request.user)

    def perform_update(self, serializer):
        serializer.instance = services.editar(
            objeto=serializer.instance, datos=serializer.validated_data, usuario=self.request.user
        )

    def _detalle(self, objeto):
        return Response(self.get_serializer(self.get_queryset().get(pk=objeto.pk)).data)

    @extend_schema(request=EntregarSerializer, responses=ObjetoPerdidoSerializer)
    @action(detail=True, methods=["post"])
    def entregar(self, request, pk=None):
        serializer = EntregarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        objeto = services.entregar(objeto=self.get_object(), usuario=request.user, **serializer.validated_data)
        return self._detalle(objeto)

    @extend_schema(responses={(200, "image/*"): OpenApiTypes.BINARY})
    @action(detail=True, methods=["get"], url_path=r"entrega/(?P<nombre>ci-anverso|ci-reverso|persona)")
    def foto_entrega(self, request, pk=None, nombre=None):
        """Foto de la entrega (CI o persona). No tiene URL pública: solo sale por aquí, con sesión."""
        archivo = getattr(self.get_object(), FOTOS_ENTREGA[nombre])
        if not archivo:
            raise Http404("Esta entrega no tiene esa foto.")
        tipo = mimetypes.guess_type(archivo.name)[0] or "application/octet-stream"
        respuesta = FileResponse(archivo.open("rb"), content_type=tipo)
        respuesta["Cache-Control"] = "private, max-age=300"
        return respuesta

    @extend_schema(request=AnularSerializer, responses=ObjetoPerdidoSerializer)
    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        serializer = AnularSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        objeto = services.anular(
            objeto=self.get_object(), motivo=serializer.validated_data["motivo"], usuario=request.user
        )
        return self._detalle(objeto)
