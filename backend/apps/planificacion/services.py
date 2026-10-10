"""Reglas de horarios y reservas: nada ocupa un laboratorio dos veces.

La base de datos ya impide choques entre horarios y entre reservas
(restricciones de exclusión). Aquí se revisa además el choque cruzado
horario ↔ reserva y se arma un mensaje que dice con qué choca.

Una reserva que choca se guarda igual, pero queda por aprobar y no ocupa el
laboratorio. Al aprobarla tiene prioridad: las clases con las que choca se
suspenden solo esos días.
"""

from datetime import datetime

from django.db import transaction
from django.db.backends.postgresql.psycopg_any import DateTimeTZRange, NumericRange
from django.utils import timezone

from apps.core.errores import Conflicto, ErrorNegocio
from apps.notificaciones.models import TipoNotificacion
from apps.notificaciones.services import administradores, notificar

from .models import (
    BloqueReserva,
    Docente,
    EstadoReserva,
    ExcepcionHorario,
    Horario,
    PeriodoAcademico,
    Reserva,
    minutos,
)


def _local(fecha, hora) -> datetime:
    return timezone.make_aware(datetime.combine(fecha, hora))


def _hhmm(valor) -> str:
    return valor.strftime("%H:%M")


# ── Horarios ────────────────────────────────────────────


def choques_de_horario(*, laboratorio, periodo, dia_semana, hora_inicio, hora_fin, excluir_id=None):
    mensajes = []
    franja = NumericRange(minutos(hora_inicio), minutos(hora_fin), "[)")

    otros = Horario.objects.filter(
        activo=True,
        laboratorio=laboratorio,
        periodo=periodo,
        dia_semana=dia_semana,
        franja__overlap=franja,
    ).select_related("materia")
    if excluir_id:
        otros = otros.exclude(pk=excluir_id)
    for h in otros:
        mensajes.append(
            f"{laboratorio.codigo} ya tiene {h.materia.sigla} {h.grupo} el "
            f"{h.get_dia_semana_display().lower()} de {_hhmm(h.hora_inicio)} a {_hhmm(h.hora_fin)}."
        )

    bloques = BloqueReserva.objects.filter(
        activo=True,
        laboratorio=laboratorio,
        reserva__estado=EstadoReserva.CONFIRMADA,
        inicio__date__gte=periodo.fecha_inicio,
        inicio__date__lte=periodo.fecha_fin,
    ).select_related("reserva")
    # Los días en que la clase que se edita está suspendida (p. ej. porque una reserva
    # aprobada tomó el laboratorio) no chocan: ese día la clase no se dicta.
    suspendida_en = set()
    if excluir_id:
        suspendida_en = set(
            ExcepcionHorario.objects.filter(horario_id=excluir_id).values_list("fecha", flat=True)
        )
    for b in bloques:
        inicio, fin = timezone.localtime(b.inicio), timezone.localtime(b.fin)
        if inicio.isoweekday() != dia_semana or inicio.date() in suspendida_en:
            continue
        if minutos(inicio) < minutos(hora_fin) and minutos(hora_inicio) < minutos(fin):
            mensajes.append(
                f"{laboratorio.codigo} tiene la reserva «{b.reserva.titulo}» el "
                f"{inicio:%d/%m} de {_hhmm(inicio)} a {_hhmm(fin)}."
            )
    return mensajes


@transaction.atomic
def guardar_horario(*, horario: Horario | None, datos: dict, usuario) -> Horario:
    horario = horario or Horario(creado_por=usuario)
    for campo, valor in datos.items():
        setattr(horario, campo, valor)

    if horario.activo:
        choques = choques_de_horario(
            laboratorio=horario.laboratorio,
            periodo=horario.periodo,
            dia_semana=horario.dia_semana,
            hora_inicio=horario.hora_inicio,
            hora_fin=horario.hora_fin,
            excluir_id=horario.pk,
        )
        if choques:
            raise Conflicto(choques[0], codigo="choque_horario", extra={"choques": choques})

    horario.actualizado_por = usuario
    horario.save()
    return horario


