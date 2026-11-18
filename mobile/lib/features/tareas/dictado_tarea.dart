/// Entiende una frase dictada (o escrita) y saca los datos de una tarea.
///
/// Ej.: "Instalar Office en el laboratorio 41, prioridad alta, responsables Ana y
/// Mario, para el viernes". Nunca guarda nada: solo propone valores que la persona revisa.
library;

import '../../core/dictado/nucleo.dart';

class ContextoTarea {
  const ContextoTarea({required this.hoy, required this.laboratorios, required this.personas});
  final DateTime hoy;
  final List<LabCtx> laboratorios;
  final List<PersonaCtx> personas;
}

class ResultadoTarea implements ResultadoBase {
  @override
  final List<String> entendido = [];
  @override
  final List<String> faltantes = [];

  String? titulo;
  String? descripcion;
  String? prioridad;
  int? laboratorio;
  List<int>? responsables;
  DateTime? fechaLimite;
}

const _prioridades = <OpcionEtiqueta<String>>[
  OpcionEtiqueta('alta', ['alta', 'urgente', 'prioritaria', 'prioritario', 'importante']),
  OpcionEtiqueta('baja', ['baja', 'poco urgente', 'sin apuro']),
  OpcionEtiqueta('normal', ['normal', 'media']),
];

ResultadoTarea interpretarDictadoTarea(String dictado, ContextoTarea contexto) {
  final resultado = ResultadoTarea();
  final original = numerosEnCifras(dictado.replaceAll(RegExp(r'\s+'), ' ').trim());
  if (original.isEmpty) {
    resultado.faltantes.add('título');
    return resultado;
  }
  final l = Lienzo(plano(original));

  // Fecha límite.
  final dia = buscarDia(l.texto, contexto.hoy);
  if (dia != null) {
    resultado.fechaLimite = dia.fecha;
    l.ocupar(dia.tramos);
    final f = dia.fecha;
    resultado.entendido
        .add('Fecha límite: ${nombresDias[f.weekday % 7]} ${f.day} de ${meses[f.month - 1]}');
  }

  // Laboratorio (uno).
  final aulas = buscarAulas(l.texto, contexto.laboratorios);
  if (aulas.ids.isNotEmpty) {
    resultado.laboratorio = aulas.ids.first;
    l.ocupar(aulas.tramos);
    final codigo = contexto.laboratorios.where((x) => x.id == aulas.ids.first).map((x) => x.codigo).firstOrNull ?? '';
    resultado.entendido.add('Laboratorio: $codigo');
  }

  // Prioridad.
  final prio = buscarEtiqueta(l.texto, _prioridades);
  if (prio != null) {
    resultado.prioridad = prio.valor;
    l.ocupar([prio.tramo]);
    resultado.entendido.add('Prioridad: ${prio.valor}');
  }

  // Responsables (con palabra clave; nunca se adivinan del título).
  final clave = RegExp(
    r'\b(?:responsables?|encargad[oa]s?|asignad[oa]s?\s+a|asignar\s+a|asignale\s+a|a\s+cargo\s+de)\s+',
  ).firstMatch(l.texto);
  if (clave != null) {
    final desde = clave.end;
    final hasta = l.hasta(desde, original.length);
    final trozo = original.substring(desde, hasta);
    final ids = <int>[];
    final nombres = <String>[];
    for (final parte in trozo.split(RegExp(r'\s+(?:y|e)\s+|,'))) {
      final id = buscarPersona(parte, contexto.personas);
      if (id != null && !ids.contains(id)) {
        ids.add(id);
        nombres.add(contexto.personas.where((p) => p.id == id).map((p) => p.nombreCompleto).firstOrNull ?? '');
      }
    }
    l.ocupar([Tramo(clave.start, hasta)]);
    if (ids.isNotEmpty) {
      resultado.responsables = ids;
      resultado.entendido.add('${ids.length == 1 ? 'Responsable' : 'Responsables'}: ${nombres.join(', ')}');
    }
  }

  // Textos con palabra clave (descripción, o un título explícito).
  final libres = textosConClave(l.texto, original, l, [
    MapEntry('titulo', RegExp(r'\b(?:titulo|titulada|titulado|llamada|llamado|se\s+llama)\s+(?:es\s+)?')),
    MapEntry('descripcion', RegExp(r'\b(?:descripcion|detalles?|detalle|nota|observacion(?:es)?)\s+(?:es\s+)?')),
  ]);
  final desc = libres['descripcion'];
  if (desc != null && desc.isNotEmpty) {
    resultado.descripcion = mayuscula(desc).substring(0, desc.length > 2000 ? 2000 : desc.length);
  }

  // Título: lo dicho al inicio, antes de cualquier otro dato.
  var inicial = original.substring(0, l.primera(original.length));
  final entrada = RegExp(
    r'^\s*(?:por\s+favor\s+)?(?:(?:quiero|quisiera|necesito|deseo)\s+)?(?:(?:crear|registrar|agregar|anotar|hacer|nueva|nuevo)\s+)*(?:(?:la|una|el|un)\s+)?(?:tarea|pendiente)?\s*(?:de|para|que\s+diga)?\s*',
  ).firstMatch(plano(inicial));
  if (entrada != null && entrada.group(0)!.trim().isNotEmpty) {
    inicial = inicial.substring(entrada.group(0)!.length);
  }
  final tituloLibre = libres['titulo'];
  final titulo = (tituloLibre != null && tituloLibre.isNotEmpty) ? tituloLibre : limpiar(inicial);
  if (titulo.isNotEmpty) {
    final t = mayuscula(titulo);
    resultado.titulo = t.substring(0, t.length > 150 ? 150 : t.length);
    resultado.entendido.insert(0, 'Título: ${resultado.titulo}');
  } else {
    resultado.faltantes.add('título');
  }

  return resultado;
}
