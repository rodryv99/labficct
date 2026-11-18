"""Pruebas del push sin depender de Firebase.

Sin credenciales de FCM, `push_disponible()` es False y el envío devuelve 0 sin
romper nada. Lo que sí se prueba de verdad: registrar/borrar el token, las
preferencias, el filtro por preferencia y el recordatorio de turno.
"""

from datetime import datetime, time, timedelta

import pytest
from django.conf import settings
from django.utils import timezone

from apps.marcaciones.models import AsignacionHorario, BloqueHorario, HorarioTrabajo
from apps.notificaciones import push
from apps.notificaciones.models import DispositivoPush, Notificacion, PreferenciaPush
from apps.notificaciones.turnos import recordatorios

pytestmark = pytest.mark.django_db

API = f"/{settings.API_PREFIX}"


# ── Dispositivos ────────────────────────────────────────


def test_registrar_dispositivo(cliente, auxiliar):
    c = cliente(auxiliar)
    r = c.post(f"{API}notificaciones/dispositivos/", {"token": "tok-123", "plataforma": "android"})
    assert r.status_code == 200
    assert DispositivoPush.objects.filter(usuario=auxiliar, token="tok-123", activo=True).exists()


def test_registrar_dispositivo_reasigna_token(cliente, auxiliar, docente):
    DispositivoPush.objects.create(usuario=docente, token="compartido", activo=True)
    cliente(auxiliar).post(f"{API}notificaciones/dispositivos/", {"token": "compartido"})
    dispositivo = DispositivoPush.objects.get(token="compartido")
    assert dispositivo.usuario_id == auxiliar.pk  # el teléfono es de quien inicia sesión ahora


def test_baja_dispositivo(cliente, auxiliar):
    DispositivoPush.objects.create(usuario=auxiliar, token="tok-x", activo=True)
    r = cliente(auxiliar).delete(
        f"{API}notificaciones/dispositivos/", {"token": "tok-x"}, format="json"
    )
    assert r.status_code == 200
    assert not DispositivoPush.objects.get(token="tok-x").activo


# ── Preferencias ────────────────────────────────────────


def test_preferencias_por_defecto_y_guardar(cliente, auxiliar):
    c = cliente(auxiliar)
    r = c.get(f"{API}notificaciones/preferencias/")
    assert r.status_code == 200
    assert r.data == {"habilitado": True, "solo_en_turno": False}

    r = c.put(f"{API}notificaciones/preferencias/", {"solo_en_turno": True}, format="json")
    assert r.status_code == 200
    assert r.data["solo_en_turno"] is True
    assert PreferenciaPush.objects.get(usuario=auxiliar).solo_en_turno is True


# ── Filtro por preferencia ──────────────────────────────


def test_destinatarios_respeta_apagado(auxiliar, docente):
    PreferenciaPush.objects.create(usuario=auxiliar, habilitado=False)
    permitidos = push.destinatarios_de_push([auxiliar.pk, docente.pk])
    assert auxiliar.pk not in permitidos  # apagó el push
    assert docente.pk in permitidos  # sin preferencia = recibe


def test_solo_en_turno_sin_horario_igual_recibe(auxiliar):
    # "solo en turno" sin horario asignado no debe silenciar: siempre recibe.
    PreferenciaPush.objects.create(usuario=auxiliar, solo_en_turno=True)
    assert auxiliar.pk in push.destinatarios_de_push([auxiliar.pk])


def test_envio_sin_firebase_no_rompe(auxiliar):
    DispositivoPush.objects.create(usuario=auxiliar, token="tok", activo=True)
    # Sin credenciales de FCM configuradas, devuelve 0 y no lanza.
    assert push.enviar_push_a([auxiliar.pk], titulo="Hola") == 0


# ── Recordatorio de turno ───────────────────────────────


def test_recordatorio_de_turno_crea_aviso(auxiliar):
    ahora = timezone.localtime(timezone.now())
    # Cerca de medianoche el bloque cruzaría de día; en ese caso no se prueba.
    if (ahora.hour * 60 + ahora.minute) + 15 >= 24 * 60:
        pytest.skip("muy cerca de medianoche para armar un turno de prueba")

    inicio = (ahora + timedelta(minutes=10)).time().replace(second=0, microsecond=0)
    fin = time(min(inicio.hour + 1, 23), inicio.minute)
    horario = HorarioTrabajo.objects.create(nombre="Turno de prueba")
    BloqueHorario.objects.create(horario=horario, dia=ahora.weekday(), inicio=inicio, fin=fin)
    AsignacionHorario.objects.create(usuario=auxiliar, horario=horario)

    enviados = recordatorios(timezone.now())
    assert enviados == 1
    aviso = Notificacion.objects.get(destinatario=auxiliar, tipo="turno")
    assert "turno" in aviso.titulo.lower()

    # No se repite: la clave única lo evita.
    assert recordatorios(timezone.now()) == 0
