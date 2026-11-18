/// Entiende una frase dictada (o escrita) y saca los datos de una reserva.
///
/// Son reglas, sin servicios externos: buscan el día ("mañana", "el viernes", "20 de
/// noviembre"), el horario ("de 8 a 10", "a las 3 de la tarde"), las aulas ("laboratorios
/// 41 y 42"), quién la pide ("solicita…", "para el…"), programas y apoyo de auxiliares.
/// Lo que queda al inicio de la frase se toma como título.
///
/// Nunca guarda nada: solo propone valores para el formulario, que la persona revisa.
///
/// Es el mismo analizador que usa la web (dictado.ts), portado a Dart.
library;

class LabCtx {
  const LabCtx(this.id, this.codigo, this.nombre);
  final int id;
  final String codigo;
  final String nombre;
}

class PersonaCtx {
  const PersonaCtx(this.id, this.nombreCompleto);
  final int id;
  final String nombreCompleto;
}

class ProgramaCtx {
  const ProgramaCtx(this.id, this.nombre);
  final int id;
  final String nombre;
}

class ContextoDictado {
  const ContextoDictado({
    required this.hoy,
    required this.laboratorios,
    required this.personas,
    required this.programas,
  });
  final DateTime hoy;
  final List<LabCtx> laboratorios;
  final List<PersonaCtx> personas;
  final List<ProgramaCtx> programas;
}

class ResultadoDictado {
  String? titulo;

  /// Usuario del sistema que la solicita.
  int? solicitante;

  /// Si quien la pide no es usuario del sistema.
  String? solicitanteExterno;
  String? contacto;
  List<int>? laboratorios;

  /// AAAA-MM-DD
  String? fecha;

  /// HH:MM
  String? horaInicio;
  String? horaFin;
  String? descripcion;
  List<int>? programas;
  bool? requiereApoyo;
  int? auxiliaresRequeridos;

  /// Lo que se entendió, en palabras, para mostrarlo.
  final List<String> entendido = [];

  /// Datos importantes que no aparecieron en la frase.
  List<String> faltantes = [];
}

const _meses = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
final _altMeses = '${_meses.join('|')}|setiembre';
const _dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const _nombresDias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const _unidades = <String, int>{
  'cero': 0,
  'uno': 1,
  'dos': 2,
  'tres': 3,
  'cuatro': 4,
  'cinco': 5,
  'seis': 6,
  'siete': 7,
  'ocho': 8,
  'nueve': 9,
};
const _numeros = <String, int>{
  'cero': 0,
  'uno': 1,
  'dos': 2,
  'tres': 3,
  'cuatro': 4,
  'cinco': 5,
  'seis': 6,
  'siete': 7,
  'ocho': 8,
  'nueve': 9,
  'diez': 10,
  'once': 11,
  'doce': 12,
  'trece': 13,
  'catorce': 14,
  'quince': 15,
  'dieciseis': 16,
  'diecisiete': 17,
  'dieciocho': 18,
  'diecinueve': 19,
  'veinte': 20,
  'veintiuno': 21,
  'veintiun': 21,
  'veintidos': 22,
  'veintitres': 23,
  'veinticuatro': 24,
  'veinticinco': 25,
  'veintiseis': 26,
  'veintisiete': 27,
  'veintiocho': 28,
  'veintinueve': 29,
};
const _decenas = <String, int>{'treinta': 30, 'cuarenta': 40, 'cincuenta': 50};

// La ñ también se aplana ("mañana" → "manana") para que los patrones sean simples.
const _acentos = <String, String>{'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n'};

final _esLetraNumero = RegExp(r'[a-z0-9:/\s-]');

/// Minúsculas, sin acentos y sin puntuación, **con el mismo largo** que el original:
/// así una posición en el texto plano es la misma posición en el texto dictado.
String plano(String texto) {
  final salida = StringBuffer();
  for (final rune in texto.runes) {
    final letra = String.fromCharCode(rune);
    final minuscula = letra.toLowerCase();
    final c = minuscula.length == letra.length ? minuscula : letra;
    if (c.length != 1) {
      salida.write(' ' * c.length);
    } else if (_acentos.containsKey(c)) {
      salida.write(_acentos[c]);
    } else if (_esLetraNumero.hasMatch(c)) {
      salida.write(c);
    } else {
      salida.write(' ');
    }
  }
  return salida.toString();
}

