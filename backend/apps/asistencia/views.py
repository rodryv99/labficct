import django_filters
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permisos import tiene_permiso
from apps.core.permissions import TienePermiso

from . import services
from .models import ABIERTAS, SolicitudAsistencia
from .serializers import ResolverSerializer, SolicitudAsistenciaSerializer


class SolicitudFilter(django_filters.FilterSet):
    abiertas = django_filters.BooleanFilter(method="filtrar_abiertas", label="Solo pendientes y en camino")

    class Meta:
        model = SolicitudAsistencia
        fields = ["estado", "laboratorio", "urgente"]

    def filtrar_abiertas(self, queryset, name, value):
        return queryset.filter(estado__in=ABIERTAS) if value else queryset.exclude(estado__in=ABIERTAS)


class SolicitudAsistenciaViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """Solicitudes de asistencia. Docentes y administrativos ven las suyas; auxiliares y Admin, todas."""

    serializer_class = SolicitudAsistenciaSerializer
    permission_classes = [TienePermiso]
    permisos = {
        "list": "asistencia.ver",
        "retrieve": "asistencia.ver",
        "create": "asistencia.solicitar",
        "tomar": "asistencia.atender",
        "resolver": "asistencia.atender",
        "cancelar": "asistencia.ver",
    }
    filterset_class = SolicitudFilter
    search_fields = [
        "descripcion",
        "lugar",
        "laboratorio__codigo",
        "solicitante__nombres",
        "solicitante__apellidos",
    ]
    ordering_fields = ["creado_en", "urgente"]
    ordering = ["-creado_en"]

    def get_queryset(self):
        qs = SolicitudAsistencia.objects.select_related("solicitante", "laboratorio", "atendida_por")
        if not tiene_permiso(self.request.user, "asistencia.atender"):
            qs = qs.filter(solicitante=self.request.user)
        return qs

    def _respuesta(self, solicitud, codigo=status.HTTP_200_OK):
        return Response(self.get_serializer(self.get_queryset().get(pk=solicitud.pk)).data, status=codigo)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        solicitud = services.solicitar(datos=serializer.validated_data, usuario=request.user)
        return self._respuesta(solicitud, status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=SolicitudAsistenciaSerializer)
    @action(detail=True, methods=["post"])
    def tomar(self, request, pk=None):
        """El auxiliar avisa que va en camino."""
        return self._respuesta(services.tomar(solicitud=self.get_object(), usuario=request.user))

    @extend_schema(request=ResolverSerializer, responses=SolicitudAsistenciaSerializer)
    @action(detail=True, methods=["post"])
    def resolver(self, request, pk=None):
        serializer = ResolverSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        solicitud = services.resolver(
            solicitud=self.get_object(),
            usuario=request.user,
            respuesta=serializer.validated_data["respuesta"],
        )
        return self._respuesta(solicitud)

    @extend_schema(request=None, responses=SolicitudAsistenciaSerializer)
    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        return self._respuesta(services.cancelar(solicitud=self.get_object(), usuario=request.user))
