import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/grilla_laboratorio.dart';

/// Categorías de un tipo de elemento (igual que la web).
const _categorias = <(String, String)>[
  ('equipo', 'Equipo de cómputo'),
  ('audiovisual', 'Audiovisual'),
  ('red', 'Red y conectividad'),
  ('mobiliario', 'Mobiliario'),
  ('infraestructura', 'Infraestructura'),
  ('otro', 'Otro'),
];

const _coloresPreset = [
  '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED',
  '#0891B2', '#DB2777', '#4B5563', '#65A30D', '#0D9488',
];

/// Catálogo de tipos de elemento del mapa (PC, proyector, silla…), con su
/// ícono y color. Se usan al dibujar la distribución de un laboratorio.
class ElementosCatalogoPage extends ConsumerWidget {
  const ElementosCatalogoPage({super.key});

  Future<void> _editar(BuildContext context, WidgetRef ref, [TipoElemento? tipo]) async {
    final datos = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (hoja) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(hoja).viewInsets.bottom),
        child: _HojaElemento(tipo: tipo),
      ),
    );
    if (datos == null || !context.mounted) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).guardarElemento(datos, id: tipo?.id);
      refrescarElementos(contenedor);
      if (context.mounted) avisar(context, tipo == null ? 'Elemento agregado.' : 'Elemento actualizado.');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<void> _eliminar(BuildContext context, WidgetRef ref, TipoElemento tipo) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text('¿Eliminar «${tipo.nombre}»?'),
        content: const Text('Solo se puede si ninguna casilla de ningún laboratorio lo usa.'),
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
      await ref.read(repositorioProvider).eliminarElemento(tipo.id);
      refrescarElementos(contenedor);
      if (context.mounted) avisar(context, 'Elemento eliminado.');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final elementos = ref.watch(catalogoElementosProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Elementos del mapa')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _editar(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Nuevo'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(catalogoElementosProvider.future),
        child: elementos.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(catalogoElementosProvider)),
          ]),
          data: (lista) => lista.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 80),
                  EstadoVacio(icono: Icons.category_outlined, titulo: 'Todavía no hay elementos'),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(8, 4, 8, 96),
                  itemCount: lista.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final e = lista[i];
                    final color = colorDesdeHex(e.color);
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: color.withValues(alpha: 0.15),
                        child: Icon(iconosElemento[e.icono] ?? Icons.category_outlined, color: color),
                      ),
                      title: Text(e.nombre),
                      subtitle: Text(
                        [
                          if (e.categoriaNombre.isNotEmpty) e.categoriaNombre,
                          '${e.enUso} ${e.enUso == 1 ? 'casilla' : 'casillas'}',
                        ].join(' · '),
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (!e.activo) const Etiqueta('Inactivo', tono: Tono.neutro),
                          IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => _editar(context, ref, e)),
                          IconButton(
                            icon: const Icon(Icons.delete_outline),
                            onPressed: e.enUso > 0 ? null : () => _eliminar(context, ref, e),
                          ),
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

class _HojaElemento extends StatefulWidget {
  const _HojaElemento({this.tipo});
  final TipoElemento? tipo;

  @override
  State<_HojaElemento> createState() => _HojaElementoState();
}

class _HojaElementoState extends State<_HojaElemento> {
  late final TextEditingController _nombre = TextEditingController(text: widget.tipo?.nombre ?? '');
  late final TextEditingController _prefijo = TextEditingController(text: widget.tipo?.prefijoEtiqueta ?? '');
  late final TextEditingController _descripcion = TextEditingController(text: widget.tipo?.descripcion ?? '');
  late String _categoria = widget.tipo?.categoria ?? 'equipo';
  late String _icono = widget.tipo?.icono.isNotEmpty == true ? widget.tipo!.icono : 'generico';
  late String _color = widget.tipo?.color.isNotEmpty == true ? widget.tipo!.color : _coloresPreset.first;
  late bool _activo = widget.tipo?.activo ?? true;

  @override
  void dispose() {
    _nombre.dispose();
    _prefijo.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  void _guardar() {
    if (_nombre.text.trim().isEmpty) return;
    Navigator.pop(context, {
      'nombre': _nombre.text.trim(),
      'categoria': _categoria,
      'icono': _icono,
      'color': _color,
      'prefijo_etiqueta': _prefijo.text.trim(),
      'descripcion': _descripcion.text.trim(),
      'activo': _activo,
    });
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final color = colorDesdeHex(_color);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.tipo == null ? 'Nuevo elemento' : 'Editar ${widget.tipo!.nombre}', style: tema.textTheme.titleMedium),
          const SizedBox(height: 12),
          TextField(
            controller: _nombre,
            textCapitalization: TextCapitalization.sentences,
            maxLength: 80,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'Nombre', counterText: '', hintText: 'Ej.: Computadora'),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _categoria,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Categoría'),
            items: [for (final (v, n) in _categorias) DropdownMenuItem(value: v, child: Text(n))],
            onChanged: (v) => setState(() => _categoria = v ?? 'otro'),
          ),
          const SizedBox(height: 16),
          Text('Ícono', style: tema.textTheme.labelLarge),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final entrada in iconosElemento.entries)
                InkWell(
                  onTap: () => setState(() => _icono = entrada.key),
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: _icono == entrada.key ? color.withValues(alpha: 0.18) : tema.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: _icono == entrada.key ? color : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: Icon(entrada.value, color: _icono == entrada.key ? color : tema.colorScheme.onSurfaceVariant),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text('Color', style: tema.textTheme.labelLarge),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final hex in _coloresPreset)
                InkWell(
                  onTap: () => setState(() => _color = hex),
                  customBorder: const CircleBorder(),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: colorDesdeHex(hex),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: _color == hex ? tema.colorScheme.onSurface : Colors.transparent,
                        width: 3,
                      ),
                    ),
                    child: _color == hex ? const Icon(Icons.check, color: Colors.white, size: 18) : null,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _prefijo,
            maxLength: 10,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(
              labelText: 'Prefijo de etiqueta (opcional)',
              counterText: '',
              hintText: 'Ej.: PC → PC-01, PC-02…',
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _descripcion,
            textCapitalization: TextCapitalization.sentences,
            minLines: 1,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Descripción (opcional)'),
          ),
          if (widget.tipo != null)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Activo'),
              subtitle: const Text('Se puede usar al dibujar mapas'),
              value: _activo,
              onChanged: (v) => setState(() => _activo = v),
            ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _nombre.text.trim().isEmpty ? null : _guardar,
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
  }
}
