"""Inventario de activos fijos: altas, traslados, cambios de estado, bajas y verificaciones.

Nada se borra. El lugar y el estado de un activo solo cambian con un movimiento, y cada
corrección de un dato queda anotada (quién, cuándo, qué decía antes y qué dice ahora).
"""

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.core.errores import ErrorNegocio
from apps.core.permisos import tiene_permiso
from apps.notificaciones.models import TipoNotificacion
from apps.notificaciones.services import auxiliares, notificar
from apps.tareas.models import AvanceTarea, EstadoTarea, Tarea

from .models import (
    Activo,
    CambioInventario,
    EstadoActivo,
    EstadoVerificacion,
    ItemVerificacion,
    Lugar,
    MovimientoActivo,
    ResultadoVerificacion,
    TipoLugar,
    TipoMovimiento,
    Verificacion,
)

# ── Lugares ─────────────────────────────────────────────


def sincronizar_lugar_de_laboratorio(laboratorio) -> Lugar:
    """Cada laboratorio tiene su lugar en el inventario, con su mismo código y nombre."""
    nombre = f"{laboratorio.codigo} · {laboratorio.nombre}"[:120]
    lugar, creado = Lugar.objects.get_or_create(
        laboratorio=laboratorio,
        defaults={"nombre": nombre, "tipo": TipoLugar.LABORATORIO, "activo": laboratorio.activo},
    )
    if not creado and (lugar.nombre != nombre or lugar.activo != laboratorio.activo):
        lugar.nombre = nombre
        lugar.activo = laboratorio.activo
        lugar.save(update_fields=["nombre", "activo", "actualizado_en"])
    return lugar


# ── Historial de correcciones ───────────────────────────

CAMPOS_ACTIVO = {
    "codigo": "Código",
    "descripcion": "Descripción",
    "tipo": "Tipo",
    "marca": "Marca",
    "modelo": "Modelo",
    "serie": "Número de serie",
    "fecha_adquisicion": "Fecha de adquisición",
    "responsable": "Responsable",
    "observaciones": "Observaciones",
}
CAMPOS_MOVIMIENTO = {"fecha": "Fecha", "motivo": "Motivo", "documento": "Documento"}


def _texto(valor) -> str:
    if valor is None:
        return ""
    if hasattr(valor, "strftime"):
        return valor.strftime("%d/%m/%Y")
    return str(valor)


def _aplicar_cambios(objeto, datos: dict, campos: dict) -> list[dict]:
    """Pone los datos nuevos en el objeto y devuelve qué cambió, en palabras."""
    cambios = []
    for campo, etiqueta in campos.items():
        if campo not in datos:
            continue
        antes, despues = getattr(objeto, campo), datos[campo]
        if antes != despues:
            cambios.append({"campo": etiqueta, "antes": _texto(antes), "despues": _texto(despues)})
            setattr(objeto, campo, despues)
    return cambios


# ── Activos ─────────────────────────────────────────────


@transaction.atomic
def crear_activo(*, datos: dict, usuario) -> Activo:
    """Alta: el activo entra al inventario, en un lugar y con un estado."""
    datos = dict(datos)
    if datos.get("estado") == EstadoActivo.BAJA:
        raise ErrorNegocio(
            "Un activo nuevo no puede entrar ya dado de baja.",
            codigo="alta_de_baja",
            campos={"estado": ["Elige otro estado."]},
        )
    activo = Activo.objects.create(**datos, creado_por=usuario, actualizado_por=usuario)
    MovimientoActivo.objects.create(
        activo=activo,
        tipo=TipoMovimiento.ALTA,
        fecha=timezone.localdate(),
        lugar_destino=activo.lugar,
        estado_nuevo=activo.estado,
        motivo="Alta en el inventario.",
        creado_por=usuario,
        actualizado_por=usuario,
    )
    return activo


@transaction.atomic
def editar_activo(*, activo: Activo, datos: dict, usuario) -> Activo:
    """Corrige los datos del activo. El lugar y el estado no se tocan aquí."""
    cambios = _aplicar_cambios(activo, datos, CAMPOS_ACTIVO)
    if cambios:
        activo.actualizado_por = usuario
        activo.save()
        CambioInventario.objects.create(activo=activo, usuario=usuario, cambios=cambios)
    return activo


