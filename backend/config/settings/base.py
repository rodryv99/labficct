"""Configuración común. Todo valor variable sale del archivo .env."""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env()
if (BASE_DIR / ".env").exists():
    environ.Env.read_env(BASE_DIR / ".env")

# ── Núcleo ──────────────────────────────────────────────
SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# Rutas configurables desde el .env
API_PREFIX = env("API_PREFIX", default="api/v1/")
WS_PREFIX = env("WS_PREFIX", default="ws/")
ADMIN_URL = env("ADMIN_URL", default="panel-django/")
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    # Terceros
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    # Propias
    "apps.core",
    "apps.usuarios",
    "apps.laboratorios",
    "apps.planificacion",
    "apps.objetos_perdidos",
    "apps.notificaciones",
    "apps.preferencias",
    "apps.asistencia",
    "apps.bitacora",
    "apps.tareas",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ── Base de datos ───────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB"),
        "USER": env("POSTGRES_USER"),
        "PASSWORD": env("POSTGRES_PASSWORD"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env.int("POSTGRES_PORT", default=5432),
        "CONN_MAX_AGE": 60,
    }
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Usuarios y contraseñas ──────────────────────────────
AUTH_USER_MODEL = "usuarios.Usuario"
AUTHENTICATION_BACKENDS = ["apps.usuarios.backends.CorreoOCodigoBackend"]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── Idioma y hora ───────────────────────────────────────
LANGUAGE_CODE = "es"
TIME_ZONE = env("TIME_ZONE", default="America/La_Paz")
USE_I18N = True
USE_TZ = True

# ── Archivos ────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = env("MEDIA_URL", default="/media/")
MEDIA_ROOT = env("MEDIA_ROOT", default=str(BASE_DIR / "media"))
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
TAMANO_MAXIMO_IMAGEN = 5 * 1024 * 1024  # 5 MB
# Archivos sensibles (fotos del CI al entregar un objeto perdido). Van fuera de
# MEDIA_ROOT: no tienen URL pública y solo se ven por la API, con permiso.
PRIVADO_ROOT = env("PRIVADO_ROOT", default=str(BASE_DIR / "privado"))

# ── Horario de atención de los laboratorios ─────────────
# Clases y reservas deben caber aquí. La web y la app lo leen de /configuracion/.
ATENCION_INICIO = env("ATENCION_INICIO", default="07:00")
ATENCION_FIN = env("ATENCION_FIN", default="22:45")
FRANJAS_HABITUALES = env.list(
    "FRANJAS_HABITUALES",
    default=[
        "07:00-09:15", "09:15-11:30", "11:30-13:45", "13:45-16:00",
        "16:00-18:15", "18:15-20:30", "20:30-22:45",
        "07:00-08:30", "08:30-10:00", "10:00-11:30", "11:30-13:00",
        "14:00-15:30", "15:30-17:00", "18:15-19:45", "19:45-21:15",
    ],
)

# ── Caché (también la usa el límite de intentos de login) ──
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

# ── Django REST framework ───────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.paginacion.Paginacion",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.errores.manejador_de_errores",
    "DEFAULT_THROTTLE_RATES": {"login": "5/min"},
    "DATETIME_FORMAT": "iso-8601",
    "TIME_FORMAT": "%H:%M",
    "TIME_INPUT_FORMATS": ["%H:%M", "%H:%M:%S"],
}

JWT_ACCESS_MINUTES = env.int("JWT_ACCESS_MINUTES", default=15)
JWT_REFRESH_DAYS = env.int("JWT_REFRESH_DAYS", default=7)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=JWT_ACCESS_MINUTES),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=JWT_REFRESH_DAYS),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
# El token de renovación de la web viaja en una cookie httpOnly.
JWT_REFRESH_COOKIE_NAME = env("JWT_REFRESH_COOKIE_NAME", default="labficct_refresh")
JWT_REFRESH_COOKIE_PATH = f"/{API_PREFIX}auth/"
JWT_REFRESH_COOKIE_SECURE = not DEBUG

# ── CORS y CSRF ─────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[FRONTEND_URL])
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "origin",
    "x-cliente",
    "x-csrftoken",
    "x-requested-with",
]
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[FRONTEND_URL])

# ── Cifrado de credenciales de laboratorio ──────────────
FIELD_ENCRYPTION_KEY = env("FIELD_ENCRYPTION_KEY", default="")

# ── Celery ──────────────────────────────────────────────
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
# Tareas periódicas. El worker las ejecuta porque arranca con --beat (docker-compose.yml).
CELERY_BEAT_SCHEDULE = {
    # Alistar/cerrar aulas: cada minuto revisa qué clases y reservas empiezan o terminan.
    "avisos-de-aulas": {"task": "notificaciones.avisos_de_aulas", "schedule": 60.0},
    # Revisiones periódicas que vencen: pasan al pizarrón de tareas y se avisa.
    "revisiones-vencidas": {"task": "bitacora.revisiones_vencidas", "schedule": 15 * 60.0},
    "limpiar-notificaciones": {"task": "notificaciones.limpiar", "schedule": 24 * 60 * 60.0},
}

# ── Avisos a los auxiliares ─────────────────────────────
# Cuántos minutos antes de cada clase o reserva se avisa que alisten el aula.
AVISO_ALISTAR_MINUTOS = env.int("AVISO_ALISTAR_MINUTOS", default=15)

# ── Documentación de la API (OpenAPI) ───────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "API · Laboratorios FICCT",
    "DESCRIPTION": "Gestión de laboratorios de la FICCT (UAGRM).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": r"/api/v[0-9]+",
}

# ── Registro ────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
