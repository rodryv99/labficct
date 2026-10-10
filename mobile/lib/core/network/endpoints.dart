/// El único lugar con rutas de la API. La dirección base sale de
/// env/dev.env (API_BASE_URL) y se aplica en api_cliente.dart.
abstract final class Endpoints {
  // Autenticación
  static const login = '/auth/login/';
  static const refresh = '/auth/refresh/';
  static const logout = '/auth/logout/';
  static const me = '/auth/me/';
  static const cambiarPassword = '/auth/cambiar-password/';

  // Usuarios
  static const usuariosOpciones = '/usuarios/opciones/';

  // Laboratorios y elementos
  static const elementos = '/elementos/';
  static const laboratorios = '/laboratorios/';
  static String laboratorio(int id) => '/laboratorios/$id/';
  static String distribucion(int id) => '/laboratorios/$id/distribucion/';
  static const software = '/software/';
  static const credenciales = '/credenciales/';
  static String revelarCredencial(int id) => '/credenciales/$id/revelar/';

  // Planificación
  static const periodos = '/periodos/';
  static const horarios = '/horarios/';
  static const reservas = '/reservas/';
  static String reserva(int id) => '/reservas/$id/';
  static String cancelarReserva(int id) => '/reservas/$id/cancelar/';
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

  // Preferencias de los docentes
  static const opcionesPreferencia = '/preferencias/opciones/';
  static const misPreferencias = '/preferencias/mias/';

  // Solicitudes de asistencia
  static const asistencia = '/asistencia/';
  static String solicitud(int id) => '/asistencia/$id/';
  static String tomarSolicitud(int id) => '/asistencia/$id/tomar/';
  static String resolverSolicitud(int id) => '/asistencia/$id/resolver/';
  static String cancelarSolicitud(int id) => '/asistencia/$id/cancelar/';

  // Pizarrón de tareas
  static const tareas = '/tareas/';
  static String tarea(int id) => '/tareas/$id/';
  static String estadoTarea(int id) => '/tareas/$id/estado/';
  static String avancesTarea(int id) => '/tareas/$id/avances/';
}
