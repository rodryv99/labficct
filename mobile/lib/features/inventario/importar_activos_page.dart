import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/seleccion.dart';

/// Campos de un activo que puede traer una planilla (en el orden en que se muestran).
const _camposImportables = [
  ('codigo', 'Código'),
  ('descripcion', 'Descripción'),
  ('lugar', 'Lugar'),
  ('tipo', 'Tipo'),
  ('marca', 'Marca'),
  ('modelo', 'Modelo'),
  ('serie', 'Número de serie'),
  ('estado', 'Estado'),
  ('fecha_adquisicion', 'Fecha de adquisición'),
  ('observaciones', 'Observaciones'),
];

/// Importar activos desde un Excel o CSV. Primero analiza (sin guardar) y
/// muestra una vista previa; al confirmar, crea los activos.
class ImportarActivosPage extends ConsumerStatefulWidget {
  const ImportarActivosPage({super.key});

  @override
  ConsumerState<ImportarActivosPage> createState() => _ImportarActivosPageState();
}

class _ImportarActivosPageState extends ConsumerState<ImportarActivosPage> {
  Uint8List? _bytes;
  String? _nombre;
  String _titulos = 'auto';
  List<String>? _mapeo;
  int? _lugarPorDefecto;
  String _lugarNombre = '';

  Map<String, dynamic>? _resultado;
  bool _analizando = false;
  bool _confirmando = false;
  String? _error;

