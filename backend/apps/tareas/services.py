"""Pizarrón de tareas: crear, mover entre columnas y anotar avances. Avisa a los responsables."""

from django.db import transaction
from django.utils import timezone

from apps.core.errores import ErrorNegocio
from apps.notificaciones.models import TipoNotificacion
from apps.notificaciones.services import auxiliares, notificar

from .models import AvanceTarea, EstadoTarea, Tarea


def _enlace(tarea) -> str:
    return f"/tareas?id={tarea.pk}"


def _avisar(
    destinatarios, tarea, *, titulo: str, mensaje: str = "", actor=None, tipo=TipoNotificacion.TAREA, clave=""
):
    notificar(
        destinatarios,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        enlace=_enlace(tarea),
        datos={"tarea_id": tarea.pk, **({"revision_id": tarea.revision_id} if tarea.revision_id else {})},
        clave=clave,
        excepto=actor,
    )


def _interesados(tarea) -> list:
    """Responsables y quien la creó."""
    return [*tarea.responsables.all(), tarea.creado_por_id]


@transaction.atomic
def crear_tarea(*, datos: dict, usuario) -> Tarea:
    datos = dict(datos)
    responsables = datos.pop("responsables", [])
    estado = datos.pop("estado", EstadoTarea.PENDIENTE)
    tarea = Tarea.objects.create(**datos, creado_por=usuario, actualizado_por=usuario)
    tarea.responsables.set(responsables)
    if responsables:
        _avisar(
            responsables,
            tarea,
            titulo=f"Te asignaron una tarea: {tarea.titulo}",
            mensaje=tarea.descripcion[:300],
            actor=usuario,
        )
    if estado != EstadoTarea.PENDIENTE:
        cambiar_estado(tarea=tarea, estado=estado, usuario=usuario)
    return tarea


@transaction.atomic
def editar_tarea(*, tarea: Tarea, datos: dict, usuario) -> Tarea:
    datos = dict(datos)
    responsables = datos.pop("responsables", None)
    estado = datos.pop("estado", None)
    for campo, valor in datos.items():
        setattr(tarea, campo, valor)
    tarea.actualizado_por = usuario
    tarea.save()
    if responsables is not None:
        antes = set(tarea.responsables.values_list("pk", flat=True))
        tarea.responsables.set(responsables)
        nuevos = [u for u in responsables if u.pk not in antes]
        if nuevos:
            _avisar(
                nuevos,
                tarea,
                titulo=f"Te asignaron una tarea: {tarea.titulo}",
                mensaje=tarea.descripcion[:300],
                actor=usuario,
            )
    if estado and estado != tarea.estado:
        cambiar_estado(tarea=tarea, estado=estado, usuario=usuario)
    return tarea


@transaction.atomic
def cambiar_estado(
    *, tarea: Tarea, estado: str, usuario, nota: str = "", progreso: int | None = None
) -> Tarea:
    """Mueve la tarea de columna y lo anota en su historial. Si era de una revisión
    periódica y queda hecha, la revisión se registra en la bitácora."""
    anterior = tarea.estado
    if estado == anterior:
        if nota.strip():
            AvanceTarea.objects.create(tarea=tarea, autor=usuario, texto=nota.strip())
        return tarea

    tarea.estado = estado
    if estado == EstadoTarea.HECHA:
        tarea.completada_en = timezone.now()
        tarea.completada_por = usuario
        tarea.progreso = 100
    elif anterior == EstadoTarea.HECHA:
        tarea.completada_en = None
        tarea.completada_por = None
    tarea.actualizado_por = usuario
    tarea.save()
    AvanceTarea.objects.create(
        tarea=tarea,
        autor=usuario,
        texto=nota.strip(),
        estado_anterior=anterior,
        estado_nuevo=estado,
        progreso=100 if estado == EstadoTarea.HECHA else progreso,
    )

    if estado == EstadoTarea.HECHA:
        if tarea.revision_id and not _revision_ya_registrada(tarea):
            from apps.bitacora.services import registrar_revision

            texto = nota.strip() or _ultimo_texto(tarea)
            registrar_revision(revision=tarea.revision, usuario=usuario, nota=texto, tarea=tarea)
        _avisar(
            [tarea.creado_por_id],
            tarea,
            titulo=f"Tarea terminada: {tarea.titulo}",
            mensaje=f"La marcó como hecha {usuario.nombre_completo}.",
            actor=usuario,
        )
    return tarea


