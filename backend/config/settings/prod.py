"""Producción: se completa en la fase de despliegue."""

from .base import *  # noqa: F401,F403

DEBUG = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
JWT_REFRESH_COOKIE_SECURE = True
# La web (Netlify) y la API (Render) viven en dominios distintos: la cookie de
# refresh tiene que ser SameSite=None para viajar en las peticiones cross-site.
# (Requiere Secure=True, que ya está arriba.) Si algún día sirves ambos bajo el
# mismo dominio, podés volver a "Lax" con la env JWT_REFRESH_COOKIE_SAMESITE.
JWT_REFRESH_COOKIE_SAMESITE = "None"
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
SECURE_CONTENT_TYPE_NOSNIFF = True

# ── Base de datos gestionada (Neon u otro Postgres en la nube): exigir SSL ──
DATABASES["default"]["OPTIONS"] = {"sslmode": "require"}  # noqa: F405

# ── Estáticos del panel de administración servidos por WhiteNoise ──
# El frontend va aparte (Netlify); esto es solo para /panel-django/ y la API navegable.
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
