/// Modelos de la API, escritos a mano (sin generación de código).
/// Reflejan los serializers de Django; los nombres de campo son los mismos.
library;

int _entero(dynamic v) => v is int ? v : int.parse(v.toString());
int? _enteroONulo(dynamic v) => v == null ? null : (v is int ? v : int.tryParse(v.toString()));
String _texto(dynamic v) => v?.toString() ?? '';
List<String> _textos(dynamic v) => (v as List? ?? const []).map((e) => e.toString()).toList();

/// Fecha y hora ISO 8601 del servidor, en la hora del teléfono. null si viene vacía.
DateTime? _momento(dynamic v) {
  final t = _texto(v);
  return t.isEmpty ? null : DateTime.tryParse(t)?.toLocal();
}

class Usuario {
  const Usuario({
    required this.id,
    required this.email,
    required this.nombres,
    required this.apellidos,
    required this.nombreCompleto,
    required this.rol,
    required this.rolNombre,
    required this.permisos,
  });

  final int id;
  final String email;
  final String nombres;
  final String apellidos;
  final String nombreCompleto;
  final String rol;
  final String rolNombre;
  final List<String> permisos;

  bool puede(String permiso) => permisos.contains(permiso);

  String get iniciales {
    final partes = nombreCompleto.split(' ').where((p) => p.isNotEmpty).take(2);
    return partes.map((p) => p[0].toUpperCase()).join();
  }

  factory Usuario.fromJson(Map<String, dynamic> j) => Usuario(
        id: _entero(j['id']),
        email: _texto(j['email']),
        nombres: _texto(j['nombres']),
        apellidos: _texto(j['apellidos']),
        nombreCompleto: _texto(j['nombre_completo']),
        rol: _texto(j['rol']),
        rolNombre: _texto(j['rol_nombre']),
        permisos: _textos(j['permisos']),
      );
}

class UsuarioOpcion {
  const UsuarioOpcion({required this.id, required this.nombreCompleto, required this.rol, this.email = ''});
  final int id;
  final String nombreCompleto;
  final String rol;
  final String email;

  factory UsuarioOpcion.fromJson(Map<String, dynamic> j) => UsuarioOpcion(
        id: _entero(j['id']),
        nombreCompleto: _texto(j['nombre_completo']),
        rol: _texto(j['rol']),
        email: _texto(j['email']),
      );
}

class TipoElemento {
  const TipoElemento({
    required this.id,
    required this.nombre,
    required this.icono,
    required this.color,
    this.imagen,
  });

  final int id;
  final String nombre;
  final String icono;
  final String color;
  final String? imagen;

  factory TipoElemento.fromJson(Map<String, dynamic> j) => TipoElemento(
        id: _entero(j['id']),
        nombre: _texto(j['nombre']),
        icono: _texto(j['icono']),
        color: _texto(j['color']),
        imagen: j['imagen'] as String?,
      );
}

class Software {
  const Software({required this.id, required this.nombreCompleto});
  final int id;
  final String nombreCompleto;

  factory Software.fromJson(Map<String, dynamic> j) =>
      Software(id: _entero(j['id']), nombreCompleto: _texto(j['nombre_completo']));
}

class Laboratorio {
  const Laboratorio({
    required this.id,
    required this.codigo,
    required this.nombre,
    required this.ubicacion,
    required this.capacidad,
    required this.filas,
    required this.columnas,
    required this.estado,
    required this.estadoNombre,
    required this.notas,
    required this.activo,
    required this.totalElementos,
    required this.software,
  });

  final int id;
  final String codigo;
  final String nombre;
  final String ubicacion;
  final int capacidad;
  final int filas;
  final int columnas;
  final String estado;
  final String estadoNombre;
  final String notas;
  final bool activo;
  final int totalElementos;
  final List<Software> software;

