"""Cuarta pasada de poblado: la asistencia de los auxiliares (módulo marcaciones).
Úsalo DESPUÉS de poblar_presentacion.

    docker compose exec backend python manage.py poblar_presentacion_marcaciones

Crea 4 turnos de trabajo de lunes a viernes:
    Turno 1 · Mañana        06:45–10:45
    Turno 2 · Media mañana  10:45–14:45
    Turno 3 · Tarde         14:45–18:45
    Turno 4 · Noche         18:45–22:45

Reparte a los 25 auxiliares: 2 en el Laboratorio de redes (123-3) en turnos distintos,
3 en el Laboratorio de electrónica (236-36) y el resto en el Módulo 236; y genera ~4
semanas de marcaciones realistas (algunas con retraso, alguna falta y unas cuantas
jornadas abiertas de hoy).

Es idempotente: no duplica turnos, lugares, asignaciones ni marcaciones (una por
auxiliar y día).
"""

import math
import random
from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.roles import Rol
from apps.marcaciones.models import (
    AsignacionHorario,
    AsignacionLugar,
    BloqueHorario,
    HorarioTrabajo,
    LugarAsistencia,
    Marcacion,
)
from apps.usuarios.models import Usuario

# (nombre, inicio, fin)
TURNOS = [
    ("Turno 1 · Mañana", time(6, 45), time(10, 45)),
    ("Turno 2 · Media mañana", time(10, 45), time(14, 45)),
    ("Turno 3 · Tarde", time(14, 45), time(18, 45)),
    ("Turno 4 · Noche", time(18, 45), time(22, 45)),
]
DIAS_LABORALES = [0, 1, 2, 3, 4]  # lunes a viernes
SEMANAS = 4  # cuántas semanas hacia atrás generar marcaciones

# Lugares de asistencia con su geocerca. Coordenadas aproximadas de la Ciudad
# Universitaria (UV-32), FICCT, Santa Cruz: (nombre, lat, lng, radio_m, predeterminado).
LUGARES = {
    "236": ("FICCT · Módulo 236 (Centro de Cómputo)", -17.77565, -63.19835, 120, True),
    "236-36": ("FICCT · Laboratorio de Electrónica (236-36)", -17.77570, -63.19828, 80, False),
    "123-3": ("FICCT · Laboratorio de Redes (123-3)", -17.77492, -63.19908, 90, False),
}

DOMINIO_AUX = "@ficct.uagrm.edu.bo"


def _haversine(a_lat, a_lng, b_lat, b_lng) -> float:
    """Distancia en metros entre dos puntos (lat/lng)."""
    radio = 6371000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dlmb = math.radians(b_lng - a_lng)
    x = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * radio * math.asin(math.sqrt(x))


