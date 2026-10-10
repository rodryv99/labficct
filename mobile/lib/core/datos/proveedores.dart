import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/sesion.dart';
import '../modelos/modelos.dart';
import '../network/repositorio.dart';

/// Se lanza cuando no hay sesión; la pantalla ya se está cerrando, así que no se muestra.
class SinSesion implements Exception {
  const SinSesion();
}

/// Repositorio atado al usuario actual: si cambia la sesión, los datos se piden
/// de nuevo y nunca se ven los de la persona anterior.
Repositorio _repo(Ref ref) {
  final id = ref.watch(sesionProvider.select((s) => s.usuario?.id));
  if (id == null) throw const SinSesion();
  return ref.watch(repositorioProvider);
}

// ── Catálogos ──
final tiposProvider = FutureProvider<Map<int, TipoElemento>>((ref) async {
  final lista = await _repo(ref).elementos();
  return {for (final t in lista) t.id: t};
});

final softwareProvider = FutureProvider<List<Software>>((ref) => _repo(ref).software());

final personasProvider = FutureProvider.family<List<UsuarioOpcion>, String>(
  (ref, roles) => _repo(ref).opcionesUsuarios(roles),
);

// ── Laboratorios ──
final laboratoriosProvider = FutureProvider<List<Laboratorio>>((ref) => _repo(ref).laboratorios());

final laboratorioProvider = FutureProvider.family<Laboratorio, int>((ref, id) => _repo(ref).laboratorio(id));

final distribucionProvider = FutureProvider.family<Distribucion, int>((ref, id) => _repo(ref).distribucion(id));

final credencialesProvider = FutureProvider.family<List<Credencial>, int>(
  (ref, laboratorio) => _repo(ref).credenciales(laboratorio),
);

// ── Agenda, horarios y reservas ──
/// Clave: fecha en formato yyyy-MM-dd.
final agendaDiaProvider = FutureProvider.family<List<EventoAgenda>, String>(
  (ref, fecha) => _repo(ref).agenda(fecha, fecha),
);

/// Clave: 'proximas' o 'pasadas'.
final reservasProvider = FutureProvider.family<List<Reserva>, String>(
  (ref, cuando) => _repo(ref).reservas(cuando: cuando),
);

/// Clases del periodo vigente (el docente recibe solo las suyas desde la API).
final misClasesProvider = FutureProvider<List<Horario>>((ref) async {
  final repo = _repo(ref);
  final periodos = await repo.periodos();
  final vigente = periodos.where((p) => p.vigente).firstOrNull;
  return repo.horarios(periodo: vigente?.id);
});

// ── Objetos perdidos ──
typedef FiltroObjetos = ({String? estado, String buscar});

final objetosProvider = FutureProvider.family<List<ObjetoPerdido>, FiltroObjetos>(
  (ref, filtro) => _repo(ref).objetos(estado: filtro.estado, buscar: filtro.buscar),
);

final objetoProvider = FutureProvider.family<ObjetoPerdido, int>((ref, id) => _repo(ref).objeto(id));

/// Clave: (id del objeto, 'ci-anverso' | 'ci-reverso' | 'persona').
/// autoDispose: la foto se libera de la memoria al cerrar la pantalla.
final fotoEntregaProvider = FutureProvider.autoDispose.family<Uint8List, (int, String)>(
  (ref, clave) => _repo(ref).fotoEntrega(clave.$1, clave.$2),
);

// ── Notificaciones ──
/// Cada cuánto se consulta la campana.
const intervaloNotificaciones = Duration(seconds: 20);

/// Resumen de la campana. Se vuelve a pedir solo cada [intervaloNotificaciones]
/// mientras haya sesión y alguien lo esté mirando.
final resumenNotificacionesProvider = FutureProvider.autoDispose<ResumenNotificaciones>((ref) {
  final repo = _repo(ref);
  final siguiente = Timer(intervaloNotificaciones, () => ref.invalidateSelf());
  ref.onDispose(siguiente.cancel);
  return repo.resumenNotificaciones();
});

/// Las 50 más recientes, leídas o no.
final notificacionesProvider = FutureProvider.autoDispose<List<Notificacion>>(
  (ref) => _repo(ref).notificaciones(),
);

// ── Preferencias del docente ──
typedef FormularioPreferencias = ({List<OpcionPreferencia> opciones, Preferencias mias});

final misPreferenciasProvider = FutureProvider.autoDispose<FormularioPreferencias>((ref) async {
  final repo = _repo(ref);
  final opciones = await repo.opcionesPreferencia();
  final mias = await repo.misPreferencias();
  return (opciones: opciones, mias: mias);
});

// ── Solicitudes de asistencia ──
/// Clave: true = abiertas, false = cerradas, null = todas (las de quien las pidió).
final solicitudesProvider = FutureProvider.family<List<SolicitudAsistencia>, bool?>(
  (ref, abiertas) => _repo(ref).solicitudes(abiertas: abiertas),
);

/// Para el aviso de la pantalla Hoy (solo quien atiende).
final solicitudesAbiertasProvider = FutureProvider<int>((ref) => _repo(ref).contarSolicitudesAbiertas());

final solicitudProvider = FutureProvider.autoDispose.family<SolicitudAsistencia, int>(
  (ref, id) => _repo(ref).solicitud(id),
);

/// Tras pedir, tomar, resolver o cancelar una solicitud.
void refrescarSolicitudes(ProviderContainer contenedor) {
  contenedor.invalidate(solicitudesProvider);
  contenedor.invalidate(solicitudesAbiertasProvider);
}

// ── Pizarrón de tareas ──
final tareasProvider = FutureProvider<List<Tarea>>((ref) => _repo(ref).tareas());

final tareaProvider = FutureProvider.autoDispose.family<Tarea, int>((ref, id) => _repo(ref).tarea(id));

/// Tras crear o cambiar algo de la agenda, refresca todo lo que la muestra.
/// Recibe el contenedor (tomado antes del await) porque la pantalla puede haberse cerrado.
void refrescarAgenda(ProviderContainer contenedor) {
  contenedor.invalidate(agendaDiaProvider);
  contenedor.invalidate(reservasProvider);
}
