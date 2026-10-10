from rest_framework.routers import SimpleRouter

from .views import TareaViewSet

router = SimpleRouter()
router.register("tareas", TareaViewSet, basename="tarea")

urlpatterns = router.urls