@transaction.atomic
def crear_horarios_por_dias(*, datos: dict, dias: list[int], usuario) -> list[Horario]:
    """Crea la misma clase en varios días (p. ej. lunes, miércoles y viernes).
    Si algún día choca no se guarda ninguno, y el aviso lista todos los choques."""
    dias = sorted(set(dias))
    choques = []
    for dia in dias:
        choques += choques_de_horario(
            laboratorio=datos["laboratorio"],
            periodo=datos["periodo"],
            dia_semana=dia,
            hora_inicio=datos["hora_inicio"],
            hora_fin=datos["hora_fin"],
        )
    if choques:
        raise Conflicto(choques[0], codigo="choque_horario", extra={"choques": choques})
    return [
        guardar_horario(horario=None, datos={**datos, "dia_semana": dia}, usuario=usuario) for dia in dias
    ]


@transaction.atomic
def editar_horarios_por_dias(
    *, horarios: list[Horario], datos: dict, dias: list[int], usuario
) -> list[Horario]:
    """Edita de una vez una clase que se da en varios días (la fila de la tabla de horarios).

    Los cambios se aplican a todos los días; los días nuevos se crean y los que se
    quitan se borran. Todo o nada: si algún día choca, no se guarda nada y el aviso
    lista todos los choques.
    """
    dias = sorted(set(dias))
    por_dia: dict[int, Horario] = {}
    for h in sorted(horarios, key=lambda h: h.pk):
        if h.dia_semana in dias and h.dia_semana not in por_dia:
            por_dia[h.dia_semana] = h
        else:
            h.delete()

    if datos.get("activo", True):
        choques = []
        for dia in dias:
            actual = por_dia.get(dia)
            choques += choques_de_horario(
                laboratorio=datos["laboratorio"],
                periodo=datos["periodo"],
                dia_semana=dia,
                hora_inicio=datos["hora_inicio"],
                hora_fin=datos["hora_fin"],
                excluir_id=actual.pk if actual else None,
            )
        if choques:
            raise Conflicto(choques[0], codigo="choque_horario", extra={"choques": choques})

    return [
        guardar_horario(horario=por_dia.get(dia), datos={**datos, "dia_semana": dia}, usuario=usuario)
        for dia in dias
    ]


@transaction.atomic
def clonar_horarios(*, origen: PeriodoAcademico, destino: PeriodoAcademico, usuario) -> dict:
    """Copia las clases activas de un periodo a otro. Las que chocan con algo que ya
    está en el destino se saltan y se informan, para ajustarlas a mano."""
    if origen.pk == destino.pk:
        raise ErrorNegocio("Elige un periodo de destino distinto al de origen.", codigo="mismo_periodo")

    creados = 0
    omitidos = []
    clases = origen.horarios.filter(activo=True).select_related("laboratorio", "materia")
    for h in clases.order_by("dia_semana", "hora_inicio"):
        choques = choques_de_horario(
            laboratorio=h.laboratorio,
            periodo=destino,
            dia_semana=h.dia_semana,
            hora_inicio=h.hora_inicio,
            hora_fin=h.hora_fin,
        )
        if choques:
            omitidos.append(
                f"{h.materia.sigla} {h.grupo} ({h.get_dia_semana_display().lower()} "
                f"{_hhmm(h.hora_inicio)}–{_hhmm(h.hora_fin)}, {h.laboratorio.codigo}): {choques[0]}"
            )
            continue
        Horario(
            periodo=destino,
            laboratorio=h.laboratorio,
            materia=h.materia,
            grupo=h.grupo,
            docente_id=h.docente_id,
            dia_semana=h.dia_semana,
            hora_inicio=h.hora_inicio,
            hora_fin=h.hora_fin,
            observaciones=h.observaciones,
            creado_por=usuario,
            actualizado_por=usuario,
        ).save()
        creados += 1
    return {"creados": creados, "omitidos": omitidos}


# ── Docentes ────────────────────────────────────────────


