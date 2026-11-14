"""Validación de los filtros y del formato de los reportes."""

from calendar import monthrange

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from apps.core.errores import ErrorNegocio
from apps.laboratorios.models import Laboratorio, TipoElemento

from . import catalogo

FORMATOS = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


class ListaOpciones(serializers.Field):
    """Varias opciones separadas por coma: ?categoria=equipo,red"""

    def __init__(self, choices, **kwargs):
        self.opciones = dict(choices)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        valores = [v.strip() for v in str(data).split(",") if v.strip()]
        invalidos = [v for v in valores if v not in self.opciones]
        if invalidos:
            raise serializers.ValidationError(f"Opción no válida: {', '.join(invalidos)}.")
        return valores

    def to_representation(self, value):
        return value


def _campo(filtro: catalogo.Filtro):
    comunes = {"required": False, "label": filtro.etiqueta}
    if filtro.tipo == catalogo.FECHA:
        return serializers.DateField(**comunes)
    if filtro.tipo == catalogo.LABORATORIO:
        return serializers.PrimaryKeyRelatedField(queryset=Laboratorio.objects.all(), **comunes)
    if filtro.tipo == catalogo.TIPO_ELEMENTO:
        return serializers.PrimaryKeyRelatedField(queryset=TipoElemento.objects.all(), **comunes)
    if filtro.tipo == catalogo.USUARIO:
        return serializers.PrimaryKeyRelatedField(queryset=catalogo.autores(), **comunes)
    if filtro.multiple:
        return ListaOpciones(filtro.choices.choices, **comunes)
    return serializers.ChoiceField(choices=filtro.choices.choices, **comunes)


def validar_filtros(reporte: catalogo.Reporte, parametros) -> dict:
    """Filtros de la URL → valores listos para selectors.py.

    Un valor que no existe responde 400 (validacion); un rango mal armado, rango_invalido.
    """
    campos = {f.clave: _campo(f) for f in reporte.filtros}
    # Copia: la metaclase de DRF saca los campos del dict que recibe.
    Filtros = type("Filtros", (serializers.Serializer,), dict(campos))
    datos = {clave: parametros.get(clave) for clave in campos if parametros.get(clave) not in (None, "")}
    serializer = Filtros(data=datos)
    serializer.is_valid(raise_exception=True)
    filtros = dict(serializer.validated_data)

    for f in reporte.filtros:
        if f.clave not in filtros and f.por_defecto:
            filtros[f.clave] = list(f.por_defecto)

    if reporte.con_fechas:
        hoy = timezone.localdate()
        filtros.setdefault("desde", hoy.replace(day=1))
        filtros.setdefault("hasta", hoy.replace(day=monthrange(hoy.year, hoy.month)[1]))
        if filtros["hasta"] < filtros["desde"]:
            raise ErrorNegocio(
                "La fecha final no puede ser anterior a la inicial.",
                codigo="rango_invalido",
                campos={"hasta": ["Debe ser igual o posterior a la fecha inicial."]},
            )
        dias = (filtros["hasta"] - filtros["desde"]).days + 1
        if dias > settings.REPORTE_MAX_DIAS:
            raise ErrorNegocio(
                f"El rango máximo de un reporte es de {settings.REPORTE_MAX_DIAS} días.",
                codigo="rango_invalido",
                campos={"hasta": [f"Elige un rango de hasta {settings.REPORTE_MAX_DIAS} días."]},
            )
    return filtros


def validar_formato(valor) -> str:
    formato = (valor or "").lower()
    if formato not in FORMATOS:
        raise ErrorNegocio(
            "Formato no soportado. Elige Excel (xlsx) o PDF (pdf).",
            codigo="formato_invalido",
            campos={"formato": [f"Usa uno de: {', '.join(FORMATOS)}."]},
        )
    return formato
