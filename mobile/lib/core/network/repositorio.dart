import 'dart:convert';
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

  // ── Gestión de usuarios ──
  Future<List<UsuarioAdmin>> usuariosAdmin({
    String buscar = '',
    String rol = '',
    String activo = 'true',
    String ordering = 'apellidos',
    int cantidad = 200,
  }) async {
    final r = await _dio.get<dynamic>(Endpoints.usuarios, queryParameters: {
      'page_size': cantidad,
      'ordering': ordering,
      if (buscar.isNotEmpty) 'search': buscar,
      if (rol.isNotEmpty) 'rol': rol,
      if (activo.isNotEmpty) 'is_active': activo,
    });
    return resultados(r.data).map(UsuarioAdmin.fromJson).toList();
  }

  Future<UsuarioAdmin> crearUsuario(Map<String, dynamic> datos) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.usuarios, data: datos);
    return UsuarioAdmin.fromJson(r.data!);
  }

  Future<UsuarioAdmin> actualizarUsuario(int id, Map<String, dynamic> datos) async {
    final r = await _dio.patch<Map<String, dynamic>>(Endpoints.usuario(id), data: datos);
    return UsuarioAdmin.fromJson(r.data!);
  }

  Future<void> eliminarUsuario(int id) async {
    await _dio.delete<void>(Endpoints.usuario(id));
  }

  Future<UsuarioAdmin> cambiarEstadoUsuario(int id, bool activo) async {
    final r = await _dio.post<Map<String, dynamic>>(
      activo ? Endpoints.activarUsuario(id) : Endpoints.desactivarUsuario(id),
    );
    return UsuarioAdmin.fromJson(r.data!);
  }

  Future<void> restablecerPasswordUsuario(int id, String password) async {
    await _dio.post<void>(Endpoints.restablecerPasswordUsuario(id), data: {'password': password});
  }

  Future<List<DocenteFicha>> docentesSinUsuario() async {
    final r = await _dio.get<dynamic>(
      Endpoints.docentes,
      queryParameters: {'sin_usuario': true, 'page_size': 500},
    );
    return resultados(r.data).map(DocenteFicha.fromJson).toList();
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

  Future<TipoElemento> guardarElemento(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.elementos, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.elemento(id), data: datos);
    return TipoElemento.fromJson(r.data!);
  }

  Future<void> eliminarElemento(int id) async {
    await _dio.delete<void>(Endpoints.elemento(id));
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

  /// Crear o editar un laboratorio. Al crear se mandan filas/columnas iniciales.
  Future<Laboratorio> guardarLaboratorio(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.laboratorios, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.laboratorio(id), data: datos);
    return Laboratorio.fromJson(r.data!);
  }

  Future<void> eliminarLaboratorio(int id) async {
    await _dio.delete<void>(Endpoints.laboratorio(id));
  }

  /// Guarda la grilla completa: {filas, columnas, celdas:[...]}.
  Future<Distribucion> guardarDistribucion(int id, Map<String, dynamic> datos) async {
    final r = await _dio.put<Map<String, dynamic>>(Endpoints.distribucion(id), data: datos);
    return Distribucion.fromJson(r.data!);
  }

  /// Solo los programas instalados del laboratorio (lo puede hacer el auxiliar).
  Future<Laboratorio> guardarSoftwareLaboratorio(int id, List<int> software) async {
    final r = await _dio.put<Map<String, dynamic>>(
      Endpoints.softwareLaboratorio(id),
      data: {'software': software},
    );
    return Laboratorio.fromJson(r.data!);
  }

  Future<Software> guardarSoftware(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.software, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.softwareItem(id), data: datos);
    return Software.fromJson(r.data!);
  }

  Future<void> eliminarSoftware(int id) async {
    await _dio.delete<void>(Endpoints.softwareItem(id));
  }

  Future<Credencial> guardarCredencial(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.credenciales, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.credencial(id), data: datos);
    return Credencial.fromJson(r.data!);
  }

  Future<void> eliminarCredencial(int id) async {
    await _dio.delete<void>(Endpoints.credencial(id));
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

  // ── Gestión de horarios (crear, editar en lote, suspender/reanudar) ──
  /// Todos los horarios (activos e inactivos) para administrarlos, con filtros.
  Future<List<Horario>> horariosGestion({
    int? periodo,
    int? laboratorio,
    int? diaSemana,
    String buscar = '',
  }) async {
    final r = await _dio.get<dynamic>(Endpoints.horarios, queryParameters: {
      'page_size': 500,
      if (periodo != null) 'periodo': periodo,
      if (laboratorio != null) 'laboratorio': laboratorio,
      if (diaSemana != null) 'dia_semana': diaSemana,
      if (buscar.isNotEmpty) 'search': buscar,
    });
    return resultados(r.data).map(Horario.fromJson).toList();
  }

  /// La misma clase en varios días a la vez. Si un día choca, no se crea ninguno.
  Future<void> crearHorariosEnDias(Map<String, dynamic> datos, List<int> dias) async {
    await _dio.post<dynamic>(Endpoints.horariosLote, data: {...datos, 'dias': dias});
  }

  /// Edita una clase que se da en varios días (una fila). Todo o nada.
  Future<void> editarHorariosEnDias(List<int> ids, Map<String, dynamic> datos, List<int> dias) async {
    await _dio.post<dynamic>(Endpoints.horariosLoteEditar, data: {...datos, 'ids': ids, 'dias': dias});
  }

  Future<void> eliminarHorario(int id) async {
    await _dio.delete<void>(Endpoints.horario(id));
  }

  Future<void> suspenderClase(int id, String fecha, String motivo) async {
    await _dio.post<dynamic>(Endpoints.suspenderHorario(id), data: {'fecha': fecha, 'motivo': motivo});
  }

  Future<void> reanudarClase(int id, String fecha) async {
    await _dio.post<dynamic>(Endpoints.reanudarHorario(id), data: {'fecha': fecha});
  }

  Future<Periodo> guardarPeriodo(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.periodos, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.periodo(id), data: datos);
    return Periodo.fromJson(r.data!);
  }

  Future<void> eliminarPeriodo(int id) async {
    await _dio.delete<void>(Endpoints.periodo(id));
  }

  /// Copia las clases activas de un periodo a otro. Devuelve cuántas se crearon y
  /// la lista de las que se saltaron por chocar.
  Future<({int creados, List<String> omitidos})> clonarHorarios(int origen, int destino) async {
    final r = await _dio.post<Map<String, dynamic>>(
      Endpoints.clonarHorarios(origen),
      data: {'destino': destino},
    );
    return (
      creados: (r.data?['creados'] as num?)?.toInt() ?? 0,
      omitidos: (r.data?['omitidos'] as List? ?? const []).map((e) => e.toString()).toList(),
    );
  }

  Future<List<Materia>> materias() async {
    final r = await _dio.get<dynamic>(Endpoints.materias, queryParameters: {'page_size': 500});
    return resultados(r.data).map(Materia.fromJson).toList();
  }

  Future<Materia> guardarMateria(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.materias, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.materia(id), data: datos);
    return Materia.fromJson(r.data!);
  }

  Future<void> eliminarMateria(int id) async {
    await _dio.delete<void>(Endpoints.materia(id));
  }

  Future<List<DocenteAdmin>> docentesAdmin({String buscar = ''}) async {
    final r = await _dio.get<dynamic>(Endpoints.docentes, queryParameters: {
      'page_size': 500,
      if (buscar.isNotEmpty) 'search': buscar,
    });
    return resultados(r.data).map(DocenteAdmin.fromJson).toList();
  }

  Future<DocenteAdmin> guardarDocente(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.docentes, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.docente(id), data: datos);
    return DocenteAdmin.fromJson(r.data!);
  }

  Future<void> eliminarDocente(int id) async {
    await _dio.delete<void>(Endpoints.docente(id));
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

  Future<Reserva> reserva(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.reserva(id));
    return Reserva.fromJson(r.data!);
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

  Future<Reserva> aprobarReserva(int id) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.aprobarReserva(id));
    return Reserva.fromJson(r.data!);
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

  // ── Push (notificaciones al teléfono) ──
  /// Registra (o renueva) el token de FCM de este teléfono.
  Future<void> registrarDispositivo(String token, {String plataforma = 'android'}) async {
    await _dio.post<void>(Endpoints.dispositivosPush, data: {'token': token, 'plataforma': plataforma});
  }

  /// Da de baja el token al cerrar sesión, para no recibir más avisos aquí.
  Future<void> bajaDispositivo(String token) async {
    await _dio.delete<void>(Endpoints.dispositivosPush, data: {'token': token});
  }

  Future<PreferenciasPush> preferenciasPush() async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.preferenciasPush);
    return PreferenciasPush.fromJson(r.data!);
  }

  /// Guarda las preferencias (manda solo lo que cambia). Devuelve el estado final.
  Future<PreferenciasPush> guardarPreferenciasPush({bool? habilitado, bool? soloEnTurno}) async {
    final r = await _dio.put<Map<String, dynamic>>(
      Endpoints.preferenciasPush,
      data: {
        if (habilitado != null) 'habilitado': habilitado,
        if (soloEnTurno != null) 'solo_en_turno': soloEnTurno,
      },
    );
    return PreferenciasPush.fromJson(r.data!);
  }

  // ── Preferencias de los docentes ──
  /// Solo las activas, ordenadas como las dejó el Admin.
  Future<List<OpcionPreferencia>> opcionesPreferencia() async {
    final r = await _dio.get<dynamic>(Endpoints.opcionesPreferencia, queryParameters: {'activa': true});
    return resultados(r.data).map(OpcionPreferencia.fromJson).toList()
      ..sort((a, b) => a.orden.compareTo(b.orden));
  }

  /// Todas las opciones (activas e inactivas), para administrarlas.
  Future<List<OpcionPreferencia>> catalogoOpciones() async {
    final r = await _dio.get<dynamic>(Endpoints.opcionesPreferencia, queryParameters: {'page_size': 500});
    return resultados(r.data).map(OpcionPreferencia.fromJson).toList()
      ..sort((a, b) => a.orden.compareTo(b.orden));
  }

  Future<OpcionPreferencia> guardarOpcion(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.opcionesPreferencia, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.opcionPreferencia(id), data: datos);
    return OpcionPreferencia.fromJson(r.data!);
  }

  Future<void> eliminarOpcion(int id) async {
    await _dio.delete<void>(Endpoints.opcionPreferencia(id));
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

  /// Preferencias de todos los docentes (Admin y auxiliares), con buscador.
  Future<List<Preferencias>> preferenciasDocentes({String buscar = ''}) async {
    final r = await _dio.get<dynamic>(
      Endpoints.preferenciasDocentes,
      queryParameters: {if (buscar.isNotEmpty) 'search': buscar},
    );
    return resultados(r.data).map(Preferencias.fromJson).toList();
  }

  /// Guarda las preferencias de un docente (reemplaza todo).
  Future<Preferencias> guardarPreferenciasDocente(int docente, Map<int, bool?> valores, String nota) async {
    final r = await _dio.put<Map<String, dynamic>>(
      Endpoints.preferenciasDocente(docente),
      data: {
        'valores': {for (final e in valores.entries) '${e.key}': e.value},
        'nota': nota,
      },
    );
    return Preferencias.fromJson(r.data!);
  }

  // ── Revisiones periódicas ──
  Future<List<Revision>> revisiones({int? laboratorio, bool? activa}) async {
    final r = await _dio.get<dynamic>(Endpoints.revisiones, queryParameters: {
      'page_size': 200,
      if (laboratorio != null) 'laboratorio': laboratorio,
      if (activa != null) 'activa': activa,
    });
    return resultados(r.data).map(Revision.fromJson).toList();
  }

  Future<Revision> revision(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.revision(id));
    return Revision.fromJson(r.data!);
  }

  Future<Revision> guardarRevision(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.revisiones, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.revision(id), data: datos);
    return Revision.fromJson(r.data!);
  }

  Future<void> eliminarRevision(int id) async {
    await _dio.delete<void>(Endpoints.revision(id));
  }

  /// Registra que se hizo hoy: deja una entrada en la bitácora y calcula la próxima fecha.
  Future<Revision> realizarRevision(int id, String nota) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.realizarRevision(id), data: {'nota': nota});
    return Revision.fromJson(r.data!);
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

  // ── Bitácora ──
  Future<List<EntradaBitacora>> bitacora(int laboratorio) async {
    final r = await _dio.get<dynamic>(
      Endpoints.bitacora,
      queryParameters: {'laboratorio': laboratorio, 'page_size': 100},
    );
    return resultados(r.data).map(EntradaBitacora.fromJson).toList();
  }

  Future<EntradaBitacora> entradaBitacora(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.entradaBitacora(id));
    return EntradaBitacora.fromJson(r.data!);
  }

  /// Mapa vacío con la grilla actual del laboratorio, para empezar a pintar.
  Future<MapaBitacora> plantillaBitacora(int laboratorio) async {
    final r = await _dio.get<Map<String, dynamic>>(
      Endpoints.plantillaBitacora,
      queryParameters: {'laboratorio': laboratorio},
    );
    return MapaBitacora.fromJson(r.data!);
  }

  /// [id] null = registrar una entrada nueva.
  Future<EntradaBitacora> guardarEntradaBitacora(int? id, Map<String, dynamic> datos) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.bitacora, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.entradaBitacora(id), data: datos);
    return EntradaBitacora.fromJson(r.data!);
  }

  Future<void> eliminarEntradaBitacora(int id) async {
    await _dio.delete<void>(Endpoints.entradaBitacora(id));
  }

  /// [formato]: 'jpg', 'pdf' o 'json' (archivo de bitácora para importar en la web).
  Future<({Uint8List bytes, String nombre, String tipo})> exportarEntradaBitacora(int id, String formato) async {
    final r = await _dio.get<List<int>>(
      Endpoints.exportarBitacora(id),
      queryParameters: {'formato': formato},
      options: Options(responseType: ResponseType.bytes),
    );
    final cabecera = r.headers.value('content-disposition') ?? '';
    final nombre = RegExp(r'filename="([^"]+)"').firstMatch(cabecera)?.group(1) ??
        'bitacora-$id.${formato == 'json' ? 'bitacora.json' : formato}';
    return (
      bytes: Uint8List.fromList(r.data ?? const []),
      nombre: nombre,
      tipo: r.headers.value('content-type') ?? 'application/octet-stream',
    );
  }

  /// Importa un archivo .bitacora.json (su contenido ya parseado). Sin [laboratorio],
  /// el servidor lo busca por el código que trae el archivo.
  Future<EntradaBitacora> importarBitacora(Object archivo, {int? laboratorio}) async {
    final r = await _dio.post<Map<String, dynamic>>(
      Endpoints.importarBitacora,
      data: {'archivo': archivo, if (laboratorio != null) 'laboratorio': laboratorio},
    );
    return EntradaBitacora.fromJson(r.data!);
  }

  // ── Inventario: tipos y lugares ──
  Future<List<TipoActivo>> tiposActivo() async {
    final r = await _dio.get<dynamic>(Endpoints.inventarioTipos, queryParameters: {'page_size': 500});
    return resultados(r.data).map(TipoActivo.fromJson).toList();
  }

  Future<TipoActivo> guardarTipoActivo(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.inventarioTipos, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.inventarioTipo(id), data: datos);
    return TipoActivo.fromJson(r.data!);
  }

  Future<void> eliminarTipoActivo(int id) async {
    await _dio.delete<void>(Endpoints.inventarioTipo(id));
  }

  Future<List<Lugar>> lugares() async {
    final r = await _dio.get<dynamic>(Endpoints.inventarioLugares, queryParameters: {'page_size': 500});
    return resultados(r.data).map(Lugar.fromJson).toList();
  }

  Future<Lugar> guardarLugar(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.inventarioLugares, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.inventarioLugar(id), data: datos);
    return Lugar.fromJson(r.data!);
  }

  Future<void> eliminarLugar(int id) async {
    await _dio.delete<void>(Endpoints.inventarioLugar(id));
  }

  // ── Inventario: activos ──
  /// [estado]: '' = en inventario (sin bajas); 'todos' = con las bajas; o un estado puntual.
  Future<List<Activo>> activos({
    String buscar = '',
    String tipos = '',
    String lugares = '',
    String estado = '',
    String ordering = 'codigo',
    int cantidad = 500,
  }) async {
    final r = await _dio.get<dynamic>(Endpoints.activos, queryParameters: filtrosActivos(
      buscar: buscar,
      tipos: tipos,
      lugares: lugares,
      estado: estado,
      extra: {'page_size': cantidad, 'ordering': ordering},
    ));
    return resultados(r.data).map(Activo.fromJson).toList();
  }

  Future<Activo> activo(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.activo(id));
    return Activo.fromJson(r.data!);
  }

  /// Cuántos activos vigentes (sin los dados de baja) cumplen los filtros,
  /// sin traerlos todos. Para el conteo al pedir una verificación.
  Future<int> contarActivos({String tipos = '', String lugares = ''}) async {
    final r = await _dio.get<dynamic>(
      Endpoints.activos,
      queryParameters: filtrosActivos(
        buscar: '',
        tipos: tipos,
        lugares: lugares,
        estado: '',
        extra: {'page_size': 1},
      ),
    );
    final datos = r.data;
    if (datos is Map && datos['count'] is num) return (datos['count'] as num).toInt();
    return resultados(datos).length;
  }

  Future<Activo> crearActivo(Map<String, dynamic> datos) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.activos, data: datos);
    return Activo.fromJson(r.data!);
  }

  Future<Activo> editarActivo(int id, Map<String, dynamic> datos) async {
    final r = await _dio.patch<Map<String, dynamic>>(Endpoints.activo(id), data: datos);
    return Activo.fromJson(r.data!);
  }

  Future<Activo> trasladarActivo(int id, Map<String, dynamic> datos) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.trasladarActivo(id), data: datos);
    return Activo.fromJson(r.data!);
  }

  Future<Activo> cambiarEstadoActivo(int id, Map<String, dynamic> datos) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.estadoActivo(id), data: datos);
    return Activo.fromJson(r.data!);
  }

  Future<Activo> darDeBajaActivo(int id, Map<String, dynamic> datos) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.bajaActivo(id), data: datos);
    return Activo.fromJson(r.data!);
  }

  Future<void> corregirMovimiento(int id, Map<String, dynamic> datos) async {
    await _dio.patch<Map<String, dynamic>>(Endpoints.corregirMovimiento(id), data: datos);
  }

  /// Descarga los activos de la búsqueda actual. [formato]: 'xlsx', 'csv' o 'pdf'.
  Future<({Uint8List bytes, String nombre, String tipo})> exportarActivos(
    String formato, {
    String buscar = '',
    String tipos = '',
    String lugares = '',
    String estado = '',
  }) async {
    final r = await _dio.get<List<int>>(
      Endpoints.exportarActivos,
      queryParameters: filtrosActivos(
        buscar: buscar,
        tipos: tipos,
        lugares: lugares,
        estado: estado,
        extra: {'formato': formato},
      ),
      options: Options(responseType: ResponseType.bytes),
    );
    final cabecera = r.headers.value('content-disposition') ?? '';
    final nombre = RegExp(r'filename="([^"]+)"').firstMatch(cabecera)?.group(1) ?? 'inventario.$formato';
    return (
      bytes: Uint8List.fromList(r.data ?? const []),
      nombre: nombre,
      tipo: r.headers.value('content-type') ?? 'application/octet-stream',
    );
  }

  /// Analiza o importa una planilla de activos (Excel o CSV). Con [confirmar] en false
  /// solo la analiza y devuelve la vista previa; en true crea los activos.
  /// [bytes] y [nombre] vienen del archivo elegido. Devuelve la respuesta cruda del servidor.
  Future<Map<String, dynamic>> importarActivos({
    required Uint8List bytes,
    required String nombre,
    bool confirmar = false,
    String titulos = 'auto',
    List<String>? mapeo,
    int? lugarPorDefecto,
  }) async {
    final cuerpo = FormData.fromMap({
      'archivo': MultipartFile.fromBytes(bytes, filename: nombre),
      'confirmar': confirmar.toString(),
      'titulos': titulos,
      if (mapeo != null) 'mapeo': jsonEncode(mapeo),
      if (lugarPorDefecto != null) 'lugar_por_defecto': lugarPorDefecto.toString(),
    });
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.importarActivos, data: cuerpo);
    return r.data!;
  }

  // ── Inventario: verificaciones ──
  Future<List<Verificacion>> verificaciones({String estado = '', bool mias = false}) async {
    final r = await _dio.get<dynamic>(
      Endpoints.verificaciones,
      queryParameters: {
        'page_size': 100,
        if (estado.isNotEmpty) 'estado': estado,
        if (mias) 'mias': true,
      },
    );
    return resultados(r.data).map(Verificacion.fromJson).toList();
  }

  Future<Verificacion> verificacion(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.verificacion(id));
    return Verificacion.fromJson(r.data!);
  }

  Future<Verificacion> crearVerificacion(Map<String, dynamic> datos) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.verificaciones, data: datos);
    return Verificacion.fromJson(r.data!);
  }

  Future<Verificacion> marcarItems(int id, Map<String, dynamic> datos) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.marcarVerificacion(id), data: datos);
    return Verificacion.fromJson(r.data!);
  }

  Future<Verificacion> cerrarVerificacion(int id, String conclusion) async {
    final r = await _dio.post<Map<String, dynamic>>(
      Endpoints.cerrarVerificacion(id),
      data: {'conclusion': conclusion},
    );
    return Verificacion.fromJson(r.data!);
  }

  Future<Verificacion> cancelarVerificacion(int id) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.cancelarVerificacion(id));
    return Verificacion.fromJson(r.data!);
  }

  // ── Control de asistencia de auxiliares ──
  /// Mi lugar, si tengo una entrada abierta y mis marcas de hoy.
  Future<EstadoAsistencia> estadoAsistencia() async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.estadoMarcaciones);
    return EstadoAsistencia.fromJson(r.data!);
  }

  /// Marca la entrada o la salida. [tipo]: 'entrada' o 'salida'. Solo se llama después de
  /// que el teléfono confirmó la huella; la ubicación la vuelve a comprobar el servidor.
  Future<Marcacion> marcarAsistencia({
    required String tipo,
    required double latitud,
    required double longitud,
    double? precisionM,
    bool simulada = false,
  }) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.marcar, data: {
      'tipo': tipo,
      'latitud': latitud,
      'longitud': longitud,
      'precision_m': precisionM,
      'biometria': true,
      'simulada': simulada,
    });
    return Marcacion.fromJson(r.data!);
  }

  /// Marcaciones (las mías si soy auxiliar; todas si soy Admin). Fechas en AAAA-MM-DD.
  Future<List<Marcacion>> marcaciones({
    String desde = '',
    String hasta = '',
    int? usuario,
    int? lugar,
    bool? abiertas,
    bool conRetraso = false,
    int retrasoMin = 0,
  }) async {
    final r = await _dio.get<dynamic>(
      Endpoints.marcaciones,
      queryParameters: {
        'page_size': 500,
        ...filtrosMarcaciones(
          desde: desde,
          hasta: hasta,
          usuario: usuario,
          lugar: lugar,
          abiertas: abiertas,
          conRetraso: conRetraso,
          retrasoMin: retrasoMin,
        ),
      },
    );
    return resultados(r.data).map(Marcacion.fromJson).toList();
  }

  Future<Marcacion> marcacion(int id) async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.marcacion(id));
    return Marcacion.fromJson(r.data!);
  }

  /// El Admin pone la salida de una marcación que quedó abierta.
  Future<Marcacion> cerrarMarcacion(int id, {required DateTime salidaEn, required String nota}) async {
    final r = await _dio.post<Map<String, dynamic>>(
      Endpoints.cerrarMarcacion(id),
      data: {'salida_en': salidaEn.toUtc().toIso8601String(), 'nota': nota},
    );
    return Marcacion.fromJson(r.data!);
  }

  /// Totales por auxiliar con los mismos filtros de la lista.
  Future<List<ResumenAsistencia>> resumenAsistencia({
    String desde = '',
    String hasta = '',
    int? lugar,
    bool conRetraso = false,
    int retrasoMin = 0,
    int minRetrasos = 0,
  }) async {
    final r = await _dio.get<dynamic>(
      Endpoints.resumenMarcaciones,
      queryParameters: filtrosMarcaciones(
        desde: desde,
        hasta: hasta,
        lugar: lugar,
        conRetraso: conRetraso,
        retrasoMin: retrasoMin,
        minRetrasos: minRetrasos,
      ),
    );
    return resultados(r.data).map(ResumenAsistencia.fromJson).toList();
  }

  /// Descarga las marcaciones que cumplen los filtros. [formato]: 'xlsx', 'csv' o 'pdf'.
  Future<({Uint8List bytes, String nombre, String tipo})> exportarMarcaciones(
    String formato, {
    String desde = '',
    String hasta = '',
    int? usuario,
    int? lugar,
    bool? abiertas,
    bool conRetraso = false,
    int retrasoMin = 0,
  }) async {
    final r = await _dio.get<List<int>>(
      Endpoints.exportarMarcaciones,
      queryParameters: {
        'formato': formato,
        ...filtrosMarcaciones(
          desde: desde,
          hasta: hasta,
          usuario: usuario,
          lugar: lugar,
          abiertas: abiertas,
          conRetraso: conRetraso,
          retrasoMin: retrasoMin,
        ),
      },
      options: Options(responseType: ResponseType.bytes),
    );
    final cabecera = r.headers.value('content-disposition') ?? '';
    final nombre = RegExp(r'filename="([^"]+)"').firstMatch(cabecera)?.group(1) ?? 'asistencia.$formato';
    return (
      bytes: Uint8List.fromList(r.data ?? const []),
      nombre: nombre,
      tipo: r.headers.value('content-type') ?? 'application/octet-stream',
    );
  }

  Future<List<LugarAsistencia>> lugaresAsistencia() async {
    final r = await _dio.get<dynamic>(Endpoints.lugaresAsistencia);
    return resultados(r.data).map(LugarAsistencia.fromJson).toList();
  }

  Future<LugarAsistencia> guardarLugarAsistencia(Map<String, dynamic> datos, {int? id}) async {
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.lugaresAsistencia, data: datos)
        : await _dio.patch<Map<String, dynamic>>(Endpoints.lugarAsistencia(id), data: datos);
    return LugarAsistencia.fromJson(r.data!);
  }

  Future<void> eliminarLugarAsistencia(int id) async {
    await _dio.delete<void>(Endpoints.lugarAsistencia(id));
  }

  /// Cada auxiliar con su lugar y cómo va hoy.
  Future<List<AuxiliarAsistencia>> auxiliaresAsistencia() async {
    final r = await _dio.get<dynamic>(Endpoints.auxiliaresAsistencia);
    return resultados(r.data).map(AuxiliarAsistencia.fromJson).toList();
  }

  /// Le pone a un auxiliar su lugar propio; con [lugar] null vuelve al predeterminado.
  Future<void> asignarLugarAsistencia(int auxiliar, int? lugar) async {
    await _dio.put<dynamic>(Endpoints.auxiliarAsistencia(auxiliar), data: {'lugar': lugar});
  }

  // ── Horarios de trabajo ──
  Future<List<HorarioTrabajo>> horariosAsistencia() async {
    final r = await _dio.get<dynamic>(Endpoints.horariosAsistencia);
    return resultados(r.data).map(HorarioTrabajo.fromJson).toList();
  }

  Future<HorarioTrabajo> guardarHorarioAsistencia(Map<String, dynamic> datos, {int? id}) async {
    // Crear usa POST; editar usa PUT (reemplaza todos los bloques).
    final r = id == null
        ? await _dio.post<Map<String, dynamic>>(Endpoints.horariosAsistencia, data: datos)
        : await _dio.put<Map<String, dynamic>>(Endpoints.horarioAsistencia(id), data: datos);
    return HorarioTrabajo.fromJson(r.data!);
  }

  Future<void> eliminarHorarioAsistencia(int id) async {
    await _dio.delete<void>(Endpoints.horarioAsistencia(id));
  }

  /// Le pone (o le quita, con null) el horario de trabajo a un auxiliar.
  Future<void> asignarHorarioAsistencia(int auxiliar, int? horario) async {
    await _dio.put<dynamic>(Endpoints.auxiliarHorario(auxiliar), data: {'horario': horario});
  }

  // ── Respaldos de la base de datos ──
  Future<EstadoRespaldos> estadoRespaldos() async {
    final r = await _dio.get<Map<String, dynamic>>(Endpoints.estadoRespaldos);
    return EstadoRespaldos.fromJson(r.data!);
  }

  Future<List<Respaldo>> respaldos() async {
    final r = await _dio.get<dynamic>(Endpoints.respaldos);
    return resultados(r.data).map(Respaldo.fromJson).toList();
  }

  Future<Respaldo> generarRespaldo({String nota = ''}) async {
    final r = await _dio.post<Map<String, dynamic>>(Endpoints.generarRespaldo, data: {'nota': nota});
    return Respaldo.fromJson(r.data!);
  }

  Future<void> eliminarRespaldo(int id) async {
    await _dio.delete<void>(Endpoints.respaldo(id));
  }

  /// Descarga el archivo .sql de un respaldo para compartirlo.
  Future<({Uint8List bytes, String nombre, String tipo})> descargarRespaldo(Respaldo r) async {
    final resp = await _dio.get<List<int>>(
      Endpoints.descargarRespaldo(r.id),
      options: Options(responseType: ResponseType.bytes),
    );
    return (
      bytes: Uint8List.fromList(resp.data ?? const []),
      nombre: r.archivo,
      tipo: resp.headers.value('content-type') ?? 'application/sql',
    );
  }
}