@transaction.atomic
def asegurar_ficha_docente(*, usuario, ficha_id: int | None = None) -> Docente | None:
    """Toda cuenta con rol docente queda unida a una ficha Docente, para que vea sus clases.

    - Con ficha_id: se vincula esa ficha (registrada antes, sin usuario).
    - Sin ficha_id: se busca una ficha libre con el mismo correo; si no hay, se crea una.
    """
    from apps.core.roles import Rol

    actual = Docente.objects.filter(usuario=usuario).first()
    if ficha_id is not None:
        ficha = Docente.objects.select_for_update().filter(pk=ficha_id).first()
        if ficha is None:
            raise ErrorNegocio(
                "Esa ficha de docente no existe.",
                codigo="ficha_inexistente",
                campos={"vincular_docente": ["Esa ficha de docente no existe."]},
            )
        if ficha.usuario_id and ficha.usuario_id != usuario.pk:
            raise ErrorNegocio(
                f"{ficha.nombre_completo} ya está vinculado a otro usuario.",
                codigo="ficha_ocupada",
                campos={"vincular_docente": ["Esa ficha ya está vinculada a otro usuario."]},
            )
        if actual and actual.pk != ficha.pk:
            # El usuario tenía otra ficha (por ejemplo, creada sola): sus clases pasan
            # a la ficha elegida y la vieja queda libre.
            actual.horarios.update(docente=ficha)
            actual.usuario = None
            # El correo pasa a la ficha elegida (no puede haber dos fichas con el mismo).
            if usuario.email and actual.email.lower() == usuario.email.lower():
                actual.email = ""
            actual.save(update_fields=["usuario", "email", "actualizado_en"])
        ficha.usuario = usuario
        _copiar_contacto(ficha, usuario)
        ficha.save()
        return ficha

    if actual or usuario.rol != Rol.DOCENTE:
        return actual

    ficha = (
        Docente.objects.select_for_update()
        .filter(usuario__isnull=True, email__iexact=usuario.email)
        .exclude(email="")
        .first()
    )
    if ficha is None:
        ficha = Docente(nombres=usuario.nombres, apellidos=usuario.apellidos)
    ficha.usuario = usuario
    _copiar_contacto(ficha, usuario)
    ficha.save()
    return ficha


def _copiar_contacto(ficha: Docente, usuario) -> None:
    """Completa correo y teléfono de la ficha con los del usuario, sin chocar con otra ficha."""
    correo_libre = (
        usuario.email
        and not Docente.objects.filter(email__iexact=usuario.email).exclude(pk=ficha.pk).exists()
    )
    if not ficha.email and correo_libre:
        ficha.email = usuario.email
    ficha.telefono = ficha.telefono or usuario.telefono or ""


@transaction.atomic
def suspender_clase(*, horario: Horario, fecha, motivo: str, usuario) -> ExcepcionHorario:
    if fecha.isoweekday() != horario.dia_semana:
        raise ErrorNegocio(
            f"Esa fecha no es {horario.get_dia_semana_display().lower()}.", codigo="dia_incorrecto"
        )
    periodo = horario.periodo
    if not (periodo.fecha_inicio <= fecha <= periodo.fecha_fin):
        raise ErrorNegocio("Esa fecha está fuera del periodo académico.", codigo="fuera_de_periodo")
    # Una suspensión a mano es independiente de las reservas (reserva=None): sigue en pie
    # aunque se cancele una reserva que también ocupaba ese día.
    excepcion, _ = ExcepcionHorario.objects.update_or_create(
        horario=horario,
        fecha=fecha,
        defaults={"motivo": motivo or "Clase suspendida", "reserva": None, "actualizado_por": usuario},
        create_defaults={
            "motivo": motivo or "Clase suspendida",
            "creado_por": usuario,
            "actualizado_por": usuario,
        },
    )
    return excepcion


def reanudar_clase(*, horario: Horario, fecha) -> None:
    # Si ese día hay una reserva confirmada en el laboratorio, la clase caería encima.
    otras = _reservas_que_chocan(
        laboratorio=horario.laboratorio,
        inicio=_local(fecha, horario.hora_inicio),
        fin=_local(fecha, horario.hora_fin),
    )
    if otras:
        raise ErrorNegocio(
            f"No se puede reanudar: ese día el laboratorio está reservado para «{otras[0].reserva.titulo}». "
            "Para devolverle el laboratorio a la clase, cancela o cambia esa reserva.",
            codigo="suspendida_por_reserva",
        )
    ExcepcionHorario.objects.filter(horario=horario, fecha=fecha).delete()


