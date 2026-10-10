import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/asistencia/asistencia_page.dart';
import '../../features/asistencia/solicitud_detalle_page.dart';
import '../../features/asistencia/solicitud_nueva_page.dart';
import '../../features/auth/login_page.dart';
import '../../features/clases/clases_page.dart';
import '../../features/inicio/inicio_page.dart';
import '../../features/laboratorios/laboratorio_detalle_page.dart';
import '../../features/laboratorios/laboratorios_page.dart';
import '../../features/notificaciones/notificaciones_page.dart';
import '../../features/objetos/objeto_detalle_page.dart';
import '../../features/objetos/objeto_nuevo_page.dart';
import '../../features/objetos/objetos_page.dart';
import '../../features/preferencias/preferencias_page.dart';
import '../../features/reservas/reserva_nueva_page.dart';
import '../../features/reservas/reservas_page.dart';
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
      const Pestana('/asistencia', 'Asistencia', Icons.support_agent_outlined, Icons.support_agent),
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
      GoRoute(
        path: '/laboratorio/:id',
        builder: (_, state) => LaboratorioDetallePage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(path: '/reserva/nueva', builder: (_, _) => const ReservaNuevaPage()),
      GoRoute(path: '/objeto/nuevo', builder: (_, _) => const ObjetoNuevoPage()),
      GoRoute(
        path: '/objeto/:id',
        builder: (_, state) => ObjetoDetallePage(id: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(path: '/notificaciones', builder: (_, _) => const NotificacionesPage()),
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
