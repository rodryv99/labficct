"""Inicio y cierre de sesión con JWT.

- Web: el token de acceso va en el cuerpo y el de renovación en una cookie
  httpOnly que JavaScript no puede leer.
- Móvil: envía la cabecera `X-Cliente: movil` y recibe ambos tokens en el
  cuerpo, para guardarlos en el almacenamiento seguro del teléfono.
"""

from django.conf import settings
from django.contrib.auth.models import update_last_login
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.errores import ErrorNegocio

from . import services
from .backends import buscar_usuario
from .serializers import (
    CambiarPasswordSerializer,
    LoginSerializer,
    MeActualizarSerializer,
    SesionSerializer,
    UsuarioMeSerializer,
)


def _es_movil(request) -> bool:
    return request.headers.get("X-Cliente", "").lower() == "movil"


def _poner_cookie(respuesta, token: str, recordar: bool):
    duracion = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
    respuesta.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        token,
        max_age=duracion if recordar else None,
        httponly=True,
        secure=settings.JWT_REFRESH_COOKIE_SECURE,
        samesite="Lax",
        path=settings.JWT_REFRESH_COOKIE_PATH,
    )


def _borrar_cookie(respuesta):
    respuesta.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path=settings.JWT_REFRESH_COOKIE_PATH,
        samesite="Lax",
    )


def _respuesta_sesion(request, refresh, usuario=None, recordar=True):
    datos = {"access": str(refresh.access_token)}
    if usuario is not None:
        datos["usuario"] = UsuarioMeSerializer(usuario).data
    if _es_movil(request):
        datos["refresh"] = str(refresh)
        return Response(datos)
    respuesta = Response(datos)
    _poner_cookie(respuesta, str(refresh), recordar)
    return respuesta


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(request=LoginSerializer, responses=SesionSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        usuario = buscar_usuario(datos["usuario"])
        if usuario is None or not usuario.check_password(datos["password"]):
            raise ErrorNegocio(
                "Correo, código o contraseña incorrectos.",
                codigo="credenciales_invalidas",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        if not usuario.is_active:
            raise ErrorNegocio(
                "Tu cuenta está desactivada. Habla con el jefe de laboratorio.",
                codigo="cuenta_inactiva",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(usuario)
        refresh["recordar"] = datos["recordar"]
        update_last_login(None, usuario)
        return _respuesta_sesion(request, refresh, usuario, datos["recordar"])


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses=SesionSerializer)
    def post(self, request):
        token = request.data.get("refresh") or request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not token:
            raise ErrorNegocio(
                "No hay una sesión activa.",
                codigo="sin_sesion",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = TokenRefreshSerializer(data={"refresh": token})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, InvalidToken, AuthenticationFailed):
            respuesta = Response(
                {
                    "codigo": "sesion_expirada",
                    "mensaje": "Tu sesión expiró. Vuelve a iniciar sesión.",
                    "campos": {},
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _borrar_cookie(respuesta)
            return respuesta

        nuevo = serializer.validated_data.get("refresh", token)
        datos = {"access": serializer.validated_data["access"]}
        if _es_movil(request):
            datos["refresh"] = nuevo
            return Response(datos)

        recordar = RefreshToken(nuevo, verify=False).payload.get("recordar", True)
        respuesta = Response(datos)
        _poner_cookie(respuesta, nuevo, recordar)
        return respuesta


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        token = request.data.get("refresh") or request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        respuesta = Response(status=status.HTTP_204_NO_CONTENT)
        _borrar_cookie(respuesta)
        return respuesta


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UsuarioMeSerializer)
    def get(self, request):
        return Response(UsuarioMeSerializer(request.user).data)

    @extend_schema(request=MeActualizarSerializer, responses=UsuarioMeSerializer)
    def patch(self, request):
        serializer = MeActualizarSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UsuarioMeSerializer(request.user).data)


class CambiarPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=CambiarPasswordSerializer, responses={204: None})
    def post(self, request):
        serializer = CambiarPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.cambiar_password_propia(
            usuario=request.user,
            actual=serializer.validated_data["actual"],
            nueva=serializer.validated_data["nueva"],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
