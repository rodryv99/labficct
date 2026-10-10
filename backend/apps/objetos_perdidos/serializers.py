from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.core.validadores import validar_imagen

from .models import FOTOS_ENTREGA, EventoObjeto, ObjetoPerdido


class EventoObjetoSerializer(serializers.ModelSerializer):
    tipo_nombre = serializers.CharField(source="get_tipo_display", read_only=True)
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = EventoObjeto
        fields = ["id", "tipo", "tipo_nombre", "detalle", "usuario_nombre", "fecha"]

    def get_usuario_nombre(self, obj) -> str:
        return obj.usuario.nombre_completo if obj.usuario_id else ""


class ObjetoPerdidoSerializer(serializers.ModelSerializer):
    codigo = serializers.CharField(read_only=True)
    categoria_nombre = serializers.CharField(source="get_categoria_display", read_only=True)
    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)
    laboratorio_codigo = serializers.SerializerMethodField()
    foto = serializers.ImageField(required=False, allow_null=True, validators=[validar_imagen])
    quitar_foto = serializers.BooleanField(write_only=True, required=False, default=False)
    registrado_por_nombre = serializers.SerializerMethodField()
    entregado_por_nombre = serializers.SerializerMethodField()
    eventos = EventoObjetoSerializer(many=True, read_only=True)
    fotos_entrega = serializers.SerializerMethodField(
        help_text="Fotos de la entrega que existen: 'ci-anverso', 'ci-reverso', 'persona'. "
        "Se descargan de /objetos-perdidos/<id>/entrega/<nombre>/ con sesión."
    )

    class Meta:
        model = ObjetoPerdido
        fields = [
            "id",
            "codigo",
            "descripcion",
            "categoria",
            "categoria_nombre",
            "caracteristicas",
            "foto",
            "quitar_foto",
            "laboratorio",
            "laboratorio_codigo",
            "lugar",
            "fecha_hallazgo",
            "encontrado_por",
            "estado",
            "estado_nombre",
            "entregado_a",
            "entregado_ci",
            "entregado_en",
            "entregado_por_nombre",
            "motivo_anulacion",
            "registrado_por_nombre",
            "creado_en",
            "eventos",
            "fotos_entrega",
        ]
        read_only_fields = [
            "estado",
            "entregado_a",
            "entregado_ci",
            "entregado_en",
            "motivo_anulacion",
            "creado_en",
        ]

    def get_fotos_entrega(self, obj) -> list[str]:
        return [nombre for nombre, campo in FOTOS_ENTREGA.items() if getattr(obj, campo)]

    def get_laboratorio_codigo(self, obj) -> str:
        return obj.laboratorio.codigo if obj.laboratorio_id else ""

    def get_registrado_por_nombre(self, obj) -> str:
        return obj.creado_por.nombre_completo if obj.creado_por_id else ""

    def get_entregado_por_nombre(self, obj) -> str:
        return obj.entregado_por.nombre_completo if obj.entregado_por_id else ""

    def validate_fecha_hallazgo(self, valor):
        if valor > timezone.now() + timedelta(minutes=5):
            raise serializers.ValidationError("La fecha del hallazgo no puede estar en el futuro.")
        return valor

    def validate(self, attrs):
        if self.instance is None and not attrs.get("laboratorio") and not attrs.get("lugar"):
            raise serializers.ValidationError(
                {"lugar": "Indica el laboratorio o el lugar donde se encontró."}
            )
        return attrs


class EntregarSerializer(serializers.Serializer):
    entregado_a = serializers.CharField(max_length=150)
    entregado_ci = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    observacion = serializers.CharField(required=False, allow_blank=True, default="")
    # Opcionales: se envían como multipart/form-data.
    ci_anverso = serializers.ImageField(required=False, allow_null=True, validators=[validar_imagen])
    ci_reverso = serializers.ImageField(required=False, allow_null=True, validators=[validar_imagen])
    foto_persona = serializers.ImageField(required=False, allow_null=True, validators=[validar_imagen])


class AnularSerializer(serializers.Serializer):
    motivo = serializers.CharField()
