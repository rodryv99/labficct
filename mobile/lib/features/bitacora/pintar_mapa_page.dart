import 'package:flutter/material.dart';

import '../../core/modelos/modelos.dart';
import 'mapa_bitacora.dart';

/// Resultado de pintar: los atributos (nombre y color) y las casillas pintadas.
typedef MapaPintado = ({List<AtributoMapa> atributos, Map<(int, int), int> marcas});

/// Pantalla completa para pintar el mapa, como en OrganiLab: arriba los atributos,
/// abajo la grilla. Se elige un atributo y se tocan (o arrastran) los elementos.
class PintarMapaPage extends StatefulWidget {
  const PintarMapaPage({super.key, required this.mapa, required this.atributos, required this.marcas});

  final MapaBitacora mapa;
  final List<AtributoMapa> atributos;
  final Map<(int, int), int> marcas;

  @override
  State<PintarMapaPage> createState() => _PintarMapaPageState();
}

class _PintarMapaPageState extends State<PintarMapaPage> {
  late List<AtributoMapa> _atributos = List.of(widget.atributos.isEmpty ? atributosIniciales : widget.atributos);
  late Map<(int, int), int> _marcas = Map.of(widget.marcas);
  HerramientaMapa _herramienta = HerramientaMapa.pintar;
  int _activo = 0;

  bool get _cambio =>
      _marcas.length != widget.marcas.length ||
      _marcas.entries.any((e) => widget.marcas[e.key] != e.value) ||
      _atributos.length != widget.atributos.length ||
      [for (var i = 0; i < _atributos.length; i++) i].any(
        (i) => _atributos[i].nombre != widget.atributos[i].nombre || _atributos[i].color != widget.atributos[i].color,
      );

  void _cantidad(int n) {
    if (n < 1 || n > maxAtributos) return;
    setState(() {
      _atributos = [
        for (var i = 0; i < n; i++)
          i < _atributos.length
              ? _atributos[i]
              : AtributoMapa(nombre: 'Atributo ${i + 1}', color: paletaMapa[i % paletaMapa.length]),
      ];
      _marcas = {
        for (final e in _marcas.entries)
          if (e.value < n) e.key: e.value,
      };
      if (_activo >= n) _activo = n - 1;
    });
  }

  Future<void> _editarAtributo(int i) async {
    final nombre = TextEditingController(text: _atributos[i].nombre);
    var color = _atributos[i].color.toUpperCase();
    final listo = await showDialog<bool>(
      context: context,
      builder: (dialogo) => StatefulBuilder(
        builder: (dialogo, setDialogo) => AlertDialog(
          title: Text('Atributo ${i + 1}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: nombre,
                autofocus: true,
                maxLength: 40,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(labelText: 'Nombre', hintText: 'Ej.: Sin internet'),
              ),
              const SizedBox(height: 8),
              const Text('Color'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final c in {...paletaMapa, color})
                    InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => setDialogo(() => color = c),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: colorHex(c),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: c == color ? Theme.of(dialogo).colorScheme.onSurface : Colors.transparent,
                            width: 3,
                          ),
                        ),
                        child: c == color ? Icon(Icons.check, size: 18, color: tintaSobre(colorHex(c))) : null,
                      ),
                    ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Cancelar')),
            FilledButton(onPressed: () => Navigator.pop(dialogo, true), child: const Text('Listo')),
          ],
        ),
      ),
    );
    final texto = nombre.text.trim();
    // No se hace dispose aquí: el diálogo todavía usa el controlador mientras se cierra (animación).
    if (listo != true || !mounted) return;
    setState(() {
      _atributos = [
        for (var j = 0; j < _atributos.length; j++)
          j == i ? _atributos[j].copyWith(nombre: texto.isEmpty ? 'Atributo ${i + 1}' : texto, color: color) : _atributos[j],
      ];
    });
  }

  Future<void> _salir() async {
    if (!_cambio) {
      Navigator.pop(context);
      return;
    }
    final descartar = await showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: const Text('¿Descartar lo pintado?'),
        content: const Text('Si sales sin tocar «Listo», no se guarda lo que pintaste.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Seguir pintando')),
          FilledButton(onPressed: () => Navigator.pop(dialogo, true), child: const Text('Descartar')),
        ],
      ),
    );
    if (descartar == true && mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final conteo = List.filled(_atributos.length, 0);
    for (final a in _marcas.values) {
      if (a < conteo.length) conteo[a]++;
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (salio, _) {
        if (!salio) _salir();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Pintar mapa'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop<MapaPintado>(context, (atributos: _atributos, marcas: _marcas)),
              child: const Text('Listo'),
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: Row(
                  children: [
                    Text('Atributos', style: tema.textTheme.titleSmall),
                    const SizedBox(width: 8),
                    IconButton.outlined(
                      tooltip: 'Uno menos',
                      onPressed: _atributos.length > 1 ? () => _cantidad(_atributos.length - 1) : null,
                      icon: const Icon(Icons.remove, size: 18),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text('${_atributos.length}', style: tema.textTheme.titleMedium),
                    ),
                    IconButton.outlined(
                      tooltip: 'Uno más',
                      onPressed: _atributos.length < maxAtributos ? () => _cantidad(_atributos.length + 1) : null,
                      icon: const Icon(Icons.add, size: 18),
                    ),
                  ],
                ),
              ),
              SizedBox(
                height: 52,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _atributos.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final a = _atributos[i];
                    final elegido = _activo == i && _herramienta == HerramientaMapa.pintar;
                    return InputChip(
                      selected: elegido,
                      showCheckmark: false,
                      avatar: CircleAvatar(backgroundColor: colorHex(a.color)),
                      label: Text('${a.nombre} (${conteo[i]})'),
                      onPressed: () => setState(() {
                        _activo = i;
                        _herramienta = HerramientaMapa.pintar;
                      }),
                      deleteIcon: const Icon(Icons.edit_outlined, size: 18),
                      deleteButtonTooltipMessage: 'Cambiar nombre o color',
                      onDeleted: () => _editarAtributo(i),
                    );
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: SegmentedButton<HerramientaMapa>(
                  segments: const [
                    ButtonSegment(value: HerramientaMapa.pintar, icon: Icon(Icons.brush_outlined), label: Text('Pintar')),
                    ButtonSegment(
                      value: HerramientaMapa.borrar,
                      icon: Icon(Icons.format_color_reset_outlined),
                      label: Text('Borrar'),
                    ),
                    ButtonSegment(value: HerramientaMapa.mover, icon: Icon(Icons.pan_tool_outlined), label: Text('Mover')),
                  ],
                  selected: {_herramienta},
                  onSelectionChanged: (s) => setState(() => _herramienta = s.first),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                  child: LayoutBuilder(
                    builder: (_, espacio) => MapaBitacoraVista(
                      mapa: widget.mapa,
                      atributos: _atributos,
                      marcas: _marcas,
                      herramienta: _herramienta,
                      atributoActivo: _activo,
                      alto: espacio.maxHeight,
                      onCambiar: (m) => setState(() => _marcas = m),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(
                  _herramienta == HerramientaMapa.mover
                      ? 'Arrastra para moverte; pellizca para acercar o alejar. Doble toque: ficha del elemento.'
                      : 'Toca o arrastra sobre los elementos. Con dos dedos: zoom. Doble toque: ficha del elemento.',
                  style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