# ── Reservas ────────────────────────────────────────────


def _reservas_que_chocan(*, laboratorio, inicio, fin, excluir_reserva_id=None):
    """Bloques de reservas confirmadas que ocupan el laboratorio en ese rango."""
    otros = BloqueReserva.objects.filter(
        activo=True,
        laboratorio=laboratorio,
        reserva__estado=EstadoReserva.CONFIRMADA,
        rango__overlap=DateTimeTZRange(inicio, fin, "[)"),
    ).select_related("reserva")
    if excluir_reserva_id:
        otros = otros.exclude(reserva_id=excluir_reserva_id)
    return list(otros)


def _clases_que_chocan(*, laboratorio, inicio, fin):
    """Clases (no suspendidas) de ese laboratorio que se cruzan con el rango. Devuelve (horario, fecha)."""
    inicio_local, fin_local = timezone.localtime(inicio), timezone.localtime(fin)
    fecha = inicio_local.date()
    clases = (
        Horario.objects.filter(
            activo=True,
            laboratorio=laboratorio,
            dia_semana=fecha.isoweekday(),
            periodo__fecha_inicio__lte=fecha,
            periodo__fecha_fin__gte=fecha,
            franja__overlap=NumericRange(minutos(inicio_local), minutos(fin_local), "[)"),
        )
        .exclude(excepciones__fecha=fecha)
        .select_related("materia", "docente__usuario", "laboratorio")
    )
    return [(h, fecha) for h in clases]


def _mensaje_reserva(laboratorio, bloque) -> str:
    ini, fi = timezone.localtime(bloque.inicio), timezone.localtime(bloque.fin)
    return (
        f"{laboratorio.codigo} ya está reservado para «{bloque.reserva.titulo}» el "
        f"{ini:%d/%m} de {_hhmm(ini)} a {_hhmm(fi)}."
    )


def _mensaje_clase(laboratorio, horario, fecha) -> str:
    return (
        f"{laboratorio.codigo} tiene clase de {horario.materia.sigla} {horario.grupo} el "
        f"{fecha:%d/%m} de {_hhmm(horario.hora_inicio)} a {_hhmm(horario.hora_fin)}."
    )


def choques_de_bloque(*, laboratorio, inicio, fin, excluir_reserva_id=None):
    mensajes = [
        _mensaje_reserva(laboratorio, b)
        for b in _reservas_que_chocan(
            laboratorio=laboratorio, inicio=inicio, fin=fin, excluir_reserva_id=excluir_reserva_id
        )
    ]
    mensajes += [
        _mensaje_clase(laboratorio, h, fecha)
        for h, fecha in _clases_que_chocan(laboratorio=laboratorio, inicio=inicio, fin=fin)
    ]
    return mensajes


def choques_de_reserva(reserva: Reserva) -> list[str]:
    """Con qué choca hoy una reserva (se usa para mostrar las pendientes)."""
    choques = []
    for b in reserva.bloques.all():
        choques += choques_de_bloque(
            laboratorio=b.laboratorio, inicio=b.inicio, fin=b.fin, excluir_reserva_id=reserva.pk
        )
    return choques


def _preparar_bloques(bloques_datos):
    bloques = []
    for datos in bloques_datos:
        inicio = _local(datos["fecha"], datos["hora_inicio"])
        fin = _local(datos["fecha"], datos["hora_fin"])
        bloques.append((datos["laboratorio"], inicio, fin))

    for i, (lab_a, ini_a, fin_a) in enumerate(bloques):
        for lab_b, ini_b, fin_b in bloques[i + 1 :]:
            if lab_a.pk == lab_b.pk and ini_a < fin_b and ini_b < fin_a:
                raise Conflicto(
                    "Dos días de esta reserva se cruzan en el mismo laboratorio.",
                    codigo="bloques_cruzados",
                )
    return bloques


