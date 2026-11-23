/// El único lugar con rutas de la API. La dirección base sale de
/// env/dev.env (API_BASE_URL) y se aplica en api_cliente.dart.
abstract final class Endpoints {
  // Autenticación
  static const login = '/auth/login/';
  static const refresh = '/auth/refresh/';
  static const logout = '/auth/logout/';
  static const me = '/auth/me/';
  static const aceptarTerminos = '/auth/terminos/aceptar/';
  static const cambiarPassword = '/auth/cambiar-password/';

  // Usuarios
  static const usuariosOpciones = '/usuarios/opciones/';
  static const usuarios = '/usuarios/';
  static String usuario(int id) => '/usuarios/$id/';
  static String activarUsuario(int id) => '/usuarios/$id/activar/';
  static String desactivarUsuario(int id) => '/usuarios/$id/desactivar/';
  static String restablecerPasswordUsuario(int id) => '/usuarios/$id/restablecer-password/';
  static const docentes = '/docentes/';

  // Laboratorios y elementos
  static const elementos = '/elementos/';
  static String elemento(int id) => '/elementos/$id/';
  static const laboratorios = '/laboratorios/';
  static String laboratorio(int id) => '/laboratorios/$id/';
  static String distribucion(int id) => '/laboratorios/$id/distribucion/';
  static String softwareLaboratorio(int id) => '/laboratorios/$id/software/';
  static const software = '/software/';
  static String softwareItem(int id) => '/software/$id/';
  static const credenciales = '/credenciales/';
  static String credencial(int id) => '/credenciales/$id/';
  static String revelarCredencial(int id) => '/credenciales/$id/revelar/';

  // Planificación
  static const periodos = '/periodos/';
  static String periodo(int id) => '/periodos/$id/';
  static String clonarHorarios(int id) => '/periodos/$id/clonar-horarios/';
  static const materias = '/materias/';
  static String materia(int id) => '/materias/$id/';
  static const horarios = '/horarios/';
  static String horario(int id) => '/horarios/$id/';
  static const horariosLote = '/horarios/lote/';
  static const horariosLoteEditar = '/horarios/lote/editar/';
  static String suspenderHorario(int id) => '/horarios/$id/suspender/';
  static String reanudarHorario(int id) => '/horarios/$id/reanudar/';
  static String docente(int id) => '/docentes/$id/';
  static const reservas = '/reservas/';
  static String reserva(int id) => '/reservas/$id/';
  static String cancelarReserva(int id) => '/reservas/$id/cancelar/';
  static String aprobarReserva(int id) => '/reservas/$id/aprobar/';
  static const agenda = '/agenda/';
  static const disponibilidad = '/disponibilidad/';

  // Objetos perdidos
  static const objetos = '/objetos-perdidos/';
  static String objeto(int id) => '/objetos-perdidos/$id/';
  static String entregarObjeto(int id) => '/objetos-perdidos/$id/entregar/';
  static String anularObjeto(int id) => '/objetos-perdidos/$id/anular/';
  /// Fotos de la entrega (ci-anverso, ci-reverso, persona). Solo con sesión.
  static String fotoEntrega(int id, String nombre) => '/objetos-perdidos/$id/entrega/$nombre/';

  // Notificaciones (campana) y avisos a los auxiliares
  static const notificaciones = '/notificaciones/';
  static const resumenNotificaciones = '/notificaciones/resumen/';
  static String leerNotificacion(int id) => '/notificaciones/$id/leer/';
  static const leerTodasNotificaciones = '/notificaciones/leer-todas/';
  static const avisoAula = '/avisos/aula/';
  // Push: token del teléfono y preferencias (interruptor general y "solo en turno").
  static const dispositivosPush = '/notificaciones/dispositivos/';
  static const preferenciasPush = '/notificaciones/preferencias/';

  // Preferencias de los docentes
  static const opcionesPreferencia = '/preferencias/opciones/';
  static String opcionPreferencia(int id) => '/preferencias/opciones/$id/';
  static const misPreferencias = '/preferencias/mias/';
  static const preferenciasDocentes = '/preferencias/docentes/';
  static String preferenciasDocente(int id) => '/preferencias/docentes/$id/';
  /// Ajustes de interfaz propios del usuario (p. ej. los laboratorios de la pizarra).
  static String preferenciaInterfaz(String clave) => '/preferencias/interfaz/$clave/';

