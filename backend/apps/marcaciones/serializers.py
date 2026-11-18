from rest_framework import serializers

from .models import (
    RADIO_MAXIMO_M,
    RADIO_MINIMO_M,
    BloqueHorario,
    HorarioTrabajo,
    LugarAsistencia,
    Marcacion,
)


class LugarAsistenciaSerializer(serializers.ModelSerializer):
    # Cuántos auxiliares lo tienen como lugar propio.
    asignados = serializers.IntegerField(read_only=True, default=0)
    latitud = serializers.FloatField(min_value=-90, max_value=90)
    longitud = serializers.FloatField(min_value=-180, max_value=180)
    radio_m = serializers.IntegerField(min_value=RADIO_MINIMO_M, max_value=RADIO_MAXIMO_M, required=False)
    # Declarado a mano: así DRF no le agrega el validador de "único" de la restricción de la
    # base de datos, que impediría cambiar cuál es el predeterminado (eso lo resuelve la vista).
    predeterminado = serializers.BooleanField(required=False)

    class Meta:
        model = LugarAsistencia
        fields = [
            "id",
            "nombre",
            "referencia",
            "latitud",
            "longitud",
            "radio_m",
            "predeterminado",
            "activo",
            "asignados",
        ]

    def validate_nombre(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("Escribe el nombre del lugar.")
        return valor

    def validate_referencia(self, valor):
        return valor.strip()

    def validate(self, datos):
        def actual(campo, por_defecto):
            if campo in datos:
                return datos[campo]
            return getattr(self.instance, campo) if self.instance else por_defecto

        if actual("predeterminado", False) and not actual("activo", True):
            raise serializers.ValidationError(
                {"activo": "El lugar predeterminado tiene que estar activo."}
            )
        return datos


class LugarBreveSerializer(serializers.ModelSerializer):
    class Meta:
        model = LugarAsistencia
        fields = ["id", "nombre", "referencia", "latitud", "longitud", "radio_m"]


class MarcacionSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.nombre_completo", read_only=True)
    lugar_nombre = serializers.CharField(source="lugar.nombre", read_only=True)
    lugar_latitud = serializers.FloatField(source="lugar.latitud", read_only=True)
    lugar_longitud = serializers.FloatField(source="lugar.longitud", read_only=True)
    radio_m = serializers.IntegerField(source="lugar.radio_m", read_only=True)
    abierta = serializers.BooleanField(read_only=True)
    minutos = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = Marcacion
        fields = [
            "id",
            "usuario",
            "usuario_nombre",
            "lugar",
            "lugar_nombre",
            "lugar_latitud",
            "lugar_longitud",
            "radio_m",
            "fecha",
            "entrada_en",
            "entrada_latitud",
            "entrada_longitud",
            "entrada_precision_m",
            "entrada_distancia_m",
            "salida_en",
            "salida_latitud",
            "salida_longitud",
            "salida_precision_m",
            "salida_distancia_m",
            "salida_manual",
            "nota",
            "turno_inicio",
            "turno_fin",
            "retraso_min",
            "salida_temprana_min",
            "abierta",
            "minutos",
        ]
        read_only_fields = fields


class MarcarSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=["entrada", "salida"])
    latitud = serializers.FloatField(min_value=-90, max_value=90)
    longitud = serializers.FloatField(min_value=-180, max_value=180)
    precision_m = serializers.FloatField(min_value=0, required=False, allow_null=True, default=None)
    # La app confirma que el teléfono verificó la huella justo antes de marcar.
    biometria = serializers.BooleanField(default=False)
    # El teléfono avisa si la ubicación viene de una app que la falsea.
    simulada = serializers.BooleanField(default=False)


class EstadoSerializer(serializers.Serializer):
    """Respuesta de /marcaciones/estado/."""

    lugar = LugarBreveSerializer(allow_null=True)
    abierta = MarcacionSerializer(allow_null=True)
    hoy = MarcacionSerializer(many=True)
    minutos_hoy = serializers.IntegerField()
    precision_maxima_m = serializers.IntegerField()
    ahora = serializers.DateTimeField()


class CerrarSerializer(serializers.Serializer):
    salida_en = serializers.DateTimeField()
    nota = serializers.CharField(max_length=300)


class AuxiliarLugarSerializer(serializers.Serializer):
    """Un auxiliar con su lugar y cómo va hoy."""

    id = serializers.IntegerField()
    nombre_completo = serializers.CharField()
    email = serializers.CharField()
    lugar = serializers.IntegerField(allow_null=True)
    lugar_nombre = serializers.CharField(allow_blank=True)
    lugar_efectivo = serializers.IntegerField(allow_null=True)
    usa_predeterminado = serializers.BooleanField()
    # Su horario de trabajo propio (null = sin horario asignado).
    horario = serializers.IntegerField(allow_null=True)
    horario_nombre = serializers.CharField(allow_blank=True)
    situacion = serializers.ChoiceField(choices=["sin_marcar", "presente", "salio"])
    entrada_en = serializers.DateTimeField(allow_null=True)
    salida_en = serializers.DateTimeField(allow_null=True)
    minutos_hoy = serializers.IntegerField()


class AsignarLugarSerializer(serializers.Serializer):
    lugar = serializers.PrimaryKeyRelatedField(queryset=LugarAsistencia.objects.all(), allow_null=True)


class ResumenSerializer(serializers.Serializer):
    usuario = serializers.IntegerField()
    usuario_nombre = serializers.CharField()
    dias = serializers.IntegerField()
    marcaciones = serializers.IntegerField()
    minutos = serializers.IntegerField()
    horas = serializers.CharField()
    sin_salida = serializers.IntegerField()
    salidas_manuales = serializers.IntegerField()
    retrasos = serializers.IntegerField()
    retraso_total_min = serializers.IntegerField()
    retraso_max_min = serializers.IntegerField()
    retraso_promedio_min = serializers.IntegerField()


# ── Horarios de trabajo ─────────────────────────────────


class BloqueHorarioSerializer(serializers.ModelSerializer):
    dia = serializers.IntegerField(min_value=0, max_value=6)

    class Meta:
        model = BloqueHorario
        fields = ["dia", "inicio", "fin"]


class HorarioTrabajoSerializer(serializers.ModelSerializer):
    bloques = BloqueHorarioSerializer(many=True)
    # Cuántos auxiliares lo tienen asignado.
    asignados = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = HorarioTrabajo
        fields = ["id", "nombre", "descripcion", "activo", "bloques", "asignados"]

    def validate_nombre(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("Escribe el nombre del horario.")
        return valor

    def validate_descripcion(self, valor):
        return valor.strip()

    def validate_bloques(self, valor):
        if not valor:
            raise serializers.ValidationError("Agrega al menos un bloque.")
        return valor


class AsignarHorarioSerializer(serializers.Serializer):
    horario = serializers.PrimaryKeyRelatedField(queryset=HorarioTrabajo.objects.all(), allow_null=True)
