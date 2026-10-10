import django_filters
from django.db.models import OuterRef, Subquery
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.errores import ErrorNegocio
from apps.core.mixins import AuditoriaMixin
from apps.core.permisos import tiene_permiso
from apps.core.permissions import TienePermiso, permisos_crud

from . import services
from .models import EntradaBitacora, RevisionProgramada
from .serializers import EntradaBitacoraSerializer, RealizarRevisionSerializer, RevisionSerializer


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
    permisos = permisos_crud("bitacora.ver", "bitacora.gestionar")
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