  factory Laboratorio.fromJson(Map<String, dynamic> j) => Laboratorio(
        id: _entero(j['id']),
        codigo: _texto(j['codigo']),
        nombre: _texto(j['nombre']),
        ubicacion: _texto(j['ubicacion']),
        capacidad: _entero(j['capacidad'] ?? 0),
        filas: _entero(j['filas']),
        columnas: _entero(j['columnas']),
        estado: _texto(j['estado']),
        estadoNombre: _texto(j['estado_nombre']),
        notas: _texto(j['notas']),
        activo: j['activo'] as bool? ?? true,
        totalElementos: _entero(j['total_elementos'] ?? 0),
        software: (j['software_detalle'] as List? ?? const [])
            .map((s) => Software.fromJson(s as Map<String, dynamic>))
            .toList(),
      );
}

class Celda {
  const Celda({
    required this.fila,
    required this.columna,
    required this.tipo,
    required this.etiqueta,
    required this.estado,
    this.ip,
    this.mac = '',
    this.codigoActivo = '',
    this.especificaciones = '',
    this.descripcion = '',
  });

  final int fila;
  final int columna;
  final int tipo;
  final String etiqueta;
  final String estado;
  final String? ip;
  final String mac;
  final String codigoActivo;
  final String especificaciones;
  final String descripcion;

  factory Celda.fromJson(Map<String, dynamic> j) => Celda(
        fila: _entero(j['fila']),
        columna: _entero(j['columna']),
        tipo: _entero(j['tipo']),
        etiqueta: _texto(j['etiqueta']),
        estado: _texto(j['estado']),
        ip: j['ip'] as String?,
        mac: _texto(j['mac']),
        codigoActivo: _texto(j['codigo_activo']),
        especificaciones: _texto(j['especificaciones']),
        descripcion: _texto(j['descripcion']),
      );
}

class Distribucion {
  const Distribucion({required this.filas, required this.columnas, required this.celdas});
  final int filas;
  final int columnas;
  final List<Celda> celdas;

  factory Distribucion.fromJson(Map<String, dynamic> j) => Distribucion(
        filas: _entero(j['filas']),
        columnas: _entero(j['columnas']),
        celdas: (j['celdas'] as List).map((c) => Celda.fromJson(c as Map<String, dynamic>)).toList(),
      );
}

class Credencial {
  const Credencial({
    required this.id,
    required this.descripcion,
    required this.usuario,
    required this.tienePassword,
    required this.notas,
  });

  final int id;
  final String descripcion;
  final String usuario;
  final bool tienePassword;
  final String notas;

  factory Credencial.fromJson(Map<String, dynamic> j) => Credencial(
        id: _entero(j['id']),
        descripcion: _texto(j['descripcion']),
        usuario: _texto(j['usuario']),
        tienePassword: j['tiene_password'] as bool? ?? false,
        notas: _texto(j['notas']),
      );
}

class EventoAgenda {
  const EventoAgenda({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.detalle,
    required this.responsable,
    required this.laboratorio,
    required this.laboratorioCodigo,
    required this.fecha,
    required this.horaInicio,
    required this.horaFin,
    required this.estado,
    required this.nota,
    required this.requiereApoyo,
    required this.programas,
    this.reservaId,
    this.docenteId,
    this.preferencias = const [],
  });

  final String id;
  final String tipo;
  final String titulo;
  final String detalle;
  final String responsable;
  final int laboratorio;
  final String laboratorioCodigo;
  final String fecha;
  final String horaInicio;
  final String horaFin;
  final String estado;
  final String nota;
  final bool requiereApoyo;
  final List<String> programas;
  final int? reservaId;

  /// Ficha del docente de la clase (o de quien reservó, si es docente).
  final int? docenteId;

  /// Preferencias del docente, en frases listas para mostrar.
  final List<String> preferencias;

  bool get esClase => tipo == 'clase';
  bool get suspendida => estado == 'suspendida';
  int get minutoInicio => minutosDe(horaInicio);
  int get minutoFin => minutosDe(horaFin);

  factory EventoAgenda.fromJson(Map<String, dynamic> j) => EventoAgenda(
        id: _texto(j['id']),
        tipo: _texto(j['tipo']),
        titulo: _texto(j['titulo']),
        detalle: _texto(j['detalle']),
        responsable: _texto(j['responsable']),
        laboratorio: _entero(j['laboratorio']),
        laboratorioCodigo: _texto(j['laboratorio_codigo']),
        fecha: _texto(j['fecha']),
        horaInicio: _texto(j['hora_inicio']),
        horaFin: _texto(j['hora_fin']),
        estado: _texto(j['estado']),
        nota: _texto(j['nota']),
        requiereApoyo: j['requiere_apoyo'] as bool? ?? false,
        programas: _textos(j['programas']),
        reservaId: j['reserva_id'] as int?,
        docenteId: _enteroONulo(j['docente_id']),
        preferencias: _textos(j['preferencias']),
      );
}