/// Igual que el split de JS con grupo capturado: deja los separadores entre medio,
/// de modo que la lista alterna palabra, espacio, palabra, espacio…
List<String> _partesConEspacios(String t) {
  final partes = <String>[];
  var ultimo = 0;
  for (final m in RegExp(r'\s+').allMatches(t)) {
    partes.add(t.substring(ultimo, m.start));
    partes.add(m.group(0)!);
    ultimo = m.end;
  }
  partes.add(t.substring(ultimo));
  return partes;
}

/// "ocho" → "8", "cuarenta y uno" → "41". Quien dicta dice números; el reconocedor no siempre los escribe con cifras.
String numerosEnCifras(String texto) {
  final partes = _partesConEspacios(texto);
  String palabra(int i) => (i >= 0 && i < partes.length) ? plano(partes[i]).trim() : '';
  // La puntuación pegada a la palabra ("ocho,") se conserva.
  String cola(int i) {
    final p = (i >= 0 && i < partes.length) ? partes[i] : '';
    return RegExp(r'[.,;:!?]+$').firstMatch(p)?.group(0) ?? '';
  }

  final salida = <String>[];
  for (var i = 0; i < partes.length; i += 1) {
    final actual = palabra(i);
    if (_decenas.containsKey(actual)) {
      // "cuarenta y uno": decena + "y" + unidad (con los espacios entre medio).
      final unidad = palabra(i + 4);
      if (cola(i).isEmpty && palabra(i + 2) == 'y' && _unidades.containsKey(unidad) && _unidades[unidad]! > 0) {
        salida.add('${_decenas[actual]! + _unidades[unidad]!}${cola(i + 4)}');
        i += 4;
        continue;
      }
      salida.add('${_decenas[actual]}${cola(i)}');
    } else if (_numeros.containsKey(actual)) {
      salida.add('${_numeros[actual]}${cola(i)}');
    } else {
      salida.add(i < partes.length ? partes[i] : '');
    }
  }
  return salida.join('');
}

class _Tramo {
  const _Tramo(this.inicio, this.fin);
  final int inicio;
  final int fin;
}

String _dos(int n) => n.toString().padLeft(2, '0');
String _aHora(int minutos) => '${_dos(minutos ~/ 60)}:${_dos(minutos % 60)}';
String _aISO(DateTime f) => '${f.year}-${_dos(f.month)}-${_dos(f.day)}';
String _escapar(String texto) =>
    texto.replaceAllMapped(RegExp(r'[.*+?^${}()|[\]\\]'), (m) => '\\${m.group(0)}');

DateTime _sumarDias(DateTime fecha, int dias) => DateTime(fecha.year, fecha.month, fecha.day + dias);

/// Día estilo JS: 0 = domingo … 6 = sábado (coincide con las listas de arriba).
int _diaSemana(DateTime d) => d.weekday % 7;

int _min(int a, int b) => a < b ? a : b;
int _max(int a, int b) => a > b ? a : b;

/// Tapa con espacios lo ya entendido, para que no se lea dos veces (conserva las posiciones).
String _tapar(String texto, _Tramo tramo) =>
    texto.substring(0, tramo.inicio) + (' ' * (tramo.fin - tramo.inicio)) + texto.substring(tramo.fin);

/// ¿La aguja aparece como palabra completa dentro del heno? (sin usar lookbehind).
bool _contienePalabra(String heno, String aguja) {
  for (final m in RegExp(_escapar(aguja)).allMatches(heno)) {
    final antesOk = m.start == 0 || !RegExp(r'[a-z0-9]').hasMatch(heno[m.start - 1]);
    final despuesOk = m.end == heno.length || !RegExp(r'[a-z0-9]').hasMatch(heno[m.end]);
    if (antesOk && despuesOk) return true;
  }
  return false;
}

// ── Horario ─────────────────────────────────────────────

// Una hora: "8", "8:30", "8 y media", "14 horas", "3 pm", "3 de la tarde", "una", "mediodia".
const _hora =
    '(\\d{1,2}|una|mediodia)(?::(\\d{2}))?(?:\\s+y\\s+(media|cuarto))?(?:\\s*(?:horas|hora|hrs|hs|h)\\b)?'
    '(?:\\s*(a\\s*m|p\\s*m)\\b)?(?:\\s+(?:de|por|en)\\s+la\\s+(manana|tarde|noche))?';

class _HoraLeida {
  const _HoraLeida(this.hora, this.minuto, this.periodo, this.explicita);
  final int hora;
  final int minuto;

