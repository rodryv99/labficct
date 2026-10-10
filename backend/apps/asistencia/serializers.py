from rest_framework import serializers

from .models import SolicitudAsistencia


class SolicitudAsistenciaSerializer(serializers.ModelSerializer):
    solicitante_nombre = serializers.CharField(source="solicitante.nombre_completo", read_only=True)
    solicitante_telefono = serializers.CharField(source="solicitante.telefono", read_only=True)
    laboratorio_codigo = serializers.CharField(source="laboratorio.codigo", read_only=True, default="")
    donde = serializers.CharField(read_only=True)
    categoria_nombre = serializers.CharField(source="get_categoria_display", read_only=True)
    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)
    atendida_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudAsistencia
        fields = [
            "id",
            "solicitante",
            "solicitante_nombre",
            "solicitante_telefono",
            "laboratorio",
            "laboratorio_codigo",
            "lugar",
            "donde",
            "categoria",
            "categoria_nombre",
            "descripcion",
            "urgente",
            "estado",
            "estado_nombre",
            "atendida_por",
            "atendida_por_nombre",
            "atendida_en",
            "cerrada_en",
            "respuesta",
            "creado_en",
        ]
        read_only_fields = [
            "solicitante",
            "estado",
            "atendida_por",
            "atendida_en",
            "cerrada_en",
            "respuesta",
            "creado_en",
        ]

    def get_atendida_por_nombre(self, obj) -> str:
        return obj.atendida_por.nombre_completo if obj.atendida_por_id else ""

    def validate_descripcion(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("Cuenta brevemente qué necesitas.")
        return valor

    def validate_lugar(self, valor):
        return valor.strip()


class ResolverSerializer(serializers.Serializer):
    respuesta = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
