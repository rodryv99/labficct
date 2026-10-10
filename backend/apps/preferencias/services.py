"""Preferencias de los docentes: lo que responde cada uno y cómo se resume para los auxiliares."""

from django.db import transaction

from apps.core.errores import ErrorNegocio

from .models import OpcionPreferencia, PreferenciasDocente


def opciones_activas() -> list[OpcionPreferencia]:
    return list(OpcionPreferencia.objects.filter(activa=True))


def resumen(preferencias: PreferenciasDocente | None, opciones=None) -> list[str]:
    """Las frases que leen los auxiliares, en el orden de la lista. Incluye la nota al final."""
    if preferencias is None:
        return []
    opciones = opciones if opciones is not None else opciones_activas()
    lineas = []
    for opcion in opciones:
        valor = preferencias.valores.get(str(opcion.pk))
        if valor is True:
            lineas.append(opcion.texto_si)
        elif valor is False:
            lineas.append(opcion.texto_no)
    if preferencias.nota.strip():
        lineas.append(preferencias.nota.strip())
    return lineas


def resumenes_por_docente(docente_ids) -> dict[int, list[str]]:
    """{id de la ficha Docente: [frases]} para varios docentes, con pocas consultas."""
    ids = {i for i in docente_ids if i}
    if not ids:
        return {}
    opciones = opciones_activas()
    return {
        p.docente_id: resumen(p, opciones) for p in PreferenciasDocente.objects.filter(docente_id__in=ids)
    }


@transaction.atomic
def guardar(*, docente, valores: dict, nota: str, usuario) -> PreferenciasDocente:
    """Reemplaza las preferencias del docente. Un valor null quita esa preferencia."""
    existentes = set(OpcionPreferencia.objects.values_list("pk", flat=True))
    limpio = {}
    for clave, valor in (valores or {}).items():
        try:
            pk = int(clave)
        except (TypeError, ValueError):
            pk = None
        if pk not in existentes:
            raise ErrorNegocio(
                "Una de las opciones ya no existe. Recarga la página e inténtalo de nuevo.",
                codigo="opcion_inexistente",
            )
        if valor is not None:
            limpio[str(pk)] = bool(valor)

    preferencias, _ = PreferenciasDocente.objects.get_or_create(
        docente=docente, defaults={"creado_por": usuario, "actualizado_por": usuario}
    )
    preferencias.valores = limpio
    preferencias.nota = (nota or "").strip()
    preferencias.actualizado_por = usuario
    preferencias.save()
    return preferencias