  /// 'am', 'pm' o null.
  final String? periodo;

  /// Dijo los minutos o el periodo: es claramente una hora y no otro número.
  final bool explicita;
}

_HoraLeida? _leerHora(List<String?> grupos) {
  final numero = grupos[0];
  final minutos = grupos[1];
  final fraccion = grupos[2];
  final ampm = grupos[3];
  final parte = grupos[4];
  if (numero == null) return null;
  var hora = numero == 'una' ? 1 : (numero == 'mediodia' ? 12 : int.parse(numero));
  final minuto = minutos != null ? int.parse(minutos) : (fraccion == 'media' ? 30 : (fraccion == 'cuarto' ? 15 : 0));
  if (hora > 24 || minuto > 59) return null;
  if (hora == 24) hora = 0;
  String? periodo;
  if (ampm != null) {
    periodo = ampm.startsWith('a') ? 'am' : 'pm';
  } else if (parte != null) {
    periodo = parte == 'manana' ? 'am' : 'pm';
  } else if (numero == 'mediodia') {
    periodo = 'pm';
  }
  final explicita = minutos != null || fraccion != null || ampm != null || parte != null || numero == 'mediodia';
  return _HoraLeida(hora, minuto, periodo, explicita);
}

int _enMinutos(_HoraLeida h, String? periodo) {
  var hora = h.hora;
  if (periodo == 'pm' && hora < 12) hora += 12;
  if (periodo == 'am' && hora == 12) hora = 0;
  return hora * 60 + h.minuto;
}

/// Decide mañana o tarde cuando no se dijo: nadie reserva un laboratorio a las 2 de la madrugada.
List<int>? _resolverRango(_HoraLeida a, _HoraLeida b) {
  int inicio;
  int fin;
  if (a.periodo != null || b.periodo != null) {
    fin = _enMinutos(b, b.periodo ?? a.periodo);
    if (a.periodo != null) {
      inicio = _enMinutos(a, a.periodo);
    } else {
      // "de 2 a 4 de la tarde" (las dos son de la tarde) frente a "de 10 a 2 de la tarde".
      final igual = _enMinutos(a, b.periodo);
      inicio = igual < fin ? igual : _enMinutos(a, 'am');
    }
    if (b.periodo == null && fin <= inicio && fin + 720 < 1440) fin += 720;
  } else {
    inicio = _enMinutos(a, a.hora < 7 ? 'pm' : null);
    fin = _enMinutos(b, b.hora < 7 ? 'pm' : null);
    if (fin <= inicio && fin + 720 < 1440) fin += 720;
  }
  return inicio < fin && fin < 1440 ? [inicio, fin] : null;
}

class _HorarioLeido {
  const _HorarioLeido(this.inicio, this.fin, this.tramo, {this.supuesto = false});
  final int inicio;
  final int fin;
  final _Tramo tramo;

  /// El horario no se dijo con horas: se supuso por "en la tarde", etc.
  final bool supuesto;
}

