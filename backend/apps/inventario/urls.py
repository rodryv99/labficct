from rest_framework.routers import SimpleRouter

from .views import ActivoViewSet, LugarViewSet, MovimientoViewSet, TipoActivoViewSet, VerificacionViewSet

router = SimpleRouter()
router.register("inventario/tipos", TipoActivoViewSet, basename="inventario-tipo")
router.register("inventario/lugares", LugarViewSet, basename="inventario-lugar")
router.register("inventario/activos", ActivoViewSet, basename="inventario-activo")
router.register("inventario/movimientos", MovimientoViewSet, basename="inventario-movimiento")
router.register("inventario/verificaciones", VerificacionViewSet, basename="inventario-verificacion")

urlpatterns = router.urls
