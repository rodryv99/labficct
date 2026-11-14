from rest_framework.routers import SimpleRouter

from .views import ReporteViewSet

router = SimpleRouter()
router.register("reportes", ReporteViewSet, basename="reporte")

urlpatterns = router.urls
