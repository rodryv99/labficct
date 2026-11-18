import django_filters
from django.db import transaction
from django.db.models import Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.mixins import AuditoriaMixin
from apps.core.permisos import tiene_permiso
from apps.core.permissions import TienePermiso, permisos_crud
from apps.core.roles import Rol
from apps.usuarios.models import Usuario

from . import services
from .models import HorarioTrabajo, LugarAsistencia, Marcacion
from .serializers import (
    AsignarHorarioSerializer,
    AsignarLugarSerializer,
    AuxiliarLugarSerializer,
    CerrarSerializer,
    EstadoSerializer,
    HorarioTrabajoSerializer,
    LugarAsistenciaSerializer,
    MarcacionSerializer,
    MarcarSerializer,
    ResumenSerializer,
)


class LugarAsistenciaViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    """Lugares donde se puede marcar asistencia. Los gestiona el Admin."""

    serializer_class = LugarAsistenciaSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud("marcaciones.gestionar", "marcaciones.gestionar")
    pagination_class = None
    filterset_fields = ["activo"]
    search_fields = ["nombre", "referencia"]
    ordering_fields = ["nombre"]
    ordering = ["nombre"]

    def get_queryset(self):
        return LugarAsistencia.objects.annotate(asignados=Count("asignaciones"))

    def _releer(self, serializer):
        # Para que la respuesta traiga cuántos auxiliares lo tienen asignado.
        serializer.instance = self.get_queryset().get(pk=serializer.instance.pk)

    @transaction.atomic
    def perform_create(self, serializer):
        if serializer.validated_data.get("predeterminado"):
            services.quitar_otros_predeterminados()
        super().perform_create(serializer)
        self._releer(serializer)

    @transaction.atomic
    def perform_update(self, serializer):
        if serializer.validated_data.get("predeterminado"):
            services.quitar_otros_predeterminados(excepto=serializer.instance)
        super().perform_update(serializer)
        self._releer(serializer)

    def perform_destroy(self, instance):
        services.eliminar_lugar(instance)


class AuxiliarLugarViewSet(viewsets.GenericViewSet):
    """Qué lugar tiene cada auxiliar y cómo va hoy. El Admin puede cambiarle el lugar a cada uno."""

    serializer_class = AuxiliarLugarSerializer
    permission_classes = [TienePermiso]
    permisos = {
        "list": "marcaciones.gestionar",
        "update": "marcaciones.gestionar",
        "horario": "marcaciones.gestionar",
    }
    pagination_class = None
    filter_backends = []
    http_method_names = ["get", "put", "head", "options"]
    queryset = Usuario.objects.filter(rol=Rol.AUXILIAR)

    @extend_schema(responses=AuxiliarLugarSerializer(many=True))
    def list(self, request):
        return Response(AuxiliarLugarSerializer(services.auxiliares_con_lugar(), many=True).data)

    @extend_schema(request=AsignarLugarSerializer, responses=AuxiliarLugarSerializer)
    def update(self, request, pk=None):
        auxiliar = get_object_or_404(Usuario, pk=pk, rol=Rol.AUXILIAR)
        serializer = AsignarLugarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.asignar(auxiliar=auxiliar, lugar=serializer.validated_data["lugar"], usuario=request.user)
        return self._fila(auxiliar)

    @extend_schema(request=AsignarHorarioSerializer, responses=AuxiliarLugarSerializer)
    @action(detail=True, methods=["put"])
    def horario(self, request, pk=None):
        """El Admin le pone (o le quita) el horario de trabajo a un auxiliar."""
        auxiliar = get_object_or_404(Usuario, pk=pk, rol=Rol.AUXILIAR)
        serializer = AsignarHorarioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.asignar_horario(
            auxiliar=auxiliar, horario=serializer.validated_data["horario"], usuario=request.user
        )
        return self._fila(auxiliar)

    def _fila(self, auxiliar):
        fila = next((f for f in services.auxiliares_con_lugar() if f["id"] == auxiliar.pk), None)
        if fila is None:  # El auxiliar está desactivado: no sale en la lista.
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(AuxiliarLugarSerializer(fila).data)


