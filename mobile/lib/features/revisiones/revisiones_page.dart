import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../shared/widgets/comunes.dart';

/// Etiqueta según qué tan cerca está la próxima fecha (null si está al día).
(String, Tono)? situacionRevision(Revision r) => switch (r.situacion) {
      'vencida' => ('Vencida', Tono.peligro),
      'hoy' => ('Hoy', Tono.aviso),
      'pronto' => ('Pronto', Tono.aviso),
      _ => null,
    };

class RevisionesPage extends ConsumerStatefulWidget {
  const RevisionesPage({super.key});

  @override
  ConsumerState<RevisionesPage> createState() => _RevisionesPageState();
}

class _RevisionesPageState extends ConsumerState<RevisionesPage> {
  bool _soloActivas = true;

  @override
  Widget build(BuildContext context) {
    final filtro = (laboratorio: null, activa: _soloActivas ? true : null);
    final revisiones = ref.watch(revisionesProvider(filtro));
    final puedeGestionar = ref.watch(sesionProvider).usuario?.puede('revisiones.gestionar') ?? false;

    return Scaffold(
      appBar: AppBar(title: const Text('Revisiones periódicas')),
      floatingActionButton: puedeGestionar
          ? FloatingActionButton.extended(
              onPressed: () async {
                final creada = await context.push<bool>('/revision/nueva');
                if (creada == true) ref.invalidate(revisionesProvider);
              },
              icon: const Icon(Icons.add),
              label: const Text('Revisión'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Row(
              children: [
                ChoiceChip(
                  label: const Text('Activas'),
                  selected: _soloActivas,
                  onSelected: (_) => setState(() => _soloActivas = true),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Todas'),
                  selected: !_soloActivas,
                  onSelected: (_) => setState(() => _soloActivas = false),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(revisionesProvider(filtro).future),
              child: revisiones.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [
                  const SizedBox(height: 80),
                  EstadoError(error: e, onReintentar: () => ref.invalidate(revisionesProvider)),
                ]),
                data: (lista) {
                  if (lista.isEmpty) {
                    return ListView(children: const [
                      SizedBox(height: 80),
                      EstadoVacio(
                        icono: Icons.fact_check_outlined,
                        titulo: 'Sin revisiones',
                        descripcion: 'Programa revisiones periódicas de los laboratorios con el botón +.',
                      ),
                    ]);
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
                    itemCount: lista.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _TarjetaRevision(revision: lista[i]),
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

class _TarjetaRevision extends ConsumerWidget {
  const _TarjetaRevision({required this.revision});
  final Revision revision;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = revision;
    final tema = Theme.of(context);
    final situacion = situacionRevision(r);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () async {
          await context.push('/revision/${r.id}');
          ref.invalidate(revisionesProvider);
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(r.titulo,
                        style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  ),
                  if (!r.activa) const Etiqueta('Inactiva', tono: Tono.neutro),
                  if (situacion != null) ...[
                    const SizedBox(width: 6),
                    Etiqueta(situacion.$1, tono: situacion.$2),
                  ],
                ],
              ),
              const SizedBox(height: 4),
              Text('${r.laboratorioCodigo} · ${r.frecuencia}', style: tema.textTheme.bodyMedium),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.event, size: 16),
                  const SizedBox(width: 6),
                  Text('Próxima: ${r.proximaFecha}'),
                  if (r.responsableNombre.isNotEmpty) ...[
                    const SizedBox(width: 12),
                    const Icon(Icons.person_outline, size: 16),
                    const SizedBox(width: 6),
                    Flexible(child: Text(r.responsableNombre, overflow: TextOverflow.ellipsis)),
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
