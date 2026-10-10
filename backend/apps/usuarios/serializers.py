from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.permisos import permisos_de

from .models import Usuario


class LoginSerializer(serializers.Serializer):
    usuario = serializers.CharField(help_text="Correo o código institucional.")
    password = serializers.CharField(style={"input_type": "password"}, trim_whitespace=False)
    recordar = serializers.BooleanField(default=True)


class UsuarioMeSerializer(serializers.ModelSerializer):
    """El usuario con sesión iniciada, con la lista de permisos para los menús."""

    nombre_completo = serializers.CharField(read_only=True)
    rol_nombre = serializers.CharField(source="get_rol_display", read_only=True)
    permisos = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = [
            "id",
            "email",
            "codigo",
            "nombres",
            "apellidos",
            "nombre_completo",
            "rol",
            "rol_nombre",
            "telefono",
            "permisos",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_permisos(self, obj):
        return permisos_de(obj)


class MeActualizarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ["telefono"]


class SesionSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField(required=False, help_text="Solo para la app móvil.")
    usuario = UsuarioMeSerializer(required=False)


class CambiarPasswordSerializer(serializers.Serializer):
    actual = serializers.CharField(trim_whitespace=False)
    nueva = serializers.CharField(trim_whitespace=False)


class RestablecerPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(trim_whitespace=False)


class UsuarioSerializer(serializers.ModelSerializer):
    """Gestión de usuarios (Superadmin y Admin)."""

    email = serializers.EmailField(max_length=254)
    codigo = serializers.CharField(
        max_length=30, required=False, allow_blank=True, allow_null=True
    )
    nombre_completo = serializers.CharField(read_only=True)
    rol_nombre = serializers.CharField(source="get_rol_display", read_only=True)
    password = serializers.CharField(
        write_only=True, required=False, trim_whitespace=False, style={"input_type": "password"}
    )
    vincular_docente = serializers.IntegerField(
        write_only=True,
        required=False,
        allow_null=True,
        help_text="Solo rol docente: id de una ficha Docente registrada sin usuario.",
    )
    ficha_docente = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = [
            "id",
            "email",
            "codigo",
            "nombres",
            "apellidos",
            "nombre_completo",
            "rol",
            "rol_nombre",
            "telefono",
            "is_active",
            "last_login",
            "creado_en",
            "password",
            "vincular_docente",
            "ficha_docente",
        ]
        read_only_fields = ["is_active", "last_login", "creado_en"]

    def get_ficha_docente(self, obj) -> dict | None:
        ficha = getattr(obj, "ficha_docente", None)
        return {"id": ficha.id, "nombre_completo": ficha.nombre_completo} if ficha else None

    def _otros(self):
        qs = Usuario.objects.all()
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        return qs

    def validate_email(self, valor):
        valor = valor.strip().lower()
        if self._otros().filter(email__iexact=valor).exists():
            raise serializers.ValidationError("Ya existe un usuario con ese correo.")
        return valor

    def validate_codigo(self, valor):
        valor = (valor or "").strip()
        if not valor:
            return None
        if self._otros().filter(codigo__iexact=valor).exists():
            raise serializers.ValidationError("Ya existe un usuario con ese código.")
        return valor

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Escribe una contraseña inicial."})
        return attrs


class UsuarioOpcionSerializer(serializers.ModelSerializer):
    """Versión corta para listas desplegables (docentes, auxiliares)."""

    nombre_completo = serializers.CharField(read_only=True)

    class Meta:
        model = Usuario
        fields = ["id", "nombre_completo", "email", "rol"]
