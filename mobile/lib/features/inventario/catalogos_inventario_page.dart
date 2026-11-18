import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'inventario_comun.dart';

/// Tipos de activo (silla, mesa, computadora…). Sirven para filtrar y para
/// pedir verificaciones.
class TiposActivoPage extends ConsumerWidget {
  const TiposActivoPage({super.key});

  Future<void> _editar(BuildContext context, WidgetRef ref, [TipoActivo? tipo]) async {
    final nombre = TextEditingController(text: tipo?.nombre ?? '');
    var activo = tipo?.activo ?? true;
    final guardado = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (hoja) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(hoja).viewInsets.bottom),
        child: StatefulBuilder(
          builder: (hoja, estado) => _FormularioHoja(
            titulo: tipo == null ? 'Nuevo tipo' : 'Editar ${tipo.nombre}',
            onGuardar: nombre.text.trim().isEmpty
                ? null
                : () async {
                    final contenedor = ProviderScope.containerOf(hoja, listen: false);
                    try {
                      await ref.read(repositorioProvider).guardarTipoActivo(
                        {'nombre': nombre.text.trim(), 'activo': activo},
                        id: tipo?.id,
                      );
                      refrescarInventario(contenedor);
                      if (hoja.mounted) Navigator.pop(hoja, true);
                    } catch (e) {
                      if (hoja.mounted) avisar(hoja, mensajeDeError(e), error: true);
                    }
                  },
            campos: [
              TextField(
                controller: nombre,
                autofocus: tipo == null,
                textCapitalization: TextCapitalization.sentences,
                maxLength: 80,
                onChanged: (_) => estado(() {}),
                decoration: const InputDecoration(labelText: 'Nombre', counterText: ''),
              ),
              if (tipo != null)
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Activo'),
                  subtitle: const Text('Se puede elegir al registrar'),
                  value: activo,
                  onChanged: (v) => estado(() => activo = v),
                ),
            ],
          ),
        ),
      ),
    );
    nombre.dispose();
    if (guardado == true && context.mounted) avisar(context, tipo == null ? 'Tipo agregado.' : 'Tipo actualizado.');
  }

  Future<void> _eliminar(BuildContext context, WidgetRef ref, TipoActivo tipo) async {
    if (!await _confirmarEliminar(context, 'el tipo «${tipo.nombre}»', 'Solo se puede si ningún activo lo usa.')) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarTipoActivo(tipo.id);
      refrescarInventario(contenedor);
      if (context.mounted) avisar(context, 'Tipo eliminado.');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tipos = ref.watch(tiposActivoProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Tipos de activo')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _editar(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Nuevo tipo'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(tiposActivoProvider.future),
        child: tipos.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(tiposActivoProvider)),
          ]),
          data: (lista) => lista.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 80),
                  EstadoVacio(icono: Icons.category_outlined, titulo: 'Todavía no hay tipos'),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(8, 4, 8, 96),
                  itemCount: lista.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final t = lista[i];
                    return ListTile(
                      title: Text(t.nombre),
                      subtitle: Text('${t.totalActivos} ${t.totalActivos == 1 ? 'activo' : 'activos'}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (!t.activo) const Etiqueta('Desactivado', tono: Tono.neutro),
                          IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => _editar(context, ref, t)),
                          IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _eliminar(context, ref, t)),
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

/// Lugares donde puede estar un activo. Los laboratorios aparecen solos; aquí se
/// agregan depósitos y otros ambientes.
class LugaresPage extends ConsumerWidget {
  const LugaresPage({super.key});