_HorarioLeido? _buscarHorario(String texto) {
  final rangos = [
    // "de 8 a 10", "desde las 14 hasta las 16", "entre las 8 y las 10"
    RegExp('\\b(?:de|desde|entre)\\s+(?:las?\\s+|el\\s+)?$_hora\\s+(?:a|al|hasta|y)\\s+(?:las?\\s+|el\\s+)?$_hora'),
    // "8:00 a 10:00", "8:30-10"
    RegExp('\\b$_hora\\s*(?:a|al|hasta|-)\\s*(?:las?\\s+|el\\s+)?$_hora'),
  ];
  for (var indice = 0; indice < rangos.length; indice += 1) {
    final m = rangos[indice].firstMatch(texto);
    if (m == null) continue;
    final a = _leerHora([m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)]);
    final b = _leerHora([m.group(6), m.group(7), m.group(8), m.group(9), m.group(10)]);
    if (a == null || b == null) continue;
    // Sin "de… a…", dos números sueltos solo son un horario si alguno es claramente una hora.
    if (indice == 1 && !a.explicita && !b.explicita) continue;
    final rango = _resolverRango(a, b);
    if (rango != null) return _HorarioLeido(rango[0], rango[1], _Tramo(m.start, m.end));
  }

  // "a las 9" (dura 2 horas, o lo que diga "por 3 horas")
  final una = RegExp('\\b(?:a|desde)\\s+(?:las?|el)\\s+$_hora').firstMatch(texto);
  if (una != null) {
    final a = _leerHora([una.group(1), una.group(2), una.group(3), una.group(4), una.group(5)]);
    if (a != null) {
      final inicio = _enMinutos(a, a.periodo ?? (a.hora < 7 ? 'pm' : null));
      var tramo = _Tramo(una.start, una.end);
      var duracion = 120;
      final d = RegExp(r'\b(?:por|durante)\s+(\d{1,2}|una)\s+horas?(\s+y\s+media)?').firstMatch(texto);
      if (d != null) {
        duracion = (d.group(1) == 'una' ? 1 : int.parse(d.group(1)!)) * 60 + (d.group(2) != null ? 30 : 0);
        tramo = _Tramo(_min(tramo.inicio, d.start), _max(tramo.fin, d.end));
      }
      final fin = _min(inicio + duracion, 23 * 60 + 59);
      if (inicio < fin) return _HorarioLeido(inicio, fin, tramo);
    }
  }

  // Sin horas: "en la tarde", "por la mañana"
  final parte = RegExp(r'\b(?:en|por|durante)\s+la\s+(manana|tarde|noche)\b').firstMatch(texto);
  if (parte != null) {
    final p = parte.group(1);
    final rango = p == 'manana'
        ? [480, 600]
        : p == 'tarde'
            ? [840, 960]
            : [1140, 1260];
    return _HorarioLeido(rango[0], rango[1], _Tramo(parte.start, parte.end), supuesto: true);
  }
  return null;
}

// ── Aulas ───────────────────────────────────────────────

const _palabraAula = '(?:laboratorios?|labs?|aulas?|salas?)';

class _AulasLeidas {
  const _AulasLeidas(this.ids, this.tramos, this.desconocidas);
  final List<int> ids;
  final List<_Tramo> tramos;
  final List<String> desconocidas;
}

_AulasLeidas _buscarAulas(String texto, List<LabCtx> laboratorios) {
  final ids = <int>[];
  final tramos = <_Tramo>[];
  final desconocidas = <String>[];
  void agregar(int id) {
    if (!ids.contains(id)) ids.add(id);
  }

  final todas = RegExp('\\b(?:en\\s+)?tod[oa]s\\s+l[oa]s\\s+$_palabraAula\\b').firstMatch(texto);
  if (todas != null) {
    for (final l in laboratorios) {
      agregar(l.id);
    }
    tramos.add(_Tramo(todas.start, todas.end));
    return _AulasLeidas(ids, tramos, desconocidas);
  }

  // El número de cada laboratorio: primero el de su código (LAB-41 → 41), después el del nombre.
  final porNumero = <int, int>{};
  for (final campo in ['codigo', 'nombre']) {
    for (final lab in laboratorios) {
      final fuente = campo == 'codigo' ? lab.codigo : lab.nombre;
      for (final n in RegExp(r'\d+').allMatches(fuente)) {
        final valor = int.parse(n.group(0)!);
        if (!porNumero.containsKey(valor)) porNumero[valor] = lab.id;
      }
    }
  }

  // "laboratorio 41", "en los laboratorios 41, 42 y 43", "aulas 12 y 14"
  final lista = RegExp(
    '\\b(?:en\\s+)?(?:(?:el|la|los|las)\\s+)?$_palabraAula\\s+(?:numeros?\\s+)?(\\d{1,3}(?:(?:\\s+(?:y|e)\\s+|\\s+)(?:(?:el|la)\\s+)?\\d{1,3})*)',
  );
  for (final m in lista.allMatches(texto)) {
    final inicioNumeros = m.end - m.group(1)!.length;
    var fin = inicioNumeros;
    for (final n in RegExp(r'\d{1,3}').allMatches(m.group(1)!)) {
      final posicion = inicioNumeros + n.start;
      final despues = texto.substring(posicion + n.group(0)!.length);
      // Ese número ya no es un aula: es una fecha ("20 de noviembre") o una hora ("8:30").
      if (RegExp('^(?:\\s+de\\s+(?:$_altMeses)\\b|:)').hasMatch(despues)) break;
      final id = porNumero[int.parse(n.group(0)!)];
      if (id == null) {
        // El primero que no existe se avisa; los siguientes ya pueden ser otra cosa.
        if (fin == inicioNumeros) {
          desconocidas.add(n.group(0)!);
          fin = posicion + n.group(0)!.length;
        }
        break;
      }
      agregar(id);
      fin = posicion + n.group(0)!.length;
    }
    if (fin > inicioNumeros) tramos.add(_Tramo(m.start, fin));
  }

  // Por nombre: "laboratorio de redes", "sala de servidores"
  for (final lab in laboratorios) {
    final nombre = plano(lab.nombre)
        .replaceFirst(RegExp('^\\s*$_palabraAula\\s+(?:de\\s+)?'), '')
        .trim();
    if (nombre.length < 3 || RegExp(r'^\d+$').hasMatch(nombre)) continue;
    final m = RegExp('\\b(?:en\\s+)?(?:(?:el|la)\\s+)?$_palabraAula\\s+(?:de\\s+)?${_escapar(nombre)}(?![a-z0-9])')
        .firstMatch(texto);
    if (m != null) {
      agregar(lab.id);
      tramos.add(_Tramo(m.start, m.end));
    }
  }
  return _AulasLeidas(ids, tramos, desconocidas);
}

