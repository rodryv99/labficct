import json
import re

from rest_framework import serializers

from apps.core.roles import Rol
from apps.usuarios.models import Usuario

from .models import (
    Activo,
    CambioInventario,
    EstadoActivo,
    ItemVerificacion,
    Lugar,
    MovimientoActivo,
    ResultadoVerificacion,
    TipoActivo,
    TipoLugar,
    Verificacion,
)

# Letras y números, con guiones opcionales entre grupos: A12345, FICCT-PC-0042.
PATRON_CODIGO = re.compile(r"^[A-Z0-9]+(-[A-Z0-9]+)*$")


def _nombre(usuario) -> str:
    return usuario.nombre_completo if usuario else ""


class TipoActivoSerializer(serializers.ModelSerializer):
    total_activos = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = TipoActivo
        fields = ["id", "nombre", "descripcion", "activo", "total_activos"]

    def validate_nombre(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("Escribe un nombre.")
        return valor


class LugarSerializer(serializers.ModelSerializer):
    tipo_nombre = serializers.CharField(source="get_tipo_display", read_only=True)
    total_activos = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Lugar
        fields = [
            "id",
            "nombre",
            "tipo",
            "tipo_nombre",
            "laboratorio",
            "descripcion",
            "activo",
            "total_activos",
        ]
        read_only_fields = ["laboratorio"]

    def validate_nombre(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("Escribe un nombre.")
        return valor

    def validate(self, attrs):
        lugar = self.instance
        if lugar is not None and lugar.laboratorio_id:
            # El lugar de un laboratorio sigue al laboratorio: aquí solo se edita la descripción.
            for campo in ("nombre", "tipo", "activo"):
                if campo in attrs and attrs[campo] != getattr(lugar, campo):
                    raise serializers.ValidationError(
                        {campo: "Este lugar es un laboratorio: cámbialo desde Laboratorios."}
                    )
        elif attrs.get("tipo") == TipoLugar.LABORATORIO:
            raise serializers.ValidationError(
                {"tipo": "Los laboratorios se crean en Laboratorios y aparecen aquí solos."}
            )
        nombre = attrs.get("nombre")
        if nombre:
            repetido = Lugar.objects.filter(nombre__iexact=nombre)
            if lugar is not None:
                repetido = repetido.exclude(pk=lugar.pk)
            if repetido.exists():
                raise serializers.ValidationError({"nombre": "Ya hay un lugar con ese nombre."})
        return attrs


class CambioSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = CambioInventario
        fields = ["id", "movimiento", "usuario_nombre", "cambios", "creado_en"]
        read_only_fields = fields

    def get_usuario_nombre(self, obj) -> str:
        return _nombre(obj.usuario) or "Sistema"


class MovimientoSerializer(serializers.ModelSerializer):
    """Un movimiento. Solo se corrigen la fecha, el motivo y el documento."""

    tipo_nombre = serializers.CharField(source="get_tipo_display", read_only=True)
    activo_codigo = serializers.CharField(source="activo.codigo", read_only=True)
    activo_descripcion = serializers.CharField(source="activo.descripcion", read_only=True)
    lugar_origen_nombre = serializers.CharField(source="lugar_origen.nombre", read_only=True, default="")
    lugar_destino_nombre = serializers.CharField(source="lugar_destino.nombre", read_only=True, default="")
    estado_anterior_nombre = serializers.CharField(source="get_estado_anterior_display", read_only=True)
    estado_nuevo_nombre = serializers.CharField(source="get_estado_nuevo_display", read_only=True)
    registrado_por = serializers.SerializerMethodField()
    corregido = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoActivo
        fields = [
            "id",
            "activo",
            "activo_codigo",
            "activo_descripcion",
            "tipo",
            "tipo_nombre",
            "fecha",
            "lugar_origen",
            "lugar_origen_nombre",
            "lugar_destino",
            "lugar_destino_nombre",
            "estado_anterior",
            "estado_anterior_nombre",
            "estado_nuevo",
            "estado_nuevo_nombre",
            "motivo",
            "documento",
            "registrado_por",
            "corregido",
            "creado_en",
        ]
        read_only_fields = [
            "activo",
            "tipo",
            "lugar_origen",
            "lugar_destino",
            "estado_anterior",
            "estado_nuevo",
            "creado_en",
        ]

    def get_registrado_por(self, obj) -> str:
        return _nombre(obj.creado_por) or "Sistema"

    def get_corregido(self, obj) -> bool:
        return len(obj.cambios.all()) > 0

    def validate_motivo(self, valor):
        return valor.strip()

    def validate_documento(self, valor):
        return valor.strip()


class ActivoSerializer(serializers.ModelSerializer):
    """Un activo en la lista. El lugar y el estado se eligen al crearlo; después
    cambian solo con un movimiento (trasladar, cambiar estado, dar de baja)."""

    tipo = serializers.PrimaryKeyRelatedField(
        queryset=TipoActivo.objects.all(), required=False, allow_null=True
    )
    tipo_nombre = serializers.SerializerMethodField()
    lugar_nombre = serializers.CharField(source="lugar.nombre", read_only=True)
    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)

    def get_tipo_nombre(self, obj) -> str:
        return obj.tipo.nombre if obj.tipo_id else ""

    class Meta:
        model = Activo
        fields = [
            "id",
            "codigo",
            "descripcion",
            "tipo",
            "tipo_nombre",
            "marca",
            "modelo",
            "serie",
            "fecha_adquisicion",
            "estado",
            "estado_nombre",
            "lugar",
            "lugar_nombre",
            "observaciones",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = ["creado_en", "actualizado_en"]
        # La unicidad del código se revisa abajo, sin distinguir mayúsculas.
        extra_kwargs = {"codigo": {"validators": []}}

    def validate_codigo(self, valor):
        valor = re.sub(r"\s+", "", valor).upper()
        if not PATRON_CODIGO.match(valor):
            raise serializers.ValidationError(
                "Usa solo letras y números (puede llevar guiones). Ej.: A12345."
            )
        repetido = Activo.objects.filter(codigo__iexact=valor)
        if self.instance is not None:
            repetido = repetido.exclude(pk=self.instance.pk)
        if repetido.exists():
            raise serializers.ValidationError("Ya existe un activo con ese código.")
        return valor

    def validate_descripcion(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("Describe el activo.")
        return valor

    def validate(self, attrs):
        for campo in ("marca", "modelo", "serie", "observaciones"):
            if campo in attrs:
                attrs[campo] = attrs[campo].strip()
        if self.instance is None:
            if attrs.get("estado") == EstadoActivo.BAJA:
                raise serializers.ValidationError(
                    {"estado": "Un activo nuevo no puede entrar ya dado de baja."}
                )
            lugar = attrs.get("lugar")
            if lugar is not None and not lugar.activo:
                raise serializers.ValidationError({"lugar": "Ese lugar está desactivado."})
        return attrs


class ActivoDetalleSerializer(ActivoSerializer):
    movimientos = MovimientoSerializer(many=True, read_only=True)
    cambios = CambioSerializer(many=True, read_only=True)
    creado_por_nombre = serializers.SerializerMethodField()
    # Si alguna casilla de un laboratorio lleva este mismo código de activo.
    en_mapa = serializers.SerializerMethodField()

    class Meta(ActivoSerializer.Meta):
        fields = [*ActivoSerializer.Meta.fields, "creado_por_nombre", "en_mapa", "movimientos", "cambios"]

    def get_creado_por_nombre(self, obj) -> str:
        return _nombre(obj.creado_por) or "Sistema"

    def get_en_mapa(self, obj) -> list[dict]:
        from apps.laboratorios.models import ElementoLaboratorio

        casillas = ElementoLaboratorio.objects.filter(codigo_activo__iexact=obj.codigo).select_related(
            "laboratorio", "tipo"
        )
        return [
            {
                "laboratorio": c.laboratorio_id,
                "laboratorio_codigo": c.laboratorio.codigo,
                "etiqueta": c.etiqueta or c.tipo.nombre,
            }
            for c in casillas
        ]


class DatosMovimientoSerializer(serializers.Serializer):
    """Lo común a trasladar, cambiar de estado y dar de baja."""

    fecha = serializers.DateField(required=False, allow_null=True, default=None)
    motivo = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    documento = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")


class TrasladarSerializer(DatosMovimientoSerializer):
    lugar = serializers.PrimaryKeyRelatedField(queryset=Lugar.objects.filter(activo=True))


class CambiarEstadoSerializer(DatosMovimientoSerializer):
    estado = serializers.ChoiceField(
        choices=[(e.value, e.label) for e in EstadoActivo if e != EstadoActivo.BAJA]
    )


class BajaSerializer(DatosMovimientoSerializer):
    motivo = serializers.CharField(max_length=2000)


# ── Verificaciones ──


class PersonaSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(read_only=True)

    class Meta:
        model = Usuario
        fields = ["id", "nombre_completo"]


class ItemSerializer(serializers.ModelSerializer):
    resultado_nombre = serializers.CharField(source="get_resultado_display", read_only=True)
    lugar_encontrado_nombre = serializers.CharField(
        source="lugar_encontrado.nombre", read_only=True, default=""
    )
    verificado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ItemVerificacion
        fields = [
            "id",
            "activo",
            "codigo",
            "descripcion",
            "tipo_nombre",
            "lugar",
            "lugar_nombre",
            "resultado",
            "resultado_nombre",
            "lugar_encontrado",
            "lugar_encontrado_nombre",
            "nota",
            "verificado_por_nombre",
            "verificado_en",
        ]
        read_only_fields = fields

    def get_verificado_por_nombre(self, obj) -> str:
        return _nombre(obj.verificado_por)


class VerificacionSerializer(serializers.ModelSerializer):
    """Una verificación en la lista, con sus totales (sin los activos)."""

    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)
    responsables_detalle = PersonaSerializer(source="responsables", many=True, read_only=True)
    creado_por_nombre = serializers.SerializerMethodField()
    cerrada_por_nombre = serializers.SerializerMethodField()
    conteo = serializers.SerializerMethodField()
    progreso = serializers.SerializerMethodField()
    puede_marcar = serializers.SerializerMethodField()

    class Meta:
        model = Verificacion
        fields = [
            "id",
            "titulo",
            "instrucciones",
            "alcance",
            "estado",
            "estado_nombre",
            "responsables",
            "responsables_detalle",
            "fecha_limite",
            "tarea",
            "conclusion",
            "creado_por_nombre",
            "creado_en",
            "cerrada_por_nombre",
            "cerrada_en",
            "conteo",
            "progreso",
            "puede_marcar",
        ]
        read_only_fields = fields

    def get_creado_por_nombre(self, obj) -> str:
        return _nombre(obj.creado_por) or "Sistema"

    def get_cerrada_por_nombre(self, obj) -> str:
        return _nombre(obj.cerrada_por)

    def get_conteo(self, obj) -> dict:
        # Los totales vienen anotados en la consulta (services.conteos_en_lista).
        total = getattr(obj, "total", 0)
        pendientes = getattr(obj, "pendientes", 0)
        return {
            "total": total,
            "revisados": total - pendientes,
            "pendientes": pendientes,
            "esta": getattr(obj, "n_esta", 0),
            "falta": getattr(obj, "n_falta", 0),
            "otro_lugar": getattr(obj, "n_otro_lugar", 0),
            "danado": getattr(obj, "n_danado", 0),
        }

    def get_progreso(self, obj) -> int:
        total = getattr(obj, "total", 0)
        return (total - getattr(obj, "pendientes", 0)) * 100 // total if total else 0

    def get_puede_marcar(self, obj) -> bool:
        from .services import puede_marcar

        peticion = self.context.get("request")
        return bool(peticion and obj.estado == "abierta" and puede_marcar(obj, peticion.user))


class VerificacionDetalleSerializer(VerificacionSerializer):
    items = ItemSerializer(many=True, read_only=True)

    class Meta(VerificacionSerializer.Meta):
        fields = [*VerificacionSerializer.Meta.fields, "items"]
        read_only_fields = fields


class CrearVerificacionSerializer(serializers.Serializer):
    """Qué verificar: una selección de activos, o los que cumplan los filtros (sin filtros = todos)."""

    titulo = serializers.CharField(max_length=150)
    instrucciones = serializers.CharField(max_length=4000, required=False, allow_blank=True, default="")
    fecha_limite = serializers.DateField(required=False, allow_null=True, default=None)
    responsables = serializers.PrimaryKeyRelatedField(
        many=True,
        required=False,
        queryset=Usuario.objects.filter(is_active=True, rol__in=[Rol.AUXILIAR, Rol.ADMIN, Rol.SUPERADMIN]),
    )
    tipos = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=TipoActivo.objects.all())
    lugares = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=Lugar.objects.all())
    activos = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=Activo.objects.all())

    def validate_titulo(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("Escribe un título.")
        return valor

    def validate_instrucciones(self, valor):
        return valor.strip()


class MarcarSerializer(serializers.Serializer):
    items = serializers.PrimaryKeyRelatedField(many=True, queryset=ItemVerificacion.objects.all())
    resultado = serializers.ChoiceField(choices=ResultadoVerificacion.choices)
    lugar_encontrado = serializers.PrimaryKeyRelatedField(
        queryset=Lugar.objects.all(), required=False, allow_null=True, default=None
    )
    nota = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")

    def validate_items(self, valor):
        if not valor:
            raise serializers.ValidationError("Elige al menos un activo.")
        return valor


class CerrarSerializer(serializers.Serializer):
    conclusion = serializers.CharField(max_length=4000, required=False, allow_blank=True, default="")


# ── Importar ──

MAX_ARCHIVO = 5 * 1024 * 1024  # 5 MB


class ImportarActivosSerializer(serializers.Serializer):
    """Sube una planilla (Excel o CSV). Primero se analiza (sin guardar); con `confirmar` se crea."""

    archivo = serializers.FileField()
    confirmar = serializers.BooleanField(default=False)
    # Si la primera fila con datos son los títulos de las columnas.
    titulos = serializers.ChoiceField(choices=["auto", "si", "no"], default="auto")
    # Qué campo es cada columna, en orden, como JSON: ["codigo", "descripcion", "", "lugar"].
    mapeo = serializers.CharField(required=False, allow_blank=True)
    # Lugar para las filas que no traigan uno.
    lugar_por_defecto = serializers.PrimaryKeyRelatedField(
        queryset=Lugar.objects.filter(activo=True), required=False, allow_null=True, default=None
    )

    def validate_archivo(self, archivo):
        if archivo.size > MAX_ARCHIVO:
            raise serializers.ValidationError(
                "El archivo supera los 5 MB. Quítale columnas de adorno o divídelo."
            )
        if not archivo.name.lower().endswith((".xlsx", ".xlsm", ".csv", ".txt")):
            raise serializers.ValidationError("Sube un Excel (.xlsx) o un CSV.")
        return archivo

    def validate_mapeo(self, valor):
        if not valor:
            return None
        try:
            datos = json.loads(valor)
        except ValueError as error:
            raise serializers.ValidationError("No se entendió la elección de columnas.") from error
        if not isinstance(datos, list) or not all(isinstance(x, str) for x in datos):
            raise serializers.ValidationError("No se entendió la elección de columnas.")
        return datos
