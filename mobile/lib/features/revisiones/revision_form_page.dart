import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/seleccion.dart';

const unidadesFrecuencia = [
  ('dias', 'días'),
  ('semanas', 'semanas'),
  ('meses', 'meses'),
];

/// Crea o edita una revisión programada. [inicial] null = nueva.
class RevisionFormPage extends ConsumerStatefulWidget {
  const RevisionFormPage({super.key, this.inicial});
  final Revision? inicial;

  @override
  ConsumerState<RevisionFormPage> createState() => _RevisionFormPageState();
}

class _RevisionFormPageState extends ConsumerState<RevisionFormPage> {
  int? _laboratorio;
  final _titulo = TextEditingController();
  final _instrucciones = TextEditingController();
  final _cada = TextEditingController(text: '1');
  String _unidad = 'semanas';
  String _proximaFecha = '';
  int? _responsable;
  bool _activa = true;
  bool _guardando = false;
  final _errores = <String, String>{};

  bool get _esNuevo => widget.inicial == null;

  @override
  void initState() {
    super.initState();
    final r = widget.inicial;
    if (r != null) {
      _laboratorio = r.laboratorio;
      _titulo.text = r.titulo;
      _instrucciones.text = r.instrucciones;
      _cada.text = '${r.cada}';
      _unidad = r.unidad.isEmpty ? 'semanas' : r.unidad;
      _proximaFecha = r.proximaFecha;
      _responsable = r.responsable;
      _activa = r.activa;
    } else {
      final manana = DateTime.now().add(const Duration(days: 1));
      _proximaFecha = _iso(manana);
    }
  }

  @override
  void dispose() {
    _titulo.dispose();
    _instrucciones.dispose();
    _cada.dispose();
    super.dispose();
  }

  String _iso(DateTime f) =>
      '${f.year.toString().padLeft(4, '0')}-${f.month.toString().padLeft(2, '0')}-${f.day.toString().padLeft(2, '0')}';

  Future<void> _elegirLaboratorio() async {
    final lista = await ref.read(laboratoriosProvider.future);
    if (!mounted) return;
    final sel = await seleccionar(
      context,
      titulo: 'Laboratorio',
      multiple: false,
      opciones: Future.value([
        for (final l in lista.where((l) => l.activo)) OpcionSeleccion(l.id, l.codigo, l.nombre),
      ]),
      seleccion: _laboratorio == null ? {} : {_laboratorio!},
    );
    if (sel != null && sel.isNotEmpty) setState(() => _laboratorio = sel.first);
  }

  Future<void> _elegirResponsable() async {
    final lista = await ref.read(personasProvider('auxiliar,admin').future);
    if (!mounted) return;
    final sel = await seleccionar(
      context,
      titulo: 'Responsable',
      multiple: false,
      opciones: Future.value([
        const OpcionSeleccion(0, 'Todos los auxiliares'),
        for (final p in lista) OpcionSeleccion(p.id, p.nombreCompleto),
      ]),
      seleccion: {_responsable ?? 0},
    );
    if (sel != null && sel.isNotEmpty) setState(() => _responsable = sel.first == 0 ? null : sel.first);
  }

  Future<void> _elegirFecha() async {
    final base = DateTime.tryParse(_proximaFecha) ?? DateTime.now();
    final f = await showDatePicker(
      context: context,
      initialDate: base,
      firstDate: DateTime(DateTime.now().year - 1),
      lastDate: DateTime(DateTime.now().year + 3),
    );
    if (f != null) setState(() => _proximaFecha = _iso(f));
  }

