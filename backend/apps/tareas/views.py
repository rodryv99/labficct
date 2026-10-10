from datetime import timedelta

import django_filters
from django.db.models import Prefetch, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.errores import ErrorNegocio
from apps.core.permisos import tiene_permiso
from apps.core.permissions import TienePermiso, permisos_crud

from . import services
from .models import AvanceTarea, EstadoTarea, Tarea
from .serializers import (
    CambiarEstadoSerializer,
    NuevoAvanceSerializer,
    TareaDetalleSerializer,
    TareaSerializer,
)

# Las tareas hechas hace más de estos días salen del pizarrón (siguen en ?archivadas=1).
DIAS_EN_EL_PIZARRON = 14


class TareaFilter(django_filters.FilterSet):
    mias = django_filters.BooleanFilter(method="filtrar_mias", label="Solo las asignadas a mí")
    archivadas = django_filters.BooleanFilter(method="filtrar_archivadas", label="Incluir hechas hace tiempo")

    class Meta:
        model = Tarea
        fields = ["estado", "prioridad", "laboratorio", "responsables", "revision"]

    def filtrar_mias(self, queryset, name, value):
        return queryset.filter(responsables=self.request.user).distinct() if value else queryset

    def filtrar_archivadas(self, queryset, name, value):
        # Se aplica en get_queryset (list); aquí solo se declara para la documentación.
        return queryset


class TareaViewSet(viewsets.ModelViewSet):
    """Pizarrón de tareas (Admin y auxiliares). Todos ven todas y anotan avances."""

    permission_classes = [TienePermiso]
    permisos = permisos_crud(
        "tareas.ver", "tareas.gestionar", estado="tareas.gestionar", avances="tareas.gestionar"
    )
    filterset_class = TareaFilter
    search_fields = ["titulo", "descripcion", "laboratorio__codigo"]
    ordering_fields = ["actualizado_en", "fecha_limite", "creado_en"]
    ordering = ["-actualizado_en"]

    def get_serializer_class(self):
        return TareaSerializer if self.action == "list" else TareaDetalleSerializer

    def get_queryset(self):
        avances = AvanceTarea.objects.select_related("autor")
        qs = Tarea.objects.select_related(
            "laboratorio", "creado_por", "completada_por", "revision"
        ).prefetch_related("responsables", Prefetch("avances", queryset=avances))
        if self.action == "list" and self.request.query_params.get("archivadas") not in ("1", "true"):
            limite = timezone.now() - timedelta(days=DIAS_EN_EL_PIZARRON)
            qs = qs.filter(~Q(estado=EstadoTarea.HECHA) | Q(completada_en__gte=limite))
        return qs

    def _respuesta(self, tarea, codigo=status.HTTP_200_OK):
        return Response(
            TareaDetalleSerializer(
                self.get_queryset().get(pk=tarea.pk), context=self.get_serializer_context()
            ).data,
            status=codigo,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tarea = services.crear_tarea(datos=serializer.validated_data, usuario=request.user)
        return self._respuesta(tarea, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        parcial = kwargs.pop("partial", False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=parcial)
        serializer.is_valid(raise_exception=True)
        tarea = services.editar_tarea(
            tarea=serializer.instance, datos=serializer.validated_data, usuario=request.user
        )
        return self._respuesta(tarea)

    def perform_destroy(self, instance):
        usuario = self.request.user
        if instance.creado_por_id != usuario.pk and not tiene_permiso(usuario, "tareas.eliminar_todas"):
            raise ErrorNegocio(
                "Solo quien la creó o el Admin pueden borrarla.", codigo="no_es_tuya", status_code=403
            )
        instance.delete()

    @extend_schema(request=CambiarEstadoSerializer, responses=TareaDetalleSerializer)
    @action(detail=True, methods=["post"])
    def estado(self, request, pk=None):
        """Mueve la tarjeta de columna (pendiente, en progreso, hecha), con una nota opcional."""
        serializer = CambiarEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tarea = services.cambiar_estado(
            tarea=self.get_object(), usuario=request.user, **serializer.validated_data
        )
        return self._respuesta(tarea)

    @extend_schema(request=NuevoAvanceSerializer, responses=TareaDetalleSerializer)
    @action(detail=True, methods=["post"])
    def avances(self, request, pk=None):
        """Anota cómo va: texto, progreso (0–100) y, si se quiere, un nuevo estado."""
        serializer = NuevoAvanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tarea = services.agregar_avance(
            tarea=self.get_object(), usuario=request.user, **serializer.validated_data
        )
        return self._respuesta(tarea, status.HTTP_201_CREATED)