def _movimiento(activo, tipo, usuario, *, fecha=None, motivo="", documento="", **extra) -> MovimientoActivo:
    return MovimientoActivo.objects.create(
        activo=activo,
        tipo=tipo,
        fecha=fecha or timezone.localdate(),
        motivo=motivo.strip(),
        documento=documento.strip(),
        creado_por=usuario,
        actualizado_por=usuario,
        **extra,
    )


@transaction.atomic
def trasladar(*, activo: Activo, lugar: Lugar, usuario, fecha=None, motivo="", documento="") -> Activo:
    activo = Activo.objects.select_for_update().get(pk=activo.pk)
    if activo.estado == EstadoActivo.BAJA:
        raise ErrorNegocio("Este activo está dado de baja: ya no se traslada.", codigo="activo_de_baja")
    if activo.lugar_id == lugar.pk:
        raise ErrorNegocio(
            f"El activo ya está en {lugar.nombre}.",
            codigo="mismo_lugar",
            campos={"lugar": ["Elige un lugar distinto al actual."]},
        )
    _movimiento(
        activo,
        TipoMovimiento.TRASLADO,
        usuario,
        fecha=fecha,
        motivo=motivo,
        documento=documento,
        lugar_origen=activo.lugar,
        lugar_destino=lugar,
    )
    activo.lugar = lugar
    activo.actualizado_por = usuario
    activo.save(update_fields=["lugar", "actualizado_por", "actualizado_en"])
    return activo


@transaction.atomic
def cambiar_estado(*, activo: Activo, estado: str, usuario, fecha=None, motivo="", documento="") -> Activo:
    """Operativo, dañado o en reparación. También sirve para reincorporar un activo
    que se dio de baja por error. Para dar de baja se usa `dar_de_baja`."""
    activo = Activo.objects.select_for_update().get(pk=activo.pk)
    if estado == EstadoActivo.BAJA:
        raise ErrorNegocio("Para dar de baja un activo usa la opción Dar de baja.", codigo="usar_baja")
    if activo.estado == estado:
        raise ErrorNegocio(
            f"El activo ya está como «{activo.get_estado_display()}».",
            codigo="mismo_estado",
            campos={"estado": ["Elige un estado distinto al actual."]},
        )
    _movimiento(
        activo,
        TipoMovimiento.ESTADO,
        usuario,
        fecha=fecha,
        motivo=motivo,
        documento=documento,
        estado_anterior=activo.estado,
        estado_nuevo=estado,
    )
    activo.estado = estado
    activo.actualizado_por = usuario
    activo.save(update_fields=["estado", "actualizado_por", "actualizado_en"])
    return activo


@transaction.atomic
def dar_de_baja(*, activo: Activo, usuario, motivo: str, fecha=None, documento="") -> Activo:
    activo = Activo.objects.select_for_update().get(pk=activo.pk)
    if activo.estado == EstadoActivo.BAJA:
        raise ErrorNegocio("Este activo ya está dado de baja.", codigo="ya_de_baja")
    if not motivo.strip():
        raise ErrorNegocio(
            "Escribe el motivo de la baja.",
            codigo="motivo_requerido",
            campos={"motivo": ["Escribe el motivo de la baja."]},
        )
    _movimiento(
        activo,
        TipoMovimiento.BAJA,
        usuario,
        fecha=fecha,
        motivo=motivo,
        documento=documento,
        lugar_origen=activo.lugar,
        estado_anterior=activo.estado,
        estado_nuevo=EstadoActivo.BAJA,
    )
    activo.estado = EstadoActivo.BAJA
    activo.actualizado_por = usuario
    activo.save(update_fields=["estado", "actualizado_por", "actualizado_en"])
    return activo


@transaction.atomic
def editar_movimiento(*, movimiento: MovimientoActivo, datos: dict, usuario) -> MovimientoActivo:
    """Corrige la fecha, el motivo o el documento de un movimiento. Queda en el historial."""
    cambios = _aplicar_cambios(movimiento, datos, CAMPOS_MOVIMIENTO)
    if cambios:
        movimiento.actualizado_por = usuario
        movimiento.save()
        CambioInventario.objects.create(
            activo=movimiento.activo, movimiento=movimiento, usuario=usuario, cambios=cambios
        )
    return movimiento


