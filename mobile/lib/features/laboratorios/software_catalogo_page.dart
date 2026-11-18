import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';

/// Catálogo de programas (software instalado en los laboratorios).
/// Crear un programa lo puede hacer quien marca el software de un laboratorio;
/// editarlo o borrarlo es solo del Admin (software.gestionar).
class SoftwareCatalogoPage extends ConsumerWidget {
  const SoftwareCatalogoPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final software = ref.watch(softwareProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Software')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _editar(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Programa'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(softwareProvider.future),
        child: software.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(softwareProvider)),
          ]),
          data: (lista) {
            if (lista.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 80),
                EstadoVacio(
                  icono: Icons.apps_outlined,
                  titulo: 'Sin programas',
                  descripcion: 'Agrega los programas que se instalan en los laboratorios.',
                ),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
              itemCount: lista.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final s = lista[i];
                return ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.apps_outlined)),
                  title: Text(s.nombreCompleto),
                  subtitle: Text(s.totalLaboratorios > 0
                      ? 'En ${s.totalLaboratorios} laboratorio(s)'
                      : 'Sin usar'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _editar(context, ref, s),
                );
              },
            );
          },
        ),
      ),
    );
  }

  Future<void> _editar(BuildContext context, WidgetRef ref, [Software? inicial]) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => _HojaSoftware(inicial: inicial),
    );
  }
}

class _HojaSoftware extends ConsumerStatefulWidget {
  const _HojaSoftware({this.inicial});
  final Software? inicial;

  @override
  ConsumerState<_HojaSoftware> createState() => _HojaSoftwareState();
}

class _HojaSoftwareState extends ConsumerState<_HojaSoftware> {
  late final TextEditingController _nombre;
  late final TextEditingController _version;
  late final TextEditingController _descripcion;
  bool _guardando = false;
  final _errores = <String, String>{};

  bool get _esNuevo => widget.inicial == null;

  @override
  void initState() {
    super.initState();
    _nombre = TextEditingController(text: widget.inicial?.nombre ?? '');
    _version = TextEditingController(text: widget.inicial?.version ?? '');
    _descripcion = TextEditingController(text: widget.inicial?.descripcion ?? '');
  }

  @override
  void dispose() {
    _nombre.dispose();
    _version.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (_nombre.text.trim().isEmpty) {
      setState(() => _errores['nombre'] = 'Escribe el nombre.');
      return;
    }
    setState(() {
      _guardando = true;
      _errores.clear();
    });
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).guardarSoftware(
        {
          'nombre': _nombre.text.trim(),
          'version': _version.text.trim(),
          'descripcion': _descripcion.text.trim(),
        },
        id: widget.inicial?.id,
      );
      contenedor.invalidate(softwareProvider);
      if (!mounted) return;
      Navigator.pop(context);
      avisar(context, _esNuevo ? 'Programa agregado.' : 'Cambios guardados.');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        _errores.addAll(erroresDeCampos(e));
      });
      avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<void> _eliminar() async {
    final s = widget.inicial!;
    if (s.totalLaboratorios > 0) {
      avisar(context, 'No se puede borrar: está instalado en ${s.totalLaboratorios} laboratorio(s).', error: true);
      return;
    }
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('¿Borrar programa?'),
        content: Text('Se quitará "${s.nombreCompleto}" del catálogo.'),
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
    if (confirmar != true) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarSoftware(s.id);
      contenedor.invalidate(softwareProvider);
      if (!mounted) return;
      Navigator.pop(context);
      avisar(context, 'Programa borrado.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_esNuevo ? 'Nuevo programa' : 'Editar programa',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            TextField(
              controller: _nombre,
              decoration: InputDecoration(labelText: 'Nombre', errorText: _errores['nombre']),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _version,
              decoration: InputDecoration(
                labelText: 'Versión (opcional)',
                hintText: '2024',
                errorText: _errores['version'],
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descripcion,
              minLines: 1,
              maxLines: 3,
              decoration: InputDecoration(labelText: 'Descripción (opcional)', errorText: _errores['descripcion']),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                if (!_esNuevo)
                  TextButton.icon(
                    onPressed: _guardando ? null : _eliminar,
                    icon: Icon(Icons.delete_outline, color: Theme.of(context).colorScheme.error),
                    label: Text('Borrar', style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ),
                const Spacer(),
                FilledButton(
                  onPressed: _guardando ? null : _guardar,
                  child: _guardando
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Guardar'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
