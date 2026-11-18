import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/grilla_laboratorio.dart';

const _estadosElemento = [
  ('operativo', 'Operativo'),
  ('con_falla', 'Con falla'),
  ('mantenimiento', 'En mantenimiento'),
  ('baja', 'De baja'),
];

enum _Modo { colocar, borrar, mano }

typedef _Grilla = ({int filas, int columnas, Map<String, Celda> celdas});

String _clave(int fila, int columna) => '$fila,$columna';

/// Editor de la distribución del laboratorio (estilo OrganiLab):
/// colocar, borrar y mano, con deshacer, rehacer y numerar.
class EditorDistribucionPage extends ConsumerStatefulWidget {
  const EditorDistribucionPage({super.key, required this.laboratorioId, required this.titulo});
  final int laboratorioId;
  final String titulo;

  @override
  ConsumerState<EditorDistribucionPage> createState() => _EditorDistribucionPageState();
}

class _EditorDistribucionPageState extends ConsumerState<EditorDistribucionPage> {
  bool _cargando = true;
  Object? _error;
  bool _guardando = false;

  // Catálogo de elementos.
  Map<int, TipoElemento> _tipos = const {};
  List<TipoElemento> _tiposActivos = const [];

  // Historial.
  final List<_Grilla> _pasado = [];
  final List<_Grilla> _futuro = [];
  late _Grilla _presente;
  late String _firmaGuardada;

