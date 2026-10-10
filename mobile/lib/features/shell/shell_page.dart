import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/router/router.dart';
import '../notificaciones/notificaciones_page.dart';

/// Marco de las pestañas: el contenido arriba y la barra de navegación abajo.
class ShellPage extends ConsumerWidget {
  const ShellPage({super.key, required this.ubicacion, required this.child});

  final String ubicacion;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Avisa abajo cuando llega una notificación nueva.
    escucharNotificacionesNuevas(context, ref);

    final usuario = ref.watch(sesionProvider).usuario;
    if (usuario == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final pestanas = pestanasDe(usuario);
    final indice = pestanas.indexWhere((p) => ubicacion.startsWith(p.ruta));

    return Scaffold(
      body: child,
      bottomNavigationBar: pestanas.length < 2
          ? null
          : NavigationBar(
              selectedIndex: indice < 0 ? 0 : indice,
              onDestinationSelected: (i) => context.go(pestanas[i].ruta),
              destinations: [
                for (final p in pestanas)
                  NavigationDestination(icon: Icon(p.icono), selectedIcon: Icon(p.iconoActivo), label: p.etiqueta),
              ],
            ),
    );
  }
}
