from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import AvisoAulaView, NotificacionViewSet

router = SimpleRouter()
router.register("notificaciones", NotificacionViewSet, basename="notificacion")

urlpatterns = [
    path("avisos/aula/", AvisoAulaView.as_view(), name="aviso-aula"),
    *router.urls,
]
