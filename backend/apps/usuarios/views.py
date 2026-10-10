from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import TienePermiso
from apps.core.roles import ROLES_GESTIONABLES_POR_ADMIN, Rol

from . import services
from .models import Usuario
from .serializers import (
    RestablecerPasswordSerializer,
    UsuarioOpcionSerializer,
    UsuarioSerializer,
)


class UsuarioViewSet(viewsets.ModelViewSet):
    """Gestión de usuarios. El Superadmin ve a todos; el Admin solo a
    auxiliares, docentes y administrativos."""

    serializer_class = UsuarioSerializer
    permission_classes = [TienePermiso]
    permisos = {
        "list": "usuarios.gestionar",
        "retrieve": "usuarios.gestionar",
        "create": "usuarios.gestionar",
        "update": "usuarios.gestionar",
        "partial_update": "usuarios.gestionar",
        "destroy": "usuarios.gestionar",
        "activar": "usuarios.gestionar",
        "desactivar": "usuarios.gestionar",
        "restablecer_password": "usuarios.gestionar",
        "opciones": "usuarios.opciones",
    }
    filterset_fields = {"rol": ["exact", "in"], "is_active": ["exact"]}
    search_fields = ["nombres", "apellidos", "email", "codigo"]
    ordering_fields = ["apellidos", "nombres", "email", "rol", "last_login", "creado_en"]
    ordering = ["apellidos", "nombres"]

    def get_queryset(self):
        qs = Usuario.objects.select_related("ficha_docente")
        if self.action == "opciones":
            return qs.filter(is_active=True).exclude(rol=Rol.SUPERADMIN)
        if self.request.user.rol != Rol.SUPERADMIN:
            qs = qs.filter(rol__in=ROLES_GESTIONABLES_POR_ADMIN)
        return qs

    def perform_create(self, serializer):
        datos = dict(serializer.validated_data)
        password = datos.pop("password")
        ficha = datos.pop("vincular_docente", None)
        serializer.instance = services.crear_usuario(
            actor=self.request.user, datos=datos, password=password, ficha_docente=ficha
        )

    def perform_update(self, serializer):
        datos = dict(serializer.validated_data)
        datos.pop("password", None)  # la contraseña se cambia con restablecer_password
        ficha = datos.pop("vincular_docente", None)
        serializer.instance = services.actualizar_usuario(
            actor=self.request.user, usuario=serializer.instance, datos=datos, ficha_docente=ficha
        )

    def perform_destroy(self, instance):
        services.eliminar_usuario(actor=self.request.user, usuario=instance)

    @extend_schema(request=None, responses=UsuarioSerializer)
    @action(detail=True, methods=["post"])
    def activar(self, request, pk=None):
        usuario = services.cambiar_estado(actor=request.user, usuario=self.get_object(), activo=True)
        return Response(UsuarioSerializer(usuario).data)

    @extend_schema(request=None, responses=UsuarioSerializer)
    @action(detail=True, methods=["post"])
    def desactivar(self, request, pk=None):
        usuario = services.cambiar_estado(actor=request.user, usuario=self.get_object(), activo=False)
        return Response(UsuarioSerializer(usuario).data)

    @extend_schema(request=RestablecerPasswordSerializer, responses={204: None})
    @action(detail=True, methods=["post"], url_path="restablecer-password")
    def restablecer_password(self, request, pk=None):
        serializer = RestablecerPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.restablecer_password(
            actor=request.user,
            usuario=self.get_object(),
            password=serializer.validated_data["password"],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        parameters=[
            OpenApiParameter("rol", str, description="Uno o varios roles separados por coma.")
        ],
        responses=UsuarioOpcionSerializer(many=True),
    )
    @action(detail=False, methods=["get"])
    def opciones(self, request):
        qs = self.get_queryset()
        roles = [r for r in request.query_params.get("rol", "").split(",") if r]
        if roles:
            qs = qs.filter(rol__in=roles)
        return Response(UsuarioOpcionSerializer(qs.order_by("apellidos", "nombres"), many=True).data)
