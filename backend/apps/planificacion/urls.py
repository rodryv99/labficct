from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    AgendaView,
    DisponibilidadView,
    DocenteViewSet,
    HorarioViewSet,
    MateriaViewSet,
    PeriodoViewSet,
    ReservaViewSet,
)

router = SimpleRouter()
router.register("periodos", PeriodoViewSet, basename="periodo")
router.register("materias", MateriaViewSet, basename="materia")
router.register("docentes", DocenteViewSet, basename="docente")
router.register("horarios", HorarioViewSet, basename="horario")
router.register("reservas", ReservaViewSet, basename="reserva")

urlpatterns = [
    path("agenda/", AgendaView.as_view(), name="agenda"),
    path("disponibilidad/", DisponibilidadView.as_view(), name="disponibilidad"),
    *router.urls,
]
