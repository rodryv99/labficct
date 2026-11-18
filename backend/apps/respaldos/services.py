"""Generación y gestión de respaldos de la base de datos con pg_dump.

pg_dump corre en el contenedor del backend y se conecta a la base por la red de Docker.
Para que exista, la imagen del backend debe traer el cliente de PostgreSQL (ver el
Dockerfile). Si no está, generar() devuelve un error claro en vez de romper la app.
"""

import os
import secrets
import shutil
import subprocess
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from apps.core.errores import ErrorNegocio

from .models import Respaldo

# Formato del archivo: SQL plano, que se restaura con psql (más simple para el usuario).
EXTENSION = "sql"


def _binario() -> str:
    return getattr(settings, "PG_DUMP_BIN", "") or "pg_dump"


def pg_dump_disponible() -> bool:
    binario = _binario()
    if os.path.isabs(binario):
        return os.path.exists(binario)
    return shutil.which(binario) is not None


def directorio() -> Path:
    ruta = Path(getattr(settings, "RESPALDO_DIR", "") or (settings.BASE_DIR / "backups"))
    ruta.mkdir(parents=True, exist_ok=True)
    return ruta


def maximos() -> int:
    return int(getattr(settings, "RESPALDO_MAXIMOS", 20))


def ruta_de(respaldo: Respaldo) -> Path:
    return directorio() / respaldo.archivo


def _conservar_ultimos() -> None:
    """Deja solo los RESPALDO_MAXIMOS más nuevos; borra los demás (archivo y registro)."""
    sobrantes = Respaldo.objects.order_by("-creado_en")[maximos():]
    for viejo in list(sobrantes):
        archivo = directorio() / viejo.archivo
        try:
            archivo.unlink(missing_ok=True)
        except OSError:
            pass
        viejo.delete()


def generar(*, usuario, origen: str = "manual", nota: str = "") -> Respaldo:
    """Crea un respaldo .sql de la base y lo registra. Aplica la retención."""
    if not pg_dump_disponible():
        raise ErrorNegocio(
            "El servidor no tiene disponible la herramienta pg_dump para crear el respaldo. "
            "Reconstruye la imagen del backend (ver las instrucciones) e intenta de nuevo.",
            codigo="sin_pg_dump",
        )

    db = settings.DATABASES["default"]
    carpeta = directorio()
    sello = timezone.localtime().strftime("%Y-%m-%d_%H%M%S")
    # Un sufijo corto evita que dos respaldos del mismo segundo compartan nombre.
    nombre = f"labficct-{sello}-{secrets.token_hex(2)}.{EXTENSION}"
    destino = carpeta / nombre

    comando = [
        _binario(),
        "--no-owner",
        "--no-privileges",
        "--format=plain",
        "--file",
        str(destino),
        "--host",
        str(db.get("HOST") or "localhost"),
        "--port",
        str(db.get("PORT") or 5432),
        "--username",
        str(db.get("USER") or "postgres"),
        str(db.get("NAME")),
    ]
    entorno = os.environ.copy()
    if db.get("PASSWORD"):
        entorno["PGPASSWORD"] = str(db["PASSWORD"])
    entorno["PGCONNECT_TIMEOUT"] = "10"

    try:
        proceso = subprocess.run(
            comando, env=entorno, capture_output=True, text=True, timeout=600
        )
    except FileNotFoundError:
        raise ErrorNegocio(
            "No se encontró pg_dump en el servidor. Reconstruye la imagen del backend.",
            codigo="sin_pg_dump",
        )
    except subprocess.TimeoutExpired:
        destino.unlink(missing_ok=True)
        raise ErrorNegocio(
            "El respaldo tardó demasiado y se canceló. Inténtalo de nuevo.",
            codigo="respaldo_lento",
        )

    if proceso.returncode != 0:
        destino.unlink(missing_ok=True)
        error = (proceso.stderr or "").strip()
        if "server version" in error.lower():
            raise ErrorNegocio(
                "La versión del cliente de PostgreSQL no coincide con la del servidor. "
                "La imagen del backend debe traer postgresql-client-18.",
                codigo="version_incompatible",
                extra={"detalle": error[-500:]},
            )
        raise ErrorNegocio(
            "No se pudo crear el respaldo. Revisa que la base de datos esté accesible.",
            codigo="fallo_respaldo",
            extra={"detalle": error[-500:]},
        )

    tamano = destino.stat().st_size if destino.exists() else 0
    respaldo = Respaldo.objects.create(
        archivo=nombre,
        tamano_bytes=tamano,
        origen=origen,
        base_datos=str(db.get("NAME") or ""),
        nota=nota.strip(),
        creado_por=usuario,
        actualizado_por=usuario,
    )
    _conservar_ultimos()
    return respaldo


def eliminar(respaldo: Respaldo) -> None:
    archivo = ruta_de(respaldo)
    try:
        archivo.unlink(missing_ok=True)
    except OSError:
        pass
    respaldo.delete()
