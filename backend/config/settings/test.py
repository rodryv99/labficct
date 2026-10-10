"""Configuración para pytest: rápida y sin depender de Redis."""

from .base import *  # noqa: F401,F403

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_RATES": {"login": "1000/min"},
}
FIELD_ENCRYPTION_KEY = "4x-S_pleeu7MfMTqFvXZK1eMb0bgumQQmGWNfwW8yQo="
MEDIA_ROOT = "/tmp/labficct-test-media"
PRIVADO_ROOT = "/tmp/labficct-test-privado"
