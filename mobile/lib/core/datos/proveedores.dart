import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/sesion.dart';
import '../modelos/modelos.dart';
import '../network/repositorio.dart';
import '../push/servicio_push.dart';

/// Servicio de notificaciones push (FCM). Único para toda la app.
final servicioPushProvider = Provider<ServicioPush>((ref) {
  return ServicioPush(ref.watch(repositorioProvider));
});

/// Las preferencias de push de la persona (interruptor general y "solo en turno").
final preferenciasPushProvider = FutureProvider<PreferenciasPush>((ref) {
  return _repo(ref).preferenciasPush();
});

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

/// Preferencia por usuario: qué laboratorios muestra la pizarra y en qué orden (ids).
/// Lista vacía = se muestran todos.
final labsPizarraProvider = FutureProvider<List<int>>((ref) => _repo(ref).laboratoriosPizarra());

final laboratorioProvider = FutureProvider.family<Laboratorio, int>((ref, id) => _repo(ref).laboratorio(id));

final distribucionProvider = FutureProvider.family<Distribucion, int>((ref, id) => _repo(ref).distribucion(id));

final credencialesProvider = FutureProvider.family<List<Credencial>, int>(
  (ref, laboratorio) => _repo(ref).credenciales(laboratorio),
);

/// Tras crear, editar o borrar un laboratorio, su grilla, credenciales o software.
void refrescarLaboratorios(ProviderContainer contenedor, {int? id}) {
  contenedor.invalidate(laboratoriosProvider);
  if (id != null) {
    contenedor.invalidate(laboratorioProvider(id));
    contenedor.invalidate(distribucionProvider(id));
    contenedor.invalidate(credencialesProvider(id));
  }
  contenedor.invalidate(softwareProvider);
}

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

// ── Planificación (gestión de horarios, periodos, materias y docentes) ──
typedef FiltroHorarios = ({int? periodo, int? laboratorio, int? diaSemana, String buscar});

final periodosProvider = FutureProvider<List<Periodo>>((ref) => _repo(ref).periodos());

final materiasProvider = FutureProvider<List<Materia>>((ref) => _repo(ref).materias());

final docentesAdminProvider = FutureProvider.family<List<DocenteAdmin>, String>(
  (ref, buscar) => _repo(ref).docentesAdmin(buscar: buscar),
);

final horariosGestionProvider = FutureProvider.family<List<Horario>, FiltroHorarios>(
  (ref, f) => _repo(ref).horariosGestion(
    periodo: f.periodo,
    laboratorio: f.laboratorio,
    diaSemana: f.diaSemana,
    buscar: f.buscar,
  ),
);

/// Tras crear, editar o borrar horarios, periodos, materias o docentes.
void refrescarPlanificacion(ProviderContainer contenedor) {
  contenedor.invalidate(horariosGestionProvider);
  contenedor.invalidate(periodosProvider);
  contenedor.invalidate(materiasProvider);
  contenedor.invalidate(docentesAdminProvider);
  contenedor.invalidate(misClasesProvider);
}

// ── Revisiones periódicas ──
typedef FiltroRevisiones = ({int? laboratorio, bool? activa});

final revisionesProvider = FutureProvider.family<List<Revision>, FiltroRevisiones>(
  (ref, f) => _repo(ref).revisiones(laboratorio: f.laboratorio, activa: f.activa),
);

final revisionProvider = FutureProvider.autoDispose.family<Revision, int>(
  (ref, id) => _repo(ref).revision(id),
);

void refrescarRevisiones(ProviderContainer contenedor) {
  contenedor.invalidate(revisionesProvider);
  contenedor.invalidate(tareasProvider);
}

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

/// Solo las opciones activas, ordenadas (para marcar las preferencias de un docente).
final opcionesActivasProvider = FutureProvider<List<OpcionPreferencia>>(
  (ref) => _repo(ref).opcionesPreferencia(),
);