// ── Día ─────────────────────────────────────────────────

class _DiaLeido {
  const _DiaLeido(this.fecha, this.tramos);
  final DateTime fecha;
  final List<_Tramo> tramos;
}

_DiaLeido? _buscarDia(String texto, DateTime hoy) {
  final tramos = <_Tramo>[];
  // Manda la primera fecha que se entienda (en el orden de abajo: la más precisa primero).
  DateTime? encontrada;
  void tomar(Match m, DateTime? valor) {
    tramos.add(_Tramo(m.start, m.end));
    if (encontrada == null && valor != null) encontrada = valor;
  }

  final hoySinHora = _sumarDias(hoy, 0);

  // "20 de noviembre", "el día 20 de noviembre de 2026"
  final conMes = RegExp('\\b(?:el\\s+)?(?:dia\\s+)?(\\d{1,2})\\s+de\\s+($_altMeses)(?:\\s+(?:de|del)\\s+(\\d{4}))?')
      .firstMatch(texto);
  if (conMes != null) {
    final mesNombre = conMes.group(2)!;
    final mes = mesNombre == 'setiembre' ? 8 : _meses.indexOf(mesNombre);
    final dia = int.parse(conMes.group(1)!);
    var f = DateTime(conMes.group(3) != null ? int.parse(conMes.group(3)!) : hoy.year, mes + 1, dia);
    // Sin año, una fecha que ya pasó es del año que viene.
    if (conMes.group(3) == null && f.isBefore(hoySinHora)) f = DateTime(hoy.year + 1, mes + 1, dia);
    tomar(conMes, f.day == dia ? f : null);
  }

  // "20/11", "20/11/2026"
  final conBarras = RegExp(r'\b(?:el\s+)?(?:dia\s+)?(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b').firstMatch(texto);
  if (conBarras != null) {
    final anioTexto = conBarras.group(3);
    final anio = anioTexto != null ? int.parse(anioTexto.length == 2 ? '20$anioTexto' : anioTexto) : hoy.year;
    final dia = int.parse(conBarras.group(1)!);
    final f = DateTime(anio, int.parse(conBarras.group(2)!), dia);
    tomar(conBarras, f.day == dia ? f : null);
  }

  final pasado = RegExp(r'\bpasado\s+manana\b').firstMatch(texto);
  if (pasado != null) tomar(pasado, _sumarDias(hoy, 2));

  // "mañana", pero no "de la mañana" ni "esta mañana" (eso es la hora del día) ni "pasado mañana".
  for (final m in RegExp(r'\bmanana\b').allMatches(texto)) {
    final antes = texto.substring(0, m.start);
    if (RegExp(r'(?:\bla|\besta|\bpasado)\s$').hasMatch(antes)) continue;
    tomar(m, _sumarDias(hoy, 1));
    break;
  }

  final esHoy = RegExp(r'\bhoy\b').firstMatch(texto);
  if (esHoy != null) tomar(esHoy, hoySinHora);

  // "el viernes", "este lunes", "el próximo martes": el que viene (nunca hoy mismo).
  final semana = RegExp('\\b(?:el\\s+|este\\s+)?(?:proximo\\s+)?(${_dias.join('|')})\\b').firstMatch(texto);
  if (semana != null) {
    var falta = (_dias.indexOf(semana.group(1)!) - _diaSemana(hoy) + 7) % 7;
    if (falta == 0) falta = 7;
    tomar(semana, _sumarDias(hoy, falta));
  }

  // "el 20", "el día 20": el próximo día 20.
  if (encontrada == null) {
    final soloDia = RegExp(
      r'\bel\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(?::|horas?\b|y\s+media|y\s+cuarto|de\s+la\b|a\s?m\b|p\s?m\b))',
    ).firstMatch(texto);
    if (soloDia != null) {
      final dia = int.parse(soloDia.group(1)!);
      if (dia >= 1 && dia <= 31) {
        var f = DateTime(hoy.year, hoy.month, dia);
        if (f.isBefore(hoySinHora) || f.day != dia) f = DateTime(hoy.year, hoy.month + 1, dia);
        tomar(soloDia, f.day == dia ? f : null);
      }
    }
  }
  return encontrada != null ? _DiaLeido(encontrada!, tramos) : null;
}

