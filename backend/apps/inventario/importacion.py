"""Importar activos desde una planilla (Excel o CSV) y exportar el inventario (Excel, CSV, PDF).

Importar tiene dos pasos con la misma función: primero se analiza el archivo y se muestra
qué se entendió (sin guardar nada); cuando la persona confirma, se crean los activos.
"""

import re

from django.db import transaction
from django.utils import timezone

from apps.core.errores import ErrorNegocio

from . import deteccion, hojas
from .models import Activo, EstadoActivo, Lugar, MovimientoActivo, TipoActivo, TipoLugar, TipoMovimiento

MAX_ERRORES = 30

# ── Importar ────────────────────────────────────────────


def _indice_lugares() -> tuple[dict, dict]:
    """Cómo encontrar un lugar por lo que diga la planilla: su nombre, o el código, nombre o número del laboratorio."""
    por_texto: dict[str, Lugar] = {}
    por_numero: dict[str, Lugar] = {}
    lugares = list(Lugar.objects.select_related("laboratorio").order_by("-activo", "id"))
    for lugar in lugares:
        por_texto.setdefault(deteccion.aplanar(lugar.nombre), lugar)
    for lugar in lugares:
        lab = lugar.laboratorio
        if lab is None:
            continue
        for texto in (lab.codigo, lab.nombre):
            por_texto.setdefault(deteccion.aplanar(texto), lugar)
        # LAB-41 → "41": primero manda el número del código y después el del nombre.
        for texto in (lab.codigo, lab.nombre):
            for numero in re.findall(r"\d+", texto):
                por_numero.setdefault(str(int(numero)), lugar)
    return por_texto, por_numero


