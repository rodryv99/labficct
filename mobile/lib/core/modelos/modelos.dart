/// Modelos de la API, escritos a mano (sin generación de código).
/// Reflejan los serializers de Django; los nombres de campo son los mismos.
library;

int _entero(dynamic v) => v is int ? v : int.parse(v.toString());
int? _enteroONulo(dynamic v) => v == null ? null : (v is int ? v : int.tryParse(v.toString()));
String _texto(dynamic v) => v?.toString() ?? '';
List<String> _textos(dynamic v) => (v as List? ?? const []).map((e) => e.toString()).toList();
double _decimal(dynamic v) => v is num ? v.toDouble() : double.parse(v.toString());
double? _decimalONulo(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));

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
    this.categoria = 'otro',
    this.categoriaNombre = '',
    this.prefijoEtiqueta = '',
    this.descripcion = '',
    this.activo = true,
    this.enUso = 0,
  });

  final int id;
  final String nombre;
  final String icono;
  final String color;
  final String? imagen;

  // Catálogo (la grilla solo usa nombre/icono/color/imagen).
  final String categoria;
  final String categoriaNombre;
  final String prefijoEtiqueta;
  final String descripcion;
  final bool activo;

  /// Casillas que lo usan (no se puede borrar si es > 0).
  final int enUso;

  factory TipoElemento.fromJson(Map<String, dynamic> j) => TipoElemento(
        id: _entero(j['id']),
        nombre: _texto(j['nombre']),
        icono: _texto(j['icono']),
        color: _texto(j['color']),
        imagen: j['imagen'] as String?,
        categoria: _texto(j['categoria']).isEmpty ? 'otro' : _texto(j['categoria']),
        categoriaNombre: _texto(j['categoria_nombre']),
        prefijoEtiqueta: _texto(j['prefijo_etiqueta']),
        descripcion: _texto(j['descripcion']),
        activo: j['activo'] as bool? ?? true,
        enUso: _entero(j['en_uso'] ?? 0),
      );
}

class Software {
  const Software({
    required this.id,
    required this.nombreCompleto,
    this.nombre = '',
    this.version = '',
    this.descripcion = '',
    this.totalLaboratorios = 0,
  });

  final int id;
  final String nombreCompleto;
  final String nombre;
  final String version;
  final String descripcion;

  /// En cuántos laboratorios está instalado (no se borra si es > 0).
  final int totalLaboratorios;

  factory Software.fromJson(Map<String, dynamic> j) => Software(
        id: _entero(j['id']),
        nombreCompleto: _texto(j['nombre_completo']),
        nombre: _texto(j['nombre']),
        version: _texto(j['version']),
        descripcion: _texto(j['descripcion']),
        totalLaboratorios: _entero(j['total_laboratorios'] ?? 0),
      );
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

  Celda copyWith({
    int? fila,
    int? columna,
    int? tipo,
    String? etiqueta,
    String? estado,
    String? ip,
    String? mac,
    String? codigoActivo,
    String? especificaciones,
    String? descripcion,
  }) =>
      Celda(
        fila: fila ?? this.fila,
        columna: columna ?? this.columna,
        tipo: tipo ?? this.tipo,
        etiqueta: etiqueta ?? this.etiqueta,
        estado: estado ?? this.estado,
        ip: ip ?? this.ip,
        mac: mac ?? this.mac,
        codigoActivo: codigoActivo ?? this.codigoActivo,
        especificaciones: especificaciones ?? this.especificaciones,
        descripcion: descripcion ?? this.descripcion,
      );

  /// Para mandar al servidor (los nombres de campo del serializer).
  Map<String, dynamic> aJson() => {
        'fila': fila,
        'columna': columna,
        'tipo': tipo,
        'etiqueta': etiqueta,
        'ip': (ip ?? '').trim().isEmpty ? null : ip!.trim(),
        'mac': mac,
        'codigo_activo': codigoActivo,
        'especificaciones': especificaciones,
        'descripcion': descripcion,
        'estado': estado,
      };
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
    required this.laboratorio,
    required this.descripcion,
    required this.usuario,
    required this.tienePassword,
    required this.notas,
    this.reveladaPor = '',
    this.reveladaEn,
    this.actualizadoEn,
  });

  final int id;
  final int laboratorio;
  final String descripcion;
  final String usuario;
  final bool tienePassword;
  final String notas;

  /// Quién y cuándo la mostró por última vez (vacío si nunca).
  final String reveladaPor;
  final DateTime? reveladaEn;
  final DateTime? actualizadoEn;

  factory Credencial.fromJson(Map<String, dynamic> j) {
    final ultima = j['ultima_revelacion'];
    return Credencial(
      id: _entero(j['id']),
      laboratorio: _entero(j['laboratorio'] ?? 0),
      descripcion: _texto(j['descripcion']),
      usuario: _texto(j['usuario']),
      tienePassword: j['tiene_password'] as bool? ?? false,
      notas: _texto(j['notas']),
      reveladaPor: ultima is Map ? _texto(ultima['usuario']) : '',
      reveladaEn: ultima is Map ? _momento(ultima['fecha']) : null,
      actualizadoEn: _momento(j['actualizado_en']),
    );
  }
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
    this.horarioId,
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

  /// Horario (clase) del que nace el evento, para suspenderlo o reanudarlo ese día.
  final int? horarioId;
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
        horarioId: _enteroONulo(j['horario_id']),
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
    this.periodo = 0,
    this.periodoNombre = '',
    this.materia = 0,
    this.docente,
    this.observaciones = '',
    this.activo = true,
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
  final int periodo;
  final String periodoNombre;
  final int materia;
  final int? docente;
  final String observaciones;
  final bool activo;

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
        periodo: _entero(j['periodo'] ?? 0),
        periodoNombre: _texto(j['periodo_nombre']),
        materia: _entero(j['materia'] ?? 0),
        docente: _enteroONulo(j['docente']),
        observaciones: _texto(j['observaciones']),
        activo: j['activo'] as bool? ?? true,
      );
}