int minutosDe(String hora) {
  final partes = hora.split(':');
  return int.parse(partes[0]) * 60 + int.parse(partes.length > 1 ? partes[1] : '0');
}

class Bloque {
  const Bloque({
    required this.laboratorio,
    required this.laboratorioCodigo,
    required this.fecha,
    required this.horaInicio,
    required this.horaFin,
  });

  final int laboratorio;
  final String laboratorioCodigo;
  final String fecha;
  final String horaInicio;
  final String horaFin;

  factory Bloque.fromJson(Map<String, dynamic> j) => Bloque(
        laboratorio: _entero(j['laboratorio']),
        laboratorioCodigo: _texto(j['laboratorio_codigo']),
        fecha: _texto(j['fecha']),
        horaInicio: _texto(j['hora_inicio']),
        horaFin: _texto(j['hora_fin']),
      );

  DateTime get inicioLocal => DateTime.parse('${fecha}T${_hhmm(horaInicio)}');
  DateTime get finLocal => DateTime.parse('${fecha}T${_hhmm(horaFin)}');
}

/// "07:00" o "07:00:00" → "07:00:00" (formato que acepta DateTime.parse).
String _hhmm(String hora) => hora.length == 5 ? '$hora:00' : hora;

class Reserva {
  const Reserva({
    required this.id,
    required this.titulo,
    required this.descripcion,
    required this.solicitanteNombre,
    required this.estado,
    required this.estadoNombre,
    required this.requiereApoyo,
    required this.auxiliaresRequeridos,
    required this.bloques,
    required this.programas,
    required this.advertencias,
    this.contacto = '',
    this.auxiliares = const [],
    this.motivoCancelacion = '',
  });

  final int id;
  final String titulo;
  final String descripcion;
  final String solicitanteNombre;
  final String contacto;
  final List<String> auxiliares;
  final String motivoCancelacion;
  final String estado;
  final String estadoNombre;
  final bool requiereApoyo;
  final int auxiliaresRequeridos;
  final List<Bloque> bloques;
  final List<String> programas;
  final List<String> advertencias;

  factory Reserva.fromJson(Map<String, dynamic> j) => Reserva(
        id: _entero(j['id']),
        titulo: _texto(j['titulo']),
        descripcion: _texto(j['descripcion']),
        solicitanteNombre: _texto(j['solicitante_nombre']),
        estado: _texto(j['estado']),
        estadoNombre: _texto(j['estado_nombre']),
        requiereApoyo: j['requiere_apoyo'] as bool? ?? false,
        auxiliaresRequeridos: _entero(j['auxiliares_requeridos'] ?? 0),
        bloques: (j['bloques'] as List? ?? const [])
            .map((b) => Bloque.fromJson(b as Map<String, dynamic>))
            .toList(),
        programas: (j['programas_detalle'] as List? ?? const [])
            .map((p) => _texto((p as Map<String, dynamic>)['nombre_completo']))
            .toList(),
        advertencias: _textos(j['advertencias']),
        contacto: _texto(j['contacto']),
        auxiliares: (j['auxiliares_detalle'] as List? ?? const [])
            .map((a) => _texto((a as Map<String, dynamic>)['nombre_completo']))
            .toList(),
        motivoCancelacion: _texto(j['motivo_cancelacion']),
      );

  bool get cancelada => estado == 'cancelada';

  /// Momento en que termina el último bloque (para saber si ya pasó).
  DateTime? get fin {
    if (bloques.isEmpty) return null;
    return bloques.map((b) => b.finLocal).reduce((a, b) => a.isAfter(b) ? a : b);
  }
}

