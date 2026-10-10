"""Reglas de negocio de laboratorios: distribución de la grilla y credenciales."""

from django.db import transaction
from django.utils import timezone

from apps.core.cifrado import cifrar, descifrar
from apps.core.errores import Conflicto, ErrorNegocio

from .models import (
    LIMITE_GRILLA,
    CredencialLaboratorio,
    ElementoLaboratorio,
    Laboratorio,
    RevelacionCredencial,
)

CAMPOS_CELDA = [
    "tipo",
    "fila",
    "columna",
    "etiqueta",
    "ip",
    "mac",
    "codigo_activo",
    "especificaciones",
    "descripcion",
    "estado",
]

VALORES_POR_DEFECTO = {
    "etiqueta": "",
    "ip": None,
    "mac": "",
    "codigo_activo": "",
    "especificaciones": "",
    "descripcion": "",
    "estado": "operativo",
}


def distribucion(laboratorio: Laboratorio) -> dict:
    return {
        "filas": laboratorio.filas,
        "columnas": laboratorio.columnas,
        "celdas": list(laboratorio.elementos.select_related("tipo").all()),
    }


@transaction.atomic
def guardar_distribucion(*, laboratorio: Laboratorio, filas: int, columnas: int, celdas: list, usuario):
    """Reemplaza la distribución completa del laboratorio.

    El cliente envía todas las casillas ocupadas. Las que traen `id` se
    actualizan (pueden cambiar de casilla), las nuevas se crean y las que ya
    no vienen se eliminan. La restricción de casilla única es diferida, así
    que intercambiar dos elementos dentro de la transacción es válido.
    """
    if not (1 <= filas <= LIMITE_GRILLA and 1 <= columnas <= LIMITE_GRILLA):
        raise ErrorNegocio(f"La grilla debe tener entre 1 y {LIMITE_GRILLA} filas y columnas.")

    ocupadas = set()
    for celda in celdas:
        posicion = (celda["fila"], celda["columna"])
        if celda["fila"] >= filas or celda["columna"] >= columnas:
            raise ErrorNegocio(
                f"La casilla fila {posicion[0] + 1}, columna {posicion[1] + 1} queda fuera de la grilla.",
                codigo="fuera_de_grilla",
            )
        if posicion in ocupadas:
            raise Conflicto(
                f"Hay dos elementos en la fila {posicion[0] + 1}, columna {posicion[1] + 1}.",
                codigo="casilla_ocupada",
            )
        ocupadas.add(posicion)

    existentes = {e.id: e for e in laboratorio.elementos.select_for_update()}
    ahora = timezone.now()
    conservar, actualizar, crear = set(), [], []

    for celda in celdas:
        datos = {campo: celda.get(campo, VALORES_POR_DEFECTO.get(campo)) for campo in CAMPOS_CELDA}
        elemento_id = celda.get("id")
        if elemento_id and elemento_id in existentes:
            elemento = existentes[elemento_id]
            for campo, valor in datos.items():
                setattr(elemento, campo, valor)
            elemento.actualizado_por = usuario
            elemento.actualizado_en = ahora
            actualizar.append(elemento)
            conservar.add(elemento_id)
        else:
            crear.append(
                ElementoLaboratorio(
                    laboratorio=laboratorio, creado_por=usuario, actualizado_por=usuario, **datos
                )
            )

    eliminar = [i for i in existentes if i not in conservar]
    if eliminar:
        ElementoLaboratorio.objects.filter(id__in=eliminar).delete()
    if actualizar:
        ElementoLaboratorio.objects.bulk_update(
            actualizar, CAMPOS_CELDA + ["actualizado_por", "actualizado_en"]
        )
    if crear:
        ElementoLaboratorio.objects.bulk_create(crear)

    laboratorio.filas = filas
    laboratorio.columnas = columnas
    laboratorio.actualizado_por = usuario
    laboratorio.save(update_fields=["filas", "columnas", "actualizado_por", "actualizado_en"])
    return distribucion(laboratorio)


def guardar_credencial(*, credencial: CredencialLaboratorio, password: str | None):
    """Cifra la contraseña si se envió una nueva. Vacío = borrar la contraseña."""
    if password is not None:
        credencial.password_cifrado = cifrar(password)
    credencial.save()
    return credencial


@transaction.atomic
def revelar_credencial(*, credencial: CredencialLaboratorio, usuario) -> str:
    password = descifrar(credencial.password_cifrado)
    RevelacionCredencial.objects.create(credencial=credencial, usuario=usuario)
    return password
