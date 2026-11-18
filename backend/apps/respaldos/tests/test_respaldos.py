"""Respaldos de la base de datos: permisos, estado y generación (con pg_dump simulado)."""

import subprocess

import pytest
from django.conf import settings

from apps.respaldos import services
from apps.respaldos.models import Respaldo

pytestmark = pytest.mark.django_db

URL = f"/{settings.API_PREFIX}respaldos/"


def test_un_auxiliar_no_ve_respaldos(cliente, auxiliar):
    assert cliente(auxiliar).get(URL).status_code == 403
    assert cliente(auxiliar).post(f"{URL}generar/").status_code == 403


def test_estado_reporta_si_hay_pg_dump(cliente, admin_lab):
    r = cliente(admin_lab).get(f"{URL}estado/")
    assert r.status_code == 200
    assert "pg_dump_disponible" in r.data
    assert "maximos" in r.data


def test_generar_sin_pg_dump_da_error_claro(cliente, admin_lab, monkeypatch):
    monkeypatch.setattr(services, "pg_dump_disponible", lambda: False)
    r = cliente(admin_lab).post(f"{URL}generar/", {}, format="json")
    assert r.status_code == 400
    assert r.data["codigo"] == "sin_pg_dump"
    assert not Respaldo.objects.exists()


def test_generar_crea_y_descarga_respaldo(cliente, admin_lab, monkeypatch, tmp_path, settings):
    settings.RESPALDO_DIR = str(tmp_path)
    monkeypatch.setattr(services, "pg_dump_disponible", lambda: True)

    def _falso_run(comando, **kwargs):
        # pg_dump escribe en el archivo que sigue a "--file".
        destino = comando[comando.index("--file") + 1]
        with open(destino, "w", encoding="utf-8") as f:
            f.write("-- respaldo de prueba\n")
        return subprocess.CompletedProcess(comando, 0, stdout="", stderr="")

    monkeypatch.setattr(services.subprocess, "run", _falso_run)

    r = cliente(admin_lab).post(f"{URL}generar/", {"nota": "prueba"}, format="json")
    assert r.status_code == 201, r.data
    assert r.data["archivo"].endswith(".sql")
    assert r.data["tamano_bytes"] > 0
    assert Respaldo.objects.count() == 1

    respaldo = Respaldo.objects.first()
    descarga = cliente(admin_lab).get(f"{URL}{respaldo.pk}/descargar/")
    assert descarga.status_code == 200

    # Eliminar borra el registro y el archivo.
    assert cliente(admin_lab).delete(f"{URL}{respaldo.pk}/").status_code == 204
    assert not Respaldo.objects.exists()


def test_retencion_deja_solo_los_mas_nuevos(cliente, admin_lab, monkeypatch, tmp_path, settings):
    settings.RESPALDO_DIR = str(tmp_path)
    settings.RESPALDO_MAXIMOS = 3
    monkeypatch.setattr(services, "pg_dump_disponible", lambda: True)

    contador = {"n": 0}

    def _falso_run(comando, **kwargs):
        contador["n"] += 1
        destino = comando[comando.index("--file") + 1]
        with open(destino, "w", encoding="utf-8") as f:
            f.write(f"-- respaldo {contador['n']}\n")
        return subprocess.CompletedProcess(comando, 0, stdout="", stderr="")

    monkeypatch.setattr(services.subprocess, "run", _falso_run)

    for _ in range(5):
        services.generar(usuario=admin_lab)

    assert Respaldo.objects.count() == 3