class Horario {
  const Horario({
    required this.id,
    required this.diaSemana,
    required this.diaNombre,
    required this.horaInicio,
    required this.horaFin,
    required this.materiaSigla,
    required this.materiaNombre,
    required this.grupo,
    required this.docenteNombre,
    required this.laboratorio,
    required this.laboratorioCodigo,
    this.laboratorioNombre = '',
  });

  final int id;
  final int laboratorio;
  final String laboratorioNombre;
  final int diaSemana;
  final String diaNombre;
  final String horaInicio;
  final String horaFin;
  final String materiaSigla;
  final String materiaNombre;
  final String grupo;
  final String docenteNombre;
  final String laboratorioCodigo;

  factory Horario.fromJson(Map<String, dynamic> j) => Horario(
        id: _entero(j['id']),
        diaSemana: _entero(j['dia_semana']),
        diaNombre: _texto(j['dia_nombre']),
        horaInicio: _texto(j['hora_inicio']),
        horaFin: _texto(j['hora_fin']),
        materiaSigla: _texto(j['materia_sigla']),
        materiaNombre: _texto(j['materia_nombre']),
        grupo: _texto(j['grupo']),
        docenteNombre: _texto(j['docente_nombre']),
        laboratorio: _entero(j['laboratorio']),
        laboratorioCodigo: _texto(j['laboratorio_codigo']),
        laboratorioNombre: _texto(j['laboratorio_nombre']),
      );
}

class Periodo {
  const Periodo({required this.id, required this.nombre, required this.vigente});
  final int id;
  final String nombre;
  final bool vigente;

  factory Periodo.fromJson(Map<String, dynamic> j) =>
      Periodo(id: _entero(j['id']), nombre: _texto(j['nombre']), vigente: j['vigente'] as bool? ?? false);
}

class EventoObjeto {
  const EventoObjeto({
    required this.tipoNombre,
    required this.detalle,
    required this.usuarioNombre,
    required this.fecha,
  });

  final String tipoNombre;
  final String detalle;
  final String usuarioNombre;
  final DateTime fecha;

  factory EventoObjeto.fromJson(Map<String, dynamic> j) => EventoObjeto(
        tipoNombre: _texto(j['tipo_nombre']),
        detalle: _texto(j['detalle']),
        usuarioNombre: _texto(j['usuario_nombre']),
        fecha: DateTime.parse(_texto(j['fecha'])).toLocal(),
      );
}

class ObjetoPerdido {
  const ObjetoPerdido({
    required this.id,
    required this.codigo,
    required this.descripcion,
    required this.categoria,
    required this.categoriaNombre,
    required this.caracteristicas,
    required this.laboratorioCodigo,
    required this.lugar,
    required this.fechaHallazgo,
    required this.estado,
    required this.estadoNombre,
    required this.entregadoA,
    required this.motivoAnulacion,
    required this.eventos,
    this.foto,
    this.encontradoPor = '',
    this.entregadoCi = '',
    this.entregadoEn,
    this.entregadoPorNombre = '',
    this.registradoPorNombre = '',
    this.fotosEntrega = const [],
  });

  final int id;
  final String codigo;

  /// Fotos de la entrega que existen: 'ci-anverso', 'ci-reverso', 'persona'.
  final List<String> fotosEntrega;
  final String encontradoPor;
  final String entregadoCi;
  final DateTime? entregadoEn;
  final String entregadoPorNombre;
  final String registradoPorNombre;
  final String descripcion;
  final String categoria;
  final String categoriaNombre;
  final String caracteristicas;
  final String laboratorioCodigo;
  final String lugar;
  final DateTime fechaHallazgo;
  final String estado;
  final String estadoNombre;
  final String entregadoA;
  final String motivoAnulacion;
  final List<EventoObjeto> eventos;
  final String? foto;

  bool get enCustodia => estado == 'en_custodia';

