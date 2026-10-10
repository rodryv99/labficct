import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../core/router/router.dart';
import '../../shared/widgets/comunes.dart';

/// Campana de la barra superior, con el número de avisos sin leer.
/// Va en cada pestaña, justo antes de [BotonPerfil].
class BotonNotificaciones extends ConsumerWidget {
  const BotonNotificaciones({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final noLeidas = ref.watch(resumenNotificacionesProvider).value?.noLeidas ?? 0;
    return IconButton(
      tooltip: noLeidas == 0 ? 'Notificaciones' : 'Notificaciones: $noLeidas sin leer',
      onPressed: () => context.push('/notificaciones'),
      icon: Badge(
        isLabelVisible: noLeidas > 0,
        label: Text(noLeidas > 99 ? '99+' : '$noLeidas'),
        child: Icon(noLeidas > 0 ? Icons.notifications : Icons.notifications_outlined),
      ),
    );
  }
}

/// Cuando llega una notificación nueva (no en la primera carga), refresca lo que
/// puede haber cambiado y la anuncia abajo. Se llama desde el build del marco de pestañas.
void escucharNotificacionesNuevas(BuildContext context, WidgetRef ref) {
  ref.listen<AsyncValue<ResumenNotificaciones>>(resumenNotificacionesProvider, (anterior, siguiente) {
    final antes = anterior?.value;
    final ahora = siguiente.value;
    if (antes == null || ahora == null) return;
    final nueva = ahora.ultimaId;
    final previa = antes.ultimaId;
    if (nueva == null || (previa != null && nueva <= previa)) return;

    final usuario = ref.read(sesionProvider).usuario;
    ref.invalidate(notificacionesProvider);
    if (usuario?.puede('asistencia.ver') ?? false) {
      ref.invalidate(solicitudesProvider);
      ref.invalidate(solicitudesAbiertasProvider);
    }
    if (usuario?.puede('tareas.ver') ?? false) ref.invalidate(tareasProvider);
    _anunciar(context, ref.read(repositorioProvider));
  });
}

Future<void> _anunciar(BuildContext context, Repositorio repo) async {
  final mensajero = ScaffoldMessenger.maybeOf(context);
  final router = GoRouter.maybeOf(context);
  if (mensajero == null) return;
  var titulo = 'Tienes una notificación nueva.';
  try {
    final ultimas = await repo.notificaciones(soloNoLeidas: true, cantidad: 1);
    if (ultimas.isNotEmpty && ultimas.first.titulo.isNotEmpty) titulo = ultimas.first.titulo;
  } catch (_) {
    // Sin el título, se avisa igual con el texto genérico.
  }
  if (!context.mounted) return;
  mensajero
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(titulo, maxLines: 2, overflow: TextOverflow.ellipsis),
        behavior: SnackBarBehavior.floating,
        action: router == null ? null : SnackBarAction(label: 'Ver', onPressed: () => router.push('/notificaciones')),
      ),
    );
}

IconData iconoDeNotificacion(String tipo) => switch (tipo) {
      'alistar' => Icons.door_front_door_outlined,
      'cerrar' => Icons.lock_outline,
      'asistencia' => Icons.support_agent,
      'reserva' => Icons.event_available_outlined,
      'clase' => Icons.school_outlined,
      'revision' => Icons.fact_check,
      'tarea' => Icons.task_alt,
      _ => Icons.notifications_none,
    };

/// A dónde lleva una notificación. [pestana]: se abre con go (cambia de pestaña);
/// si no, se apila con push. null = no hay pantalla para eso en la app.
typedef DestinoNotificacion = ({String ruta, bool pestana});

DestinoNotificacion? destinoDeNotificacion(Notificacion n, Usuario u) {
  final pestanas = {for (final p in pestanasDe(u)) p.ruta};
  final fecha = n.datoTexto('fecha');
  final hoy = fecha.isEmpty ? '/hoy' : '/hoy?fecha=$fecha';

  final solicitud = n.datoEntero('solicitud_id');
  if (solicitud != null && u.puede('asistencia.ver')) return (ruta: '/asistencia/$solicitud', pestana: false);

  final tarea = n.datoEntero('tarea_id');
  if (tarea != null && u.puede('tareas.ver')) return (ruta: '/tarea/$tarea', pestana: false);

  // Alistar o cerrar un aula: la pizarra del día.
  if (n.datoTexto('evento').isNotEmpty && pestanas.contains('/hoy')) return (ruta: hoy, pestana: true);

  if (n.datoEntero('horario_id') != null) {
    if (pestanas.contains('/clases')) return (ruta: '/clases', pestana: true);
    if (pestanas.contains('/hoy')) return (ruta: hoy, pestana: true);
  }

  if (n.datoEntero('reserva_id') != null && pestanas.contains('/reservas')) {
    return (ruta: '/reservas', pestana: true);
  }
  return null;
}