def _revision_ya_registrada(tarea) -> bool:
    """True si la revisión de esta tarea ya quedó en la bitácora después de crearse la tarea
    (p. ej. la tarea se reabrió y se vuelve a marcar hecha): no se registra dos veces."""
    from apps.bitacora.models import EntradaBitacora

    return EntradaBitacora.objects.filter(
        revision_id=tarea.revision_id, creado_en__gte=tarea.creado_en
    ).exists()


def _ultimo_texto(tarea) -> str:
    ultimo = tarea.avances.exclude(texto="").order_by("-creado_en", "-id").first()
    return ultimo.texto if ultimo else ""


@transaction.atomic
def agregar_avance(
    *, tarea: Tarea, usuario, texto: str = "", progreso: int | None = None, estado: str | None = None
):
    """Anota cómo va la tarea. Si se indica un progreso en una tarea pendiente, pasa a "en progreso"."""
    texto = texto.strip()
    if not texto and progreso is None and not estado:
        raise ErrorNegocio(
            "Escribe cómo va la tarea.",
            codigo="avance_vacio",
            campos={"texto": ["Escribe cómo va la tarea."]},
        )
    if progreso is not None:
        tarea.progreso = progreso
        if not estado and tarea.estado == EstadoTarea.PENDIENTE and progreso > 0:
            estado = EstadoTarea.EN_PROGRESO
        if progreso == 100 and not estado:
            estado = EstadoTarea.HECHA

    if estado and estado != tarea.estado:
        # El cambio de estado deja su propia anotación (con el texto) y avisa si queda hecha.
        tarea.save(update_fields=["progreso", "actualizado_en"])
        cambiar_estado(tarea=tarea, estado=estado, usuario=usuario, nota=texto, progreso=progreso)
        if estado == EstadoTarea.HECHA:
            return tarea
    else:
        tarea.actualizado_por = usuario
        tarea.save()
        AvanceTarea.objects.create(tarea=tarea, autor=usuario, texto=texto, progreso=progreso)

    _avisar(
        _interesados(tarea),
        tarea,
        titulo=f"Avance en «{tarea.titulo}»",
        mensaje=(f"{progreso}% · " if progreso is not None else "")
        + (texto[:300] or "Actualizó el progreso."),
        actor=usuario,
    )
    return tarea


def cerrar_tareas_de_revision(*, revision, usuario, excepto: Tarea | None = None) -> int:
    """Al registrar una revisión desde su página, su tarea del pizarrón queda hecha."""
    abiertas = Tarea.objects.filter(revision=revision).exclude(estado=EstadoTarea.HECHA)
    if excepto is not None:
        abiertas = abiertas.exclude(pk=excepto.pk)
    cerradas = 0
    for tarea in abiertas:
        anterior = tarea.estado
        tarea.estado = EstadoTarea.HECHA
        tarea.completada_en = timezone.now()
        tarea.completada_por = usuario
        tarea.progreso = 100
        tarea.actualizado_por = usuario
        tarea.save()
        AvanceTarea.objects.create(
            tarea=tarea,
            autor=usuario,
            texto="Revisión registrada en la bitácora.",
            estado_anterior=anterior,
            estado_nuevo=EstadoTarea.HECHA,
            progreso=100,
        )
        cerradas += 1
    return cerradas


@transaction.atomic
def crear_tarea_de_revision(revision) -> Tarea:
    """La revisión periódica llegó a su fecha: aparece en el pizarrón y se avisa."""
    lab = revision.laboratorio
    tarea = Tarea.objects.create(
        titulo=f"{revision.titulo} · {lab.codigo}"[:150],
        descripcion=revision.instrucciones,
        laboratorio=lab,
        revision=revision,
        fecha_limite=revision.proxima_fecha,
    )
    responsable = revision.responsable if revision.responsable_id and revision.responsable.is_active else None
    if responsable:
        tarea.responsables.set([responsable])
    _avisar(
        [responsable] if responsable else auxiliares(),
        tarea,
        tipo=TipoNotificacion.REVISION,
        titulo=f"Toca revisar {lab.codigo}: {revision.titulo}",
        mensaje=f"Revisión programada para el {revision.proxima_fecha:%d/%m}. Ya está en el pizarrón de tareas.",
        clave=f"revision:{revision.pk}:{revision.proxima_fecha.isoformat()}",
    )
    return tarea