  factory ObjetoPerdido.fromJson(Map<String, dynamic> j) => ObjetoPerdido(
        id: _entero(j['id']),
        codigo: _texto(j['codigo']),
        descripcion: _texto(j['descripcion']),
        categoria: _texto(j['categoria']),
        categoriaNombre: _texto(j['categoria_nombre']),
        caracteristicas: _texto(j['caracteristicas']),
        laboratorioCodigo: _texto(j['laboratorio_codigo']),
        lugar: _texto(j['lugar']),
        fechaHallazgo: DateTime.parse(_texto(j['fecha_hallazgo'])).toLocal(),
        estado: _texto(j['estado']),
        estadoNombre: _texto(j['estado_nombre']),
        entregadoA: _texto(j['entregado_a']),
        motivoAnulacion: _texto(j['motivo_anulacion']),
        eventos: (j['eventos'] as List? ?? const [])
            .map((e) => EventoObjeto.fromJson(e as Map<String, dynamic>))
            .toList(),
        foto: j['foto'] as String?,
        encontradoPor: _texto(j['encontrado_por']),
        entregadoCi: _texto(j['entregado_ci']),
        entregadoEn: j['entregado_en'] == null ? null : DateTime.parse(_texto(j['entregado_en'])).toLocal(),
        entregadoPorNombre: _texto(j['entregado_por_nombre']),
        registradoPorNombre: _texto(j['registrado_por_nombre']),
        fotosEntrega: _textos(j['fotos_entrega']),
      );
}

// ── Notificaciones ──

class Notificacion {
  const Notificacion({
    required this.id,
    required this.tipo,
    required this.tipoNombre,
    required this.titulo,
    required this.mensaje,
    required this.enlace,
    required this.datos,
    required this.creadoEn,
    required this.leida,
  });

  final int id;

  /// alistar | cerrar | asistencia | reserva | clase | revision | tarea | general
  final String tipo;
  final String tipoNombre;
  final String titulo;

  /// Puede traer saltos de línea.
  final String mensaje;

  /// Ruta de la web (no se usa en la app).
  final String enlace;

  /// Para abrir la pantalla correcta: solicitud_id, tarea_id, reserva_id, horario_id, evento, fecha…
  final Map<String, dynamic> datos;
  final DateTime creadoEn;
  final bool leida;

  int? datoEntero(String clave) => _enteroONulo(datos[clave]);
  String datoTexto(String clave) => _texto(datos[clave]);

  factory Notificacion.fromJson(Map<String, dynamic> j) => Notificacion(
        id: _entero(j['id']),
        tipo: _texto(j['tipo']),
        tipoNombre: _texto(j['tipo_nombre']),
        titulo: _texto(j['titulo']),
        mensaje: _texto(j['mensaje']),
        enlace: _texto(j['enlace']),
        datos: j['datos'] is Map ? Map<String, dynamic>.from(j['datos'] as Map) : const {},
        creadoEn: _momento(j['creado_en']) ?? DateTime.now(),
        leida: j['leida'] as bool? ?? false,
      );
}

class ResumenNotificaciones {
  const ResumenNotificaciones({required this.noLeidas, this.ultimaId});

  final int noLeidas;

  /// La no leída más reciente: si aumenta, llegó algo nuevo.
  final int? ultimaId;

  factory ResumenNotificaciones.fromJson(Map<String, dynamic> j) => ResumenNotificaciones(
        noLeidas: _entero(j['no_leidas'] ?? 0),
        ultimaId: _enteroONulo(j['ultima_id']),
      );
}

// ── Preferencias de los docentes ──

class OpcionPreferencia {
  const OpcionPreferencia({
    required this.id,
    required this.pregunta,
    required this.textoSi,
    required this.textoNo,
    required this.orden,
    required this.activa,
  });

  final int id;

  /// Lo que ve el docente.
  final String pregunta;

  /// Lo que leen los auxiliares según la respuesta.
  final String textoSi;
  final String textoNo;
  final int orden;
  final bool activa;

  factory OpcionPreferencia.fromJson(Map<String, dynamic> j) => OpcionPreferencia(
        id: _entero(j['id']),
        pregunta: _texto(j['pregunta']),
        textoSi: _texto(j['texto_si']),
        textoNo: _texto(j['texto_no']),
        orden: _entero(j['orden'] ?? 0),
        activa: j['activa'] as bool? ?? true,
      );
}

class Preferencias {
  const Preferencias({
    required this.docente,
    required this.docenteNombre,
    required this.valores,
    required this.nota,
    required this.resumen,
    this.actualizadoEn,
  });

  final int docente;
  final String docenteNombre;

