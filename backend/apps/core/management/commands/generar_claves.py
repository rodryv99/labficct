import secrets

from cryptography.fernet import Fernet
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Genera claves nuevas para DJANGO_SECRET_KEY y FIELD_ENCRYPTION_KEY."

    def handle(self, *args, **options):
        self.stdout.write("Copia estas líneas en backend/.env:\n")
        self.stdout.write(f"DJANGO_SECRET_KEY={secrets.token_urlsafe(50)}")
        self.stdout.write(f"FIELD_ENCRYPTION_KEY={Fernet.generate_key().decode()}")
        self.stdout.write(
            self.style.WARNING(
                "\nSi cambias FIELD_ENCRYPTION_KEY, las credenciales ya guardadas "
                "no se podrán descifrar: vuelve a escribirlas."
            )
        )
