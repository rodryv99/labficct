import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/asistencia/asistencia_page.dart';
import '../../features/asistencia/solicitud_detalle_page.dart';
import '../../features/asistencia/solicitud_nueva_page.dart';
import '../../features/auth/login_page.dart';
import '../../features/bitacora/bitacora_page.dart';
import '../../features/bitacora/entrada_bitacora_form_page.dart';
import '../../features/bitacora/entrada_bitacora_page.dart';
import '../../features/clases/clases_page.dart';
import '../../features/inicio/inicio_page.dart';
import '../../features/inventario/activo_detalle_page.dart';
import '../../features/inventario/activo_form_page.dart';
import '../../features/inventario/catalogos_inventario_page.dart';
import '../../features/inventario/importar_activos_page.dart';
import '../../features/inventario/inventario_page.dart';
import '../../features/inventario/verificacion_detalle_page.dart';
import '../../features/inventario/verificacion_nueva_page.dart';
import '../../features/laboratorios/elementos_catalogo_page.dart';
import '../../features/preferencias/preferencias_opciones_page.dart';
import '../../features/laboratorios/editor_distribucion_page.dart';
import '../../features/laboratorios/laboratorio_detalle_page.dart';
import '../../features/laboratorios/laboratorio_form_page.dart';
import '../../features/laboratorios/laboratorios_page.dart';
import '../../features/laboratorios/software_catalogo_page.dart';
import '../../features/marcaciones/control_asistencia_page.dart';
import '../../features/marcaciones/horario_asistencia_form_page.dart';
import '../../features/marcaciones/lugar_asistencia_form_page.dart';
import '../../features/marcaciones/marcacion_detalle_page.dart';
import '../../features/marcaciones/mi_asistencia_page.dart';
import '../../features/marcaciones/mis_marcaciones_page.dart';
import '../../features/respaldos/respaldos_page.dart';
import '../../features/notificaciones/notificaciones_page.dart';
import '../../features/notificaciones/preferencias_push_page.dart';
import '../../features/planificacion/catalogos_planificacion_page.dart';
import '../../features/planificacion/horario_form_page.dart';
import '../../features/planificacion/planificacion_comun.dart';
import '../../features/planificacion/planificacion_page.dart';
import '../../features/objetos/objeto_detalle_page.dart';
import '../../features/objetos/objeto_nuevo_page.dart';
import '../../features/objetos/objetos_page.dart';
import '../../features/preferencias/preferencias_docentes_page.dart';
import '../../features/preferencias/preferencias_page.dart';
import '../../features/reservas/reserva_nueva_page.dart';
import '../../features/reservas/reservas_page.dart';
import '../../features/revisiones/revision_detalle_page.dart';
import '../../features/revisiones/revision_form_page.dart';
import '../../features/revisiones/revisiones_page.dart';
import '../../features/usuarios/usuario_form_page.dart';
import '../../features/usuarios/usuarios_page.dart';
import '../../features/shell/shell_page.dart';
import '../../features/tareas/tarea_detalle_page.dart';
import '../../features/tareas/tarea_nueva_page.dart';
import '../../features/tareas/tareas_page.dart';
import '../auth/sesion.dart';
import '../modelos/modelos.dart';

/// Una pestaña de la barra inferior. Cada rol ve solo las que le sirven.
class Pestana {
  const Pestana(this.ruta, this.etiqueta, this.icono, this.iconoActivo);
  final String ruta;
  final String etiqueta;
  final IconData icono;
  final IconData iconoActivo;
}

List<Pestana> pestanasDe(Usuario u) {
  final conPizarra = u.puede('pizarra.ver');
  final lista = [
    if (conPizarra) const Pestana('/hoy', 'Hoy', Icons.today_outlined, Icons.today),
    if (u.puede('tareas.ver')) const Pestana('/tareas', 'Tareas', Icons.assignment_outlined, Icons.assignment),
    if (!conPizarra && u.puede('horarios.ver'))
      Pestana(
        '/clases',
        u.rol == 'docente' ? 'Mis clases' : 'Horarios',
        Icons.school_outlined,
        Icons.school,
      ),
    if (u.puede('laboratorios.ver'))
      const Pestana('/laboratorios', 'Laboratorios', Icons.computer_outlined, Icons.computer),
    if (u.puede('reservas.ver'))
      Pestana(
        '/reservas',
        u.puede('reservas.gestionar') ? 'Reservas' : 'Mis reservas',
        Icons.event_available_outlined,
        Icons.event_available,
      ),
    if (u.puede('objetos.ver')) const Pestana('/objetos', 'Objetos', Icons.inventory_2_outlined, Icons.inventory_2),
    // Quien atiende las solicitudes las ve desde Hoy, su perfil y las notificaciones.
    if (u.puede('asistencia.solicitar') && !u.puede('asistencia.atender'))
      const Pestana('/asistencia', 'Asistencia técnica', Icons.support_agent_outlined, Icons.support_agent),
  ];
  // Con cinco pestañas, "Laboratorios" no entra en un teléfono angosto.
  if (lista.length < 5) return lista;
  return [
    for (final p in lista)
      p.ruta == '/laboratorios' ? Pestana(p.ruta, 'Labs', p.icono, p.iconoActivo) : p,
  ];
}

