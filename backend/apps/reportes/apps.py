from django.apps import AppConfig


class ReportesConfig(AppConfig):
    """CU24. Sin modelos: solo lee los datos de las otras apps."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.reportes"
    label = "reportes"
    verbose_name = "Reportes"