// ── Textos libres ───────────────────────────────────────

final _conectores =
    RegExp(r'(?:^|\s)(?:en|el|la|los|las|de|del|para|con|y|e|a|al|que|es|sera|dia|por|un|una)$');

/// Quita espacios, puntuación y palabras sueltas del final ("Taller de Git en el" → "Taller de Git").
String _limpiar(String texto) {
  var t = texto.replaceAll(RegExp(r'^[\s,.;:¡!¿?-]+|[\s,.;:¡!¿?-]+$'), '');
  while (true) {
    final m = _conectores.firstMatch(plano(t));
    if (m == null) break;
    t = t.substring(0, m.start).replaceAll(RegExp(r'[\s,.;:-]+$'), '');
    if (t.isEmpty) break;
  }
  return t;
}

String _mayuscula(String texto) => texto.isNotEmpty ? texto[0].toUpperCase() + texto.substring(1) : texto;

const _titulosDePersona = <String>{
  'el',
  'la',
  'don',
  'dona',
  'lic',
  'licenciado',
  'licenciada',
  'ing',
  'ingeniero',
  'ingeniera',
  'dr',
  'dra',
  'doctor',
  'doctora',
  'docente',
  'profesor',
  'profesora',
  'auxiliar',
  'msc',
};

int? _buscarPersona(String texto, List<PersonaCtx> personas) {
  final palabras = plano(texto).split(RegExp(r'\s+')).where((p) => p.isNotEmpty && !_titulosDePersona.contains(p)).toList();
  if (palabras.isEmpty) return null;
  final candidatas = personas.where((p) {
    final nombre = plano(p.nombreCompleto).split(RegExp(r'\s+'));
    return palabras.every((palabra) => nombre.contains(palabra));
  }).toList();
  // Con un solo nombre ("Ana") solo vale si no hay dos personas que se llamen así.
  return candidatas.length == 1 ? candidatas[0].id : null;
}

final _esActividad = RegExp(
  r'^(?:taller|curso|cursillo|clase|examen|capacitacion|reunion|defensa|practica|evento|seminario|charla|conferencia|olimpiada|hackathon|hackaton|prueba|evaluacion|presentacion|concurso|feria|induccion|laboratorio de)\b',
);

// ── Todo junto ──────────────────────────────────────────

