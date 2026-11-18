import django_filters
from django.db.models import OuterRef, Subquery
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.errores import ErrorNegocio
from apps.core.mixins import AuditoriaMixin
from apps.core.permisos import tiene_permiso
from apps.core.permissions import TienePermiso, permisos_crud
from apps.laboratorios.models import Laboratorio

from . import mapa as mapa_bitacora
from . import services
from .models import EntradaBitacora, RevisionProgramada
from .serializers import (
    EntradaBitacoraSerializer,
    ImportarEntradaSerializer,
    RealizarRevisionSerializer,
    RevisionSerializer,
)


class EntradaFilter(django_filters.FilterSet):
    desde = django_filters.DateFilter(field_name="fecha", lookup_expr="date__gte")
    hasta = django_filters.DateFilter(field_name="fecha", lookup_expr="date__lte")

    class Meta:
        model = EntradaBitacora
        fields = ["laboratorio", "tipo", "revision"]


class EntradaBitacoraViewSet(viewsets.ModelViewSet):
    """Bitácora de los laboratorios. Cada quien edita o borra lo que registró; el Admin, todo."""

    serializer_class = EntradaBitacoraSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud(
        "bitacora.ver",
        "bitacora.gestionar",
        plantilla="bitacora.ver",
        exportar="bitacora.ver",
        importar="bitacora.gestionar",
    )
    filterset_class = EntradaFilter
    search_fields = ["titulo", "descripcion", "elementos", "laboratorio__codigo"]
    ordering_fields = ["fecha", "creado_en"]
    ordering = ["-fecha", "-id"]

    def get_queryset(self):
        return EntradaBitacora.objects.select_related("laboratorio", "creado_por", "revision")

    def _puede_modificar(self, entrada):
        usuario = self.request.user
        if entrada.creado_por_id != usuario.pk and not tiene_permiso(usuario, "bitacora.editar_todas"):
            raise ErrorNegocio(
                "Solo puedes cambiar las entradas que registraste tú.", codigo="no_es_tuya", status_code=403
            )

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user, actualizado_por=self.request.user)

    def perform_update(self, serializer):
        self._puede_modificar(serializer.instance)
        serializer.save(actualizado_por=self.request.user)

    def perform_destroy(self, instance):
        self._puede_modificar(instance)
        instance.delete()

    @extend_schema(parameters=[OpenApiParameter("laboratorio", int, required=True)], responses=dict)
    @action(detail=False, methods=["get"])
    def plantilla(self, request):
        """Mapa vacío con la distribución actual de un laboratorio, para empezar a pintar."""
        # Un id que no es número daría ValueError (500) en vez de 404.
        lab_id = request.query_params.get("laboratorio", "")
        laboratorio = get_object_or_404(Laboratorio, pk=int(lab_id) if lab_id.isdigit() else 0)
        return Response(mapa_bitacora.plantilla(laboratorio))

    @extend_schema(
        parameters=[OpenApiParameter("formato", str, enum=["jpg", "png", "pdf", "json"], required=False)],
        responses={(200, "application/octet-stream"): bytes},
    )
    @action(detail=True, methods=["get"])
    def exportar(self, request, pk=None):
        """Descarga la entrada como imagen (jpg/png), PDF o archivo de bitácora (json) para importarla en otro lado."""
        formato = request.query_params.get("formato", "jpg").lower()
        if formato not in ("jpg", "jpeg", "png", "pdf", "json"):
            raise ErrorNegocio("Formato no válido: usa jpg, png, pdf o json.", codigo="formato_invalido")
        contenido, tipo, nombre = mapa_bitacora.exportar(self.get_object(), formato)
        respuesta = HttpResponse(contenido, content_type=tipo)
        respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
        respuesta["Access-Control-Expose-Headers"] = "Content-Disposition"
        return respuesta

    @extend_schema(request=ImportarEntradaSerializer, responses=EntradaBitacoraSerializer)
    @action(detail=False, methods=["post"])
    def importar(self, request):
        """Crea una entrada a partir de un archivo de bitácora exportado (también desde otro equipo)."""
        serializer = ImportarEntradaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = mapa_bitacora.leer_archivo(serializer.validated_data["archivo"])
        laboratorio = serializer.validated_data.get("laboratorio")
        codigo = datos.pop("codigo_laboratorio")
        if laboratorio is None:
            laboratorio = Laboratorio.objects.filter(codigo__iexact=codigo).first() if codigo else None
            if laboratorio is None:
                raise ErrorNegocio(
                    f"No hay un laboratorio {codigo or 'con ese código'}: elige en cuál importarla.",
                    codigo="laboratorio_desconocido",
                    campos={"laboratorio": ["Elige el laboratorio."]},
                )
        entrada = EntradaBitacora.objects.create(
            laboratorio=laboratorio, creado_por=request.user, actualizado_por=request.user, **datos
        )
        return Response(self.get_serializer(entrada).data, status=status.HTTP_201_CREATED)


class RevisionViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    """Revisiones periódicas. El Admin las programa; Admin y auxiliares las registran."""

    serializer_class = RevisionSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud("revisiones.ver", "revisiones.gestionar", realizar="revisiones.realizar")
    filterset_fields = ["laboratorio", "activa", "responsable"]
    search_fields = ["titulo", "laboratorio__codigo", "laboratorio__nombre"]
    ordering_fields = ["proxima_fecha", "titulo"]
    ordering = ["proxima_fecha", "id"]

    def get_queryset(self):
        from apps.tareas.models import EstadoTarea, Tarea

        abierta = (
            Tarea.objects.filter(revision=OuterRef("pk")).exclude(estado=EstadoTarea.HECHA).values("pk")[:1]
        )
        return RevisionProgramada.objects.select_related("laboratorio", "responsable").annotate(
            tarea_abierta=Subquery(abierta)
        )

    @extend_schema(request=RealizarRevisionSerializer, responses=RevisionSerializer)
    @action(detail=True, methods=["post"])
    def realizar(self, request, pk=None):
        """Registra que la revisión se hizo hoy: queda en la bitácora y se calcula la próxima fecha."""
        serializer = RealizarRevisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revision = self.get_object()
        services.registrar_revision(
            revision=revision, usuario=request.user, nota=serializer.validated_data["nota"]
        )
        return Response(self.get_serializer(self.get_queryset().get(pk=revision.pk)).data)
