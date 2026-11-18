/// Entiende una frase dictada (o escrita) y saca los datos de un objeto perdido.
///
/// Ej.: "Un celular negro con funda roja, encontrado en el laboratorio 41 hoy, lo
/// entregó Juan". Nunca guarda nada: solo propone valores que la persona revisa.
library;

import '../../core/dictado/nucleo.dart';

class ContextoObjeto {
  const ContextoObjeto({required this.hoy, required this.laboratorios});
  final DateTime hoy;
  final List<LabCtx> laboratorios;
}

class ResultadoObjeto implements ResultadoBase {
  @override
  final List<String> entendido = [];
  @override
  final List<String> faltantes = [];

  String? descripcion;
  String? caracteristicas;
  String? categoria;
  String? encontradoPor;
  DateTime? fechaHallazgo;
  int? laboratorio;
  String? lugar;
}

const _categorias = <OpcionEtiqueta<String>>[
  OpcionEtiqueta('electronico', [
    'electronico', 'celular', 'telefono', 'laptop', 'computadora', 'cargador', 'audifonos',
    'auriculares', 'mouse', 'tablet', 'dispositivo', 'usb', 'memoria',
  ]),
  OpcionEtiqueta('documento', [
    'documento', 'documentos', 'carnet', 'ci', 'cedula', 'libreta', 'credencial', 'certificado', 'licencia',
  ]),
  OpcionEtiqueta('llaves', ['llaves', 'llave', 'llavero']),
  OpcionEtiqueta('ropa', [
    'ropa', 'chamarra', 'casaca', 'chaqueta', 'polera', 'camisa', 'gorra', 'bufanda', 'prenda', 'chompa',
  ]),
  OpcionEtiqueta('accesorio', [
    'accesorio', 'reloj', 'lentes', 'gafas', 'anillo', 'pulsera', 'mochila', 'billetera', 'cartera', 'paraguas',
  ]),
  OpcionEtiqueta('utiles', [
    'utiles', 'cuaderno', 'libro', 'lapiz', 'boligrafo', 'calculadora', 'estuche', 'folder',
  ]),
  OpcionEtiqueta('otro', ['otro', 'otra cosa']),
];

ResultadoObjeto interpretarDictadoObjeto(String dictado, ContextoObjeto contexto) {
  final resultado = ResultadoObjeto();
  final original = numerosEnCifras(dictado.replaceAll(RegExp(r'\s+'), ' ').trim());
  if (original.isEmpty) {
    resultado.faltantes.add('qué objeto es');
    return resultado;
  }
  final l = Lienzo(plano(original));

  // Día del hallazgo.
  final dia = buscarDia(l.texto, contexto.hoy);
  if (dia != null) {
    resultado.fechaHallazgo = dia.fecha;
    l.ocupar(dia.tramos);
    final f = dia.fecha;
    resultado.entendido.add('Encontrado el: ${nombresDias[f.weekday % 7]} ${f.day} de ${meses[f.month - 1]}');
  }

  // Laboratorio.
  final aulas = buscarAulas(l.texto, contexto.laboratorios);
  if (aulas.ids.isNotEmpty) {
    resultado.laboratorio = aulas.ids.first;
    l.ocupar(aulas.tramos);
    final codigo = contexto.laboratorios.where((x) => x.id == aulas.ids.first).map((x) => x.codigo).firstOrNull ?? '';
    resultado.entendido.add('Laboratorio: $codigo');
  }

  // Categoría (por el tipo de objeto que se nombra).
  final cat = buscarEtiqueta(l.texto, _categorias);
  if (cat != null) {
    resultado.categoria = cat.valor;
    // No se tapa: la palabra ("celular") suele ser también la descripción del objeto.
    resultado.entendido.add('Categoría: ${cat.valor}');
  }

  // Textos con palabra clave.
  final libres = textosConClave(l.texto, original, l, [
    MapEntry('caracteristicas', RegExp(r'\b(?:caracteristicas|color|marca|señas|senas|detalles?)\s+(?:es\s+|son\s+)?')),
    MapEntry(
      'encontrado_por',
      RegExp(
        r'\b(?:encontrad[oa]\s+por|lo\s+encontro|la\s+encontro|entregad[oa]\s+por|lo\s+entrego|la\s+entrego|lo\s+trajo|la\s+trajo)\s+',
      ),
    ),
    MapEntry('lugar', RegExp(r'\b(?:en\s+el\s+lugar|lugar|estaba\s+en|cerca\s+de)\s+')),
  ]);
  final carac = libres['caracteristicas'];
  if (carac != null && carac.isNotEmpty) {
    resultado.caracteristicas = mayuscula(carac).substring(0, carac.length > 500 ? 500 : carac.length);
  }
  final quien = libres['encontrado_por'];
  if (quien != null && quien.isNotEmpty) {
    resultado.encontradoPor = mayuscula(quien).substring(0, quien.length > 150 ? 150 : quien.length);
  }
  final lugar = libres['lugar'];
  if (lugar != null && lugar.isNotEmpty) {
    resultado.lugar = mayuscula(lugar).substring(0, lugar.length > 150 ? 150 : lugar.length);
  }

  // Descripción: lo dicho al inicio (qué es el objeto).
  var inicial = original.substring(0, l.primera(original.length));
  final entrada = RegExp(
    r'^\s*(?:por\s+favor\s+)?(?:(?:quiero|quisiera|necesito|deseo)\s+)?(?:(?:registrar|anotar|agregar|guardar)\s+)*(?:(?:un|una|el|la|los|las)\s+)?(?:objeto\s+perdido|objeto)?\s*(?:perdid[oa]s?|encontrad[oa]s?)?\s*(?:es\s+|:\s*)?',
  ).firstMatch(plano(inicial));
  if (entrada != null && entrada.group(0)!.trim().isNotEmpty) {
    inicial = inicial.substring(entrada.group(0)!.length);
  }
  final descripcion = limpiar(inicial);
  if (descripcion.isNotEmpty) {
    final d = mayuscula(descripcion);
    resultado.descripcion = d.substring(0, d.length > 200 ? 200 : d.length);
    resultado.entendido.insert(0, 'Objeto: ${resultado.descripcion}');
  } else {
    resultado.faltantes.add('qué objeto es');
  }

  return resultado;
}
