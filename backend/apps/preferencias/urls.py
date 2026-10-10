from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import MisPreferenciasView, OpcionPreferenciaViewSet, PreferenciasDocenteViewSet

router = SimpleRouter()
router.register("preferencias/opciones", OpcionPreferenciaViewSet, basename="preferencia-opcion")
router.register("preferencias/docentes", PreferenciasDocenteViewSet, basename="preferencia-docente")

urlpatterns = [
    path("preferencias/mias/", MisPreferenciasView.as_view(), name="mis-preferencias"),
    *router.urls,
]
