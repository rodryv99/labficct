from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

from apps.core.roles import Rol


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def _crear(self, email, password, **extra):
        if not email:
            raise ValueError("El correo es obligatorio.")
        usuario = self.model(email=self.normalize_email(email).lower(), **extra)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_user(self, email, password=None, **extra):
        extra.setdefault("rol", Rol.AUXILIAR)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._crear(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(rol=Rol.SUPERADMIN, is_staff=True, is_superuser=True)
        return self._crear(email, password, **extra)


class Usuario(AbstractBaseUser, PermissionsMixin):
    """Usuario del sistema. Inicia sesión con su correo o su código institucional."""

    email = models.EmailField("correo", unique=True)
    codigo = models.CharField(
        "código institucional", max_length=30, unique=True, null=True, blank=True
    )
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.AUXILIAR)
    telefono = models.CharField("teléfono", max_length=30, blank=True)
    is_active = models.BooleanField("activo", default=True)
    is_staff = models.BooleanField("acceso al panel técnico", default=False)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    objects = UsuarioManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["nombres", "apellidos"]

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"
        ordering = ["apellidos", "nombres"]

    def __str__(self):
        return self.nombre_completo or self.email

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombres} {self.apellidos}".strip()
