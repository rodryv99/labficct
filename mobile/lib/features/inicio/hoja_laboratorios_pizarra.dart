import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/repositorio.dart';

/// Abre la hoja para elegir qué laboratorios muestra la pizarra y en qué orden.
Future<void> mostrarHojaLaboratoriosPizarra(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _HojaLaboratoriosPizarra(),
  );
}

class _HojaLaboratoriosPizarra extends ConsumerStatefulWidget {
  const _HojaLaboratoriosPizarra();

  @override
  ConsumerState<_HojaLaboratoriosPizarra> createState() => _HojaLaboratoriosPizarraState();
}

class _HojaLaboratoriosPizarraState extends ConsumerState<_HojaLaboratoriosPizarra> {
  /// Orden local (ids), se guarda en el servidor en cuanto cambia.
  List<int>? _orden;
  bool _guardando = false;

  List<int> get _actual => _orden ?? ref.read(labsPizarraProvider).value ?? const [];

  Future<void> _aplicar(List<int> nuevo) async {
    setState(() {
      _orden = nuevo;
      _guardando = true;
    });
    try {
      await ref.read(repositorioProvider).guardarLaboratoriosPizarra(nuevo);
      ref.invalidate(labsPizarraProvider);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  void _alternar(int id, bool marcado) {
    final orden = [..._actual];
    orden.remove(id);
    if (marcado) orden.add(id); // al marcar va al final: ese es el orden
    _aplicar(orden);
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final labs = (ref.watch(laboratoriosProvider).value ?? const <Laboratorio>[])
        .where((l) => l.activo)
        .toList();
    final orden = _actual;
    final personalizado = orden.isNotEmpty;

    // Primero los marcados, en su orden; luego el resto.
    final porId = {for (final l in labs) l.id: l};
    final marcados = [for (final id in orden) if (porId[id] != null) porId[id]!];
    final idsMarcados = orden.toSet();
    final resto = labs.where((l) => !idsMarcados.contains(l.id)).toList();
    final ordenados = [...marcados, ...resto];

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 8, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Laboratorios de la pizarra',
                    style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                if (_guardando)
                  const Padding(
                    padding: EdgeInsets.only(right: 8),
                    child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  ),
                if (personalizado)
                  TextButton(onPressed: () => _aplicar(const []), child: const Text('Todos')),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(right: 8, bottom: 4),
              child: Text(
                'Marca los que quieres ver. Se ordenan según los vayas marcando.',
                style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final l in ordenados)
                    CheckboxListTile(
                      dense: true,
                      controlAffinity: ListTileControlAffinity.leading,
                      value: idsMarcados.contains(l.id),
                      onChanged: _guardando ? null : (v) => _alternar(l.id, v ?? false),
                      title: Text('${l.codigo} · ${l.nombre}'),
                      secondary: idsMarcados.contains(l.id)
                          ? CircleAvatar(
                              radius: 12,
                              backgroundColor: tema.colorScheme.primaryContainer,
                              child: Text(
                                '${orden.indexOf(l.id) + 1}',
                                style: TextStyle(fontSize: 12, color: tema.colorScheme.onPrimaryContainer),
                              ),
                            )
                          : null,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