  Future<void> _elegirArchivo() async {
    List<PlatformFile> elegido;
    try {
      elegido = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['xlsx', 'xlsm', 'csv', 'txt'],
      );
    } catch (_) {
      if (mounted) avisar(context, 'No se pudo abrir el selector de archivos.', error: true);
      return;
    }
    if (elegido.isEmpty) return;
    final archivo = elegido.first;
    Uint8List bytes;
    try {
      bytes = await archivo.readAsBytes();
    } catch (_) {
      if (mounted) avisar(context, 'No se pudo leer el archivo.', error: true);
      return;
    }
    setState(() {
      _bytes = bytes;
      _nombre = archivo.name;
      _mapeo = null;
      _titulos = 'auto';
      _resultado = null;
      _error = null;
    });
    await _analizar();
  }

  Future<void> _analizar() async {
    if (_bytes == null || _nombre == null) return;
    setState(() {
      _analizando = true;
      _error = null;
    });
    try {
      final r = await ref.read(repositorioProvider).importarActivos(
            bytes: _bytes!,
            nombre: _nombre!,
            confirmar: false,
            titulos: _titulos,
            mapeo: _mapeo,
            lugarPorDefecto: _lugarPorDefecto,
          );
      // El mapeo actual sale de las columnas detectadas, para poder ajustarlo.
      final columnas = (r['columnas'] as List? ?? const []);
      final mapeo = List<String>.filled(columnas.length, '');
      for (final c in columnas) {
        final mapa = c as Map<String, dynamic>;
        final indice = (mapa['indice'] as num?)?.toInt() ?? 0;
        if (indice >= 0 && indice < mapeo.length) mapeo[indice] = (mapa['campo'] ?? '').toString();
      }
      setState(() {
        _resultado = r;
        _mapeo = mapeo;
      });
    } catch (e) {
      setState(() => _error = mensajeDeError(e));
    } finally {
      if (mounted) setState(() => _analizando = false);
    }
  }

  void _cambiarColumna(int indice, String campo) {
    final mapeo = [...?_mapeo];
    while (mapeo.length <= indice) {
      mapeo.add('');
    }
    // Un mismo campo no puede estar en dos columnas: se quita de la anterior.
    if (campo.isNotEmpty) {
      for (var i = 0; i < mapeo.length; i++) {
        if (i != indice && mapeo[i] == campo) mapeo[i] = '';
      }
    }
    mapeo[indice] = campo;
    setState(() => _mapeo = mapeo);
    _analizar();
  }

  Future<void> _elegirLugar() async {
    final lugares = await ref.read(lugaresProvider.future);
    if (!mounted) return;
    final sel = await seleccionar(
      context,
      titulo: 'Lugar por defecto',
      multiple: false,
      opciones: Future.value([
        const OpcionSeleccion(0, 'Sin lugar por defecto'),
        for (final l in lugares) OpcionSeleccion(l.id, l.nombre),
      ]),
      seleccion: {_lugarPorDefecto ?? 0},
    );
    if (sel == null || sel.isEmpty) return;
    setState(() {
      _lugarPorDefecto = sel.first == 0 ? null : sel.first;
      _lugarNombre = sel.first == 0 ? '' : lugares.firstWhere((l) => l.id == sel.first).nombre;
    });
    _analizar();
  }

  Future<void> _confirmar() async {
    if (_bytes == null) return;
    setState(() => _confirmando = true);
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      final r = await ref.read(repositorioProvider).importarActivos(
            bytes: _bytes!,
            nombre: _nombre!,
            confirmar: true,
            titulos: _titulos,
            mapeo: _mapeo,
            lugarPorDefecto: _lugarPorDefecto,
          );
      refrescarInventario(contenedor);
      if (!mounted) return;
      final creados = (r['creados'] as num?)?.toInt() ?? 0;
      avisar(context, 'Se importaron $creados activo(s).');
      Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        setState(() => _confirmando = false);
        avisar(context, mensajeDeError(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _resultado;
    final tema = Theme.of(context);
    final faltan = (r?['faltan'] as List? ?? const []).map((e) => e.toString()).toList();
    final validas = (r?['validas'] as num?)?.toInt() ?? 0;
    final puedeConfirmar = r != null && faltan.isEmpty && validas > 0 && !_analizando;

    return Scaffold(
      appBar: AppBar(title: const Text('Importar activos')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
        children: [
          Text(
            'Sube un Excel (.xlsx) o un CSV con una fila por activo. Luego indica qué columna '
            'es cada dato y revisa la vista previa antes de importar.',
            style: tema.textTheme.bodyMedium?.copyWith(color: tema.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _analizando || _confirmando ? null : _elegirArchivo,
            icon: const Icon(Icons.attach_file),
            label: Text(_nombre ?? 'Elegir archivo'),
          ),
          if (_analizando) const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator()),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: tema.colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(_error!, style: TextStyle(color: tema.colorScheme.onErrorContainer)),
            ),
          ],
          if (r != null) ...[
            const TituloSeccion('¿La primera fila son los títulos?'),
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: 'auto', label: Text('Automático')),
                ButtonSegment(value: 'si', label: Text('Sí')),
                ButtonSegment(value: 'no', label: Text('No')),
              ],
              selected: {_titulos},
              onSelectionChanged: (s) {
                setState(() => _titulos = s.first);
                _analizar();
              },
            ),
            const TituloSeccion('Qué es cada columna'),
            for (final columna in (r['columnas'] as List? ?? const []))
              _FilaColumna(
                columna: columna as Map<String, dynamic>,
                onCampo: _cambiarColumna,
              ),
            const SizedBox(height: 8),
            _Selector(
              etiqueta: 'Lugar por defecto (para filas sin lugar)',
              valor: _lugarPorDefecto == null ? 'Ninguno' : _lugarNombre,
              onTap: _elegirLugar,
            ),
            const TituloSeccion('Resumen'),
            _Resumen(resultado: r),
            if (faltan.isNotEmpty) ...[
              const SizedBox(height: 10),
              _Aviso(
                color: tema.colorScheme.errorContainer,
                frente: tema.colorScheme.onErrorContainer,
                icono: Icons.error_outline,
                titulo: 'Faltan columnas obligatorias',
                lineas: faltan,
              ),
            ],
            _listaMensajes('Errores', (r['errores'] as List? ?? const []), tema.colorScheme.error),
            _listaMensajes('Avisos', (r['avisos'] as List? ?? const []), tema.colorScheme.tertiary),
            if ((r['ejemplo'] as List? ?? const []).isNotEmpty) ...[
              const TituloSeccion('Ejemplo (primeras filas)'),
              for (final ej in (r['ejemplo'] as List).take(3)) _Ejemplo(datos: ej as Map<String, dynamic>),
            ],
          ],
        ],
      ),
      bottomNavigationBar: r == null
          ? null
          : Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + MediaQuery.of(context).padding.bottom),
              child: FilledButton.icon(
                onPressed: puedeConfirmar && !_confirmando ? _confirmar : null,
                icon: _confirmando
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.file_download_done),
                label: Text(validas > 0 ? 'Importar $validas activo(s)' : 'Nada para importar'),
              ),
            ),
    );
  }

  Widget _listaMensajes(String titulo, List<dynamic> mensajes, Color color) {
    if (mensajes.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$titulo (${mensajes.length})', style: TextStyle(color: color, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          for (final m in mensajes.take(20))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Text('• ${m.toString()}', style: Theme.of(context).textTheme.bodySmall),
            ),
        ],
      ),
    );
  }
}

