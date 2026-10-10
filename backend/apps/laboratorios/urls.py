from rest_framework.routers import SimpleRouter

from .views import CredencialViewSet, LaboratorioViewSet, SoftwareViewSet, TipoElementoViewSet

router = SimpleRouter()
router.register("elementos", TipoElementoViewSet, basename="elemento")
router.register("software", SoftwareViewSet, basename="software")
router.register("laboratorios", LaboratorioViewSet, basename="laboratorio")
router.register("credenciales", CredencialViewSet, basename="credencial")

urlpatterns = router.urls