NoTransitionPage<void> _pestana(Widget hijo) => NoTransitionPage<void>(child: hijo);

final routerProvider = Provider<GoRouter>((ref) {
  // El router se vuelve a evaluar cada vez que cambia la sesión.
  final sesion = ValueNotifier<Sesion>(ref.read(sesionProvider));
  ref.listen<Sesion>(sesionProvider, (_, siguiente) => sesion.value = siguiente);
  ref.onDispose(sesion.dispose);

  return GoRouter(
    initialLocation: '/cargando',
    refreshListenable: sesion,
    redirect: (context, state) {
      final actual = sesion.value;
      final ruta = state.matchedLocation;
      switch (actual.estado) {
        case EstadoSesion.cargando:
          return ruta == '/cargando' ? null : '/cargando';
        case EstadoSesion.anonimo:
          return ruta == '/login' ? null : '/login';
        case EstadoSesion.autenticado:
          if (ruta == '/login' || ruta == '/cargando' || ruta == '/') {
            final pestanas = pestanasDe(actual.usuario!);
            return pestanas.isEmpty ? '/laboratorios' : pestanas.first.ruta;
          }
          return null;
      }
    },
    routes: [
      GoRoute(path: '/', redirect: (_, _) => '/cargando'),
      GoRoute(path: '/cargando', builder: (_, _) => const _PantallaCarga()),
      GoRoute(path: '/login', builder: (_, _) => const LoginPage()),
      ShellRoute(
        builder: (context, state, hijo) => ShellPage(ubicacion: state.matchedLocation, child: hijo),
        routes: [
          // /hoy?fecha=2026-09-28 abre la pizarra en ese día (desde una notificación).
          GoRoute(
            path: '/hoy',
            pageBuilder: (_, state) =>
                _pestana(InicioPage(fecha: DateTime.tryParse(state.uri.queryParameters['fecha'] ?? ''))),
          ),
          GoRoute(path: '/tareas', pageBuilder: (_, _) => _pestana(const TareasPage())),
          GoRoute(path: '/clases', pageBuilder: (_, _) => _pestana(const ClasesPage())),
          GoRoute(path: '/laboratorios', pageBuilder: (_, _) => _pestana(const LaboratoriosPage())),
          GoRoute(path: '/reservas', pageBuilder: (_, _) => _pestana(const ReservasPage())),
          GoRoute(path: '/objetos', pageBuilder: (_, _) => _pestana(const ObjetosPage())),
          GoRoute(path: '/asistencia', pageBuilder: (_, _) => _pestana(const AsistenciaPage())),
        ],
      ),
      // Pantallas completas (sin barra inferior); se abren con context.push.
      // "nuevo" va antes que ":id" para que no lo tome como identificador.
      GoRoute(path: '/laboratorio/nuevo', builder: (_, _) => const LaboratorioFormPage()),
      GoRoute(
        path: '/laboratorio/:id/editar',
        builder: (_, state) => LaboratorioFormPage(inicial: state.extra as Laboratorio?),
      ),
      GoRoute(
        path: '/laboratorio/:id/distribucion',
        builder: (_, state) => EditorDistribucionPage(
          laboratorioId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
          titulo: state.extra as String? ?? '',
        ),
      ),
      GoRoute(
        path: '/laboratorio/:id',
        builder: (_, state) => LaboratorioDetallePage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      // Bitácora del laboratorio (con mapa pintado estilo OrganiLab).
      GoRoute(
        path: '/laboratorio/:id/bitacora',
        builder: (_, state) => BitacoraPage(laboratorioId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(
        path: '/bitacora/nueva',
        builder: (_, state) =>
            EntradaBitacoraFormPage(laboratorioId: int.tryParse(state.uri.queryParameters['lab'] ?? '') ?? 0),
      ),
      GoRoute(
        path: '/bitacora/:id',
        builder: (_, state) => EntradaBitacoraPage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(
        path: '/bitacora/:id/editar',
        builder: (_, state) => EntradaBitacoraFormPage(
          laboratorioId: 0,
          entradaId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
      GoRoute(path: '/reserva/nueva', builder: (_, _) => const ReservaNuevaPage()),
      GoRoute(path: '/objeto/nuevo', builder: (_, _) => const ObjetoNuevoPage()),
      GoRoute(
        path: '/objeto/:id',
        builder: (_, state) => ObjetoDetallePage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(path: '/notificaciones', builder: (_, _) => const NotificacionesPage()),
      GoRoute(path: '/notificaciones/preferencias', builder: (_, _) => const PreferenciasPushPage()),
      GoRoute(path: '/preferencias', builder: (_, _) => const PreferenciasPage()),
      GoRoute(path: '/solicitudes', builder: (_, _) => const SolicitudesPage()),
      GoRoute(path: '/asistencia/nueva', builder: (_, _) => const SolicitudNuevaPage()),
      GoRoute(
        path: '/asistencia/:id',
        builder: (_, state) => SolicitudDetallePage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(path: '/tarea/nueva', builder: (_, _) => const TareaNuevaPage()),
      GoRoute(
        path: '/tarea/:id',
        builder: (_, state) => TareaDetallePage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      // Inventario de activos fijos (se abre desde el menú de perfil con context.push).
      GoRoute(path: '/inventario', builder: (_, _) => const InventarioPage()),
      GoRoute(path: '/inventario/activo/nuevo', builder: (_, _) => const ActivoFormPage()),
      GoRoute(
        path: '/inventario/activo/:id/editar',
        builder: (_, state) => ActivoFormPage(inicial: state.extra as Activo?),
      ),
      GoRoute(
        path: '/inventario/activo/:id',
        builder: (_, state) => ActivoDetallePage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(path: '/inventario/verificacion/nueva', builder: (_, _) => const VerificacionNuevaPage()),
      GoRoute(
        path: '/inventario/verificacion/:id',
        builder: (_, state) => VerificacionDetallePage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(path: '/inventario/tipos', builder: (_, _) => const TiposActivoPage()),
      GoRoute(path: '/inventario/lugares', builder: (_, _) => const LugaresPage()),
      GoRoute(path: '/inventario/importar', builder: (_, _) => const ImportarActivosPage()),
      // Gestión de usuarios (desde el menú de perfil).
      GoRoute(path: '/usuarios', builder: (_, _) => const UsuariosPage()),
      GoRoute(path: '/usuarios/nuevo', builder: (_, _) => const UsuarioFormPage()),
      GoRoute(
        path: '/usuarios/:id',
        builder: (_, state) => UsuarioFormPage(inicial: state.extra as UsuarioAdmin?),
      ),
      // Catálogos de administración.
      GoRoute(path: '/elementos', builder: (_, _) => const ElementosCatalogoPage()),
      GoRoute(path: '/software', builder: (_, _) => const SoftwareCatalogoPage()),
      GoRoute(path: '/preferencias/opciones', builder: (_, _) => const PreferenciasOpcionesPage()),
      GoRoute(path: '/preferencias/docentes', builder: (_, _) => const PreferenciasDocentesPage()),
      GoRoute(
        path: '/preferencias/docente/editar',
        builder: (_, state) => PreferenciasDocenteEditorPage(preferencias: state.extra as Preferencias),
      ),
      // Planificación (horarios, periodos, materias y docentes).
      GoRoute(path: '/planificacion', builder: (_, _) => const PlanificacionPage()),
      GoRoute(path: '/planificacion/catalogos', builder: (_, _) => const CatalogosPlanificacionPage()),
      GoRoute(
        path: '/planificacion/horario/nuevo',
        builder: (_, state) => HorarioFormPage(periodoInicial: state.extra as int?),
      ),
      GoRoute(
        path: '/planificacion/horario/editar',
        builder: (_, state) => HorarioFormPage(grupo: state.extra as GrupoHorario?),
      ),
      // Revisiones periódicas.
      GoRoute(path: '/revisiones', builder: (_, _) => const RevisionesPage()),
      GoRoute(path: '/revision/nueva', builder: (_, _) => const RevisionFormPage()),
      GoRoute(
        path: '/revision/:id/editar',
        builder: (_, state) => RevisionFormPage(inicial: state.extra as Revision?),
      ),
      GoRoute(
        path: '/revision/:id',
        builder: (_, state) => RevisionDetallePage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      // Control de asistencia de auxiliares (entrada y salida con GPS y huella).
      GoRoute(path: '/mi-asistencia', builder: (_, _) => const MiAsistenciaPage()),
      GoRoute(path: '/mi-asistencia/historial', builder: (_, _) => const MisMarcacionesPage()),
      GoRoute(path: '/control-asistencia', builder: (_, _) => const ControlAsistenciaPage()),
      GoRoute(
        path: '/control-asistencia/marcacion/:id',
        builder: (_, state) => MarcacionDetallePage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(
        path: '/control-asistencia/lugar/nuevo',
        builder: (_, state) => LugarAsistenciaFormPage(primero: state.extra as bool? ?? false),
      ),
      GoRoute(
        path: '/control-asistencia/lugar/editar',
        builder: (_, state) => LugarAsistenciaFormPage(inicial: state.extra as LugarAsistencia?),
      ),
      GoRoute(
        path: '/control-asistencia/horario/nuevo',
        builder: (_, _) => const HorarioAsistenciaFormPage(),
      ),
      GoRoute(
        path: '/control-asistencia/horario/editar',
        builder: (_, state) => HorarioAsistenciaFormPage(inicial: state.extra as HorarioTrabajo?),
      ),
      GoRoute(path: '/respaldos', builder: (_, _) => const RespaldosPage()),
    ],
  );
});

class _PantallaCarga extends StatelessWidget {
  const _PantallaCarga();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset('assets/images/logo_ficct.png', height: 88),
            const SizedBox(height: 28),
            const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)),
          ],
        ),
      ),
    );
  }
}
