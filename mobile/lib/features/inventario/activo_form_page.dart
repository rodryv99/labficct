import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/datos/proveedores.dart';
import '../../core/dictado/dictado_frase.dart';
import '../../core/dictado/nucleo.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'dictado_activo.dart';
import 'inventario_comun.dart';

/// Alta de un activo o corrección de sus datos. El lugar y el estado solo se
/// eligen al darlo de alta; después cambian con un movimiento (ver la ficha).
class ActivoFormPage extends ConsumerStatefulWidget {
  const ActivoFormPage({super.key, this.inicial});

  /// null = alta de un activo nuevo.
  final Activo? inicial;

  @override
  ConsumerState<ActivoFormPage> createState() => _ActivoFormPageState();
}

class _ActivoFormPageState extends ConsumerState<ActivoFormPage> {
  final _form = GlobalKey<FormState>();
  final _codigo = TextEditingController();
  final _descripcion = TextEditingController();
  final _marca = TextEditingController();
  final _modelo = TextEditingController();
  final _serie = TextEditingController();
  final _responsable = TextEditingController();
  final _observaciones = TextEditingController();

  int? _tipo;
  int? _lugar;
  String _estado = 'operativo';
  DateTime? _fecha;
  bool _guardando = false;
  String? _error;
  Map<String, String> _errores = {};

  bool get _esNuevo => widget.inicial == null;

  @override
  void initState() {
    super.initState();
    final a = widget.inicial;
    if (a != null) {
      _codigo.text = a.codigo;
      _descripcion.text = a.descripcion;
      _marca.text = a.marca;
      _modelo.text = a.modelo;
      _serie.text = a.serie;
      _responsable.text = a.responsable;
      _observaciones.text = a.observaciones;
      _tipo = a.tipo;
      _fecha = DateTime.tryParse(a.fechaAdquisicion);
    }
  }

  @override
  void dispose() {
    _codigo.dispose();
    _descripcion.dispose();
    _marca.dispose();
    _modelo.dispose();
    _serie.dispose();
    _responsable.dispose();
    _observaciones.dispose();
    super.dispose();
  }

  Future<void> _elegirFecha() async {
    final ahora = DateTime.now();
    final dia = await showDatePicker(
      context: context,
      initialDate: _fecha ?? ahora,
      firstDate: DateTime(1990),
      lastDate: ahora,
    );
    if (dia != null && mounted) setState(() => _fecha = dia);
  }

  void _aplicarDictado(ResultadoActivo r) {
    setState(() {
      if (r.descripcion != null) _descripcion.text = r.descripcion!;
      if (r.codigo != null) _codigo.text = r.codigo!;
      if (r.marca != null) _marca.text = r.marca!;
      if (r.modelo != null) _modelo.text = r.modelo!;
      if (r.serie != null) _serie.text = r.serie!;
      if (r.observaciones != null) _observaciones.text = r.observaciones!;
      if (r.tipo != null) _tipo = r.tipo;
      if (r.fechaAdquisicion != null) _fecha = r.fechaAdquisicion;
      // El lugar y el estado solo se fijan al dar de alta.
      if (_esNuevo && r.lugar != null) _lugar = r.lugar;
      if (_esNuevo && r.estado != null) _estado = r.estado!;
    });
  }