# ── Verificaciones ──────────────────────────────────────


def _enlace(verificacion) -> str:
    return f"/inventario?verificacion={verificacion.pk}"


def _avisar(destinatarios, verificacion, *, titulo: str, mensaje: str = "", actor=None, clave: str = ""):
    notificar(
        destinatarios,
        tipo=TipoNotificacion.TAREA,
        titulo=titulo,
        mensaje=mensaje,
        enlace=_enlace(verificacion),
        datos={"verificacion_id": verificacion.pk, "tarea_id": verificacion.tarea_id},
        clave=clave,
        excepto=actor,
    )


def activos_del_alcance(*, tipos=(), lugares=(), activos=()):
    """Los activos que entran en una verificación (nunca los dados de baja).

    Con `activos` se toma esa selección tal cual; si no, se filtra por tipo y lugar
    (sin filtros = todos)."""
    qs = Activo.objects.exclude(estado=EstadoActivo.BAJA)
    if activos:
        return qs.filter(pk__in=[a.pk for a in activos])
    if tipos:
        qs = qs.filter(tipo__in=tipos)
    if lugares:
        qs = qs.filter(lugar__in=lugares)
    return qs


def _texto_alcance(*, tipos, lugares, activos, total: int) -> str:
    if activos:
        return f"Selección de {total} {'activo' if total == 1 else 'activos'}"
    partes = []
    if tipos:
        partes.append("Tipo: " + ", ".join(t.nombre for t in tipos))
    if lugares:
        partes.append("Lugar: " + ", ".join(lugar.nombre for lugar in lugares))
    texto = " · ".join(partes) or "Todos los activos"
    return texto if len(texto) <= 255 else texto[:252] + "…"


@transaction.atomic
def crear_verificacion(*, datos: dict, usuario) -> Verificacion:
    datos = dict(datos)
    tipos = list(datos.pop("tipos", []))
    lugares = list(datos.pop("lugares", []))
    seleccion = list(datos.pop("activos", []))
    responsables = list(datos.pop("responsables", []))

    activos = list(
        activos_del_alcance(tipos=tipos, lugares=lugares, activos=seleccion)
        .select_related("tipo", "lugar")
        .order_by("lugar__nombre", "codigo")
    )
    if not activos:
        raise ErrorNegocio(
            "No hay activos para verificar con esa selección.",
            codigo="sin_activos",
            campos={"activos": ["No hay activos para verificar con esa selección."]},
        )

    verificacion = Verificacion.objects.create(
        titulo=datos["titulo"],
        instrucciones=datos.get("instrucciones", ""),
        fecha_limite=datos.get("fecha_limite"),
        alcance=_texto_alcance(tipos=tipos, lugares=lugares, activos=seleccion, total=len(activos)),
        creado_por=usuario,
        actualizado_por=usuario,
    )
    verificacion.responsables.set(responsables)
    ItemVerificacion.objects.bulk_create(
        [
            ItemVerificacion(
                verificacion=verificacion,
                activo=a,
                codigo=a.codigo,
                descripcion=a.descripcion,
                tipo_nombre=a.tipo.nombre,
                lugar=a.lugar,
                lugar_nombre=a.lugar.nombre,
            )
            for a in activos
        ]
    )

    # La verificación aparece en el pizarrón de tareas; su avance se calcula solo.
    total = len(activos)
    detalle = f"{total} {'activo' if total == 1 else 'activos'} · {verificacion.alcance}"
    tarea = Tarea.objects.create(
        titulo=f"Verificar inventario: {verificacion.titulo}"[:150],
        descripcion="\n\n".join(p for p in [verificacion.instrucciones, detalle] if p),
        fecha_limite=verificacion.fecha_limite,
        creado_por=usuario,
        actualizado_por=usuario,
    )
    tarea.responsables.set(responsables)
    verificacion.tarea = tarea
    verificacion.save(update_fields=["tarea"])

    _avisar(
        responsables or auxiliares(),
        verificacion,
        titulo=f"Verificación de inventario: {verificacion.titulo}",
        mensaje=f"{detalle}\nPidió: {usuario.nombre_completo}.",
        actor=usuario,
    )
    return verificacion


