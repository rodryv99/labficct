import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../shared/widgets/comunes.dart';
import '../notificaciones/notificaciones_page.dart';
import '../perfil/perfil_sheet.dart';

/// Mismas categorías que el backend (CategoriaAsistencia).
const categoriasAsistencia = <String, (String, IconData)>{
  'equipo': ('Computadora o equipo', Icons.computer_outlined),
  'proyector': ('Proyector o audio', Icons.videocam_outlined),
  'red': ('Internet o red', Icons.wifi),
  'software': ('Programas', Icons.apps_outlined),
  'acceso': ('Abrir o cerrar el aula', Icons.key_outlined),
  'otro': ('Otro', Icons.help_outline),
};

IconData iconoDeCategoria(String categoria) => categoriasAsistencia[categoria]?.$2 ?? Icons.help_outline;

Tono tonoDeSolicitud(String estado) => switch (estado) {
      'pendiente' => Tono.aviso,
      'en_curso' => Tono.info,
      'resuelta' => Tono.exito,
      _ => Tono.neutro,
    };

/// Urgentes primero, luego las que nadie tomó, y dentro de eso las más nuevas.
int _porPrioridad(SolicitudAsistencia a, SolicitudAsistencia b) {
  if (a.urgente != b.urgente) return a.urgente ? -1 : 1;
  if (a.pendiente != b.pendiente) return a.pendiente ? -1 : 1;
  return b.creadoEn.compareTo(a.creadoEn);
}

/// Pestaña de docentes y administrativos: sus pedidos de ayuda y el botón para pedir uno nuevo.
class AsistenciaPage extends ConsumerWidget {
  const AsistenciaPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final puedePedir = ref.watch(sesionProvider).usuario?.puede('asistencia.solicitar') ?? false;
    final solicitudes = ref.watch(solicitudesProvider(null));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistencia'),
        actions: const [BotonNotificaciones(), BotonPerfil()],
      ),
      floatingActionButton: puedePedir
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/asistencia/nueva'),
              icon: const Icon(Icons.support_agent),
              label: const Text('Pedir asistencia'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(solicitudesProvider(null).future),
        child: solicitudes.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(solicitudesProvider(null))),
          ]),
          data: (lista) {
            if (lista.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 80),
                EstadoVacio(
                  icono: Icons.support_agent,
                  titulo: 'No has pedido asistencia',
                  descripcion: '¿Falla el proyector o necesitas que abran el aula? '
                      'Pide ayuda y un auxiliar irá a verte.',
                ),
              ]);
            }
            final abiertas = lista.where((s) => s.abierta).toList()..sort(_porPrioridad);
            final cerradas = lista.where((s) => !s.abierta).toList();
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
              children: [
                if (abiertas.isNotEmpty) ...[
                  const TituloSeccion('Abiertas'),
                  for (final s in abiertas) ...[TarjetaSolicitud(solicitud: s), const SizedBox(height: 10)],
                ],
                if (cerradas.isNotEmpty) ...[
                  const TituloSeccion('Anteriores'),
                  for (final s in cerradas) ...[TarjetaSolicitud(solicitud: s), const SizedBox(height: 10)],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Para auxiliares y Admin: todas las solicitudes, abiertas o cerradas.
class SolicitudesPage extends ConsumerStatefulWidget {
  const SolicitudesPage({super.key});

  @override
  ConsumerState<SolicitudesPage> createState() => _SolicitudesPageState();
}

class _SolicitudesPageState extends ConsumerState<SolicitudesPage> {
  bool _abiertas = true;

  @override
  Widget build(BuildContext context) {
    final solicitudes = ref.watch(solicitudesProvider(_abiertas));

    return Scaffold(
      appBar: AppBar(title: const Text('Solicitudes de asistencia')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: SizedBox(
              width: double.infinity,
              child: SegmentedButton<bool>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: true, label: Text('Abiertas')),
                  ButtonSegment(value: false, label: Text('Cerradas')),
                ],
                selected: {_abiertas},
                onSelectionChanged: (s) => setState(() => _abiertas = s.first),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () {
                ref.invalidate(solicitudesAbiertasProvider);
                return ref.refresh(solicitudesProvider(_abiertas).future);
              },
              child: solicitudes.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [
                  const SizedBox(height: 80),
                  EstadoError(error: e, onReintentar: () => ref.invalidate(solicitudesProvider(_abiertas))),
                ]),
                data: (lista) {
                  if (lista.isEmpty) {
                    return ListView(children: [
                      const SizedBox(height: 80),
                      _abiertas
                          ? const EstadoVacio(
                              icono: Icons.check_circle_outline,
                              titulo: 'Nadie necesita ayuda ahora',
                              descripcion: 'Cuando un docente o administrativo pida asistencia, te llegará un aviso.',
                            )
                          : const EstadoVacio(icono: Icons.history, titulo: 'Sin solicitudes cerradas'),
                    ]);
                  }
                  final visibles = _abiertas ? ([...lista]..sort(_porPrioridad)) : lista;
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: visibles.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => TarjetaSolicitud(solicitud: visibles[i], mostrarSolicitante: true),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Una solicitud en la lista. Al tocarla se abre el detalle.
class TarjetaSolicitud extends StatelessWidget {
  const TarjetaSolicitud({super.key, required this.solicitud, this.mostrarSolicitante = false});

  final SolicitudAsistencia solicitud;
  final bool mostrarSolicitante;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final s = solicitud;
    final resaltar = s.urgente && s.abierta;
    final pie = [
      if (s.donde.isNotEmpty) s.donde,
      if (mostrarSolicitante && s.solicitanteNombre.isNotEmpty) s.solicitanteNombre,
      haceCuanto(s.creadoEn),
    ].join(' · ');

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: resaltar ? esquema.error : esquema.outlineVariant, width: resaltar ? 1.5 : 1),
      ),
      child: InkWell(
        onTap: () => context.push('/asistencia/${s.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: s.abierta ? esquema.primaryContainer : esquema.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  iconoDeCategoria(s.categoria),
                  color: s.abierta ? esquema.onPrimaryContainer : esquema.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            s.categoriaNombre,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Etiqueta(s.estadoNombre, tono: tonoDeSolicitud(s.estado)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(s.descripcion, maxLines: 2, overflow: TextOverflow.ellipsis, style: tema.textTheme.bodyMedium),
                    const SizedBox(height: 6),
                    Text(
                      pie,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                    ),
                    if (s.urgente || (s.enCurso && s.atendidaPorNombre.isNotEmpty)) ...[
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (s.urgente) const Etiqueta('Urgente', tono: Tono.peligro),
                          if (s.enCurso && s.atendidaPorNombre.isNotEmpty)
                            Etiqueta('Va ${s.atendidaPorNombre}', tono: Tono.info),
                        ],
                      ),
                    ],
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