  // Solicitudes de asistencia
  static const asistencia = '/asistencia/';
  static String solicitud(int id) => '/asistencia/$id/';
  static String tomarSolicitud(int id) => '/asistencia/$id/tomar/';
  static String resolverSolicitud(int id) => '/asistencia/$id/resolver/';
  static String cancelarSolicitud(int id) => '/asistencia/$id/cancelar/';

  // Bitácora de los laboratorios (con mapa pintado estilo OrganiLab)
  static const bitacora = '/bitacora/';
  static String entradaBitacora(int id) => '/bitacora/$id/';
  static const plantillaBitacora = '/bitacora/plantilla/';
  static String exportarBitacora(int id) => '/bitacora/$id/exportar/';
  static const importarBitacora = '/bitacora/importar/';

  // Revisiones periódicas
  static const revisiones = '/revisiones/';
  static String revision(int id) => '/revisiones/$id/';
  static String realizarRevision(int id) => '/revisiones/$id/realizar/';

  // Pizarrón de tareas
  static const tareas = '/tareas/';
  static String tarea(int id) => '/tareas/$id/';
  static String estadoTarea(int id) => '/tareas/$id/estado/';
  static String avancesTarea(int id) => '/tareas/$id/avances/';

  // Inventario de activos fijos
  static const inventarioTipos = '/inventario/tipos/';
  static String inventarioTipo(int id) => '/inventario/tipos/$id/';
  static const inventarioLugares = '/inventario/lugares/';
  static String inventarioLugar(int id) => '/inventario/lugares/$id/';
  static const activos = '/inventario/activos/';
  static String activo(int id) => '/inventario/activos/$id/';
  static String trasladarActivo(int id) => '/inventario/activos/$id/trasladar/';
  static String estadoActivo(int id) => '/inventario/activos/$id/estado/';
  static String bajaActivo(int id) => '/inventario/activos/$id/baja/';
  static const exportarActivos = '/inventario/activos/exportar/';
  static const importarActivos = '/inventario/activos/importar/';
  static String corregirMovimiento(int id) => '/inventario/movimientos/$id/';
  static const verificaciones = '/inventario/verificaciones/';
  static String verificacion(int id) => '/inventario/verificaciones/$id/';
  static String marcarVerificacion(int id) => '/inventario/verificaciones/$id/marcar/';
  static String cerrarVerificacion(int id) => '/inventario/verificaciones/$id/cerrar/';
  static String cancelarVerificacion(int id) => '/inventario/verificaciones/$id/cancelar/';

  // Control de asistencia de auxiliares (entrada y salida con GPS y huella)
  static const marcaciones = '/marcaciones/';
  static String marcacion(int id) => '/marcaciones/$id/';
  static String cerrarMarcacion(int id) => '/marcaciones/$id/cerrar/';
  static const estadoMarcaciones = '/marcaciones/estado/';
  static const marcar = '/marcaciones/marcar/';
  static const resumenMarcaciones = '/marcaciones/resumen/';
  static const exportarMarcaciones = '/marcaciones/exportar/';
  static const lugaresAsistencia = '/marcaciones/lugares/';
  static String lugarAsistencia(int id) => '/marcaciones/lugares/$id/';
  static const horariosAsistencia = '/marcaciones/horarios/';
  static String horarioAsistencia(int id) => '/marcaciones/horarios/$id/';
  static const auxiliaresAsistencia = '/marcaciones/auxiliares/';
  static String auxiliarAsistencia(int id) => '/marcaciones/auxiliares/$id/';
  static String auxiliarHorario(int id) => '/marcaciones/auxiliares/$id/horario/';

  // Respaldos (copias de seguridad) de la base de datos
  static const respaldos = '/respaldos/';
  static const estadoRespaldos = '/respaldos/estado/';
  static const generarRespaldo = '/respaldos/generar/';
  static String respaldo(int id) => '/respaldos/$id/';
  static String descargarRespaldo(int id) => '/respaldos/$id/descargar/';
}