  Future<void> _guardar() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _errores = {};
    });
    if (!_form.currentState!.validate()) return;
    if (_esNuevo && _lugar == null) {
      setState(() => _errores = {'lugar': 'Elige un lugar.'});
      return;
    }

    final datos = <String, dynamic>{
      'codigo': _codigo.text.trim(),
      'descripcion': _descripcion.text.trim(),
      'tipo': _tipo,
      'marca': _marca.text.trim(),
      'modelo': _modelo.text.trim(),
      'serie': _serie.text.trim(),
      'fecha_adquisicion': _fecha == null ? null : fechaIso(_fecha!),
      'responsable': _responsable.text.trim(),
      'observaciones': _observaciones.text.trim(),
    };

    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _guardando = true);
    try {
      final repo = ref.read(repositorioProvider);
      final Activo activo;
      if (_esNuevo) {
        activo = await repo.crearActivo({...datos, 'lugar': _lugar, 'estado': _estado});
      } else {
        activo = await repo.editarActivo(widget.inicial!.id, datos);
        contenedor.invalidate(activoProvider(activo.id));
      }
      refrescarInventario(contenedor);
      if (!mounted) return;
      avisar(context, _esNuevo ? 'Activo registrado: ${activo.codigo}.' : 'Cambios guardados.');
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errores = erroresDeCampos(e);
        _error = _errores.isEmpty ? mensajeDeError(e) : null;
      });
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final tipos = (ref.watch(tiposActivoProvider).value ?? const <TipoActivo>[])
        .where((t) => t.activo || t.id == _tipo)
        .toList();
    final lugares = (ref.watch(lugaresProvider).value ?? const <Lugar>[]).where((l) => l.activo).toList();

    return Scaffold(
      appBar: AppBar(title: Text(_esNuevo ? 'Registrar activo' : 'Editar ${widget.inicial!.codigo}')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _guardando ? null : _guardar,
            child: _guardando
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                : Text(_esNuevo ? 'Registrar activo' : 'Guardar cambios'),
          ),
        ),
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: esquema.errorContainer, borderRadius: BorderRadius.circular(10)),
                child: Text(_error!, style: TextStyle(color: esquema.onErrorContainer)),
              ),
            if (_esNuevo) ...[
              DictadoFrase<ResultadoActivo>(
                ejemplo: 'Ej.: Proyector Epson modelo X500, código INV-120, en el depósito, '
                    'operativo, comprado el 10 de marzo.',
                placeholder: 'Qué equipo es, código, marca y modelo, lugar, estado, fecha de compra',
                sustantivo: 'un activo',
                interpretar: (frase) {
                  final ahora = DateTime.now();
                  return interpretarDictadoActivo(
                    frase,
                    ContextoActivo(
                      hoy: DateTime(ahora.year, ahora.month, ahora.day),
                      tipos: [for (final t in tipos) ItemCatalogo(t.id, t.nombre)],
                      lugares: [for (final l in lugares) ItemCatalogo(l.id, l.nombre)],
                    ),
                  );
                },
                onAplicar: _aplicarDictado,
              ),
              const SizedBox(height: 14),
            ],
            TextFormField(
              controller: _codigo,
              textCapitalization: TextCapitalization.characters,
              maxLength: 30,
              inputFormatters: [
                TextInputFormatter.withFunction((anterior, nuevo) {
                  final texto = nuevo.text.toUpperCase().replaceAll(RegExp(r'\s+'), '');
                  return TextEditingValue(text: texto, selection: TextSelection.collapsed(offset: texto.length));
                }),
              ],
              decoration: InputDecoration(
                labelText: 'Código de activo',
                hintText: 'Letras y números. Ej.: A12345',
                errorText: _errores['codigo'],
              ),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe el código.' : null,
            ),
            DropdownButtonFormField<int?>(
              key: ValueKey('tipos-${tipos.length}'),
              initialValue: _tipo,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Tipo (opcional)'),
              items: [
                const DropdownMenuItem<int?>(value: null, child: Text('Sin tipo')),
                for (final t in tipos)
                  DropdownMenuItem<int?>(value: t.id, child: Text(t.nombre, overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (v) => setState(() => _tipo = v),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descripcion,
              textCapitalization: TextCapitalization.sentences,
              maxLength: 200,
              decoration: InputDecoration(
                labelText: 'Descripción',
                hintText: 'Ej.: Silla giratoria negra con apoyabrazos',
                errorText: _errores['descripcion'],
              ),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Describe el activo.' : null,
            ),
            if (_esNuevo) ...[
              const TituloSeccion('Dónde entra y en qué estado'),
              DropdownButtonFormField<int?>(
                key: ValueKey('lugares-${lugares.length}'),
                initialValue: _lugar,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: 'Lugar',
                  prefixIcon: const Icon(Icons.place_outlined),
                  errorText: _errores['lugar'],
                ),
                items: [
                  for (final l in lugares)
                    DropdownMenuItem<int?>(value: l.id, child: Text(l.nombre, overflow: TextOverflow.ellipsis)),
                ],
                onChanged: (v) => setState(() {
                  _lugar = v;
                  _errores = {..._errores}..remove('lugar');
                }),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _estado,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Estado'),
                items: [
                  for (final (valor, nombre) in estadosActivo)
                    if (valor != 'baja') DropdownMenuItem(value: valor, child: Text(nombre)),
                ],
                onChanged: (v) => setState(() => _estado = v ?? 'operativo'),
              ),
            ] else
              Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: esquema.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, size: 18, color: esquema.onSurfaceVariant),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'El lugar y el estado no se editan aquí: usa Trasladar, Cambiar estado o Dar de baja en la ficha, '
                        'y queda el movimiento.',
                        style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                      ),
                    ),
                  ],
                ),
              ),
            const TituloSeccion('Datos opcionales'),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _marca,
                    maxLength: 80,
                    decoration: InputDecoration(labelText: 'Marca', errorText: _errores['marca'], counterText: ''),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _modelo,
                    maxLength: 80,
                    decoration: InputDecoration(labelText: 'Modelo', errorText: _errores['modelo'], counterText: ''),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _serie,
              maxLength: 80,
              decoration: InputDecoration(labelText: 'Número de serie', errorText: _errores['serie'], counterText: ''),
            ),
            const SizedBox(height: 12),
            InkWell(
              onTap: _elegirFecha,
              borderRadius: BorderRadius.circular(10),
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: 'Fecha de adquisición (opcional)',
                  prefixIcon: const Icon(Icons.event_outlined),
                  suffixIcon: _fecha == null
                      ? null
                      : IconButton(
                          tooltip: 'Quitar',
                          icon: const Icon(Icons.close),
                          onPressed: () => setState(() => _fecha = null),
                        ),
                ),
                child: Text(
                  _fecha == null ? 'Sin fecha' : fechaCortaIso(fechaIso(_fecha!)),
                  style: _fecha == null ? TextStyle(color: esquema.onSurfaceVariant) : null,
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _responsable,
              maxLength: 120,
              decoration: const InputDecoration(
                labelText: 'Responsable (opcional)',
                hintText: 'Ej.: 5599-HIGUERAS HUANCA LUIS ENRIQUE',
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _observaciones,
              textCapitalization: TextCapitalization.sentences,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Observaciones (opcional)',
                hintText: 'Detalles que ayuden a reconocerlo o a entender su estado.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