def conteo_de(verificacion) -> dict:
    """Cuántos activos hay en cada resultado."""
    por_resultado = dict(
        verificacion.items.order_by()
        .values_list("resultado")
        .annotate(n=Count("id"))
        .values_list("resultado", "n")
    )
    total = sum(por_resultado.values())
    pendientes = por_resultado.get(ResultadoVerificacion.PENDIENTE, 0)
    return {
        "total": total,
        "revisados": total - pendientes,
        "pendientes": pendientes,
        "esta": por_resultado.get(ResultadoVerificacion.ESTA, 0),
        "falta": por_resultado.get(ResultadoVerificacion.FALTA, 0),
        "otro_lugar": por_resultado.get(ResultadoVerificacion.OTRO_LUGAR, 0),
        "danado": por_resultado.get(ResultadoVerificacion.DANADO, 0),
    }


def _sincronizar_tarea(verificacion, conteo: dict, usuario) -> None:
    """El avance de la tarea es el porcentaje de activos ya revisados."""
    tarea = verificacion.tarea
    if tarea is None:
        return
    progreso = conteo["revisados"] * 100 // conteo["total"] if conteo["total"] else 0
    estado = EstadoTarea.EN_PROGRESO if conteo["revisados"] else EstadoTarea.PENDIENTE
    anterior = tarea.estado
    if tarea.progreso == progreso and anterior == estado:
        return
    tarea.progreso = progreso
    tarea.estado = estado
    tarea.completada_en = None
    tarea.completada_por = None
    tarea.actualizado_por = usuario
    tarea.save()
    if anterior != estado:
        AvanceTarea.objects.create(
            tarea=tarea,
            autor=usuario,
            texto="Empezó la verificación." if estado == EstadoTarea.EN_PROGRESO else "",
            estado_anterior=anterior,
            estado_nuevo=estado,
            progreso=progreso,
        )


def puede_marcar(verificacion, usuario) -> bool:
    """Si tiene responsables, solo ellos (y quien gestiona el inventario) la marcan."""
    if tiene_permiso(usuario, "inventario.gestionar"):
        return True
    responsables = {r.pk for r in verificacion.responsables.all()}
    return not responsables or usuario.pk in responsables


@transaction.atomic
def marcar_items(
    *, verificacion: Verificacion, items: list, resultado: str, usuario, lugar_encontrado=None, nota: str = ""
) -> Verificacion:
    """Marca uno o varios activos de la verificación (está, falta, en otro lugar, dañado)."""
    verificacion = Verificacion.objects.select_for_update().get(pk=verificacion.pk)
    if verificacion.estado != EstadoVerificacion.ABIERTA:
        raise ErrorNegocio("Esta verificación ya no está abierta.", codigo="verificacion_cerrada")
    if not puede_marcar(verificacion, usuario):
        raise ErrorNegocio(
            "Esta verificación está asignada a otras personas.", codigo="no_asignada", status_code=403
        )
    propios = verificacion.items.filter(pk__in=[i.pk for i in items])
    if propios.count() != len({i.pk for i in items}):
        raise ErrorNegocio("Algún activo no pertenece a esta verificación.", codigo="item_ajeno")

    pendiente = resultado == ResultadoVerificacion.PENDIENTE
    propios.update(
        resultado=resultado,
        lugar_encontrado=lugar_encontrado if resultado == ResultadoVerificacion.OTRO_LUGAR else None,
        nota="" if pendiente else nota.strip()[:300],
        verificado_por=None if pendiente else usuario,
        verificado_en=None if pendiente else timezone.now(),
    )

    conteo = conteo_de(verificacion)
    _sincronizar_tarea(verificacion, conteo, usuario)
    if conteo["total"] and conteo["pendientes"] == 0:
        _avisar(
            [verificacion.creado_por_id],
            verificacion,
            titulo=f"Lista para cerrar: {verificacion.titulo}",
            mensaje=_resumen(conteo),
            actor=usuario,
            clave=f"verificacion:{verificacion.pk}:completa",
        )
    return verificacion