def analizar(
    *, nombre: str, contenido: bytes, mapeo=None, titulos: str = "auto", lugar_por_defecto=None
) -> dict:
    """Lee la planilla y dice qué se importaría. No guarda nada.

    `mapeo`: qué campo es cada columna (lista con un campo o "" por columna). Sin él, se detecta.
    `titulos`: "auto", "si" o "no" (si la primera fila con datos son los títulos de las columnas).
    """
    try:
        tabla = hojas.leer_tabla(nombre, contenido)
    except hojas.ArchivoIlegible as error:
        raise ErrorNegocio(str(error), codigo="archivo_ilegible", campos={"archivo": [str(error)]})

    lugares, numeros = _indice_lugares()
    tipos = {deteccion.aplanar(t.nombre): t for t in TipoActivo.objects.all()}
    detectado = deteccion.detectar(
        tabla,
        {"lugares": set(lugares), "tipos": set(tipos)},
        {"auto": None, "si": True, "no": False}[titulos],
    )
    columnas = len(tabla[0])
    campos = detectado["campos"]
    if mapeo is not None:
        campos = [(c or None) for c in mapeo][:columnas]
        campos += [None] * (columnas - len(campos))
        elegidos = [c for c in campos if c]
        if any(c not in deteccion.CAMPOS for c in elegidos) or len(set(elegidos)) != len(elegidos):
            raise ErrorNegocio(
                "Cada dato puede venir de una sola columna. Revisa las columnas elegidas.",
                codigo="mapeo_invalido",
            )
    donde = {campo: i for i, campo in enumerate(campos) if campo}
    datos = tabla[detectado["inicio"] :]
    fila_titulos = detectado["fila_titulos"]

    resultado = {
        "archivo": nombre,
        "con_titulos": fila_titulos is not None,
        "columnas": [
            {
                "indice": i,
                "titulo": tabla[fila_titulos][i] if fila_titulos is not None else "",
                "campo": campos[i] or "",
                "muestra": [f[i] for f in datos if f[i]][:3],
            }
            for i in range(columnas)
        ],
        "total": len(datos),
        "validas": 0,
        "existentes": 0,
        "con_error": 0,
        "errores": [],
        "avisos": [],
        "faltan": [
            deteccion.CAMPOS[c]
            for c in deteccion.OBLIGATORIOS
            if c not in donde and not (c == "lugar" and lugar_por_defecto is not None)
        ],
        "ejemplo": [],
        "creados": 0,
    }
    filas: list[dict] = []
    resultado["_filas"] = filas
    if resultado["faltan"]:
        return resultado

    def valor(fila, campo) -> str:
        return fila[donde[campo]].strip() if campo in donde else ""

    def error(numero, codigo, mensaje):
        resultado["con_error"] += 1
        if len(resultado["errores"]) < MAX_ERRORES:
            resultado["errores"].append(f"Fila {numero}{f' ({codigo})' if codigo else ''}: {mensaje}")

    codigos = {deteccion.limpiar_codigo(valor(f, "codigo")) for f in datos}
    existentes = {
        c.upper() for c in Activo.objects.filter(codigo__in=codigos).values_list("codigo", flat=True)
    }
    vistos: set[str] = set()
    lugares_nuevos: dict[str, str] = {}
    tipos_nuevos: dict[str, str] = {}
    sin_fecha = sin_estado = sin_descripcion = 0

    for posicion, fila in enumerate(datos):
        numero = detectado["inicio"] + posicion + 1
        codigo = deteccion.limpiar_codigo(valor(fila, "codigo"))
        if not codigo:
            error(numero, "", "falta el código.")
            continue
        if not deteccion.codigo_valido(codigo):
            error(numero, codigo[:30], "el código solo puede llevar letras, números y guiones (hasta 30).")
            continue
        if codigo in vistos:
            error(numero, codigo, "el código está repetido en el archivo.")
            continue
        vistos.add(codigo)
        if codigo in existentes:
            resultado["existentes"] += 1
            continue

        texto_tipo = valor(fila, "tipo")
        descripcion = valor(fila, "descripcion")
        if not descripcion and texto_tipo:
            # Sin descripción pero con tipo ("Silla"): sirve como descripción.
            descripcion, sin_descripcion = texto_tipo, sin_descripcion + 1
        if not descripcion:
            error(numero, codigo, "falta la descripción.")
            continue

        texto_lugar = valor(fila, "lugar")
        lugar = None
        if texto_lugar:
            plano = deteccion.aplanar(texto_lugar)
            aula = deteccion.numero_de_aula(texto_lugar) or (plano if plano.isdigit() else None)
            lugar = lugares.get(plano) or (numeros.get(str(int(aula))) if aula else None)
            if lugar is None:
                lugares_nuevos.setdefault(plano, " ".join(texto_lugar.split())[:120])
        elif lugar_por_defecto is not None:
            lugar = lugar_por_defecto
        else:
            error(numero, codigo, "falta el lugar. Elige abajo un lugar para los que no lo tengan.")
            continue

        tipo = None
        if texto_tipo:
            plano_tipo = deteccion.aplanar(texto_tipo)
            tipo = tipos.get(plano_tipo) or tipos.get(plano_tipo.rstrip("s"))
            if tipo is None:
                limpio = " ".join(texto_tipo.split())[:80]
                tipos_nuevos.setdefault(plano_tipo, limpio[:1].upper() + limpio[1:])

        texto_estado = valor(fila, "estado")
        estado = deteccion.leer_estado(texto_estado)
        if texto_estado and estado is None:
            sin_estado += 1
        texto_fecha = valor(fila, "fecha_adquisicion")
        fecha = deteccion.leer_fecha(texto_fecha)
        if texto_fecha and fecha is None:
            sin_fecha += 1

        filas.append(
            {
                "codigo": codigo,
                "descripcion": " ".join(descripcion.split())[:200],
                "lugar": lugar,
                "lugar_nuevo": None if lugar else deteccion.aplanar(texto_lugar),
                "tipo": tipo,
                "tipo_nuevo": deteccion.aplanar(texto_tipo) if texto_tipo and tipo is None else None,
                "marca": valor(fila, "marca")[:80],
                "modelo": valor(fila, "modelo")[:80],
                "serie": valor(fila, "serie")[:80],
                "estado": estado or EstadoActivo.OPERATIVO,
                "fecha_adquisicion": fecha,
                "observaciones": valor(fila, "observaciones"),
            }
        )

    resultado["validas"] = len(filas)
    resultado["_lugares_nuevos"] = lugares_nuevos
    resultado["_tipos_nuevos"] = tipos_nuevos
    etiquetas_estado = dict(EstadoActivo.choices)
    for f in filas[:5]:
        resultado["ejemplo"].append(
            {
                "codigo": f["codigo"],
                "descripcion": f["descripcion"],
                "lugar": f["lugar"].nombre if f["lugar"] else lugares_nuevos[f["lugar_nuevo"]],
                "tipo": f["tipo"].nombre if f["tipo"] else tipos_nuevos.get(f["tipo_nuevo"], ""),
                "marca": f["marca"],
                "modelo": f["modelo"],
                "serie": f["serie"],
                "estado": etiquetas_estado[f["estado"]],
                "fecha_adquisicion": hojas.fecha_corta(f["fecha_adquisicion"]),
                "observaciones": f["observaciones"],
            }
        )

    avisos = resultado["avisos"]
    if resultado["con_error"] > MAX_ERRORES:
        avisos.append(f"Se muestran los primeros {MAX_ERRORES} errores de {resultado['con_error']}.")
    for nuevos, uno, varios in (
        (lugares_nuevos, "Se creará 1 lugar nuevo", "Se crearán {} lugares nuevos"),
        (tipos_nuevos, "Se creará 1 tipo nuevo", "Se crearán {} tipos nuevos"),
    ):
        if nuevos:
            nombres = ", ".join(list(nuevos.values())[:8]) + ("…" if len(nuevos) > 8 else "")
            avisos.append(f"{uno if len(nuevos) == 1 else varios.format(len(nuevos))}: {nombres}.")
    if len(lugares_nuevos) > 15:
        avisos.append("Son muchos lugares nuevos: revisa que la columna Lugar sea la correcta.")
    if sin_descripcion:
        avisos.append(f"{sin_descripcion} sin descripción: se usó el tipo como descripción.")
    if sin_estado:
        avisos.append(f"{sin_estado} con un estado que no reconocí: quedarán como Operativo.")
    if sin_fecha:
        avisos.append(f"{sin_fecha} con una fecha que no entendí: quedarán sin fecha.")
    return resultado