class Command(BaseCommand):
    help = "Puebla la asistencia de auxiliares: turnos, lugares de marcación y marcaciones."

    @transaction.atomic
    def handle(self, *args, **options):
        rnd = random.Random(2026)
        hoy = timezone.localdate()
        tz = timezone.get_current_timezone()
        ahora = timezone.localtime().time()

        admin = (
            Usuario.objects.filter(is_superuser=True).order_by("pk").first()
            or Usuario.objects.filter(rol=Rol.ADMIN).order_by("pk").first()
        )
        quien = {"creado_por": admin, "actualizado_por": admin}

        auxiliares = list(
            Usuario.objects.filter(rol=Rol.AUXILIAR, is_active=True, email__endswith=DOMINIO_AUX).order_by("pk")
        )
        if len(auxiliares) < 5:
            self.stdout.write(
                self.style.ERROR("Hay muy pocos auxiliares de la FICCT. Corré primero poblar_presentacion.")
            )
            return

        # 1) Turnos (HorarioTrabajo + bloques de lunes a viernes).
        horarios = []
        for nombre, ini, fin in TURNOS:
            h, creado = HorarioTrabajo.objects.get_or_create(
                nombre=nombre,
                defaults={"descripcion": f"{ini:%H:%M}–{fin:%H:%M}, lunes a viernes", **quien},
            )
            if creado:
                BloqueHorario.objects.bulk_create(
                    [BloqueHorario(horario=h, dia=d, inicio=ini, fin=fin) for d in DIAS_LABORALES]
                )
            horarios.append(h)

        # 2) Lugares de asistencia (geocerca). Solo un lugar puede ser el predeterminado.
        ya_hay_predeterminado = LugarAsistencia.objects.filter(predeterminado=True).exists()
        lugares = {}
        for clave, (nombre, lat, lng, radio, pred) in LUGARES.items():
            pred = pred and not ya_hay_predeterminado
            lugares[clave] = LugarAsistencia.objects.get_or_create(
                nombre=nombre,
                defaults={
                    "referencia": "Ciudad Universitaria UV-32, FICCT",
                    "latitud": lat,
                    "longitud": lng,
                    "radio_m": radio,
                    "predeterminado": pred,
                    **quien,
                },
            )[0]
            if pred:
                ya_hay_predeterminado = True

        # 3) Reparto: 2 en 123-3 (turnos 1 y 3), 3 en 236-36 (turnos 1, 2, 3), el resto en 236.
        plan = []  # (usuario, clave_lugar, indice_turno)
        for i, u in enumerate(auxiliares[:2]):
            plan.append((u, "123-3", (0, 2)[i % 2]))
        for i, u in enumerate(auxiliares[2:5]):
            plan.append((u, "236-36", (0, 1, 2)[i % 3]))
        for i, u in enumerate(auxiliares[5:]):
            plan.append((u, "236", i % 4))

        for u, clave, idx in plan:
            AsignacionLugar.objects.get_or_create(usuario=u, defaults={"lugar": lugares[clave], **quien})
            AsignacionHorario.objects.get_or_create(usuario=u, defaults={"horario": horarios[idx], **quien})

        # 4) Marcaciones: ~4 semanas de lunes a viernes, una por auxiliar y día.
        creadas = 0
        inicio = hoy - timedelta(days=SEMANAS * 7)
        for u, clave, idx in plan:
            lugar = lugares[clave]
            _, t_ini, t_fin = TURNOS[idx]
            dia = inicio
            while dia <= hoy:
                if dia.weekday() not in DIAS_LABORALES:
                    dia += timedelta(days=1)
                    continue
                es_hoy = dia == hoy
                # ~8% de faltas (nunca el día de hoy).
                if not es_hoy and rnd.random() < 0.08:
                    dia += timedelta(days=1)
                    continue
                if Marcacion.objects.filter(usuario=u, fecha=dia).exists():
                    dia += timedelta(days=1)
                    continue

                retraso = rnd.choice([0, 0, 0, 0, 2, 4, 6, 9, 13])
                ent = timezone.make_aware(datetime.combine(dia, t_ini) + timedelta(minutes=retraso), tz)
                e_lat = lugar.latitud + rnd.uniform(-0.0003, 0.0003)
                e_lng = lugar.longitud + rnd.uniform(-0.0003, 0.0003)

                m = Marcacion(
                    usuario=u,
                    lugar=lugar,
                    fecha=dia,
                    entrada_en=ent,
                    entrada_latitud=e_lat,
                    entrada_longitud=e_lng,
                    entrada_precision_m=round(rnd.uniform(5, 18), 1),
                    entrada_distancia_m=round(_haversine(e_lat, e_lng, lugar.latitud, lugar.longitud), 1),
                    turno_inicio=t_ini,
                    turno_fin=t_fin,
                    retraso_min=retraso,
                    **quien,
                )
                # Se deja abierta solo si es hoy y el turno todavía no terminó.
                if not (es_hoy and ahora < t_fin):
                    salida_antes = rnd.choice([0, 0, 0, 0, 3, 7, 12])
                    sal = timezone.make_aware(datetime.combine(dia, t_fin) - timedelta(minutes=salida_antes), tz)
                    s_lat = lugar.latitud + rnd.uniform(-0.0003, 0.0003)
                    s_lng = lugar.longitud + rnd.uniform(-0.0003, 0.0003)
                    m.salida_en = sal
                    m.salida_latitud = s_lat
                    m.salida_longitud = s_lng
                    m.salida_precision_m = round(rnd.uniform(5, 18), 1)
                    m.salida_distancia_m = round(_haversine(s_lat, s_lng, lugar.latitud, lugar.longitud), 1)
                    m.salida_temprana_min = salida_antes
                m.save()
                creadas += 1
                dia += timedelta(days=1)

        self.stdout.write(
            self.style.SUCCESS(
                f"Asistencia poblada: {len(horarios)} turnos, {len(lugares)} lugares, "
                f"{len(plan)} auxiliares asignados, {creadas} marcaciones."
            )
        )