  Future<void> _editar(BuildContext context, WidgetRef ref, [Lugar? lugar]) async {
    final nombre = TextEditingController(text: lugar?.nombre ?? '');
    var tipo = lugar?.tipo ?? 'deposito';
    var activo = lugar?.activo ?? true;
    final guardado = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (hoja) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(hoja).viewInsets.bottom),
        child: StatefulBuilder(
          builder: (hoja, estado) => _FormularioHoja(
            titulo: lugar == null ? 'Nuevo lugar' : 'Editar ${lugar.nombre}',
            onGuardar: nombre.text.trim().isEmpty
                ? null
                : () async {
                    final contenedor = ProviderScope.containerOf(hoja, listen: false);
                    try {
                      await ref.read(repositorioProvider).guardarLugar(
                        {'nombre': nombre.text.trim(), 'tipo': tipo, 'activo': activo},
                        id: lugar?.id,
                      );
                      refrescarInventario(contenedor);
                      if (hoja.mounted) Navigator.pop(hoja, true);
                    } catch (e) {
                      if (hoja.mounted) avisar(hoja, mensajeDeError(e), error: true);
                    }
                  },
            campos: [
              TextField(
                controller: nombre,
                autofocus: lugar == null,
                textCapitalization: TextCapitalization.sentences,
                maxLength: 120,
                onChanged: (_) => estado(() {}),
                decoration: const InputDecoration(
                  labelText: 'Nombre',
                  counterText: '',
                  hintText: 'Ej.: Depósito del módulo 236',
                ),
              ),
              DropdownButtonFormField<String>(
                initialValue: tipo,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Tipo'),
                items: [for (final (valor, nombre) in tiposLugar) DropdownMenuItem(value: valor, child: Text(nombre))],
                onChanged: (v) => estado(() => tipo = v ?? 'deposito'),
              ),
              if (lugar != null)
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Activo'),
                  subtitle: const Text('Se puede elegir como destino'),
                  value: activo,
                  onChanged: (v) => estado(() => activo = v),
                ),
            ],
          ),
        ),
      ),
    );
    nombre.dispose();
    if (guardado == true && context.mounted) avisar(context, lugar == null ? 'Lugar agregado.' : 'Lugar actualizado.');
  }

  Future<void> _eliminar(BuildContext context, WidgetRef ref, Lugar lugar) async {
    if (!await _confirmarEliminar(context, 'el lugar «${lugar.nombre}»', 'Solo se puede si nunca tuvo activos.')) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarLugar(lugar.id);
      refrescarInventario(contenedor);
      if (context.mounted) avisar(context, 'Lugar eliminado.');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lugares = ref.watch(lugaresProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Lugares')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _editar(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Nuevo lugar'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(lugaresProvider.future),
        child: lugares.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(lugaresProvider)),
          ]),
          data: (lista) => lista.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 80),
                  EstadoVacio(icono: Icons.place_outlined, titulo: 'Todavía no hay lugares'),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(8, 4, 8, 96),
                  itemCount: lista.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final l = lista[i];
                    return ListTile(
                      title: Text(l.nombre),
                      subtitle: Text(
                        '${l.tipoNombre} · ${l.totalActivos} ${l.totalActivos == 1 ? 'activo' : 'activos'}',
                      ),
                      trailing: l.esLaboratorio
                          ? const Etiqueta('Laboratorio', tono: Tono.info)
                          : Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (!l.activo) const Etiqueta('Desactivado', tono: Tono.neutro),
                                IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => _editar(context, ref, l)),
                                IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _eliminar(context, ref, l)),
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

Future<bool> _confirmarEliminar(BuildContext context, String que, String nota) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (dialogo) => AlertDialog(
      title: Text('¿Eliminar $que?'),
      content: Text(nota),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Volver')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Theme.of(dialogo).colorScheme.error),
          onPressed: () => Navigator.pop(dialogo, true),
          child: const Text('Eliminar'),
        ),
      ],
    ),
  );
  return r ?? false;
}

/// Hoja de formulario simple: un título, unos campos y un botón de guardar.
class _FormularioHoja extends StatelessWidget {
  const _FormularioHoja({required this.titulo, required this.campos, required this.onGuardar});

  final String titulo;
  final List<Widget> campos;
  final VoidCallback? onGuardar;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(titulo, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...campos,
          const SizedBox(height: 12),
          FilledButton(onPressed: onGuardar, child: const Text('Guardar')),
        ],
      ),
    );
  }
}
