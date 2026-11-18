import django_filters
from django.db.models import Count, Prefetch, Q
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.errores import ErrorNegocio
from apps.core.mixins import AuditoriaMixin
from apps.core.permissions import TienePermiso, permisos_crud

from . import importacion, services
from .models import (
    Activo,
    CambioInventario,
    EstadoActivo,
    ItemVerificacion,
    Lugar,
    MovimientoActivo,
    TipoActivo,
    Verificacion,
)
from .serializers import (
    ActivoDetalleSerializer,
    ActivoSerializer,
    BajaSerializer,
    CambiarEstadoSerializer,
    CerrarSerializer,
    CrearVerificacionSerializer,
    ImportarActivosSerializer,
    LugarSerializer,
    MarcarSerializer,
    MovimientoSerializer,
    TipoActivoSerializer,
    TrasladarSerializer,
    VerificacionDetalleSerializer,
    VerificacionSerializer,
)

# En los totales de tipos y lugares no cuentan los activos dados de baja.
EN_INVENTARIO = ~Q(activos__estado=EstadoActivo.BAJA)


class NumerosEnLista(django_filters.BaseInFilter, django_filters.NumberFilter):
    """Varios ids separados por coma: ?tipos=1,4"""


class TipoActivoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    """Catálogo de tipos de activo (silla, mesa, computadora…)."""

    serializer_class = TipoActivoSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud("inventario.ver", "inventario.gestionar")
    filterset_fields = ["activo"]
    search_fields = ["nombre"]
    ordering = ["nombre"]

    def get_queryset(self):
        return TipoActivo.objects.annotate(total_activos=Count("activos", filter=EN_INVENTARIO))


class LugarViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    """Lugares donde puede estar un activo: laboratorios (automáticos), depósitos y otros."""

    serializer_class = LugarSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud("inventario.ver", "inventario.gestionar")
    filterset_fields = ["tipo", "activo"]
    search_fields = ["nombre"]
    ordering = ["tipo", "nombre"]

    def get_queryset(self):
        return Lugar.objects.annotate(total_activos=Count("activos", filter=EN_INVENTARIO))

    def perform_destroy(self, instance):
        if instance.laboratorio_id:
            raise ErrorNegocio(
                "Este lugar es un laboratorio: no se elimina desde el inventario.",
                codigo="lugar_de_laboratorio",
            )
        # Si tiene activos o movimientos, la base lo protege y se avisa (409).
        instance.delete()


class ActivoFilter(django_filters.FilterSet):
    tipos = NumerosEnLista(field_name="tipo_id", lookup_expr="in", label="Tipos (ids separados por coma)")
    lugares = NumerosEnLista(
        field_name="lugar_id", lookup_expr="in", label="Lugares (ids separados por coma)"
    )
    vigentes = django_filters.BooleanFilter(method="filtrar_vigentes", label="Sin los dados de baja")

    class Meta:
        model = Activo
        fields = ["tipo", "lugar", "estado"]

    def filtrar_vigentes(self, queryset, name, value):
        return queryset.exclude(estado=EstadoActivo.BAJA) if value else queryset


class ActivoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """15. Inventario de activos fijos. No hay borrado: un activo se da de baja."""

    permission_classes = [TienePermiso]
    permisos = {
        "list": "inventario.ver",
        "retrieve": "inventario.ver",
        "create": "inventario.gestionar",
        "update": "inventario.gestionar",
        "partial_update": "inventario.gestionar",
        "trasladar": "inventario.gestionar",
        "estado": "inventario.gestionar",
        "baja": "inventario.gestionar",
        "importar": "inventario.gestionar",
        "exportar": "inventario.ver",
    }
    filterset_class = ActivoFilter
    search_fields = ["codigo", "descripcion", "marca", "modelo", "serie", "tipo__nombre"]
    ordering_fields = ["codigo", "descripcion", "tipo__nombre", "lugar__nombre", "estado", "actualizado_en"]
    ordering = ["codigo"]

    def get_serializer_class(self):
        return ActivoSerializer if self.action == "list" else ActivoDetalleSerializer

    def get_queryset(self):
        qs = Activo.objects.select_related("tipo", "lugar", "creado_por")
        # La lista y la exportación no necesitan el historial de cada activo.
        if self.action not in ("list", "exportar"):
            movimientos = MovimientoActivo.objects.select_related(
                "activo", "lugar_origen", "lugar_destino", "creado_por"
            ).prefetch_related("cambios")
            cambios = CambioInventario.objects.select_related("usuario")
            qs = qs.prefetch_related(
                Prefetch("movimientos", queryset=movimientos), Prefetch("cambios", queryset=cambios)
            )
        return qs

    def _respuesta(self, activo, codigo=status.HTTP_200_OK):
        return Response(
            ActivoDetalleSerializer(
                self.get_queryset().get(pk=activo.pk), context=self.get_serializer_context()
            ).data,
            status=codigo,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        activo = services.crear_activo(datos=serializer.validated_data, usuario=request.user)
        return self._respuesta(activo, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        parcial = kwargs.pop("partial", False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=parcial)
        serializer.is_valid(raise_exception=True)
        activo = services.editar_activo(
            activo=serializer.instance, datos=serializer.validated_data, usuario=request.user
        )
        return self._respuesta(activo)

    @extend_schema(request=TrasladarSerializer, responses=ActivoDetalleSerializer)
    @action(detail=True, methods=["post"])
    def trasladar(self, request, pk=None):
        """Mueve el activo a otro lugar."""
        serializer = TrasladarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        activo = services.trasladar(
            activo=self.get_object(), usuario=request.user, **serializer.validated_data
        )
        return self._respuesta(activo)

    @extend_schema(request=CambiarEstadoSerializer, responses=ActivoDetalleSerializer)
    @action(detail=True, methods=["post"])
    def estado(self, request, pk=None):
        """Operativo, dañado o en reparación (también reincorpora uno dado de baja por error)."""
        serializer = CambiarEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        activo = services.cambiar_estado(
            activo=self.get_object(), usuario=request.user, **serializer.validated_data
        )
        return self._respuesta(activo)

    @extend_schema(request=BajaSerializer, responses=ActivoDetalleSerializer)
    @action(detail=True, methods=["post"])
    def baja(self, request, pk=None):
        """Da de baja el activo, con su motivo. Sigue en el inventario como «De baja»."""
        serializer = BajaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        activo = services.dar_de_baja(
            activo=self.get_object(), usuario=request.user, **serializer.validated_data
        )
        return self._respuesta(activo)

    @extend_schema(request=ImportarActivosSerializer, responses=None)
    @action(detail=False, methods=["post"])
    def importar(self, request):
        """Carga muchos activos de una planilla (Excel o CSV).

        Sin `confirmar` solo analiza y devuelve qué se entendería (columnas, ejemplo, avisos).
        Con `confirmar` crea los activos que están bien. Reconoce las columnas por su título
        y, si no, por lo que contienen; crea los lugares y tipos que no existan.
        """
        serializer = ImportarActivosSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        archivo = datos["archivo"]
        resultado = importacion.importar(
            usuario=request.user,
            confirmar=datos["confirmar"],
            nombre=archivo.name,
            contenido=archivo.read(),
            titulos=datos["titulos"],
            mapeo=datos.get("mapeo"),
            lugar_por_defecto=datos.get("lugar_por_defecto"),
        )
        return Response(resultado)

    @extend_schema(responses=None)
    @action(detail=False, methods=["get"])
    def exportar(self, request):
        """Descarga los activos de la búsqueda actual en Excel, CSV o PDF (?formato=xlsx|csv|pdf)."""
        formato = request.query_params.get("formato", "xlsx")
        activos = self.filter_queryset(self.get_queryset())
        contenido, mime, nombre = importacion.exportar(activos, formato, self._texto_filtros(request))
        respuesta = HttpResponse(contenido, content_type=mime)
        respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
        respuesta["Content-Length"] = len(contenido)
        return respuesta

    def _texto_filtros(self, request):
        """Describe en palabras los filtros activos, para el subtítulo del PDF."""
        p = request.query_params
        partes = []
        tipos = [t for t in p.get("tipos", "").split(",") if t.isdigit()]
        if p.get("tipo"):
            tipos.append(p["tipo"])
        if tipos:
            nombres = TipoActivo.objects.filter(id__in=tipos).values_list("nombre", flat=True)
            if nombres:
                partes.append("Tipo: " + ", ".join(nombres))
        lugares = [x for x in p.get("lugares", "").split(",") if x.isdigit()]
        if p.get("lugar"):
            lugares.append(p["lugar"])
        if lugares:
            nombres = Lugar.objects.filter(id__in=lugares).values_list("nombre", flat=True)
            if nombres:
                partes.append("Lugar: " + ", ".join(nombres))
        estado = p.get("estado")
        if estado in dict(EstadoActivo.choices):
            partes.append("Estado: " + dict(EstadoActivo.choices)[estado])
        elif p.get("vigentes") in ("true", "1"):
            partes.append("Sin los dados de baja")
        if p.get("search"):
            partes.append(f"Búsqueda: «{p['search']}»")
        return " · ".join(partes)


class MovimientoViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """Movimientos de los activos. Se crean al trasladar, cambiar de estado o dar de baja;
    aquí se consultan y se corrigen (fecha, motivo y documento)."""

    serializer_class = MovimientoSerializer
    permission_classes = [TienePermiso]
    permisos = {
        "list": "inventario.ver",
        "retrieve": "inventario.ver",
        "update": "inventario.gestionar",
        "partial_update": "inventario.gestionar",
    }
    filterset_fields = ["activo", "tipo", "lugar_origen", "lugar_destino"]
    search_fields = ["activo__codigo", "activo__descripcion", "motivo", "documento"]
    ordering_fields = ["fecha", "creado_en"]
    ordering = ["-fecha", "-id"]

    def get_queryset(self):
        return MovimientoActivo.objects.select_related(
            "activo", "lugar_origen", "lugar_destino", "creado_por"
        ).prefetch_related("cambios")

    def update(self, request, *args, **kwargs):
        parcial = kwargs.pop("partial", False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=parcial)
        serializer.is_valid(raise_exception=True)
        movimiento = services.editar_movimiento(
            movimiento=serializer.instance, datos=serializer.validated_data, usuario=request.user
        )
        return Response(self.get_serializer(self.get_queryset().get(pk=movimiento.pk)).data)


class VerificacionFilter(django_filters.FilterSet):
    mias = django_filters.BooleanFilter(method="filtrar_mias", label="Solo las asignadas a mí")

    class Meta:
        model = Verificacion
        fields = ["estado"]

    def filtrar_mias(self, queryset, name, value):
        return queryset.filter(responsables=self.request.user) if value else queryset


class VerificacionViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """Listas de activos que el Admin manda a verificar. Los auxiliares marcan; el Admin cierra."""

    permission_classes = [TienePermiso]
    permisos = {
        "list": "inventario.ver",
        "retrieve": "inventario.ver",
        "create": "inventario.gestionar",
        "marcar": "inventario.verificar",
        "cerrar": "inventario.gestionar",
        "cancelar": "inventario.gestionar",
    }
    filterset_class = VerificacionFilter
    search_fields = ["titulo", "alcance"]
    ordering_fields = ["creado_en", "fecha_limite"]
    ordering = ["-creado_en"]

    def get_serializer_class(self):
        return VerificacionSerializer if self.action == "list" else VerificacionDetalleSerializer

    def get_queryset(self):
        qs = services.conteos_en_lista(
            Verificacion.objects.select_related("creado_por", "cerrada_por").prefetch_related("responsables")
        )
        if self.action != "list":
            items = ItemVerificacion.objects.select_related("lugar_encontrado", "verificado_por")
            qs = qs.prefetch_related(Prefetch("items", queryset=items))
        return qs

    def _respuesta(self, verificacion, codigo=status.HTTP_200_OK):
        return Response(
            VerificacionDetalleSerializer(
                self.get_queryset().get(pk=verificacion.pk), context=self.get_serializer_context()
            ).data,
            status=codigo,
        )

    @extend_schema(request=CrearVerificacionSerializer, responses=VerificacionDetalleSerializer)
    def create(self, request, *args, **kwargs):
        serializer = CrearVerificacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verificacion = services.crear_verificacion(datos=serializer.validated_data, usuario=request.user)
        return self._respuesta(verificacion, status.HTTP_201_CREATED)

    @extend_schema(request=MarcarSerializer, responses=VerificacionDetalleSerializer)
    @action(detail=True, methods=["post"])
    def marcar(self, request, pk=None):
        """Marca uno o varios activos: está, falta, en otro lugar, dañado (o sin revisar)."""
        serializer = MarcarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verificacion = services.marcar_items(
            verificacion=self.get_object(), usuario=request.user, **serializer.validated_data
        )
        return self._respuesta(verificacion)

    @extend_schema(request=CerrarSerializer, responses=VerificacionDetalleSerializer)
    @action(detail=True, methods=["post"])
    def cerrar(self, request, pk=None):
        serializer = CerrarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verificacion = services.cerrar_verificacion(
            verificacion=self.get_object(), usuario=request.user, **serializer.validated_data
        )
        return self._respuesta(verificacion)

    @extend_schema(request=None, responses=VerificacionDetalleSerializer)
    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        verificacion = services.cancelar_verificacion(verificacion=self.get_object(), usuario=request.user)
        return self._respuesta(verificacion)
