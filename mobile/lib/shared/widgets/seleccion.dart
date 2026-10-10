import 'package:flutter/material.dart';

import 'comunes.dart';

class OpcionSeleccion {
  const OpcionSeleccion(this.id, this.etiqueta, [this.secundaria = '']);
  final int id;
  final String etiqueta;
  final String secundaria;
}

/// Hoja inferior para elegir una o varias opciones, con buscador.
/// Devuelve la selección nueva, o null si se cerró sin confirmar.
Future<Set<int>?> seleccionar(
  BuildContext context, {
  required String titulo,
  required Future<List<OpcionSeleccion>> opciones,
  Set<int> seleccion = const {},
  bool multiple = true,
}) {
  return showModalBottomSheet<Set<int>>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, desplazamiento) => _HojaSeleccion(
        titulo: titulo,
        opciones: opciones,
        inicial: seleccion,
        multiple: multiple,
        desplazamiento: desplazamiento,
      ),
    ),
  );
}

class _HojaSeleccion extends StatefulWidget {
  const _HojaSeleccion({
    required this.titulo,
    required this.opciones,
    required this.inicial,
    required this.multiple,
    required this.desplazamiento,
  });

  final String titulo;
  final Future<List<OpcionSeleccion>> opciones;
  final Set<int> inicial;
  final bool multiple;
  final ScrollController desplazamiento;

  @override
  State<_HojaSeleccion> createState() => _HojaSeleccionState();
}

class _HojaSeleccionState extends State<_HojaSeleccion> {
  late final Set<int> _elegidos = {...widget.inicial};
  String _buscar = '';

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 12, 8),
          child: Row(
            children: [
              Expanded(child: Text(widget.titulo, style: tema.textTheme.titleMedium)),
              if (widget.multiple)
                FilledButton(onPressed: () => Navigator.pop(context, _elegidos), child: Text('Listo (${_elegidos.length})')),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: TextField(
            onChanged: (v) => setState(() => _buscar = v.trim().toLowerCase()),
            decoration: const InputDecoration(hintText: 'Buscar', prefixIcon: Icon(Icons.search)),
          ),
        ),
        Expanded(
          child: FutureBuilder<List<OpcionSeleccion>>(
            future: widget.opciones,
            builder: (context, estado) {
              if (estado.hasError) {
                return const EstadoVacio(icono: Icons.cloud_off_outlined, titulo: 'No se pudo cargar la lista');
              }
              if (!estado.hasData) return const Center(child: CircularProgressIndicator());
              final lista = estado.data!
                  .where((o) =>
                      _buscar.isEmpty ||
                      o.etiqueta.toLowerCase().contains(_buscar) ||
                      o.secundaria.toLowerCase().contains(_buscar))
                  .toList();
              if (lista.isEmpty) {
                return const EstadoVacio(icono: Icons.search_off, titulo: 'Sin resultados');
              }
              return ListView.builder(
                controller: widget.desplazamiento,
                itemCount: lista.length,
                itemBuilder: (_, i) {
                  final o = lista[i];
                  final elegido = _elegidos.contains(o.id);
                  final subtitulo = o.secundaria.isEmpty ? null : Text(o.secundaria);
                  if (!widget.multiple) {
                    return ListTile(
                      title: Text(o.etiqueta),
                      subtitle: subtitulo,
                      trailing: elegido ? Icon(Icons.check, color: tema.colorScheme.primary) : null,
                      onTap: () => Navigator.pop(context, {o.id}),
                    );
                  }
                  return CheckboxListTile(
                    value: elegido,
                    title: Text(o.etiqueta),
                    subtitle: subtitulo,
                    controlAffinity: ListTileControlAffinity.leading,
                    onChanged: (v) => setState(() => v == true ? _elegidos.add(o.id) : _elegidos.remove(o.id)),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
