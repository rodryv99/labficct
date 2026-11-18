from django.apps import AppConfig


class InventarioConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.inventario"
    label = "inventario"
    verbose_name = "Inventario de activos"

    def ready(self):
        # Cada laboratorio es también un lugar del inventario (se crea y se renombra solo).
        from . import senales  # noqa: F401