def _firma(bloques) -> list:
    return sorted((lab.pk, inicio, fin) for lab, inicio, fin in bloques)


def advertencias_de_programas(reserva: Reserva, bloques) -> list[str]:
    programas = list(reserva.programas.all())
    if not programas:
        return []
    avisos = []
    laboratorios = {lab.pk: lab for lab, _, _ in bloques}
    for lab in laboratorios.values():
        instalados = set(lab.software.values_list("pk", flat=True))
        faltan = [str(p) for p in programas if p.pk not in instalados]
        if faltan:
            avisos.append(f"{lab.codigo} no tiene instalado: {', '.join(faltan)}.")
    return avisos


# ── Avisos de reservas ──────────────────────────────────


def _clase_texto(horario, fecha) -> str:
    return (
        f"{horario.materia.sigla} {horario.grupo} del {horario.get_dia_semana_display().lower()} "
        f"{fecha:%d/%m} ({_hhmm(horario.hora_inicio)}–{_hhmm(horario.hora_fin)}, {horario.laboratorio.codigo})"
    )


def _usuario_docente(horario):
    """El usuario del docente de la clase, si tiene cuenta activa."""
    if horario.docente_id and horario.docente.usuario_id and horario.docente.usuario.is_active:
        return horario.docente.usuario
    return None


def _enlace_reserva(reserva) -> str:
    return f"/reservas?id={reserva.pk}"


def _avisar_por_aprobar(reserva, choques, usuario):
    extra = f" (y {len(choques) - 1} más)" if len(choques) > 1 else ""
    notificar(
        administradores(),
        tipo=TipoNotificacion.RESERVA,
        titulo=f"Reserva por aprobar: «{reserva.titulo}»",
        mensaje=f"{choques[0] if choques else ''}{extra}\nRegistró: {usuario.nombre_completo}.".strip(),
        enlace=_enlace_reserva(reserva),
        datos={"reserva_id": reserva.pk},
        excepto=usuario,
    )


def _avisar_solicitante(reserva, titulo, mensaje, usuario):
    if reserva.solicitante_id:
        notificar(
            [reserva.solicitante_id],
            tipo=TipoNotificacion.RESERVA,
            titulo=titulo,
            mensaje=mensaje,
            enlace=_enlace_reserva(reserva),
            datos={"reserva_id": reserva.pk},
            excepto=usuario,
        )


def _liberar_clases(reserva: Reserva, *, conservar=()) -> None:
    """Devuelve el laboratorio a las clases que esta reserva había suspendido.

    - Las que siguen chocando con `conservar` (los días nuevos de la misma reserva,
      si sigue confirmada) quedan suspendidas.
    - Si otra reserva confirmada también choca con esa clase ese día, la suspensión
      pasa a esa otra; si no, la clase volvería encima de ella.
    - Al docente cuya clase vuelve se le avisa.
    """
    suspendidas = reserva.clases_suspendidas.select_related(
        "horario__laboratorio", "horario__materia", "horario__docente__usuario"
    )
    for e in suspendidas:
        h = e.horario
        inicio, fin = _local(e.fecha, h.hora_inicio), _local(e.fecha, h.hora_fin)
        if any(lab.pk == h.laboratorio_id and ini < fin and inicio < fi for lab, ini, fi in conservar):
            continue
        otras = _reservas_que_chocan(
            laboratorio=h.laboratorio, inicio=inicio, fin=fin, excluir_reserva_id=reserva.pk
        )
        if otras:
            e.reserva = otras[0].reserva
            e.motivo = f"Laboratorio reservado: «{otras[0].reserva.titulo}»"[:150]
            e.save(update_fields=["reserva", "motivo", "actualizado_en"])
        else:
            e.delete()
            notificar(
                [_usuario_docente(h)],
                tipo=TipoNotificacion.CLASE,
                titulo=f"Tu clase vuelve: {h.materia.sigla} {h.grupo} del {e.fecha:%d/%m}",
                mensaje=(
                    f"La reserva «{reserva.titulo}» ya no ocupa el laboratorio, así que tu clase "
                    f"{_clase_texto(h, e.fecha)} se dicta normalmente."
                ),
                enlace="/horarios",
                datos={"horario_id": h.pk, "fecha": e.fecha.isoformat()},
            )