  /// id de la opción → true (sí) / false (no). Las que no están no tienen preferencia.
  final Map<int, bool> valores;
  final String nota;
  final List<String> resumen;
  final DateTime? actualizadoEn;

  factory Preferencias.fromJson(Map<String, dynamic> j) {
    final valores = <int, bool>{};
    final crudo = j['valores'];
    if (crudo is Map) {
      crudo.forEach((clave, valor) {
        final id = int.tryParse(clave.toString());
        if (id != null && valor is bool) valores[id] = valor;
      });
    }
    return Preferencias(
      docente: _entero(j['docente']),
      docenteNombre: _texto(j['docente_nombre']),
      valores: valores,
      nota: _texto(j['nota']),
      resumen: _textos(j['resumen']),
      actualizadoEn: _momento(j['actualizado_en']),
    );
  }
}

// ── Solicitudes de asistencia ──

class SolicitudAsistencia {
  const SolicitudAsistencia({
    required this.id,
    required this.solicitante,
    required this.solicitanteNombre,
    required this.solicitanteTelefono,
    required this.laboratorio,
    required this.laboratorioCodigo,
    required this.lugar,
    required this.donde,
    required this.categoria,
    required this.categoriaNombre,
    required this.descripcion,
    required this.urgente,
    required this.estado,
    required this.estadoNombre,
    required this.atendidaPor,
    required this.atendidaPorNombre,
    required this.respuesta,
    required this.creadoEn,
    this.atendidaEn,
    this.cerradaEn,
  });

  final int id;
  final int solicitante;
  final String solicitanteNombre;
  final String solicitanteTelefono;
  final int? laboratorio;
  final String laboratorioCodigo;
  final String lugar;

  /// Laboratorio y/o lugar, listo para mostrar.
  final String donde;
  final String categoria;
  final String categoriaNombre;
  final String descripcion;
  final bool urgente;

  /// pendiente | en_curso | resuelta | cancelada
  final String estado;
  final String estadoNombre;
  final int? atendidaPor;
  final String atendidaPorNombre;
  final DateTime? atendidaEn;
  final DateTime? cerradaEn;
  final String respuesta;
  final DateTime creadoEn;

  bool get pendiente => estado == 'pendiente';
  bool get enCurso => estado == 'en_curso';

  /// Pendiente o en camino.
  bool get abierta => pendiente || enCurso;

  factory SolicitudAsistencia.fromJson(Map<String, dynamic> j) => SolicitudAsistencia(
        id: _entero(j['id']),
        solicitante: _entero(j['solicitante']),
        solicitanteNombre: _texto(j['solicitante_nombre']),
        solicitanteTelefono: _texto(j['solicitante_telefono']),
        laboratorio: _enteroONulo(j['laboratorio']),
        laboratorioCodigo: _texto(j['laboratorio_codigo']),
        lugar: _texto(j['lugar']),
        donde: _texto(j['donde']),
        categoria: _texto(j['categoria']),
        categoriaNombre: _texto(j['categoria_nombre']),
        descripcion: _texto(j['descripcion']),
        urgente: j['urgente'] as bool? ?? false,
        estado: _texto(j['estado']),
        estadoNombre: _texto(j['estado_nombre']),
        atendidaPor: _enteroONulo(j['atendida_por']),
        atendidaPorNombre: _texto(j['atendida_por_nombre']),
        atendidaEn: _momento(j['atendida_en']),
        cerradaEn: _momento(j['cerrada_en']),
        respuesta: _texto(j['respuesta']),
        creadoEn: _momento(j['creado_en']) ?? DateTime.now(),
      );
}

// ── Pizarrón de tareas ──

class AvanceTarea {
  const AvanceTarea({
    required this.id,
    required this.autorNombre,
    required this.texto,
    required this.estadoNuevo,
    required this.estadoNuevoNombre,
    required this.creadoEn,
    this.autor,
    this.progreso,
  });

  final int id;
  final int? autor;
  final String autorNombre;

  /// Puede venir vacío si el avance solo movió la tarea o marcó progreso.
  final String texto;
  final int? progreso;

  /// Si no está vacío, el avance registra un cambio de columna.
  final String estadoNuevo;
  final String estadoNuevoNombre;
  final DateTime creadoEn;