class Periodo {
  const Periodo({
    required this.id,
    required this.nombre,
    required this.vigente,
    this.fechaInicio = '',
    this.fechaFin = '',
    this.totalHorarios = 0,
  });

  final int id;
  final String nombre;
  final bool vigente;
  final String fechaInicio;
  final String fechaFin;
  final int totalHorarios;

  factory Periodo.fromJson(Map<String, dynamic> j) => Periodo(
        id: _entero(j['id']),
        nombre: _texto(j['nombre']),
        vigente: j['vigente'] as bool? ?? false,
        fechaInicio: _texto(j['fecha_inicio']),
        fechaFin: _texto(j['fecha_fin']),
        totalHorarios: _entero(j['total_horarios'] ?? 0),
      );
}

class Materia {
  const Materia({required this.id, required this.sigla, required this.nombre});
  final int id;
  final String sigla;
  final String nombre;

  factory Materia.fromJson(Map<String, dynamic> j) =>
      Materia(id: _entero(j['id']), sigla: _texto(j['sigla']), nombre: _texto(j['nombre']));
}

/// Ficha de docente completa, para administrarla desde Planificación.
class DocenteAdmin {
  const DocenteAdmin({
    required this.id,
    required this.nombres,
    required this.apellidos,
    required this.nombreCompleto,
    required this.email,
    required this.telefono,
    required this.activo,
    required this.tieneUsuario,
    this.usuarioEmail = '',
    this.totalHorarios = 0,
  });

  final int id;
  final String nombres;
  final String apellidos;
  final String nombreCompleto;
  final String email;
  final String telefono;
  final bool activo;
  final bool tieneUsuario;
  final String usuarioEmail;
  final int totalHorarios;

  factory DocenteAdmin.fromJson(Map<String, dynamic> j) => DocenteAdmin(
        id: _entero(j['id']),
        nombres: _texto(j['nombres']),
        apellidos: _texto(j['apellidos']),
        nombreCompleto: _texto(j['nombre_completo']),
        email: _texto(j['email']),
        telefono: _texto(j['telefono']),
        activo: j['activo'] as bool? ?? true,
        tieneUsuario: j['tiene_usuario'] as bool? ?? false,
        usuarioEmail: _texto(j['usuario_email']),
        totalHorarios: _entero(j['total_horarios'] ?? 0),
      );
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

/// Preferencias de notificaciones push de la persona.
class PreferenciasPush {
  const PreferenciasPush({required this.habilitado, required this.soloEnTurno});

  /// Interruptor general: en false no llega ningún push (la campana sigue).
  final bool habilitado;

  /// Si está activo, solo llega push durante el horario de trabajo asignado.
  final bool soloEnTurno;

  PreferenciasPush copiarCon({bool? habilitado, bool? soloEnTurno}) => PreferenciasPush(
        habilitado: habilitado ?? this.habilitado,
        soloEnTurno: soloEnTurno ?? this.soloEnTurno,
      );

