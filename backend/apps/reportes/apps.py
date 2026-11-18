from django.apps import AppConfig


class ReportesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.reportes"
    label = "reportes"
    verbose_name = "Reportes y BI"

    def ready(self):
        # Importa los selectors para que se registren en el catálogo al arrancar.
        from . import selectors  # noqa: F401
