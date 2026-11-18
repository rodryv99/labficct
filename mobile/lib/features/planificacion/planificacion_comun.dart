import '../../core/modelos/modelos.dart';

/// Días de la semana (coinciden con el backend: Lunes = 1 … Domingo = 7).
const diasSemana = [
  (1, 'Lunes', 'Lun'),
  (2, 'Martes', 'Mar'),
  (3, 'Miércoles', 'Mié'),
  (4, 'Jueves', 'Jue'),
  (5, 'Viernes', 'Vie'),
  (6, 'Sábado', 'Sáb'),
  (7, 'Domingo', 'Dom'),
];

/// [3] → "Miércoles"; [1, 3, 5] → "Lun · Mié · Vie".
String nombreDias(List<int> dias) {
  if (dias.isEmpty) return '';
  if (dias.length == 1) {
    return diasSemana.firstWhere((d) => d.$1 == dias.first, orElse: () => (0, '', '')).$2;
  }
  return dias.map((d) => diasSemana.firstWhere((x) => x.$1 == d, orElse: () => (0, '', '')).$3).join(' · ');
}

/// "07:00:00" → "07:00".
String horaCorta(String hora) => hora.length >= 5 ? hora.substring(0, 5) : hora;

/// Una clase tal como se muestra: el mismo horario (materia, grupo, docente,
/// laboratorio y horas) dado en uno o varios días. En la base hay un horario
/// por día; aquí se juntan en una fila.
class GrupoHorario {
  const GrupoHorario({required this.base, required this.horarios, required this.dias});

  /// El primero de la semana: de él salen materia, grupo, docente, horas…
  final Horario base;
  final List<Horario> horarios;
  final List<int> dias;

  List<int> get ids => horarios.map((h) => h.id).toList();
}

int _aMinutos(String hora) {
  final partes = horaCorta(hora).split(':');
  return int.parse(partes[0]) * 60 + int.parse(partes.length > 1 ? partes[1] : '0');
}

/// Junta los horarios por clase (una fila por clase) y los ordena.
List<GrupoHorario> agruparHorarios(List<Horario> horarios) {
  final grupos = <String, List<Horario>>{};
  for (final h in horarios) {
    final clave = [
      h.periodo,
      h.laboratorio,
      h.materia,
      h.grupo,
      h.docente ?? '',
      h.horaInicio,
      h.horaFin,
      h.activo,
      h.observaciones,
    ].join('|');
    grupos.putIfAbsent(clave, () => []).add(h);
  }
  final lista = grupos.values.map((hs) {
    final ordenados = [...hs]..sort((a, b) => a.diaSemana - b.diaSemana);
    return GrupoHorario(
      base: ordenados.first,
      horarios: ordenados,
      dias: ordenados.map((h) => h.diaSemana).toList(),
    );
  }).toList();
  lista.sort((a, b) {
    final porDia = a.dias.first - b.dias.first;
    if (porDia != 0) return porDia;
    final porHora = _aMinutos(a.base.horaInicio) - _aMinutos(b.base.horaInicio);
    if (porHora != 0) return porHora;
    return a.base.materiaSigla.compareTo(b.base.materiaSigla);
  });
  return lista;
}