  factory AvanceTarea.fromJson(Map<String, dynamic> j) => AvanceTarea(
        id: _entero(j['id']),
        autor: _enteroONulo(j['autor']),
        autorNombre: _texto(j['autor_nombre']),
        texto: _texto(j['texto']),
        progreso: _enteroONulo(j['progreso']),
        estadoNuevo: _texto(j['estado_nuevo']),
        estadoNuevoNombre: _texto(j['estado_nuevo_nombre']),
        creadoEn: _momento(j['creado_en']) ?? DateTime.now(),
      );
}

class Tarea {
  const Tarea({
    required this.id,
    required this.titulo,
    required this.descripcion,
    required this.estado,
    required this.estadoNombre,
    required this.prioridad,
    required this.prioridadNombre,
    required this.laboratorioCodigo,
    required this.responsables,
    required this.responsablesNombres,
    required this.vencida,
    required this.progreso,
    required this.creadoPorNombre,
    required this.creadoEn,
    required this.completadaPorNombre,
    required this.revisionTitulo,
    required this.totalAvances,
    this.laboratorio,
    this.fechaLimite,
    this.creadoPor,
    this.completadaEn,
    this.revision,
    this.avances = const [],
  });

  final int id;
  final String titulo;
  final String descripcion;

  /// pendiente | en_progreso | hecha
  final String estado;
  final String estadoNombre;

  /// baja | normal | alta
  final String prioridad;
  final String prioridadNombre;
  final int? laboratorio;
  final String laboratorioCodigo;
  final List<int> responsables;
  final List<String> responsablesNombres;

  /// "YYYY-MM-DD" o null.
  final String? fechaLimite;
  final bool vencida;

  /// De 0 a 100.
  final int progreso;
  final int? creadoPor;

  /// "Sistema" si la creó una revisión periódica.
  final String creadoPorNombre;
  final DateTime creadoEn;
  final DateTime? completadaEn;
  final String completadaPorNombre;
  final int? revision;
  final String revisionTitulo;
  final int totalAvances;

  /// Solo en el detalle, del más viejo al más nuevo.
  final List<AvanceTarea> avances;

  bool get hecha => estado == 'hecha';
  bool get alta => prioridad == 'alta';

  factory Tarea.fromJson(Map<String, dynamic> j) {
    final detalle = (j['responsables_detalle'] as List? ?? const []).cast<Map<String, dynamic>>();
    final fecha = _texto(j['fecha_limite']);
    return Tarea(
      id: _entero(j['id']),
      titulo: _texto(j['titulo']),
      descripcion: _texto(j['descripcion']),
      estado: _texto(j['estado']),
      estadoNombre: _texto(j['estado_nombre']),
      prioridad: _texto(j['prioridad']),
      prioridadNombre: _texto(j['prioridad_nombre']),
      laboratorio: _enteroONulo(j['laboratorio']),
      laboratorioCodigo: _texto(j['laboratorio_codigo']),
      responsables: (j['responsables'] as List? ?? const []).map(_entero).toList(),
      responsablesNombres: [for (final p in detalle) _texto(p['nombre_completo'])],
      fechaLimite: fecha.isEmpty ? null : fecha,
      vencida: j['vencida'] as bool? ?? false,
      progreso: _entero(j['progreso'] ?? 0),
      creadoPor: _enteroONulo(j['creado_por']),
      creadoPorNombre: _texto(j['creado_por_nombre']),
      creadoEn: _momento(j['creado_en']) ?? DateTime.now(),
      completadaEn: _momento(j['completada_en']),
      completadaPorNombre: _texto(j['completada_por_nombre']),
      revision: _enteroONulo(j['revision']),
      revisionTitulo: _texto(j['revision_titulo']),
      totalAvances: _entero(j['total_avances'] ?? 0),
      avances: (j['avances'] as List? ?? const [])
          .map((a) => AvanceTarea.fromJson(a as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// Lista de resultados de una respuesta paginada de DRF.
List<Map<String, dynamic>> resultados(dynamic datos) {
  final lista = datos is Map<String, dynamic> ? datos['results'] as List : datos as List;
  return lista.cast<Map<String, dynamic>>();
}
