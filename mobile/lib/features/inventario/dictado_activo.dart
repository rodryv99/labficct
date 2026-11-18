/// Entiende una frase dictada (o escrita) y saca los datos de un activo de inventario.
///
/// Ej.: "Proyector Epson modelo X500, código INV-120, en el depósito, operativo,
/// comprado el 10 de marzo". Nunca guarda nada: solo propone valores que la persona revisa.
library;

import '../../core/dictado/nucleo.dart';

class ContextoActivo {
  const ContextoActivo({required this.hoy, required this.tipos, required this.lugares});
  final DateTime hoy;
  final List<ItemCatalogo> tipos;
  final List<ItemCatalogo> lugares;
}

class ResultadoActivo implements ResultadoBase {
  @override
  final List<String> entendido = [];
  @override
  final List<String> faltantes = [];

  String? descripcion;
  String? codigo;
  int? tipo;
  int? lugar;
  String? estado;
  String? marca;
  String? modelo;
  String? serie;
  DateTime? fechaAdquisicion;
  String? observaciones;
}

const _estados = <OpcionEtiqueta<String>>[
  OpcionEtiqueta('operativo', ['operativo', 'funcionando', 'funciona', 'bueno', 'en buen estado', 'nuevo']),
  OpcionEtiqueta('danado', ['danado', 'malogrado', 'roto', 'no funciona', 'descompuesto', 'quemado']),
  OpcionEtiqueta('en_reparacion', [
    'en reparacion', 'reparacion', 'reparandose', 'en arreglo', 'en el taller', 'en mantenimiento',
  ]),
  OpcionEtiqueta('baja', ['de baja', 'dado de baja', 'baja', 'obsoleto']),
];

ResultadoActivo interpretarDictadoActivo(String dictado, ContextoActivo contexto) {
  final resultado = ResultadoActivo();
  final original = numerosEnCifras(dictado.replaceAll(RegExp(r'\s+'), ' ').trim());
  if (original.isEmpty) {
    resultado.faltantes.add('qué activo es');
    return resultado;
  }
  final l = Lienzo(plano(original));

  // Código: "código INV-120", "código 45".
  final codigo = RegExp(r'\b(?:codigo|cod)\s+(?:es\s+)?([a-z0-9][a-z0-9-]{0,19})\b').firstMatch(l.texto);
  if (codigo != null) {
    // Se toma del original (por si llevara mayúsculas) en la misma posición.
    final bruto = original.substring(codigo.end - codigo.group(1)!.length, codigo.end);
    resultado.codigo = bruto.toUpperCase();
    l.ocupar([Tramo(codigo.start, codigo.end)]);
    resultado.entendido.add('Código: ${resultado.codigo}');
  }

  // Fecha de adquisición.
  final dia = buscarDia(l.texto, contexto.hoy);
  if (dia != null) {
    resultado.fechaAdquisicion = dia.fecha;
    l.ocupar(dia.tramos);
    final f = dia.fecha;
    resultado.entendido.add('Adquirido el: ${nombresDias[f.weekday % 7]} ${f.day} de ${meses[f.month - 1]}');
  }

  // Estado.
  final estado = buscarEtiqueta(l.texto, _estados);
  if (estado != null) {
    resultado.estado = estado.valor;
    l.ocupar([estado.tramo]);
    resultado.entendido.add('Estado: ${estado.valor.replaceAll('_', ' ')}');
  }

  // Lugar y tipo (catálogos).
  final lugar = buscarEnCatalogo(l.texto, contexto.lugares);
  if (lugar != null) {
    resultado.lugar = lugar.id;
    l.ocupar([lugar.tramo]);
    final nombre = contexto.lugares.where((x) => x.id == lugar.id).map((x) => x.nombre).firstOrNull ?? '';
    resultado.entendido.add('Lugar: $nombre');
  }
  final tipo = buscarEnCatalogo(l.texto, contexto.tipos);
  if (tipo != null) {
    resultado.tipo = tipo.id;
    // No se tapa: el nombre del tipo ("proyector") suele ser también la descripción.
    final nombre = contexto.tipos.where((x) => x.id == tipo.id).map((x) => x.nombre).firstOrNull ?? '';
    resultado.entendido.add('Tipo: $nombre');
  }

  // Textos con palabra clave.
  final libres = textosConClave(l.texto, original, l, [
    MapEntry('marca', RegExp(r'\b(?:marca)\s+(?:es\s+)?')),
    MapEntry('modelo', RegExp(r'\b(?:modelo)\s+(?:es\s+)?')),
    MapEntry('serie', RegExp(r'\b(?:numero\s+de\s+serie|serie|serial)\s+(?:es\s+)?')),
    MapEntry('observaciones', RegExp(r'\b(?:observacion(?:es)?|nota|detalles?)\s+(?:es\s+)?')),
  ]);
  final marca = libres['marca'];
  if (marca != null && marca.isNotEmpty) {
    resultado.marca = mayuscula(marca).substring(0, marca.length > 80 ? 80 : marca.length);
  }
  final modelo = libres['modelo'];
  if (modelo != null && modelo.isNotEmpty) {
    resultado.modelo = mayuscula(modelo).substring(0, modelo.length > 80 ? 80 : modelo.length);
  }
  final serie = libres['serie'];
  if (serie != null && serie.isNotEmpty) {
    final s = serie.toUpperCase();
    resultado.serie = s.substring(0, s.length > 80 ? 80 : s.length);
  }
  final obs = libres['observaciones'];
  if (obs != null && obs.isNotEmpty) {
    resultado.observaciones = mayuscula(obs).substring(0, obs.length > 500 ? 500 : obs.length);
  }

  // Descripción: lo dicho al inicio (qué es el activo).
  var inicial = original.substring(0, l.primera(original.length));
  final entrada = RegExp(
    r'^\s*(?:por\s+favor\s+)?(?:(?:quiero|quisiera|necesito|deseo)\s+)?(?:(?:registrar|anotar|agregar|dar\s+de\s+alta)\s+)*(?:(?:un|una|el|la)\s+)?(?:activo|equipo)?\s*(?:es\s+|:\s*)?',
  ).firstMatch(plano(inicial));
  if (entrada != null && entrada.group(0)!.trim().isNotEmpty) {
    inicial = inicial.substring(entrada.group(0)!.length);
  }
  final descripcion = (marca != null && marca.isNotEmpty && resultado.tipo != null) ? '' : limpiar(inicial);
  if (descripcion.isNotEmpty) {
    final d = mayuscula(descripcion);
    resultado.descripcion = d.substring(0, d.length > 200 ? 200 : d.length);
    resultado.entendido.insert(0, 'Activo: ${resultado.descripcion}');
  }
  if (resultado.descripcion == null && resultado.tipo == null) {
    resultado.faltantes.add('qué activo es');
  }

  return resultado;
}
