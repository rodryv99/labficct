from django.utils import timezone
from rest_framework import serializers

from apps.core.roles import Rol
from apps.usuarios.models import Usuario

from .models import AvanceTarea, EstadoTarea, Tarea


class PersonaSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(read_only=True)

    class Meta:
        model = Usuario
        fields = ["id", "nombre_completo"]


class AvanceSerializer(serializers.ModelSerializer):
    autor_nombre = serializers.SerializerMethodField()
    estado_nuevo_nombre = serializers.CharField(source="get_estado_nuevo_display", read_only=True)

    class Meta:
        model = AvanceTarea
        fields = [
            "id",
            "autor",
            "autor_nombre",
            "texto",
            "progreso",
            "estado_anterior",
            "estado_nuevo",
            "estado_nuevo_nombre",
            "creado_en",
        ]
        read_only_fields = fields

    def get_autor_nombre(self, obj) -> str:
        return obj.autor.nombre_completo if obj.autor_id else "Sistema"


class TareaSerializer(serializers.ModelSerializer):
    """Una tarjeta del pizarrón (sin el historial completo)."""

    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)
    prioridad_nombre = serializers.CharField(source="get_prioridad_display", read_only=True)
    laboratorio_codigo = serializers.CharField(source="laboratorio.codigo", read_only=True, default="")
    responsables = serializers.PrimaryKeyRelatedField(
        many=True,
        required=False,
        queryset=Usuario.objects.filter(is_active=True, rol__in=[Rol.AUXILIAR, Rol.ADMIN, Rol.SUPERADMIN]),
    )
    responsables_detalle = PersonaSerializer(source="responsables", many=True, read_only=True)
    creado_por_nombre = serializers.SerializerMethodField()
    completada_por_nombre = serializers.SerializerMethodField()
    revision_titulo = serializers.SerializerMethodField()
    vencida = serializers.SerializerMethodField()
    total_avances = serializers.SerializerMethodField()
    ultimo_avance = serializers.SerializerMethodField()

    class Meta:
        model = Tarea
        fields = [
            "id",
            "titulo",
            "descripcion",
            "estado",
            "estado_nombre",
            "prioridad",
            "prioridad_nombre",
            "laboratorio",
            "laboratorio_codigo",
            "responsables",
            "responsables_detalle",
            "fecha_limite",
            "vencida",
            "progreso",
            "creado_por",
            "creado_por_nombre",
            "creado_en",
            "actualizado_en",
            "completada_en",
            "completada_por_nombre",
            "revision",
            "revision_titulo",
            "total_avances",
            "ultimo_avance",
        ]
        read_only_fields = [
            "progreso",
            "creado_por",
            "creado_en",
            "actualizado_en",
            "completada_en",
            "revision",
        ]

    def get_creado_por_nombre(self, obj) -> str:
        return obj.creado_por.nombre_completo if obj.creado_por_id else "Sistema"

    def get_completada_por_nombre(self, obj) -> str:
        return obj.completada_por.nombre_completo if obj.completada_por_id else ""

    def get_revision_titulo(self, obj) -> str:
        return obj.revision.titulo if obj.revision_id else ""

    def get_vencida(self, obj) -> bool:
        return bool(
            obj.fecha_limite and obj.estado != EstadoTarea.HECHA and obj.fecha_limite < timezone.localdate()
        )

    def _avances(self, obj) -> list:
        return list(obj.avances.all())

    def get_total_avances(self, obj) -> int:
        return len(self._avances(obj))

    def get_ultimo_avance(self, obj) -> dict | None:
        con_texto = [a for a in self._avances(obj) if a.texto]
        return AvanceSerializer(con_texto[-1]).data if con_texto else None

    def validate_titulo(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("Escribe un título.")
        return valor


class TareaDetalleSerializer(TareaSerializer):
    avances = AvanceSerializer(many=True, read_only=True)

    class Meta(TareaSerializer.Meta):
        fields = [*TareaSerializer.Meta.fields, "avances"]


class CambiarEstadoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=EstadoTarea.choices)
    nota = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")


class NuevoAvanceSerializer(serializers.Serializer):
    texto = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    progreso = serializers.IntegerField(
        min_value=0, max_value=100, required=False, allow_null=True, default=None
    )
    estado = serializers.ChoiceField(
        choices=EstadoTarea.choices, required=False, allow_null=True, default=None
    )