/// Preferencias de todos los docentes (Admin y auxiliares). Clave: texto de búsqueda.
final preferenciasDocentesProvider = FutureProvider.family<List<Preferencias>, String>(
  (ref, buscar) => _repo(ref).preferenciasDocentes(buscar: buscar),
);

void refrescarPreferenciasDocentes(ProviderContainer contenedor) =>
    contenedor.invalidate(preferenciasDocentesProvider);

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

// ── Bitácora ──
/// Clave: id del laboratorio.
final bitacoraProvider = FutureProvider.autoDispose.family<List<EntradaBitacora>, int>(
  (ref, laboratorio) => _repo(ref).bitacora(laboratorio),
);

final entradaBitacoraProvider = FutureProvider.autoDispose.family<EntradaBitacora, int>(
  (ref, id) => _repo(ref).entradaBitacora(id),
);

/// Clave: id del laboratorio.
final plantillaBitacoraProvider = FutureProvider.autoDispose.family<MapaBitacora, int>(
  (ref, laboratorio) => _repo(ref).plantillaBitacora(laboratorio),
);

/// Tras crear o cambiar algo de la agenda, refresca todo lo que la muestra.
/// Recibe el contenedor (tomado antes del await) porque la pantalla puede haberse cerrado.
void refrescarAgenda(ProviderContainer contenedor) {
  contenedor.invalidate(agendaDiaProvider);
  contenedor.invalidate(reservasProvider);
}

// ── Gestión de usuarios ──
typedef FiltroUsuarios = ({String buscar, String rol, String activo, String ordering});

final usuariosAdminProvider = FutureProvider.family<List<UsuarioAdmin>, FiltroUsuarios>(
  (ref, f) => _repo(ref).usuariosAdmin(buscar: f.buscar, rol: f.rol, activo: f.activo, ordering: f.ordering),
);

final docentesSinUsuarioProvider = FutureProvider.autoDispose<List<DocenteFicha>>(
  (ref) => _repo(ref).docentesSinUsuario(),
);

void refrescarUsuarios(ProviderContainer contenedor) => contenedor.invalidate(usuariosAdminProvider);

// ── Catálogos de administración (elementos del mapa y preguntas de preferencias) ──
final catalogoElementosProvider = FutureProvider<List<TipoElemento>>((ref) => _repo(ref).elementos());

final catalogoOpcionesProvider = FutureProvider<List<OpcionPreferencia>>((ref) => _repo(ref).catalogoOpciones());

void refrescarElementos(ProviderContainer contenedor) {
  contenedor.invalidate(catalogoElementosProvider);
  contenedor.invalidate(tiposProvider); // la grilla del mapa usa este
}

void refrescarOpciones(ProviderContainer contenedor) {
  contenedor.invalidate(catalogoOpcionesProvider);
  contenedor.invalidate(misPreferenciasProvider);
}

// ── Inventario ──
typedef FiltroActivos = ({String buscar, String tipos, String lugares, String estado, String ordering});
typedef FiltroVerificaciones = ({String estado, bool mias});

final tiposActivoProvider = FutureProvider<List<TipoActivo>>((ref) => _repo(ref).tiposActivo());

final lugaresProvider = FutureProvider<List<Lugar>>((ref) => _repo(ref).lugares());

final activosProvider = FutureProvider.family<List<Activo>, FiltroActivos>(
  (ref, f) => _repo(ref).activos(
    buscar: f.buscar,
    tipos: f.tipos,
    lugares: f.lugares,
    estado: f.estado,
    ordering: f.ordering,
  ),
);

final activoProvider = FutureProvider.autoDispose.family<Activo, int>((ref, id) => _repo(ref).activo(id));

final verificacionesProvider = FutureProvider.family<List<Verificacion>, FiltroVerificaciones>(
  (ref, f) => _repo(ref).verificaciones(estado: f.estado, mias: f.mias),
);

final verificacionProvider = FutureProvider.autoDispose.family<Verificacion, int>(
  (ref, id) => _repo(ref).verificacion(id),
);