@transaction.atomic
def guardar_reserva(*, reserva: Reserva | None, datos: dict, usuario):
    """Crea o actualiza una reserva con todos sus bloques.

    - Laboratorio libre: la reserva queda confirmada.
    - Choca con una clase u otra reserva: se guarda igual, pero queda por aprobar
      y no ocupa el laboratorio hasta que un administrador la apruebe.

    Devuelve (reserva, advertencias). Las advertencias no impiden guardar:
    avisan, por ejemplo, que un laboratorio no tiene un programa pedido.
    """
    datos = dict(datos)
    datos.pop("estado", None)  # el estado lo decide el sistema, nunca el formulario
    bloques_datos = datos.pop("bloques", None)
    programas = datos.pop("programas", None)
    auxiliares = datos.pop("auxiliares", None)

    if reserva is None and not bloques_datos:
        raise ErrorNegocio(
            "Agrega al menos un día y horario.",
            codigo="sin_bloques",
            campos={"bloques": ["Agrega al menos un día y horario."]},
        )

    reserva = reserva or Reserva(creado_por=usuario)
    for campo, valor in datos.items():
        setattr(reserva, campo, valor)

    es_nueva = reserva.pk is None
    estado_antes = None if es_nueva else reserva.estado
    choques = []
    actuales = []
    if not es_nueva:
        actuales = [(b.laboratorio, b.inicio, b.fin) for b in reserva.bloques.select_related("laboratorio")]
    bloques = _preparar_bloques(bloques_datos) if bloques_datos is not None else actuales
    cambian_bloques = es_nueva or (bloques_datos is not None and _firma(bloques) != _firma(actuales))

    # Si no cambian los días de una reserva ya confirmada (p. ej. solo se edita el
    # título), se respeta la aprobación. En los demás casos se vuelve a revisar. Las
    # clases que esta misma reserva ya había suspendido no cuentan como choque.
    if cambian_bloques or reserva.estado == EstadoReserva.PENDIENTE:
        for laboratorio, inicio, fin in bloques:
            choques += choques_de_bloque(
                laboratorio=laboratorio, inicio=inicio, fin=fin, excluir_reserva_id=reserva.pk
            )
        reserva.estado = EstadoReserva.PENDIENTE if choques else EstadoReserva.CONFIRMADA
        if choques:
            reserva.aprobada_por = None
            reserva.aprobada_en = None

    ocupa = reserva.estado == EstadoReserva.CONFIRMADA
    reserva.actualizado_por = usuario
    reserva.save()
    if programas is not None:
        reserva.programas.set(programas)
    if auxiliares is not None:
        reserva.auxiliares.set(auxiliares)

    if cambian_bloques:
        reserva.bloques.all().delete()
        BloqueReserva.objects.bulk_create(
            [
                BloqueReserva(
                    reserva=reserva,
                    laboratorio=laboratorio,
                    inicio=inicio,
                    fin=fin,
                    rango=DateTimeTZRange(inicio, fin, "[)"),
                    activo=ocupa,
                )
                for laboratorio, inicio, fin in bloques
            ]
        )
    else:
        reserva.bloques.update(activo=ocupa)

    if not es_nueva and (cambian_bloques or not ocupa):
        # Las clases que ya no le estorban (o todas, si ahora queda por aprobar) vuelven.
        _liberar_clases(reserva, conservar=bloques if ocupa else ())

    if reserva.estado == EstadoReserva.PENDIENTE and (
        estado_antes != EstadoReserva.PENDIENTE or cambian_bloques
    ):
        _avisar_por_aprobar(reserva, choques, usuario)

    return reserva, advertencias_de_programas(reserva, bloques)


