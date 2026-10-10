from rest_framework import serializers

from apps.core import atencion
from apps.core.roles import Rol
from apps.laboratorios.models import Laboratorio
from apps.laboratorios.serializers import SoftwareSerializer
from apps.usuarios.models import Usuario

from .models import (
    DiaSemana,
    Docente,
    EstadoReserva,
    ExcepcionHorario,
    Horario,
    Materia,
    PeriodoAcademico,
    Reserva,
)


class PeriodoSerializer(serializers.ModelSerializer):
    total_horarios = serializers.SerializerMethodField()

    class Meta:
        model = PeriodoAcademico
        fields = ["id", "nombre", "fecha_inicio", "fecha_fin", "vigente", "total_horarios"]

    def get_total_horarios(self, obj) -> int:
        return getattr(obj, "total_horarios", 0)

    def validate(self, attrs):
        inicio = attrs.get("fecha_inicio", getattr(self.instance, "fecha_inicio", None))
        fin = attrs.get("fecha_fin", getattr(self.instance, "fecha_fin", None))
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({"fecha_fin": "Debe ser posterior a la fecha de inicio."})
        return attrs


class MateriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Materia
        fields = ["id", "sigla", "nombre"]

    def validate_sigla(self, valor):
        return valor.strip().upper()


class DocenteSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(read_only=True)
    email = serializers.EmailField(max_length=254, required=False, allow_blank=True, default="")
    tiene_usuario = serializers.SerializerMethodField()
    usuario_email = serializers.SerializerMethodField()
    total_horarios = serializers.SerializerMethodField()

    class Meta:
        model = Docente
        fields = [
            "id",
            "nombres",
            "apellidos",
            "nombre_completo",
            "email",
            "telefono",
            "activo",
            "tiene_usuario",
            "usuario_email",
            "total_horarios",
        ]

    def get_tiene_usuario(self, obj) -> bool:
        return obj.usuario_id is not None

    def get_usuario_email(self, obj) -> str:
        return obj.usuario.email if obj.usuario_id else ""

    def get_total_horarios(self, obj) -> int:
        return getattr(obj, "total_horarios", 0)

    def validate_nombres(self, valor):
        return valor.strip()

    def validate_apellidos(self, valor):
        return valor.strip()

    def validate_email(self, valor):
        valor = (valor or "").strip().lower()
        if valor:
            otros = Docente.objects.filter(email__iexact=valor)
            if self.instance is not None:
                otros = otros.exclude(pk=self.instance.pk)
            if otros.exists():
                raise serializers.ValidationError("Ya hay un docente registrado con ese correo.")
        return valor


class HorarioSerializer(serializers.ModelSerializer):
    periodo_nombre = serializers.CharField(source="periodo.nombre", read_only=True)
    laboratorio_codigo = serializers.CharField(source="laboratorio.codigo", read_only=True)
    laboratorio_nombre = serializers.CharField(source="laboratorio.nombre", read_only=True)
    materia_sigla = serializers.CharField(source="materia.sigla", read_only=True)
    materia_nombre = serializers.CharField(source="materia.nombre", read_only=True)
    docente = serializers.PrimaryKeyRelatedField(
        queryset=Docente.objects.all(), required=False, allow_null=True
    )
    docente_nombre = serializers.SerializerMethodField()
    dia_nombre = serializers.CharField(source="get_dia_semana_display", read_only=True)

    class Meta:
        model = Horario
        fields = [
            "id",
            "periodo",
            "periodo_nombre",
            "laboratorio",
            "laboratorio_codigo",
            "laboratorio_nombre",
            "materia",
            "materia_sigla",
            "materia_nombre",
            "grupo",
            "docente",
            "docente_nombre",
            "dia_semana",
            "dia_nombre",
            "hora_inicio",
            "hora_fin",
            "observaciones",
            "activo",
        ]
        # Los choques los revisa services.py con un mensaje claro.
        validators = []

    def get_docente_nombre(self, obj) -> str:
        return obj.docente.nombre_completo if obj.docente_id else ""

    def validate_grupo(self, valor):
        return valor.strip().upper()

    def validate(self, attrs):
        inicio = attrs.get("hora_inicio", getattr(self.instance, "hora_inicio", None))
        fin = attrs.get("hora_fin", getattr(self.instance, "hora_fin", None))
        if inicio and fin and fin <= inicio:
            raise serializers.ValidationError({"hora_fin": "Debe ser posterior a la hora de inicio."})
        # Solo se revisa el horario de atención cuando se cambian las horas: así una
        # clase antigua fuera de rango se puede seguir editando (docente, grupo…).
        if self._cambian_horas(attrs):
            aviso = atencion.mensaje_fuera_de_atencion(inicio, fin)
            if aviso:
                raise serializers.ValidationError({"hora_inicio": aviso})
        return attrs

    def _cambian_horas(self, attrs) -> bool:
        return "hora_inicio" in attrs or "hora_fin" in attrs


