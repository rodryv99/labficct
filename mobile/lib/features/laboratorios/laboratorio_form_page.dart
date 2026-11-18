import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';

/// Estados de un laboratorio (coinciden con el backend).
const estadosLaboratorio = [
  ('operativo', 'Operativo'),
  ('mantenimiento', 'En mantenimiento'),
  ('cerrado', 'Cerrado'),
];

/// Crear o editar un laboratorio. [inicial] null = nuevo.
class LaboratorioFormPage extends ConsumerStatefulWidget {
  const LaboratorioFormPage({super.key, this.inicial});
  final Laboratorio? inicial;

  @override
  ConsumerState<LaboratorioFormPage> createState() => _LaboratorioFormPageState();
}

class _LaboratorioFormPageState extends ConsumerState<LaboratorioFormPage> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _codigo;
  late final TextEditingController _nombre;
  late final TextEditingController _ubicacion;
  late final TextEditingController _capacidad;
  late final TextEditingController _notas;
  late final TextEditingController _filas;
  late final TextEditingController _columnas;
  late String _estado;
  late bool _activo;
  bool _guardando = false;
  final _errores = <String, String>{};

  bool get _esNuevo => widget.inicial == null;

  @override
  void initState() {
    super.initState();
    final l = widget.inicial;
    _codigo = TextEditingController(text: l?.codigo ?? '');
    _nombre = TextEditingController(text: l?.nombre ?? '');
    _ubicacion = TextEditingController(text: l?.ubicacion ?? '');
    _capacidad = TextEditingController(text: l != null ? '${l.capacidad}' : '0');
    _notas = TextEditingController(text: l?.notas ?? '');
    _filas = TextEditingController(text: l != null ? '${l.filas}' : '8');
    _columnas = TextEditingController(text: l != null ? '${l.columnas}' : '10');
    _estado = l?.estado ?? 'operativo';
    _activo = l?.activo ?? true;
  }

  @override
  void dispose() {
    _codigo.dispose();
    _nombre.dispose();
    _ubicacion.dispose();
    _capacidad.dispose();
    _notas.dispose();
    _filas.dispose();
    _columnas.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _guardando = true;
      _errores.clear();
    });
    final datos = <String, dynamic>{
      'codigo': _codigo.text.trim(),
      'nombre': _nombre.text.trim(),
      'ubicacion': _ubicacion.text.trim(),
      'capacidad': int.tryParse(_capacidad.text.trim()) ?? 0,
      'estado': _estado,
      'notas': _notas.text.trim(),
      'activo': _activo,
      if (_esNuevo) 'filas': int.tryParse(_filas.text.trim()) ?? 8,
      if (_esNuevo) 'columnas': int.tryParse(_columnas.text.trim()) ?? 10,
    };
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      final repo = ref.read(repositorioProvider);
      final lab = await repo.guardarLaboratorio(datos, id: widget.inicial?.id);
      refrescarLaboratorios(contenedor, id: lab.id);
      if (!mounted) return;
      avisar(context, _esNuevo ? 'Laboratorio creado.' : 'Cambios guardados.');
      Navigator.of(context).pop(lab);
    } catch (e) {
      if (!mounted) return;
      setState(() => _errores.addAll(erroresDeCampos(e)));
      avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  Future<void> _eliminar() async {
    final l = widget.inicial!;
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('¿Borrar laboratorio?'),
        content: Text('Se eliminará "${l.codigo} · ${l.nombre}" con su distribución y credenciales. '
            'No se puede deshacer.'),
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
      await ref.read(repositorioProvider).eliminarLaboratorio(l.id);
      refrescarLaboratorios(contenedor, id: l.id);
      if (!mounted) return;
      avisar(context, 'Laboratorio borrado.');
      // Vuelve a la lista (evita quedar en el detalle de un laboratorio borrado).
      context.go('/laboratorios');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_esNuevo ? 'Nuevo laboratorio' : 'Editar laboratorio'),
        actions: [
          if (!_esNuevo)
            IconButton(
              tooltip: 'Borrar',
              icon: const Icon(Icons.delete_outline),
              onPressed: _guardando ? null : _eliminar,
            ),
        ],
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            TextFormField(
              controller: _codigo,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText: 'Código',
                hintText: 'LAB-1',
                errorText: _errores['codigo'],
              ),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe el código.' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _nombre,
              decoration: InputDecoration(labelText: 'Nombre', errorText: _errores['nombre']),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe el nombre.' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _ubicacion,
              decoration: InputDecoration(
                labelText: 'Ubicación (opcional)',
                hintText: 'Bloque 2, planta baja',
                errorText: _errores['ubicacion'],
              ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _capacidad,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                labelText: 'Capacidad (estudiantes)',
                errorText: _errores['capacidad'],
              ),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: _estado,
              decoration: const InputDecoration(labelText: 'Estado'),
              items: [
                for (final (valor, etiqueta) in estadosLaboratorio)
                  DropdownMenuItem(value: valor, child: Text(etiqueta)),
              ],
              onChanged: (v) => setState(() => _estado = v ?? 'operativo'),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _notas,
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: 'Notas (opcional)',
                hintText: 'Llaves, horarios de limpieza, etc.',
                errorText: _errores['notas'],
              ),
            ),
            if (_esNuevo) ...[
              const TituloSeccion('Tamaño de la grilla'),
              Text(
                'Cuántas filas y columnas tiene el aula. Después se dibuja la distribución y puedes cambiar el tamaño.',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _filas,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: InputDecoration(labelText: 'Filas', errorText: _errores['filas']),
                      validator: _validarDimension,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _columnas,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: InputDecoration(labelText: 'Columnas', errorText: _errores['columnas']),
                      validator: _validarDimension,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Activo'),
              subtitle: const Text('Los laboratorios inactivos no aparecen en las listas.'),
              value: _activo,
              onChanged: (v) => setState(() => _activo = v),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Padding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + MediaQuery.of(context).padding.bottom),
        child: FilledButton(
          onPressed: _guardando ? null : _guardar,
          child: _guardando
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(_esNuevo ? 'Crear laboratorio' : 'Guardar cambios'),
        ),
      ),
    );
  }

  String? _validarDimension(String? v) {
    final n = int.tryParse((v ?? '').trim());
    if (n == null || n < 1 || n > 40) return '1 a 40.';
    return null;
  }
}