  _Modo _modo = _Modo.colocar;
  int? _tipoActivo;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final repo = ref.read(repositorioProvider);
      final d = await repo.distribucion(widget.laboratorioId);
      final lista = await repo.elementos();
      final celdas = {for (final c in d.celdas) _clave(c.fila, c.columna): c};
      _tipos = {for (final t in lista) t.id: t};
      _tiposActivos = lista.where((t) => t.activo).toList();
      _presente = (filas: d.filas, columnas: d.columnas, celdas: celdas);
      _firmaGuardada = _firma(_presente);
      _tipoActivo = _tiposActivos.isNotEmpty ? _tiposActivos.first.id : null;
      if (mounted) setState(() => _cargando = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e;
          _cargando = false;
        });
      }
    }
  }

  // ── Historial ──
  String _firma(_Grilla g) {
    final claves = g.celdas.keys.toList()..sort();
    final partes = claves.map((k) {
      final c = g.celdas[k]!;
      return '$k|${c.tipo}|${c.etiqueta}|${c.ip ?? ''}|${c.mac}|${c.codigoActivo}|${c.especificaciones}|${c.descripcion}|${c.estado}';
    });
    return '${g.filas}x${g.columnas}:${partes.join(';')}';
  }

  bool get _hayCambios => _firma(_presente) != _firmaGuardada;

  void _aplicar(_Grilla nuevo) {
    setState(() {
      _pasado.add(_presente);
      if (_pasado.length > 100) _pasado.removeAt(0);
      _presente = nuevo;
      _futuro.clear();
    });
  }

  void _deshacer() {
    if (_pasado.isEmpty) return;
    setState(() {
      _futuro.insert(0, _presente);
      _presente = _pasado.removeLast();
    });
  }

  void _rehacer() {
    if (_futuro.isEmpty) return;
    setState(() {
      _pasado.add(_presente);
      _presente = _futuro.removeAt(0);
    });
  }

  // ── Operaciones de la grilla ──
  String _siguienteEtiqueta(TipoElemento? tipo) {
    final prefijo = tipo?.prefijoEtiqueta.trim() ?? '';
    if (prefijo.isEmpty) return '';
    final patron = RegExp('^${RegExp.escape(prefijo)}-(\\d+)\$', caseSensitive: false);
    var mayor = 0;
    for (final c in _presente.celdas.values) {
      final m = patron.firstMatch(c.etiqueta);
      if (m != null) mayor = mayor > int.parse(m.group(1)!) ? mayor : int.parse(m.group(1)!);
    }
    return '$prefijo-${(mayor + 1).toString().padLeft(2, '0')}';
  }

  void _tocarCelda(int fila, int columna) {
    final clave = _clave(fila, columna);
    final existente = _presente.celdas[clave];
    switch (_modo) {
      case _Modo.mano:
        return;
      case _Modo.borrar:
        if (existente == null) return;
        final celdas = Map<String, Celda>.of(_presente.celdas)..remove(clave);
        _aplicar((filas: _presente.filas, columnas: _presente.columnas, celdas: celdas));
      case _Modo.colocar:
        if (existente != null) {
          _editarCelda(existente);
          return;
        }
        final tipoId = _tipoActivo;
        if (tipoId == null) {
          avisar(context, 'Primero crea un elemento en el catálogo.', error: true);
          return;
        }
        final nueva = Celda(
          fila: fila,
          columna: columna,
          tipo: tipoId,
          etiqueta: _siguienteEtiqueta(_tipos[tipoId]),
          estado: 'operativo',
        );
        final celdas = Map<String, Celda>.of(_presente.celdas)..[clave] = nueva;
        _aplicar((filas: _presente.filas, columnas: _presente.columnas, celdas: celdas));
    }
  }

  Future<void> _editarCelda(Celda celda) async {
    final resultado = await showModalBottomSheet<({Celda? celda, bool quitar})>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => _HojaCelda(celda: celda, tipos: _tiposActivos, tiposTodos: _tipos),
    );
    if (resultado == null) return;
    final clave = _clave(celda.fila, celda.columna);
    final celdas = Map<String, Celda>.of(_presente.celdas);
    if (resultado.quitar) {
      celdas.remove(clave);
    } else if (resultado.celda != null) {
      celdas[clave] = resultado.celda!;
    }
    _aplicar((filas: _presente.filas, columnas: _presente.columnas, celdas: celdas));
  }

  Future<void> _redimensionar() async {
    final resultado = await showDialog<(int, int)>(
      context: context,
      builder: (_) => _DialogoTamano(filas: _presente.filas, columnas: _presente.columnas),
    );
    if (resultado == null) return;
    final (filas, columnas) = resultado;
    final celdas = <String, Celda>{};
    var quitadas = 0;
    _presente.celdas.forEach((k, c) {
      if (c.fila < filas && c.columna < columnas) {
        celdas[k] = c;
      } else {
        quitadas++;
      }
    });
    _aplicar((filas: filas, columnas: columnas, celdas: celdas));
    if (quitadas > 0 && mounted) {
      avisar(context, 'Se quitaron $quitadas elemento(s) fuera de la nueva grilla.');
    }
  }

  Future<void> _numerar() async {
    final opciones = await showDialog<_OpcionesNumerar>(
      context: context,
      builder: (_) => _DialogoNumerar(tipos: _tiposActivos),
    );
    if (opciones == null) return;
    final lista = _presente.celdas.values.where((c) => c.tipo == opciones.tipo).toList()
      ..sort((a, b) => opciones.porColumnas
          ? (a.columna != b.columna ? a.columna - b.columna : a.fila - b.fila)
          : (a.fila != b.fila ? a.fila - b.fila : a.columna - b.columna));
    final celdas = Map<String, Celda>.of(_presente.celdas);
    for (var i = 0; i < lista.length; i++) {
      final c = lista[i];
      final numero = (opciones.inicio + i).toString().padLeft(opciones.digitos, '0');
      final etiqueta = opciones.prefijo.isEmpty ? numero : '${opciones.prefijo}-$numero';
      celdas[_clave(c.fila, c.columna)] = c.copyWith(etiqueta: etiqueta);
    }
    _aplicar((filas: _presente.filas, columnas: _presente.columnas, celdas: celdas));
  }

  Future<void> _guardar() async {
    setState(() => _guardando = true);
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      final datos = {
        'filas': _presente.filas,
        'columnas': _presente.columnas,
        'celdas': _presente.celdas.values.map((c) => c.aJson()).toList(),
      };
      await ref.read(repositorioProvider).guardarDistribucion(widget.laboratorioId, datos);
      refrescarLaboratorios(contenedor, id: widget.laboratorioId);
      _firmaGuardada = _firma(_presente);
      if (!mounted) return;
      avisar(context, 'Distribución guardada.');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  Future<bool> _confirmarSalir() async {
    if (_cargando || _error != null || !_hayCambios) return true;
    final salir = await showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: const Text('¿Salir sin guardar?'),
        content: const Text('Hay cambios en la distribución que no se han guardado.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Seguir editando')),
          FilledButton(onPressed: () => Navigator.pop(dialogo, true), child: const Text('Salir')),
        ],
      ),
    );
    return salir ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (listo, _) async {
        if (listo) return;
        if (await _confirmarSalir() && mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text('Distribución · ${widget.titulo}'),
          actions: [
            IconButton(
              tooltip: 'Deshacer',
              onPressed: _cargando || _pasado.isEmpty ? null : _deshacer,
              icon: const Icon(Icons.undo),
            ),
            IconButton(
              tooltip: 'Rehacer',
              onPressed: _cargando || _futuro.isEmpty ? null : _rehacer,
              icon: const Icon(Icons.redo),
            ),
            PopupMenuButton<String>(
              onSelected: (v) => v == 'numerar' ? _numerar() : _redimensionar(),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'numerar', child: Text('Numerar elementos')),
                PopupMenuItem(value: 'tamano', child: Text('Cambiar tamaño de la grilla')),
              ],
            ),
          ],
        ),
        body: _cargando
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? EstadoError(error: _error!, onReintentar: _cargar)
                : _contenido(),
        bottomNavigationBar: _cargando || _error != null
            ? null
            : Padding(
                padding: EdgeInsets.fromLTRB(16, 8, 16, 12 + MediaQuery.of(context).padding.bottom),
                child: FilledButton.icon(
                  onPressed: _guardando || !_hayCambios ? null : _guardar,
                  icon: _guardando
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.save_outlined),
                  label: Text(_hayCambios ? 'Guardar distribución' : 'Sin cambios'),
                ),
              ),
      ),
    );
  }

  Widget _contenido() {
    final tema = Theme.of(context);
    return Column(
      children: [
        // Herramientas: modo.
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: SegmentedButton<_Modo>(
            segments: const [
              ButtonSegment(value: _Modo.colocar, icon: Icon(Icons.add_box_outlined), label: Text('Colocar')),
              ButtonSegment(value: _Modo.borrar, icon: Icon(Icons.backspace_outlined), label: Text('Borrar')),
              ButtonSegment(value: _Modo.mano, icon: Icon(Icons.pan_tool_outlined), label: Text('Mover')),
            ],
            selected: {_modo},
            onSelectionChanged: (s) => setState(() => _modo = s.first),
          ),
        ),
        // Selector de elemento (solo al colocar).
        if (_modo == _Modo.colocar)
          SizedBox(
            height: 48,
            child: _tiposActivos.isEmpty
                ? Center(
                    child: Text(
                      'No hay elementos en el catálogo.',
                      style: TextStyle(color: tema.colorScheme.onSurfaceVariant),
                    ),
                  )
                : ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    children: [
                      for (final t in _tiposActivos)
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            selected: _tipoActivo == t.id,
                            onSelected: (_) => setState(() => _tipoActivo = t.id),
                            avatar: Icon(
                              iconosElemento[t.icono] ?? Icons.category_outlined,
                              size: 18,
                              color: colorDesdeHex(t.color),
                            ),
                            label: Text(t.nombre),
                          ),
                        ),
                    ],
                  ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
          child: Text(
            switch (_modo) {
              _Modo.colocar => 'Toca una casilla vacía para colocar. Toca una ocupada para editar su ficha.',
              _Modo.borrar => 'Toca un elemento para quitarlo de la grilla.',
              _Modo.mano => 'Arrastra para moverte y pellizca para acercar.',
            },
            textAlign: TextAlign.center,
            style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
          ),
        ),
        Expanded(child: ClipRect(child: _grillaEditable())),
      ],
    );
  }

  Widget _grillaEditable() {
    final esquema = Theme.of(context).colorScheme;
    const lado = 58.0;
    const espacio = 6.0;
    return InteractiveViewer(
      constrained: false,
      minScale: 0.3,
      maxScale: 3,
      boundaryMargin: const EdgeInsets.all(140),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            for (var f = 0; f < _presente.filas; f++)
              Padding(
                padding: const EdgeInsets.only(bottom: espacio),
                child: Row(
                  children: [
                    for (var c = 0; c < _presente.columnas; c++)
                      Padding(
                        padding: const EdgeInsets.only(right: espacio),
                        child: _CasillaEditable(
                          celda: _presente.celdas[_clave(f, c)],
                          tipo: _tipos[_presente.celdas[_clave(f, c)]?.tipo],
                          lado: lado,
                          esquema: esquema,
                          onTap: () => _tocarCelda(f, c),
                        ),
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

class _CasillaEditable extends StatelessWidget {
  const _CasillaEditable({
    required this.celda,
    required this.tipo,
    required this.lado,
    required this.esquema,
    required this.onTap,
  });

  final Celda? celda;
  final TipoElemento? tipo;
  final double lado;
  final ColorScheme esquema;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = celda;
    if (c == null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: lado,
          height: lado,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: esquema.outlineVariant.withValues(alpha: 0.6)),
          ),
          child: Icon(Icons.add, size: 16, color: esquema.outlineVariant),
        ),
      );
    }
    final color = colorDesdeHex(tipo?.color ?? '');
    final marca = c.estado == 'con_falla'
        ? colorFalla
        : c.estado == 'mantenimiento'
            ? colorMantenimiento
            : null;
    return Opacity(
      opacity: c.estado == 'baja' ? 0.45 : 1,
      child: Material(
        color: color.withValues(alpha: 0.1),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: color.withValues(alpha: 0.55), width: 1.2),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: onTap,
          child: SizedBox(
            width: lado,
            height: lado,
            child: Stack(
              children: [
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(iconosElemento[tipo?.icono] ?? Icons.category_outlined, color: color, size: 24),
                    const SizedBox(height: 3),
                    Text(
                      c.etiqueta,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: esquema.onSurfaceVariant),
                    ),
                  ],
                ),
                if (marca != null)
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(color: marca, shape: BoxShape.circle),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Ficha de una celda ──
class _HojaCelda extends StatefulWidget {
  const _HojaCelda({required this.celda, required this.tipos, required this.tiposTodos});
  final Celda celda;
  final List<TipoElemento> tipos;
  final Map<int, TipoElemento> tiposTodos;

  @override
  State<_HojaCelda> createState() => _HojaCeldaState();
}

class _HojaCeldaState extends State<_HojaCelda> {
  late final TextEditingController _etiqueta;
  late final TextEditingController _ip;
  late final TextEditingController _mac;
  late final TextEditingController _codigo;
  late final TextEditingController _especificaciones;
  late final TextEditingController _descripcion;
  late int _tipo;
  late String _estado;

  @override
  void initState() {
    super.initState();
    final c = widget.celda;
    _etiqueta = TextEditingController(text: c.etiqueta);
    _ip = TextEditingController(text: c.ip ?? '');
    _mac = TextEditingController(text: c.mac);
    _codigo = TextEditingController(text: c.codigoActivo);
    _especificaciones = TextEditingController(text: c.especificaciones);
    _descripcion = TextEditingController(text: c.descripcion);
    _tipo = c.tipo;
    _estado = c.estado;
  }

  @override
  void dispose() {
    _etiqueta.dispose();
    _ip.dispose();
    _mac.dispose();
    _codigo.dispose();
    _especificaciones.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  void _guardar() {
    final actualizada = widget.celda.copyWith(
      tipo: _tipo,
      estado: _estado,
      etiqueta: _etiqueta.text.trim(),
      ip: _ip.text.trim(),
      mac: _mac.text.trim(),
      codigoActivo: _codigo.text.trim(),
      especificaciones: _especificaciones.text.trim(),
      descripcion: _descripcion.text.trim(),
    );
    Navigator.pop(context, (celda: actualizada, quitar: false));
  }

  @override
  Widget build(BuildContext context) {
    // Incluye el tipo actual aunque esté inactivo, para no perderlo.
    final opcionesTipo = [
      ...widget.tipos,
      if (!widget.tipos.any((t) => t.id == _tipo) && widget.tiposTodos[_tipo] != null) widget.tiposTodos[_tipo]!,
    ];
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
            Text(
              'Fila ${widget.celda.fila + 1}, columna ${widget.celda.columna + 1}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _etiqueta,
                    maxLength: 30,
                    decoration: const InputDecoration(labelText: 'Etiqueta', counterText: ''),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _estado,
                    decoration: const InputDecoration(labelText: 'Estado'),
                    items: [
                      for (final (valor, etiqueta) in _estadosElemento)
                        DropdownMenuItem(value: valor, child: Text(etiqueta)),
                    ],
                    onChanged: (v) => setState(() => _estado = v ?? 'operativo'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              initialValue: _tipo,
              decoration: const InputDecoration(labelText: 'Elemento'),
              items: [
                for (final t in opcionesTipo) DropdownMenuItem(value: t.id, child: Text(t.nombre)),
              ],
              onChanged: (v) => setState(() => _tipo = v ?? _tipo),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _ip,
                    decoration: const InputDecoration(labelText: 'IP', hintText: '192.168.1.10'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _mac,
                    maxLength: 17,
                    decoration: const InputDecoration(labelText: 'MAC', counterText: ''),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _codigo,
              decoration: const InputDecoration(labelText: 'Código de activo'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _especificaciones,
              minLines: 1,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Especificaciones', hintText: 'Procesador, RAM, disco…'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descripcion,
              minLines: 1,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Notas'),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                TextButton.icon(
                  onPressed: () => Navigator.pop(context, (celda: null, quitar: true)),
                  icon: Icon(Icons.delete_outline, color: Theme.of(context).colorScheme.error),
                  label: Text('Quitar', style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ),
                const Spacer(),
                FilledButton(onPressed: _guardar, child: const Text('Listo')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Diálogo de tamaño ──
class _DialogoTamano extends StatefulWidget {
  const _DialogoTamano({required this.filas, required this.columnas});
  final int filas;
  final int columnas;

  @override
  State<_DialogoTamano> createState() => _DialogoTamanoState();
}

class _DialogoTamanoState extends State<_DialogoTamano> {
  late final TextEditingController _filas = TextEditingController(text: '${widget.filas}');
  late final TextEditingController _columnas = TextEditingController(text: '${widget.columnas}');

  @override
  void dispose() {
    _filas.dispose();
    _columnas.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Tamaño de la grilla'),
      content: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _filas,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(labelText: 'Filas'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: _columnas,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(labelText: 'Columnas'),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        FilledButton(
          onPressed: () {
            final f = int.tryParse(_filas.text.trim()) ?? widget.filas;
            final c = int.tryParse(_columnas.text.trim()) ?? widget.columnas;
            Navigator.pop(context, (f.clamp(1, 40), c.clamp(1, 40)));
          },
          child: const Text('Aplicar'),
        ),
      ],
    );
  }
}

// ── Diálogo de numeración ──
class _OpcionesNumerar {
  const _OpcionesNumerar({
    required this.tipo,
    required this.prefijo,
    required this.inicio,
    required this.digitos,
    required this.porColumnas,
  });
  final int tipo;
  final String prefijo;
  final int inicio;
  final int digitos;
  final bool porColumnas;
}

class _DialogoNumerar extends StatefulWidget {
  const _DialogoNumerar({required this.tipos});
  final List<TipoElemento> tipos;

  @override
  State<_DialogoNumerar> createState() => _DialogoNumerarState();
}

class _DialogoNumerarState extends State<_DialogoNumerar> {
  int? _tipo;
  late final TextEditingController _prefijo = TextEditingController();
  int _inicio = 1;
  int _digitos = 2;
  bool _porColumnas = false;

  @override
  void initState() {
    super.initState();
    final primero = widget.tipos.where((t) => t.prefijoEtiqueta.isNotEmpty).firstOrNull ??
        (widget.tipos.isNotEmpty ? widget.tipos.first : null);
    _tipo = primero?.id;
    _prefijo.text = primero?.prefijoEtiqueta ?? '';
  }

  @override
  void dispose() {
    _prefijo.dispose();
    super.dispose();
  }

  String _ejemplo(int n) {
    final numero = n.toString().padLeft(_digitos, '0');
    return _prefijo.text.isEmpty ? numero : '${_prefijo.text}-$numero';
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Numerar elementos'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<int>(
              initialValue: _tipo,
              decoration: const InputDecoration(labelText: 'Elemento'),
              items: [
                for (final t in widget.tipos) DropdownMenuItem(value: t.id, child: Text(t.nombre)),
              ],
              onChanged: (v) {
                setState(() {
                  _tipo = v;
                  _prefijo.text = widget.tipos.firstWhere((t) => t.id == v).prefijoEtiqueta;
                });
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _prefijo,
              maxLength: 10,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(labelText: 'Prefijo', counterText: ''),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _Contador(
                    etiqueta: 'Empieza en',
                    valor: _inicio,
                    minimo: 0,
                    maximo: 999,
                    onCambio: (v) => setState(() => _inicio = v),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _Contador(
                    etiqueta: 'Dígitos',
                    valor: _digitos,
                    minimo: 1,
                    maximo: 4,
                    onCambio: (v) => setState(() => _digitos = v),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Numerar por columnas'),
              subtitle: const Text('Si no, se numera por filas (como se lee).'),
              value: _porColumnas,
              onChanged: (v) => setState(() => _porColumnas = v),
            ),
            Text(
              'Quedará: ${_ejemplo(_inicio)}, ${_ejemplo(_inicio + 1)}, ${_ejemplo(_inicio + 2)}…',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        FilledButton(
          onPressed: _tipo == null
              ? null
              : () => Navigator.pop(
                    context,
                    _OpcionesNumerar(
                      tipo: _tipo!,
                      prefijo: _prefijo.text.trim(),
                      inicio: _inicio,
                      digitos: _digitos,
                      porColumnas: _porColumnas,
                    ),
                  ),
          child: const Text('Numerar'),
        ),
      ],
    );
  }
}

class _Contador extends StatelessWidget {
  const _Contador({
    required this.etiqueta,
    required this.valor,
    required this.minimo,
    required this.maximo,
    required this.onCambio,
  });
  final String etiqueta;
  final int valor;
  final int minimo;
  final int maximo;
  final ValueChanged<int> onCambio;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(labelText: etiqueta),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: valor > minimo ? () => onCambio(valor - 1) : null,
            icon: const Icon(Icons.remove),
          ),
          Text('$valor', style: Theme.of(context).textTheme.titleMedium),
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: valor < maximo ? () => onCambio(valor + 1) : null,
            icon: const Icon(Icons.add),
          ),
        ],
      ),
    );
  }
}
