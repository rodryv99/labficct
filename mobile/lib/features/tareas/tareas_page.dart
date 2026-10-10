import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../shared/widgets/comunes.dart';
import '../notificaciones/notificaciones_page.dart';
import '../perfil/perfil_sheet.dart';

/// Columnas del pizarrón, en orden (mismos valores que el backend).
const estadosTarea = <(String, String)>[
  ('pendiente', 'Pendiente'),
  ('en_progreso', 'En progreso'),
  ('hecha', 'Hecha'),
];

String nombreDeEstadoTarea(String estado) =>
    estadosTarea.where((e) => e.$1 == estado).map((e) => e.$2).firstOrNull ?? estado;

Tono tonoDeTarea(String estado) => switch (estado) {
      'pendiente' => Tono.aviso,
      'en_progreso' => Tono.info,
      'hecha' => Tono.exito,
      _ => Tono.neutro,
    };

/// "Vence 3 oct" o "Venció 1 oct".
String textoFechaLimite(Tarea t) {
  final fecha = DateTime.tryParse(t.fechaLimite ?? '');
  if (fecha == null) return '';
  final dia = DateFormat('d MMM', 'es').format(fecha);
  return t.vencida ? 'Venció $dia' : 'Vence $dia';
}

int _rangoPrioridad(String p) => switch (p) {
      'alta' => 0,
      'normal' => 1,
      _ => 2,
    };

/// Alta prioridad primero, luego las que vencen antes; las hechas, las más recientes arriba.
int _orden(Tarea a, Tarea b) {
  if (a.hecha && b.hecha) {
    return (b.completadaEn ?? b.creadoEn).compareTo(a.completadaEn ?? a.creadoEn);
  }
  final prioridad = _rangoPrioridad(a.prioridad).compareTo(_rangoPrioridad(b.prioridad));
  if (prioridad != 0) return prioridad;
  final fa = a.fechaLimite;
  final fb = b.fechaLimite;
  if (fa != fb) {
    if (fa == null) return 1;
    if (fb == null) return -1;
    return fa.compareTo(fb);
  }
  return b.creadoEn.compareTo(a.creadoEn);
}

/// Pizarrón de tareas de Admin y auxiliares, agrupado por columna.
class TareasPage extends ConsumerStatefulWidget {
  const TareasPage({super.key});

  @override
  ConsumerState<TareasPage> createState() => _TareasPageState();
}

class _TareasPageState extends ConsumerState<TareasPage> {
  /// null = todas las columnas.
  String? _estado;
  bool _soloMias = false;

  @override
  Widget build(BuildContext context) {
    final usuario = ref.watch(sesionProvider).usuario;
    final puedeCrear = usuario?.puede('tareas.gestionar') ?? false;
    final tareas = ref.watch(tareasProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tareas'),
        actions: const [BotonNotificaciones(), BotonPerfil()],
      ),
      floatingActionButton: puedeCrear
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/tarea/nueva'),
              icon: const Icon(Icons.add),
              label: const Text('Nueva tarea'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(tareasProvider.future),
        child: tareas.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(tareasProvider)),
          ]),
          data: (todas) {
            final mias = _soloMias && usuario != null
                ? todas.where((t) => t.responsables.contains(usuario.id)).toList()
                : todas;
            final porEstado = {
              for (final (valor, _) in estadosTarea) valor: mias.where((t) => t.estado == valor).toList()..sort(_orden),
            };
            final columnas = [for (final e in estadosTarea) if (_estado == null || _estado == e.$1) e];
            final hayAlgo = columnas.any((c) => porEstado[c.$1]!.isNotEmpty);

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 96),
              children: [
                SizedBox(
                  height: 48,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: FilterChip(
                          avatar: _soloMias ? null : const Icon(Icons.person_outline, size: 18),
                          label: const Text('Solo mías'),
                          selected: _soloMias,
                          onSelected: (v) => setState(() => _soloMias = v),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text('Todas · ${mias.length}'),
                          selected: _estado == null,
                          onSelected: (_) => setState(() => _estado = null),
                        ),
                      ),
                      for (final (valor, nombre) in estadosTarea)
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text('$nombre · ${porEstado[valor]!.length}'),
                            selected: _estado == valor,
                            onSelected: (_) => setState(() => _estado = valor),
                          ),
                        ),
                    ],
                  ),
                ),
                if (!hayAlgo)
                  Padding(
                    padding: const EdgeInsets.only(top: 60),
                    child: EstadoVacio(
                      icono: Icons.task_alt,
                      titulo: _soloMias ? 'No tienes tareas aquí' : 'Nada por aquí',
                      descripcion: todas.isEmpty && puedeCrear
                          ? 'Anota lo que haya que hacer en los laboratorios con el botón Nueva tarea.'
                          : null,
                    ),
                  )
                else
                  for (final (valor, nombre) in columnas)
                    if (porEstado[valor]!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TituloSeccion('$nombre (${porEstado[valor]!.length})'),
                            for (final t in porEstado[valor]!) ...[
                              TarjetaTarea(tarea: t),
                              const SizedBox(height: 10),
                            ],
                          ],
                        ),
                      ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Una tarjeta del pizarrón.
class TarjetaTarea extends StatelessWidget {
  const TarjetaTarea({super.key, required this.tarea});
  final Tarea tarea;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final t = tarea;
    final vence = textoFechaLimite(t);
    final avanza = t.progreso > 0 && t.progreso < 100;

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: t.alta && !t.hecha ? esquema.error : esquema.outlineVariant,
          width: t.alta && !t.hecha ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        onTap: () => context.push('/tarea/${t.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                t.titulo,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: tema.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  decoration: t.hecha ? TextDecoration.lineThrough : null,
                  color: t.hecha ? esquema.onSurfaceVariant : null,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  if (t.alta) const Etiqueta('Prioridad alta', tono: Tono.peligro),
                  if (t.prioridad == 'baja') const Etiqueta('Baja'),
                  if (t.laboratorioCodigo.isNotEmpty) Etiqueta(t.laboratorioCodigo, tono: Tono.marca),
                  if (vence.isNotEmpty) Etiqueta(vence, tono: t.vencida ? Tono.peligro : Tono.neutro),
                  if (t.revision != null) const Etiqueta('Revisión periódica', tono: Tono.info),
                ],
              ),
              if (avanza) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(value: t.progreso / 100, minHeight: 6),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text('${t.progreso} %', style: tema.textTheme.labelMedium),
                  ],
                ),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.people_outline, size: 16, color: esquema.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      t.responsablesNombres.isEmpty ? 'Sin responsables' : t.responsablesNombres.join(', '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                    ),
                  ),
                  if (t.totalAvances > 0) ...[
                    const SizedBox(width: 8),
                    Icon(Icons.chat_bubble_outline, size: 15, color: esquema.onSurfaceVariant),
                    const SizedBox(width: 4),
                    Text(
                      '${t.totalAvances}',
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