  Future<void> _guardar() async {
    setState(() => _errores.clear());
    if (_laboratorio == null) {
      avisar(context, 'Elige el laboratorio.', error: true);
      return;
    }
    if (_titulo.text.trim().isEmpty) {
      setState(() => _errores['titulo'] = 'Escribe el título.');
      return;
    }
    final cada = int.tryParse(_cada.text.trim()) ?? 0;
    if (cada < 1 || cada > 365) {
      setState(() => _errores['cada'] = '1 a 365.');
      return;
    }
    setState(() => _guardando = true);
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).guardarRevision(
        {
          'laboratorio': _laboratorio,
          'titulo': _titulo.text.trim(),
          'instrucciones': _instrucciones.text.trim(),
          'cada': cada,
          'unidad': _unidad,
          'proxima_fecha': _proximaFecha,
          'responsable': _responsable,
          'activa': _activa,
        },
        id: widget.inicial?.id,
      );
      refrescarRevisiones(contenedor);
      if (!mounted) return;
      avisar(context, _esNuevo ? 'Revisión programada.' : 'Cambios guardados.');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        _errores.addAll(erroresDeCampos(e));
      });
      avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final laboratorios = ref.watch(laboratoriosProvider).value ?? const [];
    final personas = ref.watch(personasProvider('auxiliar,admin')).value ?? const [];
    final lab = laboratorios.where((l) => l.id == _laboratorio).firstOrNull;
    final responsableNombre = _responsable == null
        ? 'Todos los auxiliares'
        : personas.where((p) => p.id == _responsable).map((p) => p.nombreCompleto).firstOrNull ??
            widget.inicial?.responsableNombre ??
            '—';

    return Scaffold(
      appBar: AppBar(title: Text(_esNuevo ? 'Nueva revisión' : 'Editar revisión')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
        children: [
          _Selector(
            etiqueta: 'Laboratorio',
            valor: lab == null ? null : '${lab.codigo} · ${lab.nombre}',
            onTap: _elegirLaboratorio,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _titulo,
            decoration: InputDecoration(
              labelText: 'Título',
              hintText: 'Revisión de equipos',
              errorText: _errores['titulo'],
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _instrucciones,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Instrucciones (opcional)'),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 110,
                child: TextField(
                  controller: _cada,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: InputDecoration(labelText: 'Cada', errorText: _errores['cada']),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _unidad,
                  decoration: const InputDecoration(labelText: 'Unidad'),
                  items: [
                    for (final (valor, etiqueta) in unidadesFrecuencia)
                      DropdownMenuItem(value: valor, child: Text(etiqueta)),
                  ],
                  onChanged: (v) => setState(() => _unidad = v ?? 'semanas'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _Selector(
            etiqueta: 'Próxima fecha',
            valor: _proximaFecha.isEmpty ? null : _proximaFecha,
            icono: Icons.event,
            onTap: _elegirFecha,
          ),
          const SizedBox(height: 8),
          _Selector(etiqueta: 'Responsable', valor: responsableNombre, onTap: _elegirResponsable),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Activa'),
            subtitle: const Text('Si se desactiva, no se abren tareas ni avisos.'),
            value: _activa,
            onChanged: (v) => setState(() => _activa = v),
          ),
        ],
      ),
      bottomNavigationBar: Padding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + MediaQuery.of(context).padding.bottom),
        child: FilledButton(
          onPressed: _guardando ? null : _guardar,
          child: _guardando
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(_esNuevo ? 'Programar revisión' : 'Guardar cambios'),
        ),
      ),
    );
  }
}

class _Selector extends StatelessWidget {
  const _Selector({required this.etiqueta, required this.valor, required this.onTap, this.icono});
  final String etiqueta;
  final String? valor;
  final VoidCallback onTap;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: InputDecorator(
        decoration: InputDecoration(labelText: etiqueta, border: const OutlineInputBorder()),
        child: Row(
          children: [
            Expanded(
              child: Text(
                valor ?? 'Elegir…',
                style: TextStyle(color: valor == null ? Theme.of(context).hintColor : null),
              ),
            ),
            Icon(icono ?? Icons.arrow_drop_down),
          ],
        ),
      ),
    );
  }
}