/// Filtros de las marcaciones (los comparten la lista, el resumen y la exportación).
Map<String, dynamic> filtrosMarcaciones({
  String desde = '',
  String hasta = '',
  int? usuario,
  int? lugar,
  bool? abiertas,
  bool conRetraso = false,
  int retrasoMin = 0,
  int minRetrasos = 0,
}) {
  return {
    if (desde.isNotEmpty) 'desde': desde,
    if (hasta.isNotEmpty) 'hasta': hasta,
    if (usuario != null) 'usuario': usuario,
    if (lugar != null) 'lugar': lugar,
    if (abiertas != null) 'abiertas': abiertas,
    // con_retraso solo se manda en true (false filtraría a los puntuales).
    if (conRetraso) 'con_retraso': true,
    if (retrasoMin > 0) 'retraso_min': retrasoMin,
    if (minRetrasos > 0) 'min_retrasos': minRetrasos,
  };
}

/// Parámetros de la lista de activos (los comparten la lista y la exportación).
/// [estado]: '' = sin las bajas; 'todos' = con las bajas; o un estado puntual.
Map<String, dynamic> filtrosActivos({
  required String buscar,
  required String tipos,
  required String lugares,
  required String estado,
  Map<String, dynamic> extra = const {},
}) {
  return {
    ...extra,
    if (buscar.isNotEmpty) 'search': buscar,
    if (tipos.isNotEmpty) 'tipos': tipos,
    if (lugares.isNotEmpty) 'lugares': lugares,
    if (estado.isEmpty) 'vigentes': true else if (estado != 'todos') 'estado': estado,
  };
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
