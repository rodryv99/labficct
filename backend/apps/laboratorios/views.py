from django.db.models import Count, Prefetch
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.mixins import AuditoriaMixin
from apps.core.permissions import TienePermiso, permisos_crud

from . import services
from .models import CredencialLaboratorio, ElementoLaboratorio, Laboratorio, Software, TipoElemento
from .serializers import (
    CeldaSerializer,
    CredencialSerializer,
    DistribucionSerializer,
    LaboratorioCrearSerializer,
    LaboratorioSerializer,
    SoftwareLaboratorioSerializer,
    SoftwareSerializer,
    TipoElementoSerializer,
)


class TipoElementoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    """2. Elementos: el catálogo de cosas que se colocan en un laboratorio."""

    serializer_class = TipoElementoSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud("elementos.ver", "elementos.gestionar")
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["categoria", "activo"]
    search_fields = ["nombre", "descripcion"]
    ordering_fields = ["nombre", "categoria", "en_uso"]
    ordering = ["nombre"]

    def get_queryset(self):
        return TipoElemento.objects.annotate(en_uso=Count("ubicados"))


class SoftwareViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    serializer_class = SoftwareSerializer
    permission_classes = [TienePermiso]
    # Agregar un programa lo puede hacer quien marca el software de los laboratorios
    # (el auxiliar); editarlo o borrarlo del catálogo, solo el administrador.
    permisos = permisos_crud("software.ver", "software.gestionar", create="laboratorios.software")
    search_fields = ["nombre", "version"]
    ordering = ["nombre", "version"]

    def get_queryset(self):
        return Software.objects.annotate(total_laboratorios=Count("laboratorios"))


class LaboratorioViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    """3. Laboratorios: ficha, software instalado y distribución en grilla."""

    permission_classes = [TienePermiso]
    permisos = permisos_crud(
        "laboratorios.ver",
        "laboratorios.gestionar",
        software="laboratorios.software",
        **{
            "distribucion:get": "laboratorios.ver",
            "distribucion:put": "laboratorios.gestionar",
        },
    )
    filterset_fields = ["estado", "activo"]
    search_fields = ["codigo", "nombre", "ubicacion"]
    ordering_fields = ["codigo", "nombre", "capacidad"]
    ordering = ["codigo"]

    def get_serializer_class(self):
        if self.action == "create":
            return LaboratorioCrearSerializer
        return LaboratorioSerializer

    def get_queryset(self):
        elementos = ElementoLaboratorio.objects.only("id", "laboratorio_id", "fila", "columna", "tipo_id")
        return (
            Laboratorio.objects.annotate(total_elementos=Count("elementos", distinct=True))
            .prefetch_related(Prefetch("elementos", queryset=elementos), "software")
        )

    @extend_schema(methods=["GET"], responses=DistribucionSerializer)
    @extend_schema(methods=["PUT"], request=DistribucionSerializer, responses=DistribucionSerializer)
    @action(detail=True, methods=["get", "put"])
    def distribucion(self, request, pk=None):
        laboratorio = self.get_object()
        if request.method == "GET":
            datos = services.distribucion(laboratorio)
        else:
            serializer = DistribucionSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            datos = services.guardar_distribucion(
                laboratorio=laboratorio,
                usuario=request.user,
                **serializer.validated_data,
            )
        return Response(
            {
                "filas": datos["filas"],
                "columnas": datos["columnas"],
                "celdas": CeldaSerializer(datos["celdas"], many=True).data,
            }
        )

    @extend_schema(request=SoftwareLaboratorioSerializer, responses=LaboratorioSerializer)
    @action(detail=True, methods=["put"])
    def software(self, request, pk=None):
        """Programas instalados en el laboratorio: {"software": [1, 4, 7]}. Solo cambia eso,
        así el auxiliar lo mantiene al día sin poder editar el resto de la ficha."""
        laboratorio = self.get_object()
        serializer = SoftwareLaboratorioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        laboratorio.software.set(serializer.validated_data["software"])
        laboratorio.actualizado_por = request.user
        laboratorio.save(update_fields=["actualizado_por", "actualizado_en"])
        return Response(LaboratorioSerializer(self.get_queryset().get(pk=laboratorio.pk)).data)


class CredencialViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    """Credenciales de cada laboratorio. La contraseña se guarda cifrada y
    solo se muestra con la acción `revelar`, que queda registrada."""

    serializer_class = CredencialSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud(
        "laboratorios.credenciales",
        "laboratorios.gestionar",
        revelar="laboratorios.credenciales",
    )
    filterset_fields = ["laboratorio"]
    pagination_class = None

    def get_queryset(self):
        return CredencialLaboratorio.objects.select_related("laboratorio")

    def perform_create(self, serializer):
        password = serializer.validated_data.pop("password", None)
        credencial = CredencialLaboratorio(
            **serializer.validated_data,
            creado_por=self.request.user,
            actualizado_por=self.request.user,
        )
        serializer.instance = services.guardar_credencial(credencial=credencial, password=password)

    def perform_update(self, serializer):
        password = serializer.validated_data.pop("password", None)
        credencial = serializer.instance
        for campo, valor in serializer.validated_data.items():
            setattr(credencial, campo, valor)
        credencial.actualizado_por = self.request.user
        services.guardar_credencial(credencial=credencial, password=password)

    @extend_schema(
        request=None,
        responses=inline_serializer("Revelado", {"password": serializers.CharField()}),
    )
    @action(detail=True, methods=["post"])
    def revelar(self, request, pk=None):
        password = services.revelar_credencial(credencial=self.get_object(), usuario=request.user)
        return Response({"password": password}, status=status.HTTP_200_OK)
