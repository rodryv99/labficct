from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import atencion


@extend_schema(
    responses=inline_serializer(
        "Salud", {"estado": serializers.CharField(), "hora": serializers.DateTimeField()}
    )
)
@api_view(["GET"])
@permission_classes([AllowAny])
def salud(request):
    """Comprueba que la API responde. Útil para probar la conexión desde web y móvil."""
    return Response({"estado": "ok", "hora": timezone.now()})


@extend_schema(
    responses=inline_serializer(
        "Configuracion",
        {
            "atencion_inicio": serializers.CharField(),
            "atencion_fin": serializers.CharField(),
            "franjas": serializers.ListField(child=serializers.ListField(child=serializers.CharField())),
        },
    )
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def configuracion(request):
    """Datos del .env que la web y la app necesitan: horario de atención y franjas habituales."""
    return Response(
        {
            "atencion_inicio": settings.ATENCION_INICIO,
            "atencion_fin": settings.ATENCION_FIN,
            "franjas": atencion.franjas(),
        }
    )
