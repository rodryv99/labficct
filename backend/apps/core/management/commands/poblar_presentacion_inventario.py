"""Tercera pasada de poblado: el inventario de activos fijos, con datos reales del
relevamiento patrimonial de la FICCT (formato UAGRM). Úsalo DESPUÉS de poblar_presentacion.

    docker compose exec backend python manage.py poblar_presentacion_inventario

Carga ~1080 activos reales (sillas, CPU, monitores, equipos de red, estabilizadores…)
repartidos entre los laboratorios que ya existen y otros ambientes de la FICCT
(Jefatura, depósito, módulo 232, centros de cómputo 236-47/48). Cada activo entra con
su movimiento de alta. Una parte chica queda en reparación o dañada, para que el tablero
del módulo se vea realista.

Es idempotente: se puede correr varias veces sin duplicar (salta los códigos que ya
existen). Los datos salen de datos_activos_ficct.csv, junto a este archivo.
"""

import csv
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.roles import Rol
from apps.inventario.models import (
    Activo,
    EstadoActivo,
    Lugar,
    MovimientoActivo,
    TipoActivo,
    TipoLugar,
    TipoMovimiento,
)
from apps.inventario.services import sincronizar_lugar_de_laboratorio
from apps.laboratorios.models import Laboratorio
from apps.usuarios.models import Usuario

ARCHIVO = Path(__file__).with_name("datos_activos_ficct.csv")


def _estado_variado(codigo: str, base: str) -> str:
    """El relevamiento solo trae «bueno/regular» (= operativo). Para que el inventario
    no se vea plano, una parte chica queda en reparación o dañada, de forma determinista
    por código (así no cambia entre corridas)."""
    r = sum(ord(c) for c in codigo) % 100
    if r < 4:
        return EstadoActivo.EN_REPARACION
    if r < 6:
        return EstadoActivo.DANADO
    return base or EstadoActivo.OPERATIVO


class Command(BaseCommand):
    help = "Puebla el inventario de activos fijos con datos reales de la FICCT (formato UAGRM)."

    @transaction.atomic
    def handle(self, *args, **options):
        admin = (
            Usuario.objects.filter(is_superuser=True).order_by("pk").first()
            or Usuario.objects.filter(rol=Rol.ADMIN).order_by("pk").first()
        )
        if admin is None:
            self.stdout.write(
                self.style.ERROR("No hay un usuario admin/superadmin. Corré primero poblar_presentacion.")
            )
            return
        if not ARCHIVO.exists():
            self.stdout.write(
                self.style.ERROR(
                    f"No encuentro el archivo de datos: {ARCHIVO.name} (debe estar junto a este comando)."
                )
            )
            return

        quien = {"creado_por": admin, "actualizado_por": admin}

        # 1) Lugar por laboratorio (uno por lab, como en el inventario normal).
        labs = {lab.codigo: lab for lab in Laboratorio.objects.all()}
        lugar_de_lab = {cod: sincronizar_lugar_de_laboratorio(lab) for cod, lab in labs.items()}

        filas = list(csv.DictReader(ARCHIVO.open(encoding="utf-8")))

        # 2) Tipos de activo.
        tipos = {}
        for nombre in sorted({f["tipo"] for f in filas if f["tipo"]}):
            tipos[nombre] = TipoActivo.objects.get_or_create(nombre=nombre, defaults=dict(quien))[0]

        # 3) Lugares «otros» (Jefatura, depósito, módulo 232, centros de cómputo 236-47/48…).
        lugares_otros = {}
        for nombre in sorted({f["lugar_otro"] for f in filas if f["lugar_otro"]}):
            tipo_lugar = TipoLugar.DEPOSITO if "depósito" in nombre.lower() else TipoLugar.OTRO
            lugares_otros[nombre] = Lugar.objects.get_or_create(
                nombre=nombre, laboratorio=None, defaults={"tipo": tipo_lugar, **quien}
            )[0]

        # 4) Activos nuevos (saltar los que ya existen).
        existentes = set(
            Activo.objects.filter(codigo__in=[f["codigo"] for f in filas]).values_list("codigo", flat=True)
        )
        hoy = timezone.localdate()
        nuevos = []
        for f in filas:
            if f["codigo"] in existentes:
                continue
            if f["lab"]:
                lugar = lugar_de_lab.get(f["lab"])
                if lugar is None:  # el lab del documento no existe en el sistema: va a un ambiente general.
                    lugar = lugares_otros.setdefault(
                        "Depósito FICCT (4to piso)",
                        Lugar.objects.get_or_create(
                            nombre="Depósito FICCT (4to piso)",
                            laboratorio=None,
                            defaults={"tipo": TipoLugar.DEPOSITO, **quien},
                        )[0],
                    )
            else:
                lugar = lugares_otros[f["lugar_otro"]]
            nuevos.append(
                Activo(
                    codigo=f["codigo"],
                    descripcion=f["descripcion"][:200],
                    tipo=tipos.get(f["tipo"]),
                    lugar=lugar,
                    estado=_estado_variado(f["codigo"], f["estado"]),
                    fecha_adquisicion=f["fecha"] or None,
                    responsable="5599-HIGUERAS HUANCA LUIS ENRIQUE",
                    observaciones="Relevamiento patrimonial UAGRM 2025.",
                    **quien,
                )
            )
            existentes.add(f["codigo"])

        Activo.objects.bulk_create(nuevos, batch_size=500)

        # 5) Movimiento de alta por cada activo nuevo.
        MovimientoActivo.objects.bulk_create(
            [
                MovimientoActivo(
                    activo=a,
                    tipo=TipoMovimiento.ALTA,
                    fecha=hoy,
                    lugar_destino_id=a.lugar_id,
                    estado_nuevo=a.estado,
                    motivo="Alta por relevamiento patrimonial.",
                    **quien,
                )
                for a in nuevos
            ],
            batch_size=500,
        )

        total = Activo.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Inventario poblado: {len(nuevos)} activos nuevos (total {total}). "
                f"Tipos: {len(tipos)}. Lugares extra: {len(lugares_otros)}."
            )
        )
