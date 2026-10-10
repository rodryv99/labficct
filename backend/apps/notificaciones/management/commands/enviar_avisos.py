"""Envía ahora los avisos que tocan (alistar/cerrar aulas y revisiones que vencen).

Normalmente lo hace solo el worker de Celery; este comando sirve para probar sin esperar:

    docker compose exec backend python manage.py enviar_avisos
"""

from django.core.management.base import BaseCommand

from apps.bitacora.services import revisiones_vencidas
from apps.notificaciones.avisos import avisos_de_aulas


class Command(BaseCommand):
    help = "Envía los avisos de aulas y de revisiones que tocan en este momento."

    def handle(self, *args, **options):
        aulas = avisos_de_aulas()
        tareas = revisiones_vencidas()
        self.stdout.write(
            self.style.SUCCESS(
                f"Avisos revisados. Alistar: {aulas['alistar']}, cerrar: {aulas['cerrar']}. "
                f"Revisiones que pasaron al pizarrón: {tareas}."
            )
        )
