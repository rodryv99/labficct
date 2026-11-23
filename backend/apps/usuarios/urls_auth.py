from django.urls import path

from .views_auth import (
    AceptarTerminosView,
    CambiarPasswordView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("terminos/aceptar/", AceptarTerminosView.as_view(), name="auth-terminos-aceptar"),
    path("cambiar-password/", CambiarPasswordView.as_view(), name="auth-cambiar-password"),
]
