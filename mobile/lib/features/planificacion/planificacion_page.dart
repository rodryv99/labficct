import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/datos/proveedores.dart';
import '../../shared/widgets/comunes.dart';
import 'planificacion_comun.dart';

class PlanificacionPage extends ConsumerStatefulWidget {
  const PlanificacionPage({super.key});

  @override
  ConsumerState<PlanificacionPage> createState() => _PlanificacionPageState();
}

class _PlanificacionPageState extends ConsumerState<PlanificacionPage> {
  int? _periodo;
  bool _periodoFijado = false;
  String _buscar = '';
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final periodos = ref.watch(periodosProvider);
    // La primera vez, selecciona el periodo vigente.
    if (!_periodoFijado) {
      final lista = periodos.value;
      if (lista != null) {
        _periodo = (lista.where((p) => p.vigente).firstOrNull ?? lista.firstOrNull)?.id;
        _periodoFijado = true;
      }
    }
    final filtro = (periodo: _periodo, laboratorio: null, diaSemana: null, buscar: _buscar);
    final horarios = ref.watch(horariosGestionProvider(filtro));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Planificación'),
        actions: [
          IconButton(
            tooltip: 'Periodos, materias y docentes',
            icon: const Icon(Icons.folder_open_outlined),
            onPressed: () => context.push('/planificacion/catalogos'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final creado = await context.push<bool>('/planificacion/horario/nuevo', extra: _periodo);
          if (creado == true) ref.invalidate(horariosGestionProvider);
        },
        icon: const Icon(Icons.add),
        label: const Text('Clase'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Row(
              children: [
                Expanded(
                  child: periodos.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (_, _) => const Text('No se pudieron cargar los periodos.'),
                    data: (lista) => DropdownButtonFormField<int?>(
                      initialValue: _periodo,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Periodo', isDense: true),
                      items: [
                        const DropdownMenuItem(value: null, child: Text('Todos los periodos')),
                        for (final p in lista)
                          DropdownMenuItem(value: p.id, child: Text(p.vigente ? '${p.nombre} (vigente)' : p.nombre)),
                      ],
                      onChanged: (v) => setState(() => _periodo = v),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Buscar por materia, grupo o docente',
                prefixIcon: Icon(Icons.search),
                isDense: true,
              ),
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 350), () => setState(() => _buscar = v.trim()));
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(horariosGestionProvider(filtro).future),
              child: horarios.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [
                  const SizedBox(height: 80),
                  EstadoError(error: e, onReintentar: () => ref.invalidate(horariosGestionProvider)),
                ]),
                data: (lista) {
                  final grupos = agruparHorarios(lista);
                  if (grupos.isEmpty) {
                    return ListView(children: const [
                      SizedBox(height: 80),
                      EstadoVacio(
                        icono: Icons.event_busy_outlined,
                        titulo: 'Sin clases',
                        descripcion: 'Agrega la primera clase de este periodo con el botón +.',
                      ),
                    ]);
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
                    itemCount: grupos.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _TarjetaClase(grupo: grupos[i]),
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

class _TarjetaClase extends ConsumerWidget {
  const _TarjetaClase({required this.grupo});
  final GrupoHorario grupo;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final b = grupo.base;
    final tema = Theme.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () async {
          final cambio = await context.push<bool>('/planificacion/horario/editar', extra: grupo);
          if (cambio == true) ref.invalidate(horariosGestionProvider);
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('${b.materiaSigla} · ${b.grupo}',
                        style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  ),
                  if (!b.activo) const Etiqueta('Inactiva', tono: Tono.neutro),
                ],
              ),
              if (b.materiaNombre.isNotEmpty)
                Text(b.materiaNombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: tema.textTheme.bodyMedium),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.schedule, size: 16),
                  const SizedBox(width: 6),
                  Text('${horaCorta(b.horaInicio)}–${horaCorta(b.horaFin)}'),
                  const SizedBox(width: 12),
                  const Icon(Icons.event, size: 16),
                  const SizedBox(width: 6),
                  Flexible(child: Text(nombreDias(grupo.dias), overflow: TextOverflow.ellipsis)),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                [
                  b.laboratorioCodigo,
                  if (b.docenteNombre.isNotEmpty) b.docenteNombre,
                ].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