class _FilaColumna extends StatelessWidget {
  const _FilaColumna({required this.columna, required this.onCampo});
  final Map<String, dynamic> columna;
  final void Function(int indice, String campo) onCampo;

  @override
  Widget build(BuildContext context) {
    final indice = (columna['indice'] as num?)?.toInt() ?? 0;
    final titulo = (columna['titulo'] ?? '').toString();
    final campo = (columna['campo'] ?? '').toString();
    final muestra = (columna['muestra'] as List? ?? const []).map((e) => e.toString()).where((s) => s.isNotEmpty);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(titulo.isEmpty ? 'Columna ${indice + 1}' : titulo,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                if (muestra.isNotEmpty)
                  Text(
                    muestra.take(2).join(', '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 150,
            child: DropdownButtonFormField<String>(
              initialValue: campo,
              isExpanded: true,
              decoration: const InputDecoration(isDense: true),
              items: [
                const DropdownMenuItem(value: '', child: Text('(ignorar)')),
                for (final (valor, etiqueta) in _camposImportables)
                  DropdownMenuItem(value: valor, child: Text(etiqueta)),
              ],
              onChanged: (v) => onCampo(indice, v ?? ''),
            ),
          ),
        ],
      ),
    );
  }
}

class _Resumen extends StatelessWidget {
  const _Resumen({required this.resultado});
  final Map<String, dynamic> resultado;

  int _n(String clave) => (resultado[clave] as num?)?.toInt() ?? 0;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _chip(context, 'Filas: ${_n('total')}', Tono.neutro),
        _chip(context, 'Se importan: ${_n('validas')}', Tono.exito),
        if (_n('existentes') > 0) _chip(context, 'Ya existen: ${_n('existentes')}', Tono.aviso),
        if (_n('con_error') > 0) _chip(context, 'Con error: ${_n('con_error')}', Tono.peligro),
      ],
    );
  }

  Widget _chip(BuildContext context, String texto, Tono tono) => Etiqueta(texto, tono: tono);
}

class _Aviso extends StatelessWidget {
  const _Aviso({
    required this.color,
    required this.frente,
    required this.icono,
    required this.titulo,
    required this.lineas,
  });
  final Color color;
  final Color frente;
  final IconData icono;
  final String titulo;
  final List<String> lineas;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icono, size: 18, color: frente),
              const SizedBox(width: 8),
              Text(titulo, style: TextStyle(color: frente, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 4),
          Text(lineas.join(', '), style: TextStyle(color: frente)),
        ],
      ),
    );
  }
}

class _Ejemplo extends StatelessWidget {
  const _Ejemplo({required this.datos});
  final Map<String, dynamic> datos;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    String v(String k) => (datos[k] ?? '').toString();
    final subt = [v('tipo'), v('lugar'), v('estado')].where((s) => s.isNotEmpty).join(' · ');
    return Card(
      child: ListTile(
        dense: true,
        title: Text('${v('codigo')} · ${v('descripcion')}'),
        subtitle: subt.isEmpty ? null : Text(subt, style: tema.textTheme.bodySmall),
      ),
    );
  }
}

class _Selector extends StatelessWidget {
  const _Selector({required this.etiqueta, required this.valor, required this.onTap});
  final String etiqueta;
  final String valor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: InputDecorator(
        decoration: InputDecoration(labelText: etiqueta, border: const OutlineInputBorder(), isDense: true),
        child: Row(
          children: [
            Expanded(child: Text(valor)),
            const Icon(Icons.arrow_drop_down),
          ],
        ),
      ),
    );
  }
}
