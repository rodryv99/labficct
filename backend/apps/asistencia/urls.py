from rest_framework.routers import SimpleRouter

from .views import SolicitudAsistenciaViewSet

router = SimpleRouter()
router.register("asistencia", SolicitudAsistenciaViewSet, basename="asistencia")

urlpatterns = router.urls
