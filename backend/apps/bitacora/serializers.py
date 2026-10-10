from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.core.permisos import tiene_permiso
from apps.core.roles import Rol
from apps.usuarios.models import Usuario

from .models import EntradaBitacora, RevisionProgramada


class EntradaBitacoraSerializer(serializers.ModelSerializer):
    laboratorio_codigo = serializers.CharField(source="laboratorio.codigo", read_only=True)
    tipo_nombre = serializers.CharField(source="get_tipo_display", read_only=True)
    autor = serializers.IntegerField(source="creado_por_id", read_only=True)
    autor_nombre = serializers.SerializerMethodField()
    revision_titulo = serializers.SerializerMethodField()
    editable = serializers.SerializerMethodField(help_text="Si quien consulta puede editarla o borrarla.")

    class Meta:
        model = EntradaBitacora
        fields = [
            "id",
            "laboratorio",
            "laboratorio_codigo",
            "tipo",
            "tipo_nombre",
            "titulo",
            "descripcion",
            "fecha",
            "elementos",
            "revision",
            "revision_titulo",
            "autor",
            "autor_nombre",
            "editable",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = ["revision", "creado_en", "actualizado_en"]
        extra_kwargs = {"fecha": {"required": False}}

    def get_autor_nombre(self, obj) -> str:
        return obj.creado_por.nombre_completo if obj.creado_por_id else "Sistema"

    def get_revision_titulo(self, obj) -> str:
        return obj.revision.titulo if obj.revision_id else ""

    def get_editable(self, obj) -> bool:
        request = self.context.get("request")
        if request is None:
            return False
        usuario = request.user
        return obj.creado_por_id == usuario.pk or tiene_permiso(usuario, "bitacora.editar_todas")

    def validate_titulo(self, valor):
        return valor.strip()

    def validate_fecha(self, valor):
        if valor > timezone.now() + timedelta(minutes=5):
            raise serializers.ValidationError("La fecha no puede estar en el futuro.")
        return valor


class RevisionSerializer(serializers.ModelSerializer):
    laboratorio_codigo = serializers.CharField(source="laboratorio.codigo", read_only=True)
    laboratorio_nombre = serializers.CharField(source="laboratorio.nombre", read_only=True)
    unidad_nombre = serializers.CharField(source="get_unidad_display", read_only=True)
    frecuencia = serializers.CharField(read_only=True)
    responsable = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.filter(is_active=True, rol__in=[Rol.AUXILIAR, Rol.ADMIN]),
        required=False,
        allow_null=True,
    )
    responsable_nombre = serializers.SerializerMethodField()
    situacion = serializers.SerializerMethodField(help_text="vencida, hoy, pronto (≤ 3 días) o al_dia.")
    tarea_abierta = serializers.SerializerMethodField(help_text="La tarea del pizarrón si ya se abrió.")

    class Meta:
        model = RevisionProgramada
        fields = [
            "id",
            "laboratorio",
            "laboratorio_codigo",
            "laboratorio_nombre",
            "titulo",
            "instrucciones",
            "cada",
            "unidad",
            "unidad_nombre",
            "frecuencia",
            "proxima_fecha",
            "ultima_fecha",
            "responsable",
            "responsable_nombre",
            "activa",
            "situacion",
            "tarea_abierta",
        ]
        read_only_fields = ["ultima_fecha"]

    def get_responsable_nombre(self, obj) -> str:
        return obj.responsable.nombre_completo if obj.responsable_id else ""

    def get_situacion(self, obj) -> str:
        dias = (obj.proxima_fecha - timezone.localdate()).days
        if dias < 0:
            return "vencida"
        if dias == 0:
            return "hoy"
        return "pronto" if dias <= 3 else "al_dia"

    def get_tarea_abierta(self, obj) -> int | None:
        return getattr(obj, "tarea_abierta", None)

    def validate_cada(self, valor):
        if valor < 1:
            raise serializers.ValidationError("Debe ser 1 o más.")
        if valor > 365:
            raise serializers.ValidationError("Como máximo 365.")
        return valor

    def validate_titulo(self, valor):
        return valor.strip()


class RealizarRevisionSerializer(serializers.Serializer):
    nota = serializers.CharField(
        max_length=2000,
        required=False,
        allow_blank=True,
        default="",
        help_text="Qué se revisó y qué se encontró.",
    )
