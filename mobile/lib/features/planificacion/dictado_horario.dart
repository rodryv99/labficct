/// Entiende una frase dictada (o escrita) y saca los datos de un horario de clase.
///
/// Ej.: "Programación I grupo A con el ingeniero Justiniano, los lunes y miércoles de
/// 8 a 10 en el laboratorio 41". Nunca guarda nada: solo propone valores que la
/// persona revisa.
library;

import '../../core/dictado/nucleo.dart';

class MateriaCtx {
  const MateriaCtx(this.id, this.sigla, this.nombre);
  final int id;
  final String sigla;
  final String nombre;
}

class ContextoHorario {
  const ContextoHorario({
    required this.materias,
    required this.docentes,
    required this.laboratorios,
    required this.periodos,
  });
  final List<MateriaCtx> materias;
  final List<PersonaCtx> docentes;
  final List<LabCtx> laboratorios;
  final List<ItemCatalogo> periodos;
}

class ResultadoHorario implements ResultadoBase {
  @override
  final List<String> entendido = [];
  @override
  final List<String> faltantes = [];

  int? materia;
  int? docente;
  List<int>? dias;
  String? grupo;
  String? horaInicio;
  String? horaFin;
  int? laboratorio;
  int? periodo;
  String? observaciones;
}

ResultadoHorario interpretarDictadoHorario(String dictado, ContextoHorario contexto) {
  final resultado = ResultadoHorario();
  final original = numerosEnCifras(dictado.replaceAll(RegExp(r'\s+'), ' ').trim());
  if (original.isEmpty) {
    resultado.faltantes.addAll(['materia', 'días', 'horario']);
    return resultado;
  }
  final l = Lienzo(plano(original));

  // Horario (de 8 a 10).
  final horario = buscarHorario(l.texto);
  if (horario != null) {
    resultado.horaInicio = aHora(horario.inicio);
    resultado.horaFin = aHora(horario.fin);
    l.ocupar([horario.tramo]);
    resultado.entendido.add(
      'Horario: ${resultado.horaInicio} a ${resultado.horaFin}${horario.supuesto ? ' (lo supuse; ajústalo)' : ''}',
    );
  }

  // Días de la semana (se repite).
  final dias = buscarDiasSemana(l.texto);
  if (dias != null) {
    resultado.dias = dias.dias;
    l.ocupar(dias.tramos);
    resultado.entendido.add('Días: ${dias.dias.map((d) => nombreDiaSemana[d]).join(', ')}');
  }

  // Laboratorio.
  final aulas = buscarAulas(l.texto, contexto.laboratorios);
  if (aulas.ids.isNotEmpty) {
    resultado.laboratorio = aulas.ids.first;
    l.ocupar(aulas.tramos);
    final codigo = contexto.laboratorios.where((x) => x.id == aulas.ids.first).map((x) => x.codigo).firstOrNull ?? '';
    resultado.entendido.add('Laboratorio: $codigo');
  }

  // Docente (una persona del catálogo).
  final docente = buscarPersonaEnFrase(l.texto, contexto.docentes);
  if (docente != null) {
    resultado.docente = docente.id;
    l.ocupar([docente.tramo]);
    final nombre = contexto.docentes.where((d) => d.id == docente.id).map((d) => d.nombreCompleto).firstOrNull ?? '';
    resultado.entendido.add('Docente: $nombre');
  }

  // Periodo.
  final periodo = buscarEnCatalogo(l.texto, contexto.periodos);
  if (periodo != null) {
    resultado.periodo = periodo.id;
    l.ocupar([periodo.tramo]);
    final nombre = contexto.periodos.where((p) => p.id == periodo.id).map((p) => p.nombre).firstOrNull ?? '';
    resultado.entendido.add('Periodo: $nombre');
  }

  // Materia: por sigla o por nombre (el texto más largo que calce).
  final comoCatalogo = <ItemCatalogo>[];
  for (final m in contexto.materias) {
    comoCatalogo.add(ItemCatalogo(m.id, m.nombre));
    if (m.sigla.trim().length >= 3) comoCatalogo.add(ItemCatalogo(m.id, m.sigla));
  }
  final materia = buscarEnCatalogo(l.texto, comoCatalogo);
  if (materia != null) {
    resultado.materia = materia.id;
    l.ocupar([materia.tramo]);
    final m = contexto.materias.where((x) => x.id == materia.id).firstOrNull;
    resultado.entendido.add('Materia: ${m != null ? '${m.sigla} · ${m.nombre}' : ''}');
  }

  // Grupo y observaciones.
  final grupo = RegExp(r'\bgrupo\s+([a-z0-9]{1,4})\b').firstMatch(l.texto);
  if (grupo != null) {
    resultado.grupo = grupo.group(1)!.toUpperCase();
    l.ocupar([Tramo(grupo.start, grupo.end)]);
    resultado.entendido.add('Grupo: ${resultado.grupo}');
  }
  final libres = textosConClave(l.texto, original, l, [
    MapEntry('observaciones', RegExp(r'\b(?:observacion(?:es)?|nota|detalles?|comentario)\s+(?:es\s+)?')),
  ]);
  final obs = libres['observaciones'];
  if (obs != null && obs.isNotEmpty) {
    resultado.observaciones = mayuscula(obs).substring(0, obs.length > 500 ? 500 : obs.length);
  }

  if (resultado.materia == null) resultado.faltantes.add('materia');
  if (resultado.dias == null) resultado.faltantes.add('días');
  if (resultado.horaInicio == null) resultado.faltantes.add('horario');

  // Si no se nombró la materia pero quedó texto al inicio, se avisa como posible materia.
  if (resultado.materia == null) {
    final inicial = limpiar(original.substring(0, l.primera(original.length)));
    if (inicial.isNotEmpty) {
      resultado.entendido.add('No reconocí la materia «${mayuscula(inicial)}»; elígela abajo.');
    }
  }

  return resultado;
}