class HorarioLoteSerializer(HorarioSerializer):
    """La misma clase en varios días a la vez: {"dias": [1, 3, 5], ...}."""

    dias = serializers.ListField(
        child=serializers.ChoiceField(choices=DiaSemana.choices), min_length=1, write_only=True
    )

    class Meta(HorarioSerializer.Meta):
        fields = [*HorarioSerializer.Meta.fields, "dias"]
        extra_kwargs = {"dia_semana": {"required": False}}


class HorarioLoteEditarSerializer(HorarioLoteSerializer):
    """Edita una clase que se da en varios días: {"ids": [4, 5, 6], "dias": [1, 3], ...}.

    `ids` son los horarios de la fila que se edita (uno por día)."""

    ids = serializers.ListField(child=serializers.IntegerField(), min_length=1, write_only=True)

    class Meta(HorarioLoteSerializer.Meta):
        fields = [*HorarioLoteSerializer.Meta.fields, "ids"]

    def _cambian_horas(self, attrs) -> bool:
        actuales = self.context.get("horarios", [])
        return not actuales or any(
            h.hora_inicio != attrs.get("hora_inicio") or h.hora_fin != attrs.get("hora_fin") for h in actuales
        )


class ClonarHorariosSerializer(serializers.Serializer):
    destino = serializers.PrimaryKeyRelatedField(queryset=PeriodoAcademico.objects.all())


class ClonarHorariosRespuestaSerializer(serializers.Serializer):
    creados = serializers.IntegerField()
    omitidos = serializers.ListField(child=serializers.CharField())


class SuspenderClaseSerializer(serializers.Serializer):
    fecha = serializers.DateField()
    motivo = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")


class ExcepcionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExcepcionHorario
        fields = ["id", "horario", "fecha", "motivo"]


class BloqueSerializer(serializers.Serializer):
    """Un día de la reserva. Se escribe con fecha y horas locales."""

    id = serializers.IntegerField(read_only=True)
    laboratorio = serializers.PrimaryKeyRelatedField(queryset=Laboratorio.objects.all())
    laboratorio_codigo = serializers.CharField(source="laboratorio.codigo", read_only=True)
    laboratorio_nombre = serializers.CharField(source="laboratorio.nombre", read_only=True)
    fecha = serializers.DateField()
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()
    inicio = serializers.DateTimeField(read_only=True)
    fin = serializers.DateTimeField(read_only=True)

    def validate(self, attrs):
        aviso = atencion.mensaje_fuera_de_atencion(attrs["hora_inicio"], attrs["hora_fin"])
        if aviso:
            raise serializers.ValidationError({"hora_inicio": aviso})
        if attrs["hora_fin"] <= attrs["hora_inicio"]:
            raise serializers.ValidationError({"hora_fin": "Debe ser posterior a la hora de inicio."})
        return attrs


class PersonaSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(read_only=True)

    class Meta:
        model = Usuario
        fields = ["id", "nombre_completo"]


