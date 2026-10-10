from rest_framework.routers import SimpleRouter

from .views import ObjetoPerdidoViewSet

router = SimpleRouter()
router.register("objetos-perdidos", ObjetoPerdidoViewSet, basename="objeto-perdido")

urlpatterns = router.urls