def _resumen(conteo: dict) -> str:
    partes = [f"{conteo['esta']} están"]
    if conteo["falta"]:
        partes.append(f"{conteo['falta']} faltan")
    if conteo["otro_lugar"]:
        partes.append(f"{conteo['otro_lugar']} en otro lugar")
    if conteo["danado"]:
        partes.append(f"{conteo['danado']} dañados")
    if conteo["pendientes"]:
        partes.append(f"{conteo['pendientes']} sin revisar")
    return f"De {conteo['total']}: " + ", ".join(partes) + "."


@transaction.atomic
def cerrar_verificacion(*, verificacion: Verificacion, usuario, conclusion: str = "") -> Verificacion:
    """El Admin da por terminada la verificación: su tarea del pizarrón queda hecha."""
    verificacion = Verificacion.objects.select_for_update().get(pk=verificacion.pk)
    if verificacion.estado != EstadoVerificacion.ABIERTA:
        raise ErrorNegocio("Esta verificación ya no está abierta.", codigo="verificacion_cerrada")
    conteo = conteo_de(verificacion)
    verificacion.estado = EstadoVerificacion.CERRADA
    verificacion.conclusion = conclusion.strip()
    verificacion.cerrada_en = timezone.now()
    verificacion.cerrada_por = usuario
    verificacion.actualizado_por = usuario
    verificacion.save()

    tarea = verificacion.tarea
    if tarea is not None and tarea.estado != EstadoTarea.HECHA:
        anterior = tarea.estado
        tarea.estado = EstadoTarea.HECHA
        tarea.progreso = 100
        tarea.completada_en = timezone.now()
        tarea.completada_por = usuario
        tarea.actualizado_por = usuario
        tarea.save()
        AvanceTarea.objects.create(
            tarea=tarea,
            autor=usuario,
            texto=f"Verificación cerrada. {_resumen(conteo)}",
            estado_anterior=anterior,
            estado_nuevo=EstadoTarea.HECHA,
            progreso=100,
        )

    _avisar(
        verificacion.responsables.all(),
        verificacion,
        titulo=f"Verificación cerrada: {verificacion.titulo}",
        mensaje=_resumen(conteo),
        actor=usuario,
    )
    return verificacion


@transaction.atomic
def cancelar_verificacion(*, verificacion: Verificacion, usuario) -> Verificacion:
    """Se pidió por error: la verificación queda cancelada y su tarea sale del pizarrón."""
    verificacion = Verificacion.objects.select_for_update().get(pk=verificacion.pk)
    if verificacion.estado != EstadoVerificacion.ABIERTA:
        raise ErrorNegocio("Solo se cancela una verificación abierta.", codigo="verificacion_cerrada")
    tarea = verificacion.tarea
    verificacion.estado = EstadoVerificacion.CANCELADA
    verificacion.tarea = None
    verificacion.cerrada_en = timezone.now()
    verificacion.cerrada_por = usuario
    verificacion.actualizado_por = usuario
    verificacion.save()
    if tarea is not None:
        tarea.delete()
    _avisar(
        verificacion.responsables.all(),
        verificacion,
        titulo=f"Verificación cancelada: {verificacion.titulo}",
        mensaje=f"La canceló {usuario.nombre_completo}.",
        actor=usuario,
    )
    return verificacion


def conteos_en_lista(qs):
    """Anota en cada verificación sus totales, para la tabla (una sola consulta)."""
    r = ResultadoVerificacion
    return qs.annotate(
        total=Count("items"),
        pendientes=Count("items", filter=Q(items__resultado=r.PENDIENTE)),
        n_esta=Count("items", filter=Q(items__resultado=r.ESTA)),
        n_falta=Count("items", filter=Q(items__resultado=r.FALTA)),
        n_otro_lugar=Count("items", filter=Q(items__resultado=r.OTRO_LUGAR)),
        n_danado=Count("items", filter=Q(items__resultado=r.DANADO)),
    )