class HorarioTrabajoViewSet(viewsets.ModelViewSet):
    """Horarios de trabajo de los auxiliares. Los gestiona el Admin."""

    serializer_class = HorarioTrabajoSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud("marcaciones.gestionar", "marcaciones.gestionar")
    pagination_class = None
    filterset_fields = ["activo"]
    search_fields = ["nombre", "descripcion"]
    ordering_fields = ["nombre"]
    ordering = ["nombre"]

    def get_queryset(self):
        return HorarioTrabajo.objects.annotate(asignados=Count("asignaciones")).prefetch_related("bloques")

    def _releer(self, horario):
        return self.get_queryset().get(pk=horario.pk)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = dict(serializer.validated_data)
        bloques = datos.pop("bloques")
        horario = services.guardar_horario(instancia=None, datos=datos, bloques=bloques, usuario=request.user)
        salida = self.get_serializer(self._releer(horario))
        return Response(salida.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        parcial = kwargs.pop("partial", False)
        instancia = self.get_object()
        serializer = self.get_serializer(instancia, data=request.data, partial=parcial)
        serializer.is_valid(raise_exception=True)
        datos = dict(serializer.validated_data)
        # En PATCH sin bloques, se conservan los que ya tenía.
        bloques = datos.pop("bloques", None)
        if bloques is None:
            bloques = [
                {"dia": b.dia, "inicio": b.inicio, "fin": b.fin} for b in instancia.bloques.all()
            ]
        horario = services.guardar_horario(
            instancia=instancia, datos=datos, bloques=bloques, usuario=request.user
        )
        salida = self.get_serializer(self._releer(horario))
        return Response(salida.data)

    def perform_destroy(self, instance):
        services.eliminar_horario(instance)


class MarcacionFilter(django_filters.FilterSet):
    desde = django_filters.DateFilter(field_name="fecha", lookup_expr="gte")
    hasta = django_filters.DateFilter(field_name="fecha", lookup_expr="lte")
    abiertas = django_filters.BooleanFilter(method="filtrar_abiertas", label="Solo las que no tienen salida")
    con_retraso = django_filters.BooleanFilter(method="filtrar_con_retraso", label="Solo las que llegaron tarde")
    # Marcaciones con un retraso de al menos X minutos.
    retraso_min = django_filters.NumberFilter(field_name="retraso_min", lookup_expr="gte", label="Retraso de al menos (min)")

    class Meta:
        model = Marcacion
        fields = ["usuario", "lugar", "fecha", "salida_manual"]

    def filtrar_abiertas(self, queryset, name, value):
        return queryset.filter(salida_en__isnull=value)

    def filtrar_con_retraso(self, queryset, name, value):
        return queryset.filter(retraso_min__gt=0) if value else queryset.filter(retraso_min=0)


class MarcacionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Marcaciones de asistencia. Cada auxiliar ve las suyas; el Admin, todas."""

    serializer_class = MarcacionSerializer
    permission_classes = [TienePermiso]
    permisos = {
        "list": "marcaciones.ver",
        "retrieve": "marcaciones.ver",
        "estado": "marcaciones.marcar",
        "marcar": "marcaciones.marcar",
        "cerrar": "marcaciones.gestionar",
        "resumen": "marcaciones.gestionar",
        "exportar": "marcaciones.gestionar",
    }
    filterset_class = MarcacionFilter
    search_fields = ["usuario__nombres", "usuario__apellidos", "lugar__nombre"]
    ordering_fields = ["entrada_en", "fecha", "usuario__apellidos"]
    ordering = ["-entrada_en"]

    def get_queryset(self):
        qs = Marcacion.objects.select_related("usuario", "lugar")
        if not tiene_permiso(self.request.user, "marcaciones.gestionar"):
            qs = qs.filter(usuario=self.request.user)
        return qs

    @extend_schema(request=None, responses=EstadoSerializer)
    @action(detail=False, methods=["get"])
    def estado(self, request):
        """Mi lugar, si tengo una entrada abierta y mis marcas de hoy."""
        return Response(EstadoSerializer(services.estado(request.user)).data)

    @extend_schema(request=MarcarSerializer, responses=MarcacionSerializer)
    @action(detail=False, methods=["post"])
    def marcar(self, request):
        """El auxiliar marca su entrada o su salida desde la app."""
        serializer = MarcarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        marcacion = services.marcar(usuario=request.user, **serializer.validated_data)
        codigo = status.HTTP_201_CREATED if serializer.validated_data["tipo"] == "entrada" else status.HTTP_200_OK
        return Response(MarcacionSerializer(marcacion).data, status=codigo)

    @extend_schema(request=CerrarSerializer, responses=MarcacionSerializer)
    @action(detail=True, methods=["post"])
    def cerrar(self, request, pk=None):
        """El Admin pone la salida de una marcación que quedó abierta."""
        serializer = CerrarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        marcacion = services.cerrar(marcacion=self.get_object(), usuario=request.user, **serializer.validated_data)
        return Response(MarcacionSerializer(self.get_queryset().get(pk=marcacion.pk)).data)

    @extend_schema(responses=ResumenSerializer(many=True))
    @action(detail=False, methods=["get"])
    def resumen(self, request):
        """Totales por auxiliar (días, horas, retrasos) con los mismos filtros de la lista.

        Con ?min_retrasos=X deja solo a los auxiliares con al menos X retrasos.
        """
        marcaciones = self.filter_queryset(self.get_queryset())
        datos = services.resumen(marcaciones)
        min_retrasos = request.query_params.get("min_retrasos")
        if (min_retrasos or "").isdigit():
            n = int(min_retrasos)
            datos = [d for d in datos if d["retrasos"] >= n]
        return Response(ResumenSerializer(datos, many=True).data)

    @extend_schema(responses=None)
    @action(detail=False, methods=["get"])
    def exportar(self, request):
        """Descarga las marcaciones de la búsqueda actual (?formato=xlsx|csv|pdf)."""
        formato = request.query_params.get("formato", "xlsx")
        marcaciones = self.filter_queryset(self.get_queryset())
        contenido, mime, nombre = services.exportar(marcaciones, formato, self._texto_filtros(request))
        respuesta = HttpResponse(contenido, content_type=mime)
        respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
        respuesta["Content-Length"] = len(contenido)
        return respuesta

    def _texto_filtros(self, request) -> str:
        """Describe en palabras los filtros activos, para el subtítulo del PDF."""
        p = request.query_params
        partes = []
        if p.get("desde") and p.get("hasta"):
            partes.append(f"Del {p['desde']} al {p['hasta']}")
        elif p.get("desde"):
            partes.append(f"Desde el {p['desde']}")
        elif p.get("hasta"):
            partes.append(f"Hasta el {p['hasta']}")
        if (p.get("usuario") or "").isdigit():
            usuario = Usuario.objects.filter(pk=p["usuario"]).first()
            if usuario:
                partes.append(usuario.nombre_completo)
        if (p.get("lugar") or "").isdigit():
            lugar = LugarAsistencia.objects.filter(pk=p["lugar"]).first()
            if lugar:
                partes.append(f"Lugar: {lugar.nombre}")
        if p.get("abiertas") in ("true", "1"):
            partes.append("Solo sin salida")
        if p.get("con_retraso") in ("true", "1"):
            partes.append("Solo con retraso")
        if (p.get("retraso_min") or "").isdigit() and int(p["retraso_min"]) > 0:
            partes.append(f"Retraso ≥ {p['retraso_min']} min")
        return " · ".join(partes)
