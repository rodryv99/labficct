from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.errores import ErrorNegocio
from apps.core.mixins import AuditoriaMixin
from apps.core.permissions import TienePermiso, permisos_crud
from apps.planificacion.models import Docente
from apps.planificacion.services import asegurar_ficha_docente

from . import services
from .models import OpcionPreferencia
from .serializers import OpcionPreferenciaSerializer, PreferenciasRespuestaSerializer, PreferenciasSerializer


class OpcionPreferenciaViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    """La lista de preferencias que los docentes pueden marcar. La edita el Admin."""

    queryset = OpcionPreferencia.objects.all()
    serializer_class = OpcionPreferenciaSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud("preferencias.opciones", "preferencias.gestionar")
    pagination_class = None
    filterset_fields = ["activa"]


def _docentes():
    return Docente.objects.select_related("preferencias", "usuario")


def _contexto() -> dict:
    return {
        "opciones": services.opciones_activas(),
        "ids_opciones": set(OpcionPreferencia.objects.values_list("pk", flat=True)),
    }


def _respuesta(docente_id: int) -> Response:
    # Se vuelve a leer: el objeto anterior puede tener en caché "sin preferencias".
    docente = _docentes().get(pk=docente_id)
    return Response(PreferenciasSerializer(docente, context=_contexto()).data)


class PreferenciasDocenteViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """Preferencias de cada docente, por el id de su ficha. Admin y auxiliares las ven;
    el Admin puede editarlas (por ejemplo, para un docente sin usuario)."""

    serializer_class = PreferenciasSerializer
    permission_classes = [TienePermiso]
    permisos = {
        "list": "preferencias.ver",
        "retrieve": "preferencias.ver",
        "update": "preferencias.gestionar",
        "partial_update": "preferencias.gestionar",
    }
    pagination_class = None
    search_fields = ["nombres", "apellidos"]
    http_method_names = ["get", "put", "head", "options"]

    def get_queryset(self):
        qs = _docentes()
        if self.action == "list":
            qs = qs.filter(activo=True)
        return qs

    def get_serializer_context(self):
        return {**super().get_serializer_context(), **_contexto()}

    @extend_schema(responses=PreferenciasRespuestaSerializer(many=True))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(responses=PreferenciasRespuestaSerializer)
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(request=PreferenciasSerializer, responses=PreferenciasRespuestaSerializer)
    def update(self, request, *args, **kwargs):
        docente = self.get_object()
        serializer = PreferenciasSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.guardar(docente=docente, usuario=request.user, **serializer.validated_data)
        return _respuesta(docente.pk)


class MisPreferenciasView(APIView):
    """Las preferencias del docente que tiene la sesión."""

    permission_classes = [TienePermiso]
    permisos = {"get": "preferencias.propias", "put": "preferencias.propias"}

    def _mi_ficha(self, request) -> Docente:
        ficha = Docente.objects.filter(usuario=request.user).first() or asegurar_ficha_docente(
            usuario=request.user
        )
        if ficha is None:
            raise ErrorNegocio("Tu cuenta no está vinculada a una ficha de docente.", codigo="sin_ficha")
        return ficha

    @extend_schema(responses=PreferenciasRespuestaSerializer)
    def get(self, request):
        return _respuesta(self._mi_ficha(request).pk)

    @extend_schema(request=PreferenciasSerializer, responses=PreferenciasRespuestaSerializer)
    def put(self, request):
        ficha = self._mi_ficha(request)
        serializer = PreferenciasSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.guardar(docente=ficha, usuario=request.user, **serializer.validated_data)
        return _respuesta(ficha.pk)
