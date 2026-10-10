from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import TienePermiso

from . import avisos
from .models import Notificacion
from .serializers import AvisoAulaSerializer, NotificacionSerializer, ResumenSerializer


class NotificacionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Las notificaciones de quien tiene la sesión. ?no_leidas=1 para ver solo las nuevas."""

    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Notificacion.objects.filter(destinatario=self.request.user)
        if self.request.query_params.get("no_leidas") in ("1", "true"):
            qs = qs.filter(leida_en__isnull=True)
        return qs

    @extend_schema(responses=ResumenSerializer)
    @action(detail=False, methods=["get"])
    def resumen(self, request):
        """Para la campana: cuántas hay sin leer. La web y la app lo consultan cada pocos segundos."""
        no_leidas = Notificacion.objects.filter(destinatario=request.user, leida_en__isnull=True)
        ultima = no_leidas.order_by("-id").values_list("id", flat=True).first()
        return Response({"no_leidas": no_leidas.count(), "ultima_id": ultima})

    @extend_schema(request=None, responses=NotificacionSerializer)
    @action(detail=True, methods=["post"])
    def leer(self, request, pk=None):
        notificacion = self.get_object()
        if notificacion.leida_en is None:
            notificacion.leida_en = timezone.now()
            notificacion.save(update_fields=["leida_en"])
        return Response(NotificacionSerializer(notificacion).data)

    @extend_schema(
        request=None, responses=inline_serializer("Marcadas", {"marcadas": serializers.IntegerField()})
    )
    @action(detail=False, methods=["post"], url_path="leer-todas")
    def leer_todas(self, request):
        marcadas = Notificacion.objects.filter(destinatario=request.user, leida_en__isnull=True).update(
            leida_en=timezone.now()
        )
        return Response({"marcadas": marcadas})


class AvisoAulaView(APIView):
    """Avisa a mano a los auxiliares que alisten o cierren el aula de una clase o reserva."""

    permission_classes = [TienePermiso]
    permisos = {"post": "avisos.enviar"}

    @extend_schema(
        request=AvisoAulaSerializer,
        responses=inline_serializer("AvisoEnviado", {"enviadas": serializers.IntegerField()}),
    )
    def post(self, request):
        serializer = AvisoAulaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        enviadas = avisos.avisar_manual(
            tipo=d["tipo"], evento_id=d["evento"], fecha=d["fecha"], nota=d["nota"], usuario=request.user
        )
        return Response({"enviadas": enviadas})