/// Mensaje completo de una notificación, cuando no hay otra pantalla que abrir.
Future<void> mostrarNotificacion(BuildContext context, Notificacion n) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (hoja) {
      final tema = Theme.of(hoja);
      final esquema = tema.colorScheme;
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Etiqueta(n.tipoNombre.isEmpty ? 'Aviso' : n.tipoNombre, tono: Tono.marca),
            const SizedBox(height: 10),
            Text(n.titulo, style: tema.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              fechaHora(n.creadoEn),
              style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
            ),
            if (n.mensaje.isNotEmpty) ...[
              const SizedBox(height: 14),
              SelectableText(n.mensaje, style: tema.textTheme.bodyLarge),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(onPressed: () => Navigator.pop(hoja), child: const Text('Cerrar')),
            ),
          ],
        ),
      );
    },
  );
}

/// Todas las notificaciones (las 50 más recientes). Al tocar una se marca como leída
/// y se abre lo que corresponde.
class NotificacionesPage extends ConsumerStatefulWidget {
  const NotificacionesPage({super.key});

  @override
  ConsumerState<NotificacionesPage> createState() => _NotificacionesPageState();
}

class _NotificacionesPageState extends ConsumerState<NotificacionesPage> {
  bool _marcando = false;

  void _refrescarCampana(ProviderContainer contenedor) {
    contenedor.invalidate(notificacionesProvider);
    contenedor.invalidate(resumenNotificacionesProvider);
  }

  Future<void> _marcarTodas() async {
    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _marcando = true);
    try {
      final marcadas = await ref.read(repositorioProvider).leerTodasNotificaciones();
      _refrescarCampana(contenedor);
      if (mounted) avisar(context, marcadas == 0 ? 'Ya estaba todo leído.' : 'Listo, todo quedó como leído.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _marcando = false);
    }
  }

  Future<void> _abrir(Notificacion n) async {
    final usuario = ref.read(sesionProvider).usuario;
    if (usuario == null) return;
    if (!n.leida) {
      final contenedor = ProviderScope.containerOf(context, listen: false);
      try {
        await ref.read(repositorioProvider).leerNotificacion(n.id);
      } catch (_) {
        // Si no se pudo marcar, se abre igual y queda como no leída.
      }
      _refrescarCampana(contenedor);
    }
    if (!mounted) return;
    final destino = destinoDeNotificacion(n, usuario);
    if (destino == null) {
      await mostrarNotificacion(context, n);
    } else if (destino.pestana) {
      context.go(destino.ruta);
    } else {
      context.push(destino.ruta);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lista = ref.watch(notificacionesProvider);
    final noLeidas = ref.watch(resumenNotificacionesProvider).value?.noLeidas ?? 0;
    final hayNoLeidas = noLeidas > 0 || (lista.value?.any((n) => !n.leida) ?? false);

    // Si llega algo mientras la lista está abierta, se muestra sin tener que deslizar.
    ref.listen<AsyncValue<ResumenNotificaciones>>(resumenNotificacionesProvider, (anterior, siguiente) {
      final antes = anterior?.value;
      final nueva = siguiente.value?.ultimaId;
      if (antes == null || nueva == null) return;
      if (antes.ultimaId == null || nueva > antes.ultimaId!) ref.invalidate(notificacionesProvider);
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          IconButton(
            tooltip: 'Marcar todas como leídas',
            onPressed: hayNoLeidas && !_marcando ? _marcarTodas : null,
            icon: _marcando
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.done_all),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () {
          ref.invalidate(resumenNotificacionesProvider);
          return ref.refresh(notificacionesProvider.future);
        },
        child: lista.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(notificacionesProvider)),
          ]),
          data: (items) {
            if (items.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 80),
                EstadoVacio(
                  icono: Icons.notifications_none,
                  titulo: 'No tienes notificaciones',
                  descripcion: 'Aquí te avisaremos de reservas, solicitudes de asistencia, tareas y más.',
                ),
              ]);
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (_, i) => _TarjetaNotificacion(notificacion: items[i], onTap: () => _abrir(items[i])),
            );
          },
        ),
      ),
    );
  }
}

class _TarjetaNotificacion extends StatelessWidget {
  const _TarjetaNotificacion({required this.notificacion, required this.onTap});
  final Notificacion notificacion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final n = notificacion;
    final nueva = !n.leida;

    return Card(
      clipBehavior: Clip.antiAlias,
      color: nueva ? esquema.primaryContainer.withValues(alpha: 0.35) : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: nueva ? esquema.primary.withValues(alpha: 0.45) : esquema.outlineVariant),
      ),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: nueva ? esquema.primary : esquema.surfaceContainerHigh,
                child: Icon(
                  iconoDeNotificacion(n.tipo),
                  size: 18,
                  color: nueva ? esquema.onPrimary : esquema.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            n.titulo,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: tema.textTheme.titleSmall?.copyWith(
                              fontWeight: nueva ? FontWeight.w700 : FontWeight.w500,
                            ),
                          ),
                        ),
                        if (nueva)
                          Container(
                            margin: const EdgeInsets.only(left: 8, top: 6),
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(color: esquema.primary, shape: BoxShape.circle),
                          ),
                      ],
                    ),
                    if (n.mensaje.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          n.mensaje,
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                          style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
                        ),
                      ),
                    const SizedBox(height: 6),
                    Text(
                      [if (n.tipoNombre.isNotEmpty) n.tipoNombre, haceCuanto(n.creadoEn)].join(' · '),
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
