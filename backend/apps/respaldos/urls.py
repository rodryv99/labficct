from rest_framework.routers import SimpleRouter

from .views import RespaldoViewSet

router = SimpleRouter()
router.register("respaldos", RespaldoViewSet, basename="respaldo")

urlpatterns = router.urls
