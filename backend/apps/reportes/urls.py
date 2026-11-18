"""Rutas del módulo de reportes (bajo API_PREFIX).

Las rutas específicas (dashboard, pivote) van antes que `<reporte_id>` para que
no las capture el patrón general.
"""

from django.urls import path

from .views import (
    CatalogoView,
    DashboardView,
    PivoteDatosView,
    PivoteExportarView,
    PivoteMetaView,
    ReporteDatosView,
    ReporteExportarView,
)

urlpatterns = [
    path("reportes/", CatalogoView.as_view(), name="reportes-catalogo"),
    path("reportes/dashboard/", DashboardView.as_view(), name="reportes-dashboard"),
    path("reportes/pivote/meta/", PivoteMetaView.as_view(), name="reportes-pivote-meta"),
    path("reportes/pivote/", PivoteDatosView.as_view(), name="reportes-pivote"),
    path("reportes/pivote/exportar/", PivoteExportarView.as_view(), name="reportes-pivote-exportar"),
    path("reportes/<str:reporte_id>/exportar/", ReporteExportarView.as_view(), name="reportes-exportar"),
    path("reportes/<str:reporte_id>/", ReporteDatosView.as_view(), name="reportes-datos"),
]