  factory PreferenciasPush.fromJson(Map<String, dynamic> j) => PreferenciasPush(
        habilitado: j['habilitado'] as bool? ?? true,
        soloEnTurno: j['solo_en_turno'] as bool? ?? false,
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

// ── Bitácora con mapa estilo OrganiLab ──

/// Un elemento del laboratorio tal como estaba cuando se hizo el mapa (es una copia).
class CeldaMapa {
  const CeldaMapa({
    required this.fila,
    required this.columna,
    required this.tipoNombre,
    required this.color,
    required this.etiqueta,
    this.ip = '',
    this.mac = '',
    this.codigoActivo = '',
    this.especificaciones = '',
    this.descripcion = '',
    this.estado = '',
  });

  final int fila;
  final int columna;
  final String tipoNombre;
  /// Color del tipo de elemento, "#RRGGBB" (puede venir vacío).
  final String color;
  final String etiqueta;
  final String ip;
  final String mac;
  final String codigoActivo;
  final String especificaciones;
  final String descripcion;
  final String estado;

  String get nombre => etiqueta.isNotEmpty ? etiqueta : tipoNombre;

  factory CeldaMapa.fromJson(Map<String, dynamic> j) => CeldaMapa(
        fila: _entero(j['fila']),
        columna: _entero(j['columna']),
        tipoNombre: _texto(j['tipo_nombre']),
        color: _texto(j['color']),
        etiqueta: _texto(j['etiqueta']),
        ip: _texto(j['ip']),
        mac: _texto(j['mac']),
        codigoActivo: _texto(j['codigo_activo']),
        especificaciones: _texto(j['especificaciones']),
        descripcion: _texto(j['descripcion']),
        estado: _texto(j['estado']),
      );
}

/// Un "color" con nombre para pintar: p. ej. Funciona (verde) o Con falla (rojo).
class AtributoMapa {
  const AtributoMapa({required this.nombre, required this.color});
  final String nombre;
  /// "#RRGGBB".
  final String color;

  AtributoMapa copyWith({String? nombre, String? color}) =>
      AtributoMapa(nombre: nombre ?? this.nombre, color: color ?? this.color);

  Map<String, dynamic> toJson() => {'nombre': nombre, 'color': color};

  factory AtributoMapa.fromJson(Map<String, dynamic> j) =>
      AtributoMapa(nombre: _texto(j['nombre']), color: _texto(j['color']));
}

/// Mapa pintado de una entrada: solo el rectángulo que usan los elementos.
/// [marcas]: (fila, columna) → posición del atributo.
class MapaBitacora {
  const MapaBitacora({
    required this.filas,
    required this.columnas,
    required this.celdas,
    required this.atributos,
    required this.marcas,
  });

  final int filas;
  final int columnas;
  final List<CeldaMapa> celdas;
  final List<AtributoMapa> atributos;
  final Map<(int, int), int> marcas;

  factory MapaBitacora.fromJson(Map<String, dynamic> j) => MapaBitacora(
        filas: _entero(j['filas']),
        columnas: _entero(j['columnas']),
        celdas: (j['celdas'] as List? ?? const [])
            .map((c) => CeldaMapa.fromJson(c as Map<String, dynamic>))
            .toList(),
        atributos: (j['atributos'] as List? ?? const [])
            .map((a) => AtributoMapa.fromJson(a as Map<String, dynamic>))
            .toList(),
        marcas: {
          for (final m in (j['marcas'] as List? ?? const []).cast<Map<String, dynamic>>())
            (_entero(m['fila']), _entero(m['columna'])): _entero(m['atributo']),
        },
      );
}

/// Lo que se manda al guardar (la copia de la grilla la pone el servidor).
Map<String, dynamic> pintadoAJson(List<AtributoMapa> atributos, Map<(int, int), int> marcas) => {
      'atributos': [for (final a in atributos) a.toJson()],
      'marcas': [
        for (final e in marcas.entries) {'fila': e.key.$1, 'columna': e.key.$2, 'atributo': e.value},
      ],
    };

class EntradaBitacora {
  const EntradaBitacora({
    required this.id,
    required this.laboratorio,
    required this.laboratorioCodigo,
    required this.tipo,
    required this.tipoNombre,
    required this.titulo,
    required this.descripcion,
    required this.elementos,
    required this.autorNombre,
    required this.editable,
    this.fecha,
    this.mapa,
  });

  final int id;
  final int laboratorio;
  final String laboratorioCodigo;
  final String tipo;
  final String tipoNombre;
  final String titulo;
  final String descripcion;
  final String elementos;
  final String autorNombre;
  /// Si quien tiene la sesión puede editarla o borrarla.
  final bool editable;
  final DateTime? fecha;
  final MapaBitacora? mapa;

  factory EntradaBitacora.fromJson(Map<String, dynamic> j) => EntradaBitacora(
        id: _entero(j['id']),
        laboratorio: _entero(j['laboratorio']),
        laboratorioCodigo: _texto(j['laboratorio_codigo']),
        tipo: _texto(j['tipo']),
        tipoNombre: _texto(j['tipo_nombre']),
        titulo: _texto(j['titulo']),
        descripcion: _texto(j['descripcion']),
        elementos: _texto(j['elementos']),
        autorNombre: _texto(j['autor_nombre']),
        editable: j['editable'] as bool? ?? false,
        fecha: _momento(j['fecha']),
        mapa: j['mapa'] is Map<String, dynamic> ? MapaBitacora.fromJson(j['mapa'] as Map<String, dynamic>) : null,
      );
}

// ── Inventario de activos fijos ──

/// Tipo de activo del inventario (silla, mesa, computadora…). Distinto de
/// [TipoElemento], que es para el mapa de un laboratorio.
class TipoActivo {
  const TipoActivo({
    required this.id,
    required this.nombre,
    required this.descripcion,
    required this.activo,
    required this.totalActivos,
  });

  final int id;
  final String nombre;
  final String descripcion;
  final bool activo;
  final int totalActivos;

  factory TipoActivo.fromJson(Map<String, dynamic> j) => TipoActivo(
        id: _entero(j['id']),
        nombre: _texto(j['nombre']),
        descripcion: _texto(j['descripcion']),
        activo: j['activo'] as bool? ?? true,
        totalActivos: _entero(j['total_activos'] ?? 0),
      );
}

/// Dónde puede estar un activo: un laboratorio (automático), un depósito u otro.
class Lugar {
  const Lugar({
    required this.id,
    required this.nombre,
    required this.tipo,
    required this.tipoNombre,
    required this.descripcion,
    required this.activo,
    required this.totalActivos,
    this.laboratorio,
  });

  final int id;
  final String nombre;

  /// laboratorio | deposito | otro
  final String tipo;
  final String tipoNombre;
  final String descripcion;
  final bool activo;
  final int totalActivos;

  /// id del laboratorio si el lugar es uno (entonces no se edita ni se borra aquí).
  final int? laboratorio;

  bool get esLaboratorio => laboratorio != null;

  factory Lugar.fromJson(Map<String, dynamic> j) => Lugar(
        id: _entero(j['id']),
        nombre: _texto(j['nombre']),
        tipo: _texto(j['tipo']),
        tipoNombre: _texto(j['tipo_nombre']),
        descripcion: _texto(j['descripcion']),
        activo: j['activo'] as bool? ?? true,
        totalActivos: _entero(j['total_activos'] ?? 0),
        laboratorio: _enteroONulo(j['laboratorio']),
      );
}

/// Una casilla de un laboratorio que lleva el código de este activo.
class ActivoEnMapa {
  const ActivoEnMapa({required this.laboratorioCodigo, required this.etiqueta});
  final String laboratorioCodigo;
  final String etiqueta;

  factory ActivoEnMapa.fromJson(Map<String, dynamic> j) => ActivoEnMapa(
        laboratorioCodigo: _texto(j['laboratorio_codigo']),
        etiqueta: _texto(j['etiqueta']),
      );
}

/// Un dato corregido: "Marca: HP → Dell".
class CambioDato {
  const CambioDato({required this.campo, required this.antes, required this.despues});
  final String campo;
  final String antes;
  final String despues;

  factory CambioDato.fromJson(Map<String, dynamic> j) => CambioDato(
        campo: _texto(j['campo']),
        antes: _texto(j['antes']),
        despues: _texto(j['despues']),
      );
}

/// Una corrección: quién cambió qué datos de un activo o de un movimiento.
class CambioInventario {
  const CambioInventario({
    required this.id,
    required this.usuarioNombre,
    required this.cambios,
    required this.creadoEn,
    this.movimiento,
  });

  final int id;

  /// id del movimiento al que corrige, o null si corrige los datos del activo.
  final int? movimiento;
  final String usuarioNombre;
  final List<CambioDato> cambios;
  final DateTime creadoEn;

  factory CambioInventario.fromJson(Map<String, dynamic> j) => CambioInventario(
        id: _entero(j['id']),
        movimiento: _enteroONulo(j['movimiento']),
        usuarioNombre: _texto(j['usuario_nombre']),
        cambios: (j['cambios'] as List? ?? const [])
            .map((c) => CambioDato.fromJson(c as Map<String, dynamic>))
            .toList(),
        creadoEn: _momento(j['creado_en']) ?? DateTime.now(),
      );
}

/// Algo que le pasó a un activo: alta, traslado, cambio de estado o baja.
class MovimientoActivo {
  const MovimientoActivo({
    required this.id,
    required this.tipo,
    required this.tipoNombre,
    required this.fecha,
    required this.lugarOrigenNombre,
    required this.lugarDestinoNombre,
    required this.estadoAnteriorNombre,
    required this.estadoNuevoNombre,
    required this.motivo,
    required this.documento,
    required this.registradoPor,
    required this.corregido,
  });

  final int id;

  /// alta | traslado | estado | baja
  final String tipo;
  final String tipoNombre;

  /// "YYYY-MM-DD".
  final String fecha;
  final String lugarOrigenNombre;
  final String lugarDestinoNombre;
  final String estadoAnteriorNombre;
  final String estadoNuevoNombre;
  final String motivo;
  final String documento;
  final String registradoPor;
  final bool corregido;

  factory MovimientoActivo.fromJson(Map<String, dynamic> j) => MovimientoActivo(
        id: _entero(j['id']),
        tipo: _texto(j['tipo']),
        tipoNombre: _texto(j['tipo_nombre']),
        fecha: _texto(j['fecha']),
        lugarOrigenNombre: _texto(j['lugar_origen_nombre']),
        lugarDestinoNombre: _texto(j['lugar_destino_nombre']),
        estadoAnteriorNombre: _texto(j['estado_anterior_nombre']),
        estadoNuevoNombre: _texto(j['estado_nuevo_nombre']),
        motivo: _texto(j['motivo']),
        documento: _texto(j['documento']),
        registradoPor: _texto(j['registrado_por']),
        corregido: j['corregido'] as bool? ?? false,
      );
}

/// Un activo del inventario. Los campos de la ficha (historial, correcciones,
/// en qué mapa aparece) vienen vacíos en la lista y llenos en el detalle.
class Activo {
  const Activo({
    required this.id,
    required this.codigo,
    required this.descripcion,
    required this.tipoNombre,
    required this.marca,
    required this.modelo,
    required this.serie,
    required this.fechaAdquisicion,
    required this.estado,
    required this.estadoNombre,
    required this.lugar,
    required this.lugarNombre,
    required this.observaciones,
    this.tipo,
    this.creadoPorNombre = '',
    this.enMapa = const [],
    this.movimientos = const [],
    this.cambios = const [],
  });

  final int id;
  final String codigo;
  final String descripcion;
  final int? tipo;
  final String tipoNombre;
  final String marca;
  final String modelo;
  final String serie;

  /// "YYYY-MM-DD" o vacío.
  final String fechaAdquisicion;

  /// operativo | danado | en_reparacion | baja
  final String estado;
  final String estadoNombre;
  final int lugar;
  final String lugarNombre;
  final String observaciones;

  // Solo en la ficha:
  final String creadoPorNombre;
  final List<ActivoEnMapa> enMapa;
  final List<MovimientoActivo> movimientos;
  final List<CambioInventario> cambios;

  bool get deBaja => estado == 'baja';

  /// Correcciones a los datos del activo (no a un movimiento).
  List<CambioInventario> get correccionesDeDatos =>
      cambios.where((c) => c.movimiento == null).toList();

  List<CambioInventario> correccionesDe(MovimientoActivo m) =>
      cambios.where((c) => c.movimiento == m.id).toList();

  factory Activo.fromJson(Map<String, dynamic> j) => Activo(
        id: _entero(j['id']),
        codigo: _texto(j['codigo']),
        descripcion: _texto(j['descripcion']),
        tipo: _enteroONulo(j['tipo']),
        tipoNombre: _texto(j['tipo_nombre']),
        marca: _texto(j['marca']),
        modelo: _texto(j['modelo']),
        serie: _texto(j['serie']),
        fechaAdquisicion: _texto(j['fecha_adquisicion']),
        estado: _texto(j['estado']),
        estadoNombre: _texto(j['estado_nombre']),
        lugar: _entero(j['lugar'] ?? 0),
        lugarNombre: _texto(j['lugar_nombre']),
        observaciones: _texto(j['observaciones']),
        creadoPorNombre: _texto(j['creado_por_nombre']),
        enMapa: (j['en_mapa'] as List? ?? const [])
            .map((c) => ActivoEnMapa.fromJson(c as Map<String, dynamic>))
            .toList(),
        movimientos: (j['movimientos'] as List? ?? const [])
            .map((m) => MovimientoActivo.fromJson(m as Map<String, dynamic>))
            .toList(),
        cambios: (j['cambios'] as List? ?? const [])
            .map((c) => CambioInventario.fromJson(c as Map<String, dynamic>))
            .toList(),
      );
}

/// Totales de una verificación.
class ConteoVerificacion {
  const ConteoVerificacion({
    required this.total,
    required this.revisados,
    required this.pendientes,
    required this.esta,
    required this.falta,
    required this.otroLugar,
    required this.danado,
  });

  final int total;
  final int revisados;
  final int pendientes;
  final int esta;
  final int falta;
  final int otroLugar;
  final int danado;

  bool get hayDiferencias => falta > 0 || otroLugar > 0 || danado > 0;

  factory ConteoVerificacion.fromJson(Map<String, dynamic> j) => ConteoVerificacion(
        total: _entero(j['total'] ?? 0),
        revisados: _entero(j['revisados'] ?? 0),
        pendientes: _entero(j['pendientes'] ?? 0),
        esta: _entero(j['esta'] ?? 0),
        falta: _entero(j['falta'] ?? 0),
        otroLugar: _entero(j['otro_lugar'] ?? 0),
        danado: _entero(j['danado'] ?? 0),
      );
}

/// Un activo dentro de una verificación, con su resultado.
class ItemVerificacion {
  const ItemVerificacion({
    required this.id,
    required this.activo,
    required this.codigo,
    required this.descripcion,
    required this.tipoNombre,
    required this.lugarNombre,
    required this.resultado,
    required this.resultadoNombre,
    required this.lugarEncontradoNombre,
    required this.nota,
    required this.verificadoPorNombre,
    this.lugar,
    this.lugarEncontrado,
  });

  final int id;
  final int activo;
  final String codigo;
  final String descripcion;
  final String tipoNombre;
  final int? lugar;
  final String lugarNombre;

  /// pendiente | esta | falta | otro_lugar | danado
  final String resultado;
  final String resultadoNombre;
  final int? lugarEncontrado;
  final String lugarEncontradoNombre;
  final String nota;
  final String verificadoPorNombre;

  bool get pendiente => resultado == 'pendiente';

  factory ItemVerificacion.fromJson(Map<String, dynamic> j) => ItemVerificacion(
        id: _entero(j['id']),
        activo: _entero(j['activo']),
        codigo: _texto(j['codigo']),
        descripcion: _texto(j['descripcion']),
        tipoNombre: _texto(j['tipo_nombre']),
        lugar: _enteroONulo(j['lugar']),
        lugarNombre: _texto(j['lugar_nombre']),
        resultado: _texto(j['resultado']),
        resultadoNombre: _texto(j['resultado_nombre']),
        lugarEncontrado: _enteroONulo(j['lugar_encontrado']),
        lugarEncontradoNombre: _texto(j['lugar_encontrado_nombre']),
        nota: _texto(j['nota']),
        verificadoPorNombre: _texto(j['verificado_por_nombre']),
      );
}

/// Una verificación de inventario. [items] viene solo en el detalle.
class Verificacion {
  const Verificacion({
    required this.id,
    required this.titulo,
    required this.instrucciones,
    required this.alcance,
    required this.estado,
    required this.estadoNombre,
    required this.responsablesNombres,
    required this.conclusion,
    required this.creadoPorNombre,
    required this.creadoEn,
    required this.cerradaPorNombre,
    required this.conteo,
    required this.progreso,
    required this.puedeMarcar,
    this.fechaLimite = '',
    this.tarea,
    this.cerradaEn,
    this.items = const [],
  });

  final int id;
  final String titulo;
  final String instrucciones;
  final String alcance;

  /// abierta | cerrada | cancelada
  final String estado;
  final String estadoNombre;
  final List<String> responsablesNombres;

  /// "YYYY-MM-DD" o vacío.
  final String fechaLimite;
  final int? tarea;
  final String conclusion;
  final String creadoPorNombre;
  final DateTime creadoEn;
  final String cerradaPorNombre;
  final DateTime? cerradaEn;
  final ConteoVerificacion conteo;
  final int progreso;

  /// Si quien tiene la sesión puede marcar sus activos.
  final bool puedeMarcar;

  /// Solo en el detalle.
  final List<ItemVerificacion> items;

  bool get abierta => estado == 'abierta';
  bool get cerrada => estado == 'cerrada';

  factory Verificacion.fromJson(Map<String, dynamic> j) => Verificacion(
        id: _entero(j['id']),
        titulo: _texto(j['titulo']),
        instrucciones: _texto(j['instrucciones']),
        alcance: _texto(j['alcance']),
        estado: _texto(j['estado']),
        estadoNombre: _texto(j['estado_nombre']),
        responsablesNombres: (j['responsables_detalle'] as List? ?? const [])
            .map((r) => _texto((r as Map<String, dynamic>)['nombre_completo']))
            .toList(),
        fechaLimite: _texto(j['fecha_limite']),
        tarea: _enteroONulo(j['tarea']),
        conclusion: _texto(j['conclusion']),
        creadoPorNombre: _texto(j['creado_por_nombre']),
        creadoEn: _momento(j['creado_en']) ?? DateTime.now(),
        cerradaPorNombre: _texto(j['cerrada_por_nombre']),
        cerradaEn: _momento(j['cerrada_en']),
        conteo: ConteoVerificacion.fromJson(
          j['conteo'] is Map<String, dynamic> ? j['conteo'] as Map<String, dynamic> : const {},
        ),
        progreso: _entero(j['progreso'] ?? 0),
        puedeMarcar: j['puede_marcar'] as bool? ?? false,
        items: (j['items'] as List? ?? const [])
            .map((i) => ItemVerificacion.fromJson(i as Map<String, dynamic>))
            .toList(),
      );
}

// ── Gestión de usuarios ──

/// Un usuario tal como lo ve la administración (más datos que el de la sesión).
class UsuarioAdmin {
  const UsuarioAdmin({
    required this.id,
    required this.email,
    required this.codigo,
    required this.nombres,
    required this.apellidos,
    required this.nombreCompleto,
    required this.rol,
    required this.rolNombre,
    required this.telefono,
    required this.activo,
    this.ultimoAcceso,
    this.creadoEn,
    this.fichaDocenteId,
    this.fichaDocenteNombre = '',
  });

  final int id;
  final String email;
  final String codigo;
  final String nombres;
  final String apellidos;
  final String nombreCompleto;
  final String rol;
  final String rolNombre;
  final String telefono;
  final bool activo;
  final DateTime? ultimoAcceso;
  final DateTime? creadoEn;

  /// Ficha de docente vinculada (solo rol docente).
  final int? fichaDocenteId;
  final String fichaDocenteNombre;

  String get iniciales {
    final partes = nombreCompleto.split(' ').where((p) => p.isNotEmpty).take(2);
    return partes.map((p) => p[0].toUpperCase()).join();
  }

  factory UsuarioAdmin.fromJson(Map<String, dynamic> j) {
    final ficha = j['ficha_docente'];
    return UsuarioAdmin(
      id: _entero(j['id']),
      email: _texto(j['email']),
      codigo: _texto(j['codigo']),
      nombres: _texto(j['nombres']),
      apellidos: _texto(j['apellidos']),
      nombreCompleto: _texto(j['nombre_completo']),
      rol: _texto(j['rol']),
      rolNombre: _texto(j['rol_nombre']),
      telefono: _texto(j['telefono']),
      activo: j['is_active'] as bool? ?? true,
      ultimoAcceso: _momento(j['last_login']),
      creadoEn: _momento(j['creado_en']),
      fichaDocenteId: ficha is Map ? _enteroONulo(ficha['id']) : null,
      fichaDocenteNombre: ficha is Map ? _texto(ficha['nombre_completo']) : '',
    );
  }
}

/// Una ficha de docente (registrada con o sin usuario), para vincularla al crear
/// un usuario con rol docente.
class DocenteFicha {
  const DocenteFicha({
    required this.id,
    required this.nombreCompleto,
    this.email = '',
    this.totalHorarios = 0,
  });

  final int id;
  final String nombreCompleto;
  final String email;
  final int totalHorarios;

  factory DocenteFicha.fromJson(Map<String, dynamic> j) => DocenteFicha(
        id: _entero(j['id']),
        nombreCompleto: _texto(j['nombre_completo']),
        email: _texto(j['email']),
        totalHorarios: _entero(j['total_horarios'] ?? 0),
      );
}

/// Una revisión periódica programada (p. ej. revisar el LAB-2 cada 2 semanas).
class Revision {
  const Revision({
    required this.id,
    required this.laboratorio,
    required this.laboratorioCodigo,
    required this.laboratorioNombre,
    required this.titulo,
    required this.instrucciones,
    required this.cada,
    required this.unidad,
    required this.unidadNombre,
    required this.frecuencia,
    required this.proximaFecha,
    required this.situacion,
    required this.activa,
    this.ultimaFecha = '',
    this.responsable,
    this.responsableNombre = '',
    this.tareaAbierta,
  });

  final int id;
  final int laboratorio;
  final String laboratorioCodigo;
  final String laboratorioNombre;
  final String titulo;
  final String instrucciones;
  final int cada;
  final String unidad;
  final String unidadNombre;
  final String frecuencia;
  final String proximaFecha;
  final String ultimaFecha;

  /// vencida, hoy, pronto (≤ 3 días) o al_dia.
  final String situacion;
  final bool activa;
  final int? responsable;
  final String responsableNombre;

  /// Id de la tarea del pizarrón si ya se abrió (null si no).
  final int? tareaAbierta;

  bool get vencida => situacion == 'vencida';

  factory Revision.fromJson(Map<String, dynamic> j) => Revision(
        id: _entero(j['id']),
        laboratorio: _entero(j['laboratorio']),
        laboratorioCodigo: _texto(j['laboratorio_codigo']),
        laboratorioNombre: _texto(j['laboratorio_nombre']),
        titulo: _texto(j['titulo']),
        instrucciones: _texto(j['instrucciones']),
        cada: _entero(j['cada'] ?? 1),
        unidad: _texto(j['unidad']),
        unidadNombre: _texto(j['unidad_nombre']),
        frecuencia: _texto(j['frecuencia']),
        proximaFecha: _texto(j['proxima_fecha']),
        ultimaFecha: _texto(j['ultima_fecha']),
        situacion: _texto(j['situacion']),
        activa: j['activa'] as bool? ?? true,
        responsable: _enteroONulo(j['responsable']),
        responsableNombre: _texto(j['responsable_nombre']),
        tareaAbierta: _enteroONulo(j['tarea_abierta']),
      );
}

/// Lista de resultados de una respuesta paginada de DRF.
List<Map<String, dynamic>> resultados(dynamic datos) {
  final lista = datos is Map<String, dynamic> ? datos['results'] as List : datos as List;
  return lista.cast<Map<String, dynamic>>();
}

// ── Control de asistencia de auxiliares ──

/// Un punto en el mapa y el radio (en metros) dentro del cual vale marcar.
class LugarAsistencia {
  const LugarAsistencia({
    required this.id,
    required this.nombre,
    required this.latitud,
    required this.longitud,
    required this.radioM,
    this.referencia = '',
    this.predeterminado = false,
    this.activo = true,
    this.asignados = 0,
  });

  final int id;
  final String nombre;
  final String referencia;
  final double latitud;
  final double longitud;
  final int radioM;

  /// El lugar de quienes no tienen uno propio.
  final bool predeterminado;
  final bool activo;

  /// Cuántos auxiliares lo tienen como lugar propio.
  final int asignados;

  String get coordenadas => '${latitud.toStringAsFixed(6)}, ${longitud.toStringAsFixed(6)}';

  factory LugarAsistencia.fromJson(Map<String, dynamic> j) => LugarAsistencia(
        id: _entero(j['id']),
        nombre: _texto(j['nombre']),
        referencia: _texto(j['referencia']),
        latitud: _decimal(j['latitud']),
        longitud: _decimal(j['longitud']),
        radioM: _entero(j['radio_m']),
        predeterminado: j['predeterminado'] == true,
        activo: j['activo'] != false,
        asignados: _enteroONulo(j['asignados']) ?? 0,
      );
}

/// Una entrada y (cuando se marca) su salida, con dónde estaba el teléfono en cada una.
class Marcacion {
  const Marcacion({
    required this.id,
    required this.usuario,
    required this.usuarioNombre,
    required this.lugar,
    required this.lugarNombre,
    required this.radioM,
    required this.fecha,
    required this.entradaEn,
    required this.entradaLatitud,
    required this.entradaLongitud,
    required this.entradaDistanciaM,
    this.entradaPrecisionM,
    this.salidaEn,
    this.salidaLatitud,
    this.salidaLongitud,
    this.salidaPrecisionM,
    this.salidaDistanciaM,
    this.salidaManual = false,
    this.nota = '',
    this.turnoInicio,
    this.turnoFin,
    this.retrasoMin = 0,
    this.salidaTempranaMin = 0,
    this.minutos,
  });

  final int id;
  final int usuario;
  final String usuarioNombre;
  final int lugar;
  final String lugarNombre;
  final int radioM;

  /// AAAA-MM-DD (día de la entrada).
  final String fecha;
  final DateTime entradaEn;
  final double entradaLatitud;
  final double entradaLongitud;
  final double? entradaPrecisionM;
  final double entradaDistanciaM;
  final DateTime? salidaEn;
  final double? salidaLatitud;
  final double? salidaLongitud;
  final double? salidaPrecisionM;
  final double? salidaDistanciaM;

  /// La salida la puso el Admin (sin GPS ni huella).
  final bool salidaManual;
  final String nota;

  /// Turno esperado ese día ("HH:MM") o null si marcó sin horario.
  final String? turnoInicio;
  final String? turnoFin;

  /// Minutos de retraso en la entrada (0 = puntual) y minutos que salió antes del fin.
  final int retrasoMin;
  final int salidaTempranaMin;

  /// Minutos trabajados; null mientras no haya salida.
  final int? minutos;

  bool get abierta => salidaEn == null;
  bool get conRetraso => retrasoMin > 0;

  factory Marcacion.fromJson(Map<String, dynamic> j) => Marcacion(
        id: _entero(j['id']),
        usuario: _entero(j['usuario']),
        usuarioNombre: _texto(j['usuario_nombre']),
        lugar: _entero(j['lugar']),
        lugarNombre: _texto(j['lugar_nombre']),
        radioM: _enteroONulo(j['radio_m']) ?? 0,
        fecha: _texto(j['fecha']),
        entradaEn: _momento(j['entrada_en']) ?? DateTime.now(),
        entradaLatitud: _decimal(j['entrada_latitud']),
        entradaLongitud: _decimal(j['entrada_longitud']),
        entradaPrecisionM: _decimalONulo(j['entrada_precision_m']),
        entradaDistanciaM: _decimalONulo(j['entrada_distancia_m']) ?? 0,
        salidaEn: _momento(j['salida_en']),
        salidaLatitud: _decimalONulo(j['salida_latitud']),
        salidaLongitud: _decimalONulo(j['salida_longitud']),
        salidaPrecisionM: _decimalONulo(j['salida_precision_m']),
        salidaDistanciaM: _decimalONulo(j['salida_distancia_m']),
        salidaManual: j['salida_manual'] == true,
        nota: _texto(j['nota']),
        turnoInicio: j['turno_inicio'] == null ? null : _horaCorta(_texto(j['turno_inicio'])),
        turnoFin: j['turno_fin'] == null ? null : _horaCorta(_texto(j['turno_fin'])),
        retrasoMin: _enteroONulo(j['retraso_min']) ?? 0,
        salidaTempranaMin: _enteroONulo(j['salida_temprana_min']) ?? 0,
        minutos: _enteroONulo(j['minutos']),
      );
}

/// Lo que la pantalla "Mi asistencia" necesita: dónde marco, si tengo una entrada abierta y mis marcas de hoy.
class EstadoAsistencia {
  const EstadoAsistencia({
    required this.hoy,
    required this.minutosHoy,
    required this.precisionMaximaM,
    this.lugar,
    this.abierta,
  });

  /// null = todavía no tengo lugar: no puedo marcar.
  final LugarAsistencia? lugar;
  final Marcacion? abierta;
  final List<Marcacion> hoy;
  final int minutosHoy;

  /// Con un GPS más impreciso que esto el servidor rechaza la marca.
  final int precisionMaximaM;

  factory EstadoAsistencia.fromJson(Map<String, dynamic> j) => EstadoAsistencia(
        lugar: j['lugar'] is Map ? LugarAsistencia.fromJson(Map<String, dynamic>.from(j['lugar'] as Map)) : null,
        abierta: j['abierta'] is Map ? Marcacion.fromJson(Map<String, dynamic>.from(j['abierta'] as Map)) : null,
        hoy: [
          for (final m in (j['hoy'] as List? ?? const []))
            Marcacion.fromJson(Map<String, dynamic>.from(m as Map)),
        ],
        minutosHoy: _enteroONulo(j['minutos_hoy']) ?? 0,
        precisionMaximaM: _enteroONulo(j['precision_maxima_m']) ?? 150,
      );
}

/// Un auxiliar con su lugar y cómo va hoy (para el Admin).
class AuxiliarAsistencia {
  const AuxiliarAsistencia({
    required this.id,
    required this.nombreCompleto,
    required this.situacion,
    this.email = '',
    this.lugar,
    this.lugarNombre = '',
    this.lugarEfectivo,
    this.usaPredeterminado = true,
    this.horario,
    this.horarioNombre = '',
    this.entradaEn,
    this.salidaEn,
    this.minutosHoy = 0,
  });

  final int id;
  final String nombreCompleto;
  final String email;

  /// Su lugar propio; null = usa el predeterminado.
  final int? lugar;

  /// Nombre del lugar donde marca (propio o predeterminado); vacío si no hay ninguno.
  final String lugarNombre;
  final int? lugarEfectivo;
  final bool usaPredeterminado;

  /// Su horario de trabajo propio; null = sin horario.
  final int? horario;
  final String horarioNombre;

  /// sin_marcar, presente o salio.
  final String situacion;
  final DateTime? entradaEn;
  final DateTime? salidaEn;
  final int minutosHoy;

  factory AuxiliarAsistencia.fromJson(Map<String, dynamic> j) => AuxiliarAsistencia(
        id: _entero(j['id']),
        nombreCompleto: _texto(j['nombre_completo']),
        email: _texto(j['email']),
        lugar: _enteroONulo(j['lugar']),
        lugarNombre: _texto(j['lugar_nombre']),
        lugarEfectivo: _enteroONulo(j['lugar_efectivo']),
        usaPredeterminado: j['usa_predeterminado'] != false,
        horario: _enteroONulo(j['horario']),
        horarioNombre: _texto(j['horario_nombre']),
        situacion: _texto(j['situacion']),
        entradaEn: _momento(j['entrada_en']),
        salidaEn: _momento(j['salida_en']),
        minutosHoy: _enteroONulo(j['minutos_hoy']) ?? 0,
      );
}

/// Totales de un auxiliar en un rango de fechas.
class ResumenAsistencia {
  const ResumenAsistencia({
    required this.usuario,
    required this.usuarioNombre,
    required this.dias,
    required this.marcaciones,
    required this.minutos,
    required this.sinSalida,
    required this.salidasManuales,
    this.retrasos = 0,
    this.retrasoTotalMin = 0,
    this.retrasoMaxMin = 0,
    this.retrasoPromedioMin = 0,
  });

  final int usuario;
  final String usuarioNombre;
  final int dias;
  final int marcaciones;
  final int minutos;
  final int sinSalida;
  final int salidasManuales;
  final int retrasos;
  final int retrasoTotalMin;
  final int retrasoMaxMin;
  final int retrasoPromedioMin;

  factory ResumenAsistencia.fromJson(Map<String, dynamic> j) => ResumenAsistencia(
        usuario: _entero(j['usuario']),
        usuarioNombre: _texto(j['usuario_nombre']),
        dias: _enteroONulo(j['dias']) ?? 0,
        marcaciones: _enteroONulo(j['marcaciones']) ?? 0,
        minutos: _enteroONulo(j['minutos']) ?? 0,
        sinSalida: _enteroONulo(j['sin_salida']) ?? 0,
        salidasManuales: _enteroONulo(j['salidas_manuales']) ?? 0,
        retrasos: _enteroONulo(j['retrasos']) ?? 0,
        retrasoTotalMin: _enteroONulo(j['retraso_total_min']) ?? 0,
        retrasoMaxMin: _enteroONulo(j['retraso_max_min']) ?? 0,
        retrasoPromedioMin: _enteroONulo(j['retraso_promedio_min']) ?? 0,
      );
}

/// Un tramo de un día dentro de un horario de trabajo. Hora en "HH:MM".
class BloqueHorario {
  const BloqueHorario({required this.dia, required this.inicio, required this.fin});

  /// 0 = lunes … 6 = domingo.
  final int dia;
  final String inicio;
  final String fin;

  factory BloqueHorario.fromJson(Map<String, dynamic> j) => BloqueHorario(
        dia: _entero(j['dia']),
        inicio: _horaCorta(_texto(j['inicio'])),
        fin: _horaCorta(_texto(j['fin'])),
      );

  Map<String, dynamic> aJson() => {'dia': dia, 'inicio': inicio, 'fin': fin};
}

/// "08:00:00" → "08:00".
String _horaCorta(String hora) => hora.length >= 5 ? hora.substring(0, 5) : hora;

/// Un horario de trabajo que el Admin asigna a los auxiliares.
class HorarioTrabajo {
  const HorarioTrabajo({
    required this.id,
    required this.nombre,
    this.descripcion = '',
    this.activo = true,
    this.bloques = const [],
    this.asignados = 0,
  });

  final int id;
  final String nombre;
  final String descripcion;
  final bool activo;
  final List<BloqueHorario> bloques;

  /// Cuántos auxiliares lo tienen asignado.
  final int asignados;

  factory HorarioTrabajo.fromJson(Map<String, dynamic> j) => HorarioTrabajo(
        id: _entero(j['id']),
        nombre: _texto(j['nombre']),
        descripcion: _texto(j['descripcion']),
        activo: j['activo'] != false,
        bloques: [
          for (final b in (j['bloques'] as List? ?? const []))
            BloqueHorario.fromJson(Map<String, dynamic>.from(b as Map)),
        ],
        asignados: _enteroONulo(j['asignados']) ?? 0,
      );
}

/// Un respaldo (copia de seguridad) de la base de datos.
class Respaldo {
  const Respaldo({
    required this.id,
    required this.archivo,
    required this.tamano,
    this.tamanoBytes = 0,
    this.origen = 'manual',
    this.nota = '',
    this.creadoPorNombre = '',
    this.creadoEn,
  });

  final int id;
  final String archivo;

  /// Tamaño legible, p. ej. "2.4 MB".
  final String tamano;
  final int tamanoBytes;
  final String origen;
  final String nota;
  final String creadoPorNombre;
  final DateTime? creadoEn;

  factory Respaldo.fromJson(Map<String, dynamic> j) => Respaldo(
        id: _entero(j['id']),
        archivo: _texto(j['archivo']),
        tamano: _texto(j['tamano']),
        tamanoBytes: _enteroONulo(j['tamano_bytes']) ?? 0,
        origen: _texto(j['origen']).isEmpty ? 'manual' : _texto(j['origen']),
        nota: _texto(j['nota']),
        creadoPorNombre: _texto(j['creado_por_nombre']),
        creadoEn: _momento(j['creado_en']),
      );
}

/// Si el servidor puede crear respaldos y cuántos guarda.
class EstadoRespaldos {
  const EstadoRespaldos({this.pgDumpDisponible = false, this.maximos = 0, this.total = 0});

  final bool pgDumpDisponible;
  final int maximos;
  final int total;

  factory EstadoRespaldos.fromJson(Map<String, dynamic> j) => EstadoRespaldos(
        pgDumpDisponible: j['pg_dump_disponible'] == true,
        maximos: _enteroONulo(j['maximos']) ?? 0,
        total: _enteroONulo(j['total']) ?? 0,
      );
}