ResultadoDictado interpretarDictado(String dictado, ContextoDictado contexto) {
  final resultado = ResultadoDictado();
  final original = numerosEnCifras(dictado.replaceAll(RegExp(r'\s+'), ' ').trim());
  if (original.isEmpty) {
    resultado.faltantes = ['título', 'aulas', 'día', 'horario'];
    return resultado;
  }
  final completo = plano(original);
  var texto = completo;
  final tramos = <_Tramo>[];
  void ocupar(List<_Tramo> nuevos) {
    for (final t in nuevos) {
      tramos.add(t);
      texto = _tapar(texto, t);
    }
  }

  // 1. Horario, aulas y día (en ese orden: cada uno tapa lo suyo para no confundir al siguiente).
  final horario = _buscarHorario(texto);
  if (horario != null) {
    resultado.horaInicio = _aHora(horario.inicio);
    resultado.horaFin = _aHora(horario.fin);
    ocupar([horario.tramo]);
    resultado.entendido.add(
      'Horario: ${resultado.horaInicio} a ${resultado.horaFin}${horario.supuesto ? ' (lo supuse; ajústalo)' : ''}',
    );
  }

  final aulas = _buscarAulas(texto, contexto.laboratorios);
  ocupar(aulas.tramos);
  if (aulas.ids.isNotEmpty) {
    resultado.laboratorios = aulas.ids;
    final codigos = [
      for (final id in aulas.ids)
        contexto.laboratorios.firstWhere((l) => l.id == id, orElse: () => LabCtx(id, '', '')).codigo,
    ];
    resultado.entendido.add('${aulas.ids.length == 1 ? 'Aula' : 'Aulas'}: ${codigos.join(', ')}');
  }
  if (aulas.desconocidas.isNotEmpty) {
    resultado.entendido.add('No encontré el laboratorio ${aulas.desconocidas.join(', ')}');
  }

  final dia = _buscarDia(texto, contexto.hoy);
  if (dia != null) {
    resultado.fecha = _aISO(dia.fecha);
    ocupar(dia.tramos);
    final f = dia.fecha;
    resultado.entendido.add('Día: ${_nombresDias[_diaSemana(f)]} ${f.day} de ${_meses[f.month - 1]}');
  }

  // 2. Apoyo de auxiliares.
  final sinApoyo = RegExp(r'\bsin\s+(?:el\s+)?apoyo(?:\s+de\s+auxiliares)?\b').firstMatch(texto);
  final conAuxiliares =
      RegExp(r'\b(?:con|y|requiere|necesita)\s+(?:el\s+)?(?:apoyo\s+de\s+)?(\d{1,2}|un)\s+auxiliar(?:es)?\b')
          .firstMatch(texto);
  final conApoyo =
      RegExp(r'\b(?:con|y|requiere|necesita)\s+(?:el\s+)?apoyo(?:\s+de\s+(?:los\s+)?auxiliar(?:es)?)?\b')
          .firstMatch(texto);
  if (sinApoyo != null) {
    resultado.requiereApoyo = false;
    ocupar([_Tramo(sinApoyo.start, sinApoyo.end)]);
  } else if (conAuxiliares != null) {
    resultado.requiereApoyo = true;
    final n = conAuxiliares.group(1) == 'un' ? 1 : int.parse(conAuxiliares.group(1)!);
    resultado.auxiliaresRequeridos = _min(10, _max(1, n));
    ocupar([_Tramo(conAuxiliares.start, conAuxiliares.end)]);
  } else if (conApoyo != null) {
    resultado.requiereApoyo = true;
    resultado.auxiliaresRequeridos = 1;
    ocupar([_Tramo(conApoyo.start, conApoyo.end)]);
  }
  if (resultado.requiereApoyo == true) {
    final n = resultado.auxiliaresRequeridos ?? 1;
    resultado.entendido.add('Apoyo: $n ${n == 1 ? 'auxiliar' : 'auxiliares'}');
  }

  // 3. Programas: los del catálogo que se nombran en la frase.
  final vistos = <String>{};
  final programas = <int>[];
  final nombresProgramas = <String>[];
  for (final p in contexto.programas) {
    final nombre = plano(p.nombre).trim().replaceAll(RegExp(r'\s+'), ' ');
    if (nombre.length < 3 || vistos.contains(nombre)) continue;
    if (_contienePalabra(completo, nombre)) {
      vistos.add(nombre);
      programas.add(p.id);
      nombresProgramas.add(p.nombre);
    }
  }
  if (programas.isNotEmpty) {
    resultado.programas = programas;
    resultado.entendido.add('Programas: ${nombresProgramas.join(', ')}');
  }

  // 4. Textos con palabra clave: van desde la palabra hasta el siguiente dato entendido.
  final patrones = <MapEntry<String, RegExp>>[
    MapEntry('titulo', RegExp(r'\b(?:titulo|titulada|titulado|llamada|llamado|se\s+llama|actividad|evento)\s+(?:es\s+)?')),
    MapEntry(
      'solicitante',
      RegExp(
        r'\b(?:(?:lo|la)\s+)?(?:solicitad[oa]\s+por|solicitante(?:\s+es)?|solicita|a\s+nombre\s+de|pedid[oa]\s+por|pide|de\s+parte\s+de)\s+',
      ),
    ),
    MapEntry('descripcion', RegExp(r'\b(?:descripcion|detalles?|nota|observacion(?:es)?)\s+(?:es\s+)?')),
    MapEntry('contacto', RegExp(r'\b(?:contacto|telefono|celular|correo)\s+(?:es\s+)?')),
  ];
  final marcas = <MapEntry<String, _Tramo>>[];
  for (final par in patrones) {
    final m = par.value.firstMatch(texto);
    if (m != null) marcas.add(MapEntry(par.key, _Tramo(m.start, m.end)));
  }
  // "para el Centro de Estudiantes": solo si no se dijo "solicita…".
  _Tramo? debil;
  if (!marcas.any((m) => m.key == 'solicitante')) {
    final m = RegExp(r'\bpara\s+(?:el|la|los|las)\s+').firstMatch(texto);
    if (m != null) {
      debil = _Tramo(m.start, m.end);
      marcas.add(MapEntry('solicitante', debil));
    }
  }
  ocupar([for (final m in marcas) m.value]);

  int hasta(int desde) {
    var menor = original.length;
    for (final t in tramos) {
      if (t.inicio >= desde && t.inicio < menor) menor = t.inicio;
    }
    return menor;
  }

  final libres = <String, String>{};
  for (final m in marcas) {
    libres[m.key] = _limpiar(original.substring(m.value.fin, hasta(m.value.fin)));
  }

  // 5. El título: lo que se dijo al inicio, antes de cualquier otro dato.
  var primero = original.length;
  for (final t in tramos) {
    if (t.inicio < primero) primero = t.inicio;
  }
  var inicial = original.substring(0, primero);
  final entrada = RegExp(
    r'^\s*(?:por\s+favor\s+)?(?:(?:quiero|quisiera|necesito|deseo)\s+)?(?:(?:hacer|crear|registrar|agendar|programar)\s+)?(?:(?:una|la)\s+)?(?:nueva\s+)?(reservar|reserva)?\s*',
  ).firstMatch(plano(inicial));
  if (entrada != null && entrada.group(0)!.trim().isNotEmpty) {
    inicial = inicial.substring(entrada.group(0)!.length);
    if (entrada.group(1) != null) {
      inicial = inicial.replaceFirst(RegExp(r'^\s*(?:de|del|para)\s+(?:(?:el|la|un|una)\s+)?', caseSensitive: false), '');
    }
  }
  var titulo = (libres['titulo'] != null && libres['titulo']!.isNotEmpty) ? libres['titulo']! : _limpiar(inicial);
  var solicitante = libres['solicitante'] ?? '';
  // "…para el taller de Git": si no hay título, eso no es quien la pide: es la actividad.
  if (titulo.isEmpty && debil != null && solicitante.isNotEmpty && _esActividad.hasMatch(plano(solicitante))) {
    titulo = solicitante;
    solicitante = '';
  }
  if (titulo.isNotEmpty) {
    final conMayus = _mayuscula(titulo);
    resultado.titulo = conMayus.length > 150 ? conMayus.substring(0, 150) : conMayus;
    resultado.entendido.insert(0, 'Título: ${resultado.titulo}');
  }
  if (solicitante.isNotEmpty) {
    final persona = _buscarPersona(solicitante, contexto.personas);
    if (persona != null) {
      resultado.solicitante = persona;
      final nombre =
          contexto.personas.firstWhere((p) => p.id == persona, orElse: () => PersonaCtx(persona, solicitante)).nombreCompleto;
      resultado.entendido.add('Solicita: $nombre (usuario del sistema)');
    } else {
      final ext = _mayuscula(solicitante);
      resultado.solicitanteExterno = ext.length > 150 ? ext.substring(0, 150) : ext;
      resultado.entendido.add('Solicita: ${resultado.solicitanteExterno}');
    }
  }
  final contactoLibre = libres['contacto'];
  if (contactoLibre != null && contactoLibre.isNotEmpty) {
    // Un teléfono dictado llega con espacios: "7 123 4567".
    final contacto =
        RegExp(r'^[\d\s+-]+$').hasMatch(contactoLibre) ? contactoLibre.replaceAll(RegExp(r'\s+'), '') : contactoLibre;
    resultado.contacto = contacto.length > 100 ? contacto.substring(0, 100) : contacto;
    resultado.entendido.add('Contacto: ${resultado.contacto}');
  }
  final descripcionLibre = libres['descripcion'];
  if (descripcionLibre != null && descripcionLibre.isNotEmpty) {
    resultado.descripcion = _mayuscula(descripcionLibre);
    resultado.entendido.add('Descripción: ${resultado.descripcion}');
  }

  if (resultado.titulo == null) resultado.faltantes.add('título');
  if (resultado.laboratorios == null) resultado.faltantes.add('aulas');
  if (resultado.fecha == null) resultado.faltantes.add('día');
  if (resultado.horaInicio == null) resultado.faltantes.add('horario');
  return resultado;
}
