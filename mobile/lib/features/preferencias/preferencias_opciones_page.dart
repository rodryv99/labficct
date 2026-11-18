import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';

/// Catálogo de preguntas de preferencias de los docentes (lo administra el
/// Admin). Cada pregunta tiene el texto que lee el docente y lo que ven los
/// auxiliares según la respuesta.
class PreferenciasOpcionesPage extends ConsumerWidget {
  const PreferenciasOpcionesPage({super.key});

  Future<void> _editar(BuildContext context, WidgetRef ref, [OpcionPreferencia? opcion, int orden = 0]) async {
    final datos = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (hoja) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(hoja).viewInsets.bottom),
        child: _HojaOpcion(opcion: opcion, ordenSugerido: orden),
      ),
    );
    if (datos == null || !context.mounted) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).guardarOpcion(datos, id: opcion?.id);
      refrescarOpciones(contenedor);
      if (context.mounted) avisar(context, opcion == null ? 'Pregunta agregada.' : 'Pregunta actualizada.');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<void> _eliminar(BuildContext context, WidgetRef ref, OpcionPreferencia opcion) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('¿Eliminar esta pregunta?'),
        content: Text(
          '«${opcion.pregunta}». Las respuestas ya guardadas de los docentes dejarán de mostrarse. '
          'Si prefieres conservarla, desactívala en vez de borrarla.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Volver')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(d).colorScheme.error),
            onPressed: () => Navigator.pop(d, true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarOpcion(opcion.id);
      refrescarOpciones(contenedor);
      if (context.mounted) avisar(context, 'Pregunta eliminada.');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final opciones = ref.watch(catalogoOpcionesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Preguntas de preferencias')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          final n = opciones.value?.length ?? 0;
          _editar(context, ref, null, n + 1);
        },
        icon: const Icon(Icons.add),
        label: const Text('Nueva'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(catalogoOpcionesProvider.future),
        child: opciones.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(catalogoOpcionesProvider)),
          ]),
          data: (lista) => lista.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 80),
                  EstadoVacio(
                    icono: Icons.quiz_outlined,
                    titulo: 'Todavía no hay preguntas',
                    descripcion: 'Agrega preguntas para que cada docente marque cómo prefiere encontrar el aula.',
                  ),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(8, 4, 8, 96),
                  itemCount: lista.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final o = lista[i];
                    return ListTile(
                      isThreeLine: true,
                      title: Text(o.pregunta),
                      subtitle: Text('Sí → ${o.textoSi}\nNo → ${o.textoNo}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (!o.activa) const Etiqueta('Inactiva', tono: Tono.neutro),
                          IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => _editar(context, ref, o, o.orden)),
                          IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _eliminar(context, ref, o)),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class _HojaOpcion extends StatefulWidget {
  const _HojaOpcion({this.opcion, required this.ordenSugerido});
  final OpcionPreferencia? opcion;
  final int ordenSugerido;

  @override
  State<_HojaOpcion> createState() => _HojaOpcionState();
}

class _HojaOpcionState extends State<_HojaOpcion> {
  late final TextEditingController _pregunta = TextEditingController(text: widget.opcion?.pregunta ?? '');
  late final TextEditingController _si = TextEditingController(text: widget.opcion?.textoSi ?? '');
  late final TextEditingController _no = TextEditingController(text: widget.opcion?.textoNo ?? '');
  late final TextEditingController _orden =
      TextEditingController(text: '${widget.opcion?.orden ?? widget.ordenSugerido}');
  late bool _activa = widget.opcion?.activa ?? true;

  @override
  void dispose() {
    _pregunta.dispose();
    _si.dispose();
    _no.dispose();
    _orden.dispose();
    super.dispose();
  }

  bool get _completo => _pregunta.text.trim().isNotEmpty && _si.text.trim().isNotEmpty && _no.text.trim().isNotEmpty;

  void _guardar() {
    if (!_completo) return;
    Navigator.pop(context, {
      'pregunta': _pregunta.text.trim(),
      'texto_si': _si.text.trim(),
      'texto_no': _no.text.trim(),
      'orden': int.tryParse(_orden.text.trim()) ?? 0,
      'activa': _activa,
    });
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.opcion == null ? 'Nueva pregunta' : 'Editar pregunta', style: tema.textTheme.titleMedium),
          const SizedBox(height: 12),
          TextField(
            controller: _pregunta,
            textCapitalization: TextCapitalization.sentences,
            minLines: 1,
            maxLines: 2,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Pregunta (la ve el docente)',
              hintText: '¿Prefieres la puerta abierta?',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _si,
            textCapitalization: TextCapitalization.sentences,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Si responde que SÍ, los auxiliares leen:',
              hintText: 'Dejar la puerta abierta',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _no,
            textCapitalization: TextCapitalization.sentences,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Si responde que NO, los auxiliares leen:',
              hintText: 'Dejar la puerta cerrada',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _orden,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Orden', helperText: 'Las preguntas se muestran de menor a mayor.'),
          ),
          if (widget.opcion != null)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Activa'),
              subtitle: const Text('Las inactivas no se le muestran al docente'),
              value: _activa,
              onChanged: (v) => setState(() => _activa = v),
            ),
          const SizedBox(height: 12),
          FilledButton(onPressed: _completo ? _guardar : null, child: const Text('Guardar')),
        ],
      ),
    );
  }
}
