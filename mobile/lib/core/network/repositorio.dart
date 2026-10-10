import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/almacen_tokens.dart';
import '../modelos/modelos.dart';
import 'api_cliente.dart';
import 'endpoints.dart';

final almacenTokensProvider = Provider<AlmacenTokens>((ref) => AlmacenTokens());

final apiProvider = Provider<ApiCliente>((ref) => ApiCliente(ref.watch(almacenTokensProvider)));

final repositorioProvider = Provider<Repositorio>((ref) => Repositorio(ref.watch(apiProvider).dio));

/// Todas las llamadas a la API que usa la app, en un solo lugar.
class Repositorio {
  Repositorio(this._dio);
  final Dio _dio;

  // ── Sesión ──
  Future<Map<String, dynamic>> login(String usuario, String password) async {
    final r = await _dio.post<Map<String, dynamic>>(
      Endpoints.login,
      data: {'usuario': usuario, 'password': password, 'recordar': true},
    );
    return r.data!;
  }

  Future<Usuario> yo() async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.me);
    return Usuario.fromJson(r.data!);
  }

  Future<void> logout(String? refresh) async {
    await _dio.post<void>(Endpoints.logout, data: {'refresh': refresh});
  }

  Future<void> cambiarPassword(String actual, String nueva) async {
    await _dio.post<void>(Endpoints.cambiarPassword, data: {'actual': actual, 'nueva': nueva});
  }

  // ── Laboratorios ──
  Future<List<Laboratorio>> laboratorios() async {
    final r = await _dio.get<dynamic>(Endpoints.laboratorios, queryParameters: {'page_size': 500});
    return resultados(r.data).map(Laboratorio.fromJson).toList();
  }

  Future<Laboratorio> laboratorio(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.laboratorio(id));
    return Laboratorio.fromJson(r.data!);
  }

  Future<Distribucion> distribucion(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.distribucion(id));
    return Distribucion.fromJson(r.data!);
  }

  Future<List<TipoElemento>> elementos() async {
    final r = await _dio.get<dynamic>(Endpoints.elementos, queryParameters: {'page_size': 500});
    return resultados(r.data).map(TipoElemento.fromJson).toList();
  }

  Future<List<Software>> software() async {
    final r = await _dio.get<dynamic>(Endpoints.software, queryParameters: {'page_size': 500});
    return resultados(r.data).map(Software.fromJson).toList();
  }

  Future<List<Credencial>> credenciales(int laboratorio) async {
    final r = await _dio.get<dynamic>(Endpoints.credenciales, queryParameters: {'laboratorio': laboratorio});
    return resultados(r.data).map(Credencial.fromJson).toList();
  }

  Future<String> revelarCredencial(int id) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.revelarCredencial(id));
    return r.data!['password'] as String;
  }

  // ── Agenda, horarios y reservas ──
  Future<List<EventoAgenda>> agenda(String desde, String hasta) async {
    final r = await _dio.get<dynamic>(Endpoints.agenda, queryParameters: {'desde': desde, 'hasta': hasta});
    return resultados(r.data).map(EventoAgenda.fromJson).toList();
  }

  Future<List<Periodo>> periodos() async {
    final r = await _dio.get<dynamic>(Endpoints.periodos);
    return resultados(r.data).map(Periodo.fromJson).toList();
  }

  Future<List<Horario>> horarios({int? periodo}) async {
    final r = await _dio.get<dynamic>(
      Endpoints.horarios,
      queryParameters: {'page_size': 500, 'activo': true, if (periodo != null) 'periodo': periodo},
    );
    return resultados(r.data).map(Horario.fromJson).toList();
  }

  Future<List<Reserva>> reservas({String cuando = 'proximas'}) async {
    final r = await _dio.get<dynamic>(
      Endpoints.reservas,
      queryParameters: {
        'cuando': cuando,
        'ordering': cuando == 'proximas' ? 'primer_inicio' : '-primer_inicio',
        'page_size': 100,
      },
    );
    return resultados(r.data).map(Reserva.fromJson).toList();
  }

  Future<Reserva> crearReserva(Map<String, dynamic> datos) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.reservas, data: datos);
    return Reserva.fromJson(r.data!);
  }

  /// Revisa si un laboratorio está libre sin guardar nada. [choques] vacío = libre.
  /// [requiereAprobacion]: choca con una clase u otra reserva; se puede guardar, pero queda por aprobar.
  Future<({List<String> choques, bool requiereAprobacion})> disponibilidad({
    required int laboratorio,
    required String fecha,
    required String horaInicio,
    required String horaFin,
  }) async {
    final r = await _dio.post<Map<String, dynamic>>(
      Endpoints.disponibilidad,
      data: {'laboratorio': laboratorio, 'fecha': fecha, 'hora_inicio': horaInicio, 'hora_fin': horaFin},
    );
    return (
      choques: (r.data!['choques'] as List? ?? const []).map((c) => c.toString()).toList(),
      requiereAprobacion: r.data!['requiere_aprobacion'] == true,
    );
  }

  Future<void> cancelarReserva(int id, String motivo) async {
    await _dio.post<void>(Endpoints.cancelarReserva(id), data: {'motivo': motivo});
  }

  Future<List<UsuarioOpcion>> opcionesUsuarios(String roles) async {
    final r = await _dio.get<dynamic>(Endpoints.usuariosOpciones, queryParameters: {'rol': roles});
    return resultados(r.data).map(UsuarioOpcion.fromJson).toList();
  }

  // ── Objetos perdidos ──
  Future<List<ObjetoPerdido>> objetos({String? estado, String buscar = ''}) async {
    final r = await _dio.get<dynamic>(
      Endpoints.objetos,
      queryParameters: {
        'page_size': 100,
        if (estado != null) 'estado': estado,
        if (buscar.isNotEmpty) 'search': buscar,
      },
    );
    return resultados(r.data).map(ObjetoPerdido.fromJson).toList();
  }

  Future<ObjetoPerdido> objeto(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.objeto(id));
    return ObjetoPerdido.fromJson(r.data!);
  }

  Future<ObjetoPerdido> registrarObjeto(Map<String, dynamic> datos, {String? rutaFoto}) async {
    final cuerpo = FormData.fromMap({
      for (final e in datos.entries)
        if (e.value != null) e.key: e.value.toString(),
      if (rutaFoto != null) 'foto': await MultipartFile.fromFile(rutaFoto, filename: rutaFoto.split('/').last),
    });
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.objetos, data: cuerpo);
    return ObjetoPerdido.fromJson(r.data!);
  }

  Future<ObjetoPerdido> entregarObjeto(int id, DatosEntrega datos) async {
    final texto = {'entregado_a': datos.nombre, 'entregado_ci': datos.ci, 'observacion': datos.observacion};
    final fotos = {
      'ci_anverso': datos.ciAnverso,
      'ci_reverso': datos.ciReverso,
      'foto_persona': datos.fotoPersona,
    };
    Object cuerpo = texto;
    if (fotos.values.any((ruta) => ruta != null)) {
      cuerpo = FormData.fromMap({
        ...texto,
        for (final f in fotos.entries)
          if (f.value != null) f.key: await MultipartFile.fromFile(f.value!, filename: f.value!.split('/').last),
      });
    }
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.entregarObjeto(id), data: cuerpo);
    return ObjetoPerdido.fromJson(r.data!);
  }

  /// Foto de una entrega (no tiene URL pública: se descarga con la sesión).
  Future<Uint8List> fotoEntrega(int id, String nombre) async {
    final r = await _dio.get<List<int>>(
      Endpoints.fotoEntrega(id, nombre),
      options: Options(responseType: ResponseType.bytes),
    );
    return Uint8List.fromList(r.data!);
  }

  Future<ObjetoPerdido> anularObjeto(int id, String motivo) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.anularObjeto(id), data: {'motivo': motivo});
    return ObjetoPerdido.fromJson(r.data!);
  }

  // ── Notificaciones ──
  /// Las más nuevas primero.
  Future<List<Notificacion>> notificaciones({bool soloNoLeidas = false, int cantidad = 50}) async {
    final r = await _dio.get<dynamic>(
      Endpoints.notificaciones,
      queryParameters: {'page_size': cantidad, if (soloNoLeidas) 'no_leidas': 1},
    );
    return resultados(r.data).map(Notificacion.fromJson).toList();
  }

  Future<ResumenNotificaciones> resumenNotificaciones() async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.resumenNotificaciones);
    return ResumenNotificaciones.fromJson(r.data!);
  }

  Future<Notificacion> leerNotificacion(int id) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.leerNotificacion(id));
    return Notificacion.fromJson(r.data!);
  }

  /// Devuelve cuántas se marcaron.
  Future<int> leerTodasNotificaciones() async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.leerTodasNotificaciones);
    return (r.data?['marcadas'] as num?)?.toInt() ?? 0;
  }

  /// Aviso manual a los auxiliares: [tipo] es 'alistar' o 'cerrar'. Devuelve a cuántos les llegó.
  Future<int> avisarAula({
    required String tipo,
    required String evento,
    required String fecha,
    String nota = '',
  }) async {
    final r = await _dio.post<Map<String, dynamic>>(
      Endpoints.avisoAula,
      data: {'tipo': tipo, 'evento': evento, 'fecha': fecha, 'nota': nota},
    );
    return (r.data?['enviadas'] as num?)?.toInt() ?? 0;
  }

  // ── Preferencias de los docentes ──
  /// Solo las activas, ordenadas como las dejó el Admin.
  Future<List<OpcionPreferencia>> opcionesPreferencia() async {
    final r = await _dio.get<dynamic>(Endpoints.opcionesPreferencia, queryParameters: {'activa': true});
    return resultados(r.data).map(OpcionPreferencia.fromJson).toList()
      ..sort((a, b) => a.orden.compareTo(b.orden));
  }

  Future<Preferencias> misPreferencias() async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.misPreferencias);
    return Preferencias.fromJson(r.data!);
  }

  /// Reemplaza todo: las opciones con null (o ausentes) quedan sin preferencia.
  Future<Preferencias> guardarMisPreferencias(Map<int, bool?> valores, String nota) async {
    final r = await _dio.put<Map<String, dynamic>>(
      Endpoints.misPreferencias,
      data: {
        'valores': {for (final e in valores.entries) '${e.key}': e.value},
        'nota': nota,
      },
    );
    return Preferencias.fromJson(r.data!);
  }

  // ── Solicitudes de asistencia ──
  /// [abiertas]: true = pendientes y en camino; false = cerradas; null = todas.
  Future<List<SolicitudAsistencia>> solicitudes({bool? abiertas}) async {
    final r = await _dio.get<dynamic>(
      Endpoints.asistencia,
      queryParameters: {'page_size': 100, if (abiertas != null) 'abiertas': abiertas},
    );
    return resultados(r.data).map(SolicitudAsistencia.fromJson).toList();
  }

  /// Cuántas solicitudes siguen abiertas (sin traerlas todas).
  Future<int> contarSolicitudesAbiertas() async {
    final r = await _dio.get<dynamic>(Endpoints.asistencia, queryParameters: {'abiertas': true, 'page_size': 1});
    final datos = r.data;
    if (datos is Map && datos['count'] is num) return (datos['count'] as num).toInt();
    return resultados(datos).length;
  }

  Future<SolicitudAsistencia> solicitud(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.solicitud(id));
    return SolicitudAsistencia.fromJson(r.data!);
  }

  Future<SolicitudAsistencia> crearSolicitud(Map<String, dynamic> datos) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.asistencia, data: datos);
    return SolicitudAsistencia.fromJson(r.data!);
  }

  Future<SolicitudAsistencia> tomarSolicitud(int id) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.tomarSolicitud(id));
    return SolicitudAsistencia.fromJson(r.data!);
  }

  Future<SolicitudAsistencia> resolverSolicitud(int id, String respuesta) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.resolverSolicitud(id), data: {'respuesta': respuesta});
    return SolicitudAsistencia.fromJson(r.data!);
  }

  Future<SolicitudAsistencia> cancelarSolicitud(int id) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.cancelarSolicitud(id));
    return SolicitudAsistencia.fromJson(r.data!);
  }

  // ── Pizarrón de tareas ──
  /// Sin las hechas hace más de 14 días (el servidor las archiva).
  Future<List<Tarea>> tareas() async {
    final r = await _dio.get<dynamic>(Endpoints.tareas, queryParameters: {'page_size': 200});
    return resultados(r.data).map(Tarea.fromJson).toList();
  }

  /// Con todos sus avances.
  Future<Tarea> tarea(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.tarea(id));
    return Tarea.fromJson(r.data!);
  }

  Future<Tarea> crearTarea(Map<String, dynamic> datos) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.tareas, data: datos);
    return Tarea.fromJson(r.data!);
  }

  Future<Tarea> cambiarEstadoTarea(int id, String estado) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.estadoTarea(id), data: {'estado': estado});
    return Tarea.fromJson(r.data!);
  }

  Future<Tarea> agregarAvance(int id, {String texto = '', int? progreso}) async {
    final r = await _dio.post<Map<String, dynamic>>(
      Endpoints.avancesTarea(id),
      data: {'texto': texto, 'progreso': progreso},
    );
    return Tarea.fromJson(r.data!);
  }

  Future<void> eliminarTarea(int id) async {
    await _dio.delete<void>(Endpoints.tarea(id));
  }
}

/// Datos al entregar un objeto. Las fotos son rutas locales y todas son opcionales.
class DatosEntrega {
  const DatosEntrega({
    required this.nombre,
    this.ci = '',
    this.observacion = '',
    this.ciAnverso,
    this.ciReverso,
    this.fotoPersona,
  });

  final String nombre;
  final String ci;
  final String observacion;
  final String? ciAnverso;
  final String? ciReverso;
  final String? fotoPersona;
}
