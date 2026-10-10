from getpass import getpass

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.core.roles import Rol
from apps.usuarios.models import Usuario


class Command(BaseCommand):
    help = "Crea (o convierte) un usuario Superadmin. Sin argumentos, pregunta los datos."

    def add_arguments(self, parser):
        parser.add_argument("--email")
        parser.add_argument("--password")
        parser.add_argument("--nombres", default="")
        parser.add_argument("--apellidos", default="")

    def handle(self, *args, **opciones):
        email = (opciones["email"] or input("Correo: ")).strip().lower()
        if not email:
            raise CommandError("El correo es obligatorio.")

        nombres = opciones["nombres"] or input("Nombres: ").strip() or "Super"
        apellidos = opciones["apellidos"] or input("Apellidos: ").strip() or "Admin"
        password = opciones["password"] or getpass("Contraseña: ")

        try:
            validate_password(password)
        except ValidationError as error:
            raise CommandError(" ".join(error.messages)) from error

        usuario, creado = Usuario.objects.get_or_create(
            email=email, defaults={"nombres": nombres, "apellidos": apellidos}
        )
        usuario.rol = Rol.SUPERADMIN
        usuario.is_staff = True
        usuario.is_superuser = True
        usuario.is_active = True
        usuario.set_password(password)
        usuario.save()

        accion = "creado" if creado else "actualizado"
        self.stdout.write(self.style.SUCCESS(f"Superadmin {accion}: {email}"))
