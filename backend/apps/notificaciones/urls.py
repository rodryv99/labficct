from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    AvisoAulaView,
    DispositivosView,
    NotificacionViewSet,
    PreferenciasPushView,
    TickView,
)

router = SimpleRouter()
router.register("notificaciones", NotificacionViewSet, basename="notificacion")

urlpatterns = [
    path("avisos/aula/", AvisoAulaView.as_view(), name="aviso-aula"),
    path("notificaciones/tick/", TickView.as_view(), name="tick"),
    path("notificaciones/dispositivos/", DispositivosView.as_view(), name="dispositivos-push"),
    path("notificaciones/preferencias/", PreferenciasPushView.as_view(), name="preferencias-push"),
    *router.urls,
]
