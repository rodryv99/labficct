from rest_framework.routers import SimpleRouter

from .views import EntradaBitacoraViewSet, RevisionViewSet

router = SimpleRouter()
router.register("bitacora", EntradaBitacoraViewSet, basename="bitacora")
router.register("revisiones", RevisionViewSet, basename="revision")

urlpatterns = router.urls