def _publico(resultado: dict) -> dict:
    return {k: v for k, v in resultado.items() if not k.startswith("_")}


@transaction.atomic
def importar(*, usuario, confirmar: bool, **opciones) -> dict:
    """Analiza el archivo y, si se confirma, crea los activos que están bien (los demás se informan)."""
    resultado = analizar(**opciones)
    if not confirmar:
        return _publico(resultado)
    if resultado["faltan"]:
        raise ErrorNegocio(
            f"No se sabe qué columna es: {', '.join(resultado['faltan'])}. Elígela arriba.",
            codigo="faltan_columnas",
        )
    filas = resultado["_filas"]
    if not filas:
        raise ErrorNegocio(
            "No hay ningún activo nuevo para importar en este archivo.", codigo="nada_que_importar"
        )

    quien = {"creado_por": usuario, "actualizado_por": usuario}
    lugares = {
        plano: Lugar.objects.create(nombre=nombre, tipo=TipoLugar.OTRO, **quien)
        for plano, nombre in resultado["_lugares_nuevos"].items()
    }
    tipos = {}
    for plano, nombre in resultado["_tipos_nuevos"].items():
        tipos[plano] = TipoActivo.objects.filter(nombre__iexact=nombre).first() or TipoActivo.objects.create(
            nombre=nombre, **quien
        )

    activos = Activo.objects.bulk_create(
        [
            Activo(
                codigo=f["codigo"],
                descripcion=f["descripcion"],
                tipo=f["tipo"] or tipos.get(f["tipo_nuevo"]),
                lugar=f["lugar"] or lugares[f["lugar_nuevo"]],
                marca=f["marca"],
                modelo=f["modelo"],
                serie=f["serie"],
                estado=f["estado"],
                fecha_adquisicion=f["fecha_adquisicion"],
                observaciones=f["observaciones"],
                **quien,
            )
            for f in filas
        ]
    )
    hoy = timezone.localdate()
    motivo = f"Importado de «{resultado['archivo'][:120]}»."
    MovimientoActivo.objects.bulk_create(
        [
            MovimientoActivo(
                activo=a,
                tipo=TipoMovimiento.ALTA,
                fecha=hoy,
                lugar_destino_id=a.lugar_id,
                estado_nuevo=a.estado,
                motivo=motivo,
                **quien,
            )
            for a in activos
        ]
    )
    resultado["creados"] = len(activos)
    return _publico(resultado)


# ── Exportar ────────────────────────────────────────────

# Los mismos títulos que entiende la importación: lo que se exporta se puede volver a importar.
ENCABEZADOS = [
    "Código",
    "Descripción",
    "Tipo",
    "Marca",
    "Modelo",
    "Número de serie",
    "Estado",
    "Lugar",
    "Fecha de adquisición",
    "Observaciones",
]
FORMATOS = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv; charset=utf-8",
    "pdf": "application/pdf",
}


def exportar(activos, formato: str, filtros: str = "") -> tuple[bytes, str, str]:
    """Devuelve (contenido, tipo MIME, nombre de archivo) con los activos de la consulta."""
    if formato not in FORMATOS:
        raise ErrorNegocio("Formato no válido: usa xlsx, csv o pdf.", codigo="formato_invalido")
    filas = [
        [
            a.codigo,
            a.descripcion,
            a.tipo.nombre if a.tipo_id else "",
            a.marca,
            a.modelo,
            a.serie,
            a.get_estado_display(),
            a.lugar.nombre,
            hojas.fecha_corta(a.fecha_adquisicion),
            a.observaciones,
        ]
        for a in activos.select_related("tipo", "lugar")
    ]
    ahora = timezone.localtime()
    nombre = f"inventario-{ahora:%Y-%m-%d}.{formato}"
    if formato == "xlsx":
        contenido = hojas.escribir_xlsx(ENCABEZADOS, filas, "Inventario")
    elif formato == "csv":
        contenido = hojas.escribir_csv(ENCABEZADOS, filas)
    else:
        total = f"{len(filas)} {'activo' if len(filas) == 1 else 'activos'}"
        subtitulo = " · ".join(p for p in [total, filtros, f"{ahora:%d/%m/%Y %H:%M}"] if p)
        # En la hoja entran ocho columnas: la fecha y las observaciones quedan para Excel y CSV.
        contenido = hojas.escribir_pdf(
            "Inventario de activos",
            subtitulo,
            ENCABEZADOS[:8],
            [f[:8] for f in filas],
            [9, 27, 11, 9, 11, 12, 9, 16],
        )
    return contenido, FORMATOS[formato], nombre
