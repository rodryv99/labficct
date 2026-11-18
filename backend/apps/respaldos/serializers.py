from rest_framework import serializers

from .models import Respaldo


def _humano(bytes_: int) -> str:
    """1536 → "1.5 KB"; 1048576 → "1.0 MB"."""
    tamano = float(bytes_ or 0)
    for unidad in ["B", "KB", "MB", "GB"]:
        if tamano < 1024 or unidad == "GB":
            return f"{tamano:.0f} {unidad}" if unidad == "B" else f"{tamano:.1f} {unidad}"
        tamano /= 1024
    return f"{tamano:.1f} GB"


class RespaldoSerializer(serializers.ModelSerializer):
    tamano = serializers.SerializerMethodField()
    creado_por_nombre = serializers.CharField(source="creado_por.nombre_completo", read_only=True, default="")

    class Meta:
        model = Respaldo
        fields = [
            "id",
            "archivo",
            "tamano_bytes",
            "tamano",
            "origen",
            "base_datos",
            "nota",
            "creado_en",
            "creado_por_nombre",
        ]
        read_only_fields = fields

    def get_tamano(self, obj) -> str:
        return _humano(obj.tamano_bytes)


class GenerarRespaldoSerializer(serializers.Serializer):
    nota = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
