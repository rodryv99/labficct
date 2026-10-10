from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.validadores import validar_color, validar_imagen

from .models import (
    LIMITE_GRILLA,
    CredencialLaboratorio,
    ElementoLaboratorio,
    Laboratorio,
    Software,
    TipoElemento,
)


class TipoElementoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="get_categoria_display", read_only=True)
    imagen = serializers.ImageField(required=False, allow_null=True, validators=[validar_imagen])
    quitar_imagen = serializers.BooleanField(write_only=True, required=False, default=False)
    en_uso = serializers.SerializerMethodField(help_text="Casillas que usan este elemento.")

    class Meta:
        model = TipoElemento
        fields = [
            "id",
            "nombre",
            "categoria",
            "categoria_nombre",
            "icono",
            "imagen",
            "quitar_imagen",
            "color",
            "prefijo_etiqueta",
            "descripcion",
            "activo",
            "en_uso",
        ]

    def get_en_uso(self, obj) -> int:
        return getattr(obj, "en_uso", 0)

    def validate_color(self, valor):
        return validar_color(valor)

    def _aplicar_imagen(self, validated_data, instancia=None):
        quitar = validated_data.pop("quitar_imagen", False)
        if quitar and instancia is not None and instancia.imagen:
            instancia.imagen.delete(save=False)
            validated_data["imagen"] = ""
        if "imagen" in validated_data and validated_data["imagen"] is None:
            validated_data["imagen"] = ""
        return validated_data

    def create(self, validated_data):
        return super().create(self._aplicar_imagen(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._aplicar_imagen(validated_data, instance))


class SoftwareSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(source="__str__", read_only=True)
    total_laboratorios = serializers.SerializerMethodField()

    class Meta:
        model = Software
        fields = ["id", "nombre", "version", "descripcion", "nombre_completo", "total_laboratorios"]

    def get_total_laboratorios(self, obj) -> int:
        return getattr(obj, "total_laboratorios", 0)


class LaboratorioSerializer(serializers.ModelSerializer):
    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)
    software = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Software.objects.all(), required=False
    )
    software_detalle = SoftwareSerializer(source="software", many=True, read_only=True)
    total_elementos = serializers.SerializerMethodField()
    mapa = serializers.SerializerMethodField(
        help_text="Casillas ocupadas como [fila, columna, tipo] para dibujar la vista previa."
    )

    class Meta:
        model = Laboratorio
        fields = [
            "id",
            "codigo",
            "nombre",
            "ubicacion",
            "capacidad",
            "filas",
            "columnas",
            "estado",
            "estado_nombre",
            "notas",
            "software",
            "software_detalle",
            "activo",
            "total_elementos",
            "mapa",
        ]
        read_only_fields = ["filas", "columnas"]

    def get_total_elementos(self, obj) -> int:
        return getattr(obj, "total_elementos", 0)

    @extend_schema_field(
        serializers.ListField(child=serializers.ListField(child=serializers.IntegerField()))
    )
    def get_mapa(self, obj):
        return [[e.fila, e.columna, e.tipo_id] for e in obj.elementos.all()]


class SoftwareLaboratorioSerializer(serializers.Serializer):
    """Solo los programas instalados de un laboratorio."""

    software = serializers.PrimaryKeyRelatedField(many=True, queryset=Software.objects.all())


class LaboratorioCrearSerializer(LaboratorioSerializer):
    """Al crear se eligen las dimensiones iniciales de la grilla."""

    filas = serializers.IntegerField(min_value=1, max_value=LIMITE_GRILLA, default=8)
    columnas = serializers.IntegerField(min_value=1, max_value=LIMITE_GRILLA, default=10)

    class Meta(LaboratorioSerializer.Meta):
        read_only_fields = []


class CeldaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False, allow_null=True)
    tipo = serializers.PrimaryKeyRelatedField(queryset=TipoElemento.objects.all())
    ip = serializers.IPAddressField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = ElementoLaboratorio
        fields = [
            "id",
            "fila",
            "columna",
            "tipo",
            "etiqueta",
            "ip",
            "mac",
            "codigo_activo",
            "especificaciones",
            "descripcion",
            "estado",
        ]
        # Sin validadores automáticos de unicidad: el servicio revisa las casillas.
        validators = []

    def validate_ip(self, valor):
        return valor or None


class DistribucionSerializer(serializers.Serializer):
    filas = serializers.IntegerField(min_value=1, max_value=LIMITE_GRILLA)
    columnas = serializers.IntegerField(min_value=1, max_value=LIMITE_GRILLA)
    celdas = CeldaSerializer(many=True)


class CredencialSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=False
    )
    tiene_password = serializers.SerializerMethodField()
    ultima_revelacion = serializers.SerializerMethodField()

    class Meta:
        model = CredencialLaboratorio
        fields = [
            "id",
            "laboratorio",
            "descripcion",
            "usuario",
            "password",
            "tiene_password",
            "notas",
            "ultima_revelacion",
            "actualizado_en",
        ]
        read_only_fields = ["actualizado_en"]

    def get_tiene_password(self, obj) -> bool:
        return bool(obj.password_cifrado)

    @extend_schema_field(
        serializers.DictField(child=serializers.CharField(), allow_null=True)
    )
    def get_ultima_revelacion(self, obj):
        ultima = obj.revelaciones.select_related("usuario").first()
        if not ultima:
            return None
        return {"usuario": ultima.usuario.nombre_completo, "fecha": ultima.fecha.isoformat()}

    def validate(self, attrs):
        if self.instance is not None and "laboratorio" in attrs:
            if attrs["laboratorio"] != self.instance.laboratorio:
                raise serializers.ValidationError(
                    {"laboratorio": "Una credencial no se puede mover a otro laboratorio."}
                )
        return attrs