class ReservaSerializer(serializers.ModelSerializer):
    solicitante = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.filter(is_active=True), required=False, allow_null=True
    )
    solicitante_nombre = serializers.CharField(source="nombre_solicitante", read_only=True)
    programas_detalle = SoftwareSerializer(source="programas", many=True, read_only=True)
    auxiliares = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Usuario.objects.filter(rol=Rol.AUXILIAR, is_active=True),
        required=False,
    )
    auxiliares_detalle = PersonaSerializer(source="auxiliares", many=True, read_only=True)
    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)
    bloques = BloqueSerializer(many=True)
    creado_por_nombre = serializers.SerializerMethodField()
    aprobada_por_nombre = serializers.SerializerMethodField()
    advertencias = serializers.SerializerMethodField(
        help_text="Avisos que no impiden guardar (p. ej., un programa no instalado)."
    )
    choques = serializers.SerializerMethodField(
        help_text="Solo si está por aprobar: con qué choca ahora (clases u otras reservas)."
    )
    clases_suspendidas = serializers.SerializerMethodField(
        help_text="Clases suspendidas porque esta reserva se aprobó con prioridad (hay que avisar a sus docentes)."
    )

    class Meta:
        model = Reserva
        fields = [
            "id",
            "titulo",
            "descripcion",
            "solicitante",
            "solicitante_externo",
            "solicitante_nombre",
            "contacto",
            "programas",
            "programas_detalle",
            "requiere_apoyo",
            "auxiliares_requeridos",
            "auxiliares",
            "auxiliares_detalle",
            "estado",
            "estado_nombre",
            "motivo_cancelacion",
            "bloques",
            "creado_por_nombre",
            "creado_en",
            "aprobada_por_nombre",
            "aprobada_en",
            "advertencias",
            "choques",
            "clases_suspendidas",
        ]
        # El estado lo decide el sistema: confirmada si está libre, por aprobar si choca.
        read_only_fields = ["estado", "motivo_cancelacion", "creado_en", "aprobada_en"]

    def get_creado_por_nombre(self, obj) -> str:
        return obj.creado_por.nombre_completo if obj.creado_por_id else ""

    def get_aprobada_por_nombre(self, obj) -> str:
        return obj.aprobada_por.nombre_completo if obj.aprobada_por_id else ""

    def get_advertencias(self, obj) -> list[str]:
        return getattr(obj, "_advertencias", [])

    def get_choques(self, obj) -> list[str]:
        from .services import choques_de_reserva

        return choques_de_reserva(obj) if obj.estado == EstadoReserva.PENDIENTE else []

    def get_clases_suspendidas(self, obj) -> list[str]:
        textos = []
        for e in obj.clases_suspendidas.all():
            h = e.horario
            texto = (
                f"{h.materia.sigla} {h.grupo} · {h.get_dia_semana_display().lower()} {e.fecha:%d/%m} · "
                f"{h.hora_inicio:%H:%M}–{h.hora_fin:%H:%M} · {h.laboratorio.codigo}"
            )
            if h.docente_id:
                texto += f" · {h.docente.nombre_completo}"
            textos.append(texto)
        return textos

    def validate(self, attrs):
        solicitante = attrs.get("solicitante", getattr(self.instance, "solicitante", None))
        externo = attrs.get("solicitante_externo", getattr(self.instance, "solicitante_externo", ""))
        if not solicitante and not (externo or "").strip():
            raise serializers.ValidationError(
                {"solicitante": "Indica quién solicita la reserva (usuario o nombre externo)."}
            )
        if "bloques" in attrs and not attrs["bloques"]:
            raise serializers.ValidationError({"bloques": "Agrega al menos un día y horario."})
        if not attrs.get("requiere_apoyo", getattr(self.instance, "requiere_apoyo", False)):
            attrs["auxiliares_requeridos"] = 0
        return attrs


class CancelarReservaSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


class DisponibilidadSerializer(serializers.Serializer):
    laboratorio = serializers.PrimaryKeyRelatedField(queryset=Laboratorio.objects.all())
    fecha = serializers.DateField()
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()
    excluir_reserva = serializers.IntegerField(required=False, allow_null=True)


class DisponibilidadRespuestaSerializer(serializers.Serializer):
    disponible = serializers.BooleanField()
    choques = serializers.ListField(child=serializers.CharField())
    requiere_aprobacion = serializers.BooleanField(
        help_text="True si choca con una clase u otra reserva: se puede guardar, pero queda por aprobar."
    )


class EventoAgendaSerializer(serializers.Serializer):
    """Un evento de la pizarra: una clase de un horario o un bloque de reserva."""

    id = serializers.CharField()
    tipo = serializers.ChoiceField(choices=["clase", "reserva"])
    titulo = serializers.CharField()
    detalle = serializers.CharField(allow_blank=True)
    responsable = serializers.CharField(allow_blank=True)
    laboratorio = serializers.IntegerField()
    laboratorio_codigo = serializers.CharField()
    fecha = serializers.DateField()
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()
    estado = serializers.CharField()
    nota = serializers.CharField(allow_blank=True)
    horario_id = serializers.IntegerField(allow_null=True)
    reserva_id = serializers.IntegerField(allow_null=True)
    requiere_apoyo = serializers.BooleanField()
    programas = serializers.ListField(child=serializers.CharField())
    docente_id = serializers.IntegerField(
        allow_null=True, help_text="Ficha del docente de la clase (o de quien reservó)."
    )
    preferencias = serializers.ListField(
        child=serializers.CharField(), help_text="Preferencias del docente, para quien alista el aula."
    )
