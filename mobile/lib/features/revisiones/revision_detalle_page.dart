import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'revisiones_page.dart';

class RevisionDetallePage extends ConsumerWidget {
  const RevisionDetallePage({super.key, required this.id});
  final int id;

  Future<void> _realizar(BuildContext context, WidgetRef ref) async {
    final nota = await pedirTexto(
      context,
      titulo: 'Registrar revisión',
      mensaje: 'Se deja una entrada en la bitácora y se calcula la próxima fecha.',
      etiqueta: 'Qué se revisó y qué se encontró',
      boton: 'Registrar',
      maximo: 2000,
    );
    if (nota == null) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).realizarRevision(id, nota);
      contenedor.invalidate(revisionProvider(id));
      refrescarRevisiones(contenedor);
      if (context.mounted) avisar(context, 'Revisión registrada.');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<void> _eliminar(BuildContext context, WidgetRef ref, Revision r) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('¿Borrar revisión?'),
        content: Text('Se eliminará "${r.titulo}".'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Cancelar')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(d, true),
            child: const Text('Borrar'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarRevision(id);
      refrescarRevisiones(contenedor);
      if (context.mounted) {
        avisar(context, 'Revisión borrada.');
        context.pop();
      }
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final revision = ref.watch(revisionProvider(id));
    final usuario = ref.watch(sesionProvider).usuario;
    final puedeGestionar = usuario?.puede('revisiones.gestionar') ?? false;
    final puedeRealizar = usuario?.puede('revisiones.realizar') ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Revisión'),
        actions: [
          if (puedeGestionar)
            revision.maybeWhen(
              data: (r) => PopupMenuButton<String>(
                onSelected: (v) async {
                  if (v == 'editar') {
                    final cambio = await context.push<bool>('/revision/${r.id}/editar', extra: r);
                    if (cambio == true) ref.invalidate(revisionProvider(id));
                  } else {
                    _eliminar(context, ref, r);
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'editar', child: Text('Editar')),
                  PopupMenuItem(value: 'borrar', child: Text('Borrar')),
                ],
              ),
              orElse: () => const SizedBox.shrink(),
            ),
        ],
      ),
      body: revision.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoError(error: e, onReintentar: () => ref.invalidate(revisionProvider(id))),
        data: (r) {
          final situacion = situacionRevision(r);
          final tema = Theme.of(context);
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(r.titulo, style: tema.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                  ),
                  if (situacion != null) Etiqueta(situacion.$1, tono: situacion.$2),
                ],
              ),
              const SizedBox(height: 4),
              Text('${r.laboratorioCodigo} · ${r.laboratorioNombre}',
                  style: tema.textTheme.bodyMedium?.copyWith(color: tema.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 16),
              if (r.tareaAbierta != null)
                Card(
                  color: tema.colorScheme.tertiaryContainer,
                  child: ListTile(
                    leading: const Icon(Icons.assignment_outlined),
                    title: const Text('Ya tiene una tarea abierta'),
                    subtitle: const Text('Esta revisión venció y está en el pizarrón.'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/tarea/${r.tareaAbierta}'),
                  ),
                ),
              Card(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _fila('Frecuencia', r.frecuencia),
                      _fila('Próxima fecha', r.proximaFecha),
                      _fila('Última vez', r.ultimaFecha.isEmpty ? 'Nunca' : r.ultimaFecha),
                      _fila('Responsable', r.responsableNombre.isEmpty ? 'Todos los auxiliares' : r.responsableNombre),
                      _fila('Estado', r.activa ? 'Activa' : 'Inactiva'),
                    ],
                  ),
                ),
              ),
              if (r.instrucciones.isNotEmpty) ...[
                const TituloSeccion('Instrucciones'),
                Text(r.instrucciones, style: tema.textTheme.bodyLarge),
              ],
            ],
          );
        },
      ),
      bottomNavigationBar: puedeRealizar
          ? revision.maybeWhen(
              data: (r) => Padding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + MediaQuery.of(context).padding.bottom),
                child: FilledButton.icon(
                  onPressed: () => _realizar(context, ref),
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Registrar que se hizo'),
                ),
              ),
              orElse: () => const SizedBox.shrink(),
            )
          : null,
    );
  }

  Widget _fila(String titulo, String valor) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 120, child: Text(titulo)),
            Expanded(child: Text(valor, style: const TextStyle(fontWeight: FontWeight.w600))),
          ],
        ),
      );
}
