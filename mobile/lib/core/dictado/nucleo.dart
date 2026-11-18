/// Núcleo del dictado por voz: los ladrillos que comparten los formularios de la app.
///
/// Son reglas, sin servicios externos. Entienden lo que casi siempre se dice en una
/// frase: el día, el horario, los laboratorios, una persona, un ítem de un catálogo
/// (materia, tipo…) o una opción con sinónimos (prioridad, estado…).
///
/// Es el mismo motor que usa reservas (features/reservas/dictado.dart), puesto aparte
/// para reutilizarlo en tareas, objetos perdidos, horarios e inventario. No guarda nada:
/// solo propone valores que la persona revisa.
library;

// ── Contextos ───────────────────────────────────────────

/// Lo que todo resultado de dictado comparte: qué se entendió y qué faltó.
/// El widget de voz solo necesita estas dos listas para mostrar el resumen.
abstract class ResultadoBase {
  List<String> get entendido;
  List<String> get faltantes;
}

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

class ItemCatalogo {
  const ItemCatalogo(this.id, this.nombre);
  final int id;
  final String nombre;
}

class Tramo {
  const Tramo(this.inicio, this.fin);
  final int inicio;
  final int fin;
}

// ── Constantes ──────────────────────────────────────────

const meses = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
final _altMeses = '${meses.join('|')}|setiembre';
const nombresDias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const _dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const nombreDiaSemana = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const _unidades = <String, int>{
  'cero': 0, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9,
};
const _numeros = <String, int>{
  'cero': 0, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9,
  'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15, 'dieciseis': 16, 'diecisiete': 17,
  'dieciocho': 18, 'diecinueve': 19, 'veinte': 20, 'veintiuno': 21, 'veintiun': 21, 'veintidos': 22, 'veintitres': 23,
  'veinticuatro': 24, 'veinticinco': 25, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29,
};
const _decenas = <String, int>{'treinta': 30, 'cuarenta': 40, 'cincuenta': 50};
const _acentos = <String, String>{'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n'};
final _esLetraNumero = RegExp(r'[a-z0-9:/\s-]');

// ── Texto ───────────────────────────────────────────────

/// Minúsculas, sin acentos y sin puntuación, **con el mismo largo** que el original.
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

