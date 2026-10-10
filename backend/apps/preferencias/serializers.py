from rest_framework import serializers

from . import services
from .models import OpcionPreferencia


class OpcionPreferenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = OpcionPreferencia
        fields = ["id", "pregunta", "texto_si", "texto_no", "orden", "activa"]

    def validate_pregunta(self, valor):
        return valor.strip()


class PreferenciasSerializer(serializers.Serializer):
    """Se lee a partir de la ficha Docente (tenga o no preferencias guardadas)."""

    valores = serializers.DictField(
        child=serializers.BooleanField(allow_null=True),
        required=False,
        default=dict,
        help_text='{"<id de la opción>": true | false | null}',
    )
    nota = serializers.CharField(required=False, allow_blank=True, default="", max_length=1000)

    def to_representation(self, docente):
        preferencias = getattr(docente, "preferencias", None)
        opciones = self.context.get("opciones")
        valores = preferencias.valores if preferencias else {}
        existentes = self.context.get("ids_opciones")
        if existentes is not None:
            # Una opción borrada deja su id en lo guardado: no se devuelve.
            valores = {k: v for k, v in valores.items() if k.isdigit() and int(k) in existentes}
        return {
            "docente": docente.pk,
            "docente_nombre": docente.nombre_completo,
            "tiene_usuario": docente.usuario_id is not None,
            "valores": valores,
            "nota": preferencias.nota if preferencias else "",
            "resumen": services.resumen(preferencias, opciones),
            "actualizado_en": preferencias.actualizado_en.isoformat() if preferencias else None,
        }


class PreferenciasRespuestaSerializer(serializers.Serializer):
    """Solo para la documentación de la API."""

    docente = serializers.IntegerField()
    docente_nombre = serializers.CharField()
    tiene_usuario = serializers.BooleanField()
    valores = serializers.DictField(child=serializers.BooleanField())
    nota = serializers.CharField()
    resumen = serializers.ListField(child=serializers.CharField())
    actualizado_en = serializers.DateTimeField(allow_null=True)
