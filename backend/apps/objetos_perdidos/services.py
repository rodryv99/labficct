"""Reglas de objetos perdidos: se registran, se entregan o se anulan; nunca se borran.
Cada cambio deja una línea en el historial (EventoObjeto)."""

from django.db import transaction
from django.utils import timezone

from apps.core.errores import ErrorNegocio

from .models import EstadoObjeto, EventoObjeto, ObjetoPerdido, TipoEvento

NOMBRES_CAMPOS = {
    "descripcion": "Descripción",
    "categoria": "Categoría",
    "caracteristicas": "Características",
    "laboratorio": "Laboratorio",
    "lugar": "Lugar",
    "fecha_hallazgo": "Fecha del hallazgo",
    "encontrado_por": "Encontrado por",
}


def _texto(valor) -> str:
    if valor is None or valor == "":
        return "—"
    if hasattr(valor, "strftime"):
        return timezone.localtime(valor).strftime("%d/%m/%Y %H:%M")
    if hasattr(valor, "codigo"):
        return valor.codigo
    return str(valor)


def _evento(objeto, tipo, detalle, usuario):
    EventoObjeto.objects.create(objeto=objeto, tipo=tipo, detalle=detalle, usuario=usuario)


@transaction.atomic
def registrar(*, datos: dict, usuario) -> ObjetoPerdido:
    datos = dict(datos)
    datos.pop("quitar_foto", None)
    if not datos.get("foto"):
        datos.pop("foto", None)
    objeto = ObjetoPerdido(**datos, creado_por=usuario, actualizado_por=usuario)
    objeto.save()
    lugares = [objeto.laboratorio.codigo if objeto.laboratorio_id else "", objeto.lugar]
    donde = ", ".join(x for x in lugares if x)
    _evento(objeto, TipoEvento.REGISTRADO, f"Encontrado en {donde}." if donde else "Registrado.", usuario)
    return objeto


@transaction.atomic
def editar(*, objeto: ObjetoPerdido, datos: dict, usuario) -> ObjetoPerdido:
    if objeto.estado != EstadoObjeto.EN_CUSTODIA:
        raise ErrorNegocio("Solo se pueden editar objetos que siguen en custodia.", codigo="no_editable")

    datos = dict(datos)
    cambios = []
    if datos.pop("quitar_foto", False) and objeto.foto:
        objeto.foto.delete(save=False)
        objeto.foto = ""
        cambios.append("Se quitó la foto")
    foto = datos.pop("foto", None)
    if foto:
        objeto.foto = foto
        cambios.append("Se cambió la foto")

    for campo, valor in datos.items():
        anterior = getattr(objeto, campo)
        if anterior != valor:
            nombre = NOMBRES_CAMPOS.get(campo, campo)
            cambios.append(f"{nombre}: {_texto(anterior)} → {_texto(valor)}")
        setattr(objeto, campo, valor)

    objeto.actualizado_por = usuario
    objeto.save()
    if cambios:
        _evento(objeto, TipoEvento.EDITADO, "; ".join(cambios), usuario)
    return objeto


@transaction.atomic
def entregar(
    *,
    objeto: ObjetoPerdido,
    entregado_a: str,
    entregado_ci: str,
    observacion: str,
    usuario,
    ci_anverso=None,
    ci_reverso=None,
    foto_persona=None,
):
    if objeto.estado != EstadoObjeto.EN_CUSTODIA:
        raise ErrorNegocio("Este objeto ya no está en custodia.", codigo="no_en_custodia")
    objeto.estado = EstadoObjeto.ENTREGADO
    objeto.entregado_a = entregado_a.strip()
    objeto.entregado_ci = entregado_ci.strip()
    objeto.entregado_en = timezone.now()
    objeto.entregado_por = usuario
    objeto.actualizado_por = usuario
    adjuntos = []
    if ci_anverso:
        objeto.entrega_ci_anverso = ci_anverso
        adjuntos.append("CI (anverso)")
    if ci_reverso:
        objeto.entrega_ci_reverso = ci_reverso
        adjuntos.append("CI (reverso)")
    if foto_persona:
        objeto.entrega_foto_persona = foto_persona
        adjuntos.append("foto de quien recibe")
    objeto.save()

    detalle = f"Entregado a {objeto.entregado_a}"
    if objeto.entregado_ci:
        detalle += f" (CI {objeto.entregado_ci})"
    detalle += "."
    if adjuntos:
        detalle += f" Fotos: {', '.join(adjuntos)}."
    if observacion.strip():
        detalle += f" {observacion.strip()}"
    _evento(objeto, TipoEvento.ENTREGADO, detalle, usuario)
    return objeto


@transaction.atomic
def anular(*, objeto: ObjetoPerdido, motivo: str, usuario) -> ObjetoPerdido:
    if objeto.estado == EstadoObjeto.ANULADO:
        raise ErrorNegocio("Este registro ya está anulado.", codigo="ya_anulado")
    motivo = motivo.strip()
    if not motivo:
        raise ErrorNegocio(
            "Escribe el motivo de la anulación.",
            codigo="sin_motivo",
            campos={"motivo": ["Escribe el motivo de la anulación."]},
        )
    objeto.estado = EstadoObjeto.ANULADO
    objeto.motivo_anulacion = motivo
    objeto.actualizado_por = usuario
    objeto.save()
    _evento(objeto, TipoEvento.ANULADO, motivo, usuario)
    return objeto
