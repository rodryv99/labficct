import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../shared/widgets/comunes.dart';
import '../notificaciones/notificaciones_page.dart';
import '../perfil/perfil_sheet.dart';

Tono tonoDeLaboratorio(String estado) => switch (estado) {
      'operativo' => Tono.exito,
      'mantenimiento' => Tono.aviso,
      'cerrado' => Tono.peligro,
      _ => Tono.neutro,
    };

class LaboratoriosPage extends ConsumerStatefulWidget {
  const LaboratoriosPage({super.key});

  @override
  ConsumerState<LaboratoriosPage> createState() => _LaboratoriosPageState();
}

class _LaboratoriosPageState extends ConsumerState<LaboratoriosPage> {
  String _buscar = '';

  bool _coincide(Laboratorio l) {
    if (_buscar.isEmpty) return true;
    final t = _buscar.toLowerCase();
    return l.codigo.toLowerCase().contains(t) ||
        l.nombre.toLowerCase().contains(t) ||
        l.ubicacion.toLowerCase().contains(t);
  }

  @override
  Widget build(BuildContext context) {
    final laboratorios = ref.watch(laboratoriosProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Laboratorios'),
        actions: const [BotonNotificaciones(), BotonPerfil()],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              onChanged: (v) => setState(() => _buscar = v.trim()),
              decoration: const InputDecoration(
                hintText: 'Buscar por código, nombre o ubicación',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(laboratoriosProvider.future),
              child: laboratorios.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [
                  const SizedBox(height: 80),
                  EstadoError(error: e, onReintentar: () => ref.invalidate(laboratoriosProvider)),
                ]),
                data: (lista) {
                  final visibles = lista.where((l) => l.activo && _coincide(l)).toList();
                  if (visibles.isEmpty) {
                    return ListView(children: [
                      const SizedBox(height: 80),
                      EstadoVacio(
                        icono: Icons.computer_outlined,
                        titulo: _buscar.isEmpty ? 'Aún no hay laboratorios' : 'Sin resultados',
                        descripcion: _buscar.isEmpty
                            ? 'El administrador los crea y dibuja desde la web.'
                            : 'Prueba con otro código o nombre.',
                      ),
                    ]);
                  }
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: visibles.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _TarjetaLaboratorio(laboratorio: visibles[i]),
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

class _TarjetaLaboratorio extends StatelessWidget {
  const _TarjetaLaboratorio({required this.laboratorio});
  final Laboratorio laboratorio;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final l = laboratorio;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/laboratorio/${l.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: esquema.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.grid_view_rounded, color: esquema.onPrimaryContainer),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            l.codigo,
                            overflow: TextOverflow.ellipsis,
                            style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Etiqueta(l.estadoNombre, tono: tonoDeLaboratorio(l.estado)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(l.nombre, maxLines: 1, overflow: TextOverflow.ellipsis, style: tema.textTheme.bodyMedium),
                    const SizedBox(height: 4),
                    Text(
                      [
                        if (l.ubicacion.isNotEmpty) l.ubicacion,
                        '${l.capacidad} puestos',
                        '${l.totalElementos} elementos',
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: esquema.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