/// Tras crear o mover un activo, o cambiar un catálogo: refresca listas y catálogos.
void refrescarInventario(ProviderContainer contenedor) {
  contenedor.invalidate(activosProvider);
  contenedor.invalidate(tiposActivoProvider);
  contenedor.invalidate(lugaresProvider);
}

/// Tras pedir, marcar, cerrar o cancelar una verificación.
void refrescarVerificaciones(ProviderContainer contenedor) {
  contenedor.invalidate(verificacionesProvider);
  contenedor.invalidate(tareasProvider);
}

// ── Control de asistencia de auxiliares ──
/// Rango de fechas (AAAA-MM-DD) y filtros de la lista de marcaciones.
typedef FiltroMarcaciones = ({
  String desde,
  String hasta,
  int? usuario,
  int? lugar,
  bool? abiertas,
  bool conRetraso,
  int retrasoMin,
});

/// Filtros del resumen por auxiliar.
typedef FiltroResumen = ({String desde, String hasta, bool conRetraso, int retrasoMin, int minRetrasos});

/// Mi lugar, mi entrada abierta y mis marcas de hoy (pantalla "Mi asistencia").
final estadoAsistenciaProvider = FutureProvider.autoDispose<EstadoAsistencia>(
  (ref) => _repo(ref).estadoAsistencia(),
);

final marcacionesProvider = FutureProvider.autoDispose.family<List<Marcacion>, FiltroMarcaciones>(
  (ref, f) => _repo(ref).marcaciones(
    desde: f.desde,
    hasta: f.hasta,
    usuario: f.usuario,
    lugar: f.lugar,
    abiertas: f.abiertas,
    conRetraso: f.conRetraso,
    retrasoMin: f.retrasoMin,
  ),
);

final marcacionProvider = FutureProvider.autoDispose.family<Marcacion, int>(
  (ref, id) => _repo(ref).marcacion(id),
);

final resumenAsistenciaProvider = FutureProvider.autoDispose.family<List<ResumenAsistencia>, FiltroResumen>(
  (ref, f) => _repo(ref).resumenAsistencia(
    desde: f.desde,
    hasta: f.hasta,
    conRetraso: f.conRetraso,
    retrasoMin: f.retrasoMin,
    minRetrasos: f.minRetrasos,
  ),
);

final lugaresAsistenciaProvider = FutureProvider.autoDispose<List<LugarAsistencia>>(
  (ref) => _repo(ref).lugaresAsistencia(),
);

final auxiliaresAsistenciaProvider = FutureProvider.autoDispose<List<AuxiliarAsistencia>>(
  (ref) => _repo(ref).auxiliaresAsistencia(),
);

final horariosAsistenciaProvider = FutureProvider.autoDispose<List<HorarioTrabajo>>(
  (ref) => _repo(ref).horariosAsistencia(),
);

/// Tras marcar, poner una salida a mano, o cambiar un lugar, horario o a quién se asigna.
void refrescarAsistencia(ProviderContainer contenedor) {
  contenedor.invalidate(estadoAsistenciaProvider);
  contenedor.invalidate(marcacionesProvider);
  contenedor.invalidate(marcacionProvider);
  contenedor.invalidate(resumenAsistenciaProvider);
  contenedor.invalidate(lugaresAsistenciaProvider);
  contenedor.invalidate(horariosAsistenciaProvider);
  contenedor.invalidate(auxiliaresAsistenciaProvider);
}

// ── Respaldos de la base de datos ──
final estadoRespaldosProvider = FutureProvider.autoDispose<EstadoRespaldos>(
  (ref) => _repo(ref).estadoRespaldos(),
);

final respaldosProvider = FutureProvider.autoDispose<List<Respaldo>>(
  (ref) => _repo(ref).respaldos(),
);

void refrescarRespaldos(ProviderContainer contenedor) {
  contenedor.invalidate(estadoRespaldosProvider);
  contenedor.invalidate(respaldosProvider);
}