/// "ocho" → "8", "cuarenta y uno" → "41".
String numerosEnCifras(String texto) {
  final partes = _partesConEspacios(texto);
  String palabra(int i) => (i >= 0 && i < partes.length) ? plano(partes[i]).trim() : '';
  String cola(int i) {
    final p = (i >= 0 && i < partes.length) ? partes[i] : '';
    return RegExp(r'[.,;:!?]+$').firstMatch(p)?.group(0) ?? '';
  }

  final salida = <String>[];
  for (var i = 0; i < partes.length; i += 1) {
    final actual = palabra(i);
    if (_decenas.containsKey(actual)) {
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

String _dos(int n) => n.toString().padLeft(2, '0');
String aHora(int minutos) => '${_dos(minutos ~/ 60)}:${_dos(minutos % 60)}';
String aISO(DateTime f) => '${f.year}-${_dos(f.month)}-${_dos(f.day)}';
String escapar(String texto) => texto.replaceAllMapped(RegExp(r'[.*+?^${}()|[\]\\]'), (m) => '\\${m.group(0)}');
String mayuscula(String texto) => texto.isNotEmpty ? texto[0].toUpperCase() + texto.substring(1) : texto;
DateTime sumarDias(DateTime fecha, int dias) => DateTime(fecha.year, fecha.month, fecha.day + dias);
int _diaSemana(DateTime d) => d.weekday % 7;
int _min(int a, int b) => a < b ? a : b;
int _max(int a, int b) => a > b ? a : b;
String _tapar(String texto, Tramo t) =>
    texto.substring(0, t.inicio) + (' ' * (t.fin - t.inicio)) + texto.substring(t.fin);

/// Primer calce de `aguja` (texto plano, literal) como palabra completa, sin lookbehind.
Tramo? _hallarPalabra(String heno, String aguja) {
  for (final m in RegExp(escapar(aguja)).allMatches(heno)) {
    final antesOk = m.start == 0 || !RegExp(r'[a-z0-9]').hasMatch(heno[m.start - 1]);
    final despuesOk = m.end == heno.length || !RegExp(r'[a-z0-9]').hasMatch(heno[m.end]);
    if (antesOk && despuesOk) return Tramo(m.start, m.end);
  }
  return null;
}

// ── Lienzo (va tapando lo entendido) ────────────────────

class Lienzo {
  Lienzo(this.texto);
  String texto;
  final List<Tramo> tramos = [];

  void ocupar(List<Tramo> nuevos) {
    for (final t in nuevos) {
      tramos.add(t);
      texto = _tapar(texto, t);
    }
  }

  int hasta(int desde, int largoTotal) {
    var m = largoTotal;
    for (final t in tramos) {
      if (t.inicio >= desde && t.inicio < m) m = t.inicio;
    }
    return m;
  }

  int primera(int largoTotal) {
    var m = largoTotal;
    for (final t in tramos) {
      if (t.inicio < m) m = t.inicio;
    }
    return m;
  }
}

// ── Horario ─────────────────────────────────────────────

const _hora =
    '(\\d{1,2}|una|mediodia)(?::(\\d{2}))?(?:\\s+y\\s+(media|cuarto))?(?:\\s*(?:horas|hora|hrs|hs|h)\\b)?'
    '(?:\\s*(a\\s*m|p\\s*m)\\b)?(?:\\s+(?:de|por|en)\\s+la\\s+(manana|tarde|noche))?';

class _HoraLeida {
  const _HoraLeida(this.hora, this.minuto, this.periodo, this.explicita);
  final int hora;
  final int minuto;
  final String? periodo;
  final bool explicita;
}

_HoraLeida? _leerHora(List<String?> g) {
  final numero = g[0];
  if (numero == null) return null;
  var hora = numero == 'una' ? 1 : (numero == 'mediodia' ? 12 : int.parse(numero));
  final minuto = g[1] != null ? int.parse(g[1]!) : (g[2] == 'media' ? 30 : (g[2] == 'cuarto' ? 15 : 0));
  if (hora > 24 || minuto > 59) return null;
  if (hora == 24) hora = 0;
  String? periodo;
  if (g[3] != null) {
    periodo = g[3]!.startsWith('a') ? 'am' : 'pm';
  } else if (g[4] != null) {
    periodo = g[4] == 'manana' ? 'am' : 'pm';
  } else if (numero == 'mediodia') {
    periodo = 'pm';
  }
  final explicita = g[1] != null || g[2] != null || g[3] != null || g[4] != null || numero == 'mediodia';
  return _HoraLeida(hora, minuto, periodo, explicita);
}

int _enMinutos(_HoraLeida h, String? periodo) {
  var hora = h.hora;
  if (periodo == 'pm' && hora < 12) hora += 12;
  if (periodo == 'am' && hora == 12) hora = 0;
  return hora * 60 + h.minuto;
}

List<int>? _resolverRango(_HoraLeida a, _HoraLeida b) {
  int inicio;
  int fin;
  if (a.periodo != null || b.periodo != null) {
    fin = _enMinutos(b, b.periodo ?? a.periodo);
    if (a.periodo != null) {
      inicio = _enMinutos(a, a.periodo);
    } else {
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

class HorarioLeido {
  const HorarioLeido(this.inicio, this.fin, this.tramo, {this.supuesto = false});
  final int inicio;
  final int fin;
  final Tramo tramo;
  final bool supuesto;
}

HorarioLeido? buscarHorario(String texto) {
  final rangos = [
    RegExp('\\b(?:de|desde|entre)\\s+(?:las?\\s+|el\\s+)?$_hora\\s+(?:a|al|hasta|y)\\s+(?:las?\\s+|el\\s+)?$_hora'),
    RegExp('\\b$_hora\\s*(?:a|al|hasta|-)\\s*(?:las?\\s+|el\\s+)?$_hora'),
  ];
  for (var indice = 0; indice < rangos.length; indice += 1) {
    final m = rangos[indice].firstMatch(texto);
    if (m == null) continue;
    final a = _leerHora([m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)]);
    final b = _leerHora([m.group(6), m.group(7), m.group(8), m.group(9), m.group(10)]);
    if (a == null || b == null) continue;
    if (indice == 1 && !a.explicita && !b.explicita) continue;
    final rango = _resolverRango(a, b);
    if (rango != null) return HorarioLeido(rango[0], rango[1], Tramo(m.start, m.end));
  }

  final una = RegExp('\\b(?:a|desde)\\s+(?:las?|el)\\s+$_hora').firstMatch(texto);
  if (una != null) {
    final a = _leerHora([una.group(1), una.group(2), una.group(3), una.group(4), una.group(5)]);
    if (a != null) {
      final inicio = _enMinutos(a, a.periodo ?? (a.hora < 7 ? 'pm' : null));
      var tramo = Tramo(una.start, una.end);
      var duracion = 120;
      final d = RegExp(r'\b(?:por|durante)\s+(\d{1,2}|una)\s+horas?(\s+y\s+media)?').firstMatch(texto);
      if (d != null) {
        duracion = (d.group(1) == 'una' ? 1 : int.parse(d.group(1)!)) * 60 + (d.group(2) != null ? 30 : 0);
        tramo = Tramo(_min(tramo.inicio, d.start), _max(tramo.fin, d.end));
      }
      final fin = _min(inicio + duracion, 23 * 60 + 59);
      if (inicio < fin) return HorarioLeido(inicio, fin, tramo);
    }
  }

  final parte = RegExp(r'\b(?:en|por|durante)\s+la\s+(manana|tarde|noche)\b').firstMatch(texto);
  if (parte != null) {
    final p = parte.group(1);
    final rango = p == 'manana' ? [480, 600] : (p == 'tarde' ? [840, 960] : [1140, 1260]);
    return HorarioLeido(rango[0], rango[1], Tramo(parte.start, parte.end), supuesto: true);
  }
  return null;
}

// ── Laboratorios ────────────────────────────────────────

const _palabraAula = '(?:laboratorios?|labs?|aulas?|salas?)';

class AulasLeidas {
  const AulasLeidas(this.ids, this.tramos, this.desconocidas);
  final List<int> ids;
  final List<Tramo> tramos;
  final List<String> desconocidas;
}

AulasLeidas buscarAulas(String texto, List<LabCtx> laboratorios) {
  final ids = <int>[];
  final tramos = <Tramo>[];
  final desconocidas = <String>[];
  void agregar(int id) {
    if (!ids.contains(id)) ids.add(id);
  }

  final todas = RegExp('\\b(?:en\\s+)?tod[oa]s\\s+l[oa]s\\s+$_palabraAula\\b').firstMatch(texto);
  if (todas != null) {
    for (final l in laboratorios) {
      agregar(l.id);
    }
    tramos.add(Tramo(todas.start, todas.end));
    return AulasLeidas(ids, tramos, desconocidas);
  }

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

  final lista = RegExp(
    '\\b(?:en\\s+)?(?:(?:el|la|los|las)\\s+)?$_palabraAula\\s+(?:numeros?\\s+)?(\\d{1,3}(?:(?:\\s+(?:y|e)\\s+|\\s+)(?:(?:el|la)\\s+)?\\d{1,3})*)',
  );
  for (final m in lista.allMatches(texto)) {
    final inicioNumeros = m.end - m.group(1)!.length;
    var fin = inicioNumeros;
    for (final n in RegExp(r'\d{1,3}').allMatches(m.group(1)!)) {
      final posicion = inicioNumeros + n.start;
      final despues = texto.substring(posicion + n.group(0)!.length);
      if (RegExp('^(?:\\s+de\\s+(?:$_altMeses)\\b|:)').hasMatch(despues)) break;
      final id = porNumero[int.parse(n.group(0)!)];
      if (id == null) {
        if (fin == inicioNumeros) {
          desconocidas.add(n.group(0)!);
          fin = posicion + n.group(0)!.length;
        }
        break;
      }
      agregar(id);
      fin = posicion + n.group(0)!.length;
    }
    if (fin > inicioNumeros) tramos.add(Tramo(m.start, fin));
  }

  for (final lab in laboratorios) {
    final nombre = plano(lab.nombre).replaceFirst(RegExp('^\\s*$_palabraAula\\s+(?:de\\s+)?'), '').trim();
    if (nombre.length < 3 || RegExp(r'^\d+$').hasMatch(nombre)) continue;
    final m = RegExp('\\b(?:en\\s+)?(?:(?:el|la)\\s+)?$_palabraAula\\s+(?:de\\s+)?${escapar(nombre)}(?![a-z0-9])')
        .firstMatch(texto);
    if (m != null) {
      agregar(lab.id);
      tramos.add(Tramo(m.start, m.end));
    }
  }
  return AulasLeidas(ids, tramos, desconocidas);
}

// ── Día (fecha concreta) ────────────────────────────────

class DiaLeido {
  const DiaLeido(this.fecha, this.tramos);
  final DateTime fecha;
  final List<Tramo> tramos;
}

DiaLeido? buscarDia(String texto, DateTime hoy) {
  final tramos = <Tramo>[];
  DateTime? encontrada;
  void tomar(Match m, DateTime? valor) {
    tramos.add(Tramo(m.start, m.end));
    encontrada ??= valor;
  }

  final hoySinHora = sumarDias(hoy, 0);

  final conMes = RegExp('\\b(?:el\\s+)?(?:dia\\s+)?(\\d{1,2})\\s+de\\s+($_altMeses)(?:\\s+(?:de|del)\\s+(\\d{4}))?')
      .firstMatch(texto);
  if (conMes != null) {
    final mesNombre = conMes.group(2)!;
    final mes = mesNombre == 'setiembre' ? 8 : meses.indexOf(mesNombre);
    final dia = int.parse(conMes.group(1)!);
    var f = DateTime(conMes.group(3) != null ? int.parse(conMes.group(3)!) : hoy.year, mes + 1, dia);
    if (conMes.group(3) == null && f.isBefore(hoySinHora)) f = DateTime(hoy.year + 1, mes + 1, dia);
    tomar(conMes, f.day == dia ? f : null);
  }

  final conBarras = RegExp(r'\b(?:el\s+)?(?:dia\s+)?(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b').firstMatch(texto);
  if (conBarras != null) {
    final anioTexto = conBarras.group(3);
    final anio = anioTexto != null ? int.parse(anioTexto.length == 2 ? '20$anioTexto' : anioTexto) : hoy.year;
    final dia = int.parse(conBarras.group(1)!);
    final f = DateTime(anio, int.parse(conBarras.group(2)!), dia);
    tomar(conBarras, f.day == dia ? f : null);
  }

  final pasado = RegExp(r'\bpasado\s+manana\b').firstMatch(texto);
  if (pasado != null) tomar(pasado, sumarDias(hoy, 2));

  for (final m in RegExp(r'\bmanana\b').allMatches(texto)) {
    final antes = texto.substring(0, m.start);
    if (RegExp(r'(?:\bla|\besta|\bpasado)\s$').hasMatch(antes)) continue;
    tomar(m, sumarDias(hoy, 1));
    break;
  }

  final esHoy = RegExp(r'\bhoy\b').firstMatch(texto);
  if (esHoy != null) tomar(esHoy, hoySinHora);

  final semana = RegExp('\\b(?:el\\s+|este\\s+)?(?:proximo\\s+)?(${_dias.join('|')})\\b').firstMatch(texto);
  if (semana != null) {
    var falta = (_dias.indexOf(semana.group(1)!) - _diaSemana(hoy) + 7) % 7;
    if (falta == 0) falta = 7;
    tomar(semana, sumarDias(hoy, falta));
  }

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
  return encontrada != null ? DiaLeido(encontrada!, tramos) : null;
}

// ── Días de la semana (clases que se repiten) ───────────

class DiasSemanaLeidos {
  const DiasSemanaLeidos(this.dias, this.tramos);
  final List<int> dias;
  final List<Tramo> tramos;
}

/// "los lunes y miércoles". Devuelve los días (1 = lunes … 7 = domingo).
DiasSemanaLeidos? buscarDiasSemana(String texto) {
  const mapa = <String, int>{
    'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6, 'domingo': 7,
  };
  final dias = <int>[];
  final tramos = <Tramo>[];
  for (final m in RegExp(r'\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b').allMatches(texto)) {
    final valor = mapa[m.group(1)!]!;
    if (!dias.contains(valor)) dias.add(valor);
    tramos.add(Tramo(m.start, m.end));
  }
  if (dias.isEmpty) return null;
  dias.sort();
  return DiasSemanaLeidos(dias, tramos);
}

// ── Personas y catálogos ────────────────────────────────

const _titulosDePersona = <String>{
  'el', 'la', 'don', 'dona', 'lic', 'licenciado', 'licenciada', 'ing', 'ingeniero', 'ingeniera',
  'dr', 'dra', 'doctor', 'doctora', 'docente', 'profesor', 'profesora', 'auxiliar', 'msc',
};

int? buscarPersona(String texto, List<PersonaCtx> personas) {
  final palabras =
      plano(texto).split(RegExp(r'\s+')).where((p) => p.isNotEmpty && !_titulosDePersona.contains(p)).toList();
  if (palabras.isEmpty) return null;
  final candidatas = personas.where((p) {
    final nombre = plano(p.nombreCompleto).split(RegExp(r'\s+'));
    return palabras.every((palabra) => nombre.contains(palabra));
  }).toList();
  return candidatas.length == 1 ? candidatas[0].id : null;
}

class _Hallado {
  const _Hallado(this.id, this.tramo, this.largo);
  final int id;
  final Tramo tramo;
  final int largo;
}

/// Busca por toda la frase a la persona nombrada (el nombre más largo que calce gana).
({int id, Tramo tramo})? buscarPersonaEnFrase(String texto, List<PersonaCtx> personas) {
  _Hallado? mejor;
  for (final p in personas) {
    for (final parte in plano(p.nombreCompleto).split(RegExp(r'\s+')).where((x) => x.length > 2)) {
      final t = _hallarPalabra(texto, parte);
      if (t != null && (mejor == null || parte.length > mejor.largo)) {
        mejor = _Hallado(p.id, t, parte.length);
      }
    }
  }
  return mejor == null ? null : (id: mejor.id, tramo: mejor.tramo);
}

/// Encuentra el ítem del catálogo cuyo nombre aparezca en la frase (el más largo gana).
({int id, Tramo tramo})? buscarEnCatalogo(String texto, List<ItemCatalogo> items) {
  _Hallado? mejor;
  for (final item in items) {
    final nombre = plano(item.nombre).trim().replaceAll(RegExp(r'\s+'), ' ');
    if (nombre.length < 3) continue;
    final t = _hallarPalabra(texto, nombre);
    if (t != null && (mejor == null || nombre.length > mejor.largo)) {
      mejor = _Hallado(item.id, t, nombre.length);
    }
  }
  return mejor == null ? null : (id: mejor.id, tramo: mejor.tramo);
}

class OpcionEtiqueta<T> {
  const OpcionEtiqueta(this.valor, this.sinonimos);
  final T valor;
  final List<String> sinonimos;
}

/// Elige una opción (prioridad, estado, categoría…) por las palabras clave que la nombran.
({T valor, Tramo tramo})? buscarEtiqueta<T>(String texto, List<OpcionEtiqueta<T>> opciones) {
  T? valor;
  Tramo? tramo;
  var largo = -1;
  for (final opcion in opciones) {
    for (final sinonimo in opcion.sinonimos) {
      final t = _hallarPalabra(texto, sinonimo);
      if (t != null && sinonimo.length > largo) {
        valor = opcion.valor;
        tramo = t;
        largo = sinonimo.length;
      }
    }
  }
  return tramo == null ? null : (valor: valor as T, tramo: tramo);
}

// ── Textos libres ───────────────────────────────────────

final _conectores =
    RegExp(r'(?:^|\s)(?:en|el|la|los|las|de|del|para|con|y|e|a|al|que|es|sera|dia|por|un|una)$');

/// Quita espacios, puntuación y palabras sueltas del final.
String limpiar(String texto) {
  var t = texto.replaceAll(RegExp(r'^[\s,.;:¡!¿?-]+|[\s,.;:¡!¿?-]+$'), '');
  while (true) {
    final m = _conectores.firstMatch(plano(t));
    if (m == null) break;
    t = t.substring(0, m.start).replaceAll(RegExp(r'[\s,.;:-]+$'), '');
    if (t.isEmpty) break;
  }
  return t;
}

/// Saca los textos libres marcados por palabras clave ("descripción …", "marca …").
Map<String, String> textosConClave(
  String textoPlano,
  String original,
  Lienzo lienzo,
  List<MapEntry<String, RegExp>> patrones,
) {
  final marcas = <MapEntry<String, Tramo>>[];
  for (final p in patrones) {
    final m = p.value.firstMatch(textoPlano);
    if (m != null) marcas.add(MapEntry(p.key, Tramo(m.start, m.end)));
  }
  lienzo.ocupar(marcas.map((e) => e.value).toList());
  final libres = <String, String>{};
  for (final e in marcas) {
    libres[e.key] = limpiar(original.substring(e.value.fin, lienzo.hasta(e.value.fin, original.length)));
  }
  return libres;
}
