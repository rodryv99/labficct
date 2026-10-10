from rest_framework import serializers

from .models import Notificacion, TipoNotificacion


class NotificacionSerializer(serializers.ModelSerializer):
    tipo_nombre = serializers.CharField(source="get_tipo_display", read_only=True)
    leida = serializers.SerializerMethodField()

    class Meta:
        model = Notificacion
        fields = [
            "id",
            "tipo",
            "tipo_nombre",
            "titulo",
            "mensaje",
            "enlace",
            "datos",
            "creado_en",
            "leida",
            "leida_en",
        ]
        read_only_fields = fields

    def get_leida(self, obj) -> bool:
        return obj.leida_en is not None


class ResumenSerializer(serializers.Serializer):
    no_leidas = serializers.IntegerField()
    ultima_id = serializers.IntegerField(
        allow_null=True, help_text="La no leída más reciente: si cambia, llegó algo nuevo."
    )


class AvisoAulaSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=[TipoNotificacion.ALISTAR, TipoNotificacion.CERRAR])
    evento = serializers.CharField(
        max_length=60, help_text="El id del evento de la agenda, p. ej. clase-3-2026-09-28."
    )
    fecha = serializers.DateField()
    nota = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
