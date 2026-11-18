from rest_framework.routers import SimpleRouter

from .views import (
    AuxiliarLugarViewSet,
    HorarioTrabajoViewSet,
    LugarAsistenciaViewSet,
    MarcacionViewSet,
)

router = SimpleRouter()
# Los prefijos más largos van primero: si no, "lugares" se leería como el id de una marcación.
router.register("marcaciones/lugares", LugarAsistenciaViewSet, basename="marcacion-lugar")
router.register("marcaciones/horarios", HorarioTrabajoViewSet, basename="marcacion-horario")
router.register("marcaciones/auxiliares", AuxiliarLugarViewSet, basename="marcacion-auxiliar")
router.register("marcaciones", MarcacionViewSet, basename="marcacion")

urlpatterns = router.urls