@transaction.atomic
def aprobar_reserva(*, reserva: Reserva, usuario) -> Reserva:
    """Aprueba una reserva por aprobar. Tiene prioridad sobre las clases: las que chocan
    se suspenden solo esos días (y vuelven si la reserva se cancela o cambia de horario).

    Si choca con otra reserva ya confirmada no se aprueba: entre dos eventos únicos
    decide el administrador, cancelando o moviendo uno de los dos.
    """
    reserva = Reserva.objects.select_for_update().get(pk=reserva.pk)
    if reserva.estado != EstadoReserva.PENDIENTE:
        raise ErrorNegocio("Solo se pueden aprobar reservas que están por aprobar.", codigo="no_pendiente")

    bloques = list(reserva.bloques.select_related("laboratorio"))
    otras, clases = [], {}
    for b in bloques:
        otras += [
            _mensaje_reserva(b.laboratorio, o)
            for o in _reservas_que_chocan(
                laboratorio=b.laboratorio, inicio=b.inicio, fin=b.fin, excluir_reserva_id=reserva.pk
            )
        ]
        for h, fecha in _clases_que_chocan(laboratorio=b.laboratorio, inicio=b.inicio, fin=b.fin):
            clases[(h.pk, fecha)] = (h, fecha)
    if otras:
        raise Conflicto(
            f"{otras[0]} Cancela o cambia esa reserva antes de aprobar esta.",
            codigo="choque_reserva",
            extra={"choques": otras},
        )

    motivo = f"Laboratorio reservado: «{reserva.titulo}»"[:150]
    ExcepcionHorario.objects.bulk_create(
        [
            ExcepcionHorario(
                horario=h,
                fecha=fecha,
                motivo=motivo,
                reserva=reserva,
                creado_por=usuario,
                actualizado_por=usuario,
            )
            for h, fecha in clases.values()
        ]
    )

    reserva.estado = EstadoReserva.CONFIRMADA
    reserva.aprobada_por = usuario
    reserva.aprobada_en = timezone.now()
    reserva.actualizado_por = usuario
    reserva.save(update_fields=["estado", "aprobada_por", "aprobada_en", "actualizado_por", "actualizado_en"])
    reserva.bloques.update(activo=True)

    # Avisos: a quien la pidió y a cada docente cuya clase se suspende.
    _avisar_solicitante(
        reserva,
        f"Aprobada: tu reserva «{reserva.titulo}»",
        f"La aprobó {usuario.nombre_completo}. Ya aparece en la pizarra.",
        usuario,
    )
    for h, fecha in clases.values():
        notificar(
            [_usuario_docente(h)],
            tipo=TipoNotificacion.CLASE,
            titulo=f"Clase suspendida: {h.materia.sigla} {h.grupo} del {fecha:%d/%m}",
            mensaje=(
                f"Tu clase {_clase_texto(h, fecha)} no se dicta ese día: el laboratorio se reservó "
                f"para «{reserva.titulo}». Lo aprobó {usuario.nombre_completo}."
            ),
            enlace="/horarios",
            datos={"horario_id": h.pk, "fecha": fecha.isoformat(), "reserva_id": reserva.pk},
            excepto=usuario,
        )
    return reserva


@transaction.atomic
def cancelar_reserva(*, reserva: Reserva, motivo: str, usuario) -> Reserva:
    """Cancela (o rechaza, si estaba por aprobar) una reserva. Las clases que había
    desplazado vuelven a la pizarra."""
    if reserva.estado == EstadoReserva.CANCELADA:
        raise ErrorNegocio("La reserva ya está cancelada.", codigo="ya_cancelada")
    rechazada = reserva.estado == EstadoReserva.PENDIENTE
    reserva.estado = EstadoReserva.CANCELADA
    reserva.motivo_cancelacion = motivo
    reserva.actualizado_por = usuario
    reserva.save(update_fields=["estado", "motivo_cancelacion", "actualizado_por", "actualizado_en"])
    reserva.bloques.update(activo=False)
    _liberar_clases(reserva)
    detalle = f"Motivo: {motivo}" if motivo else f"Lo decidió {usuario.nombre_completo}."
    _avisar_solicitante(
        reserva,
        f"{'No se aprobó' if rechazada else 'Cancelada'}: tu reserva «{reserva.titulo}»",
        detalle,
        usuario,
    )
    return reserva
