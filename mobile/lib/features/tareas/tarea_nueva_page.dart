import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/seleccion.dart';

/// Nueva tarjeta para el pizarrón. Los responsables reciben un aviso.
class TareaNuevaPage extends ConsumerStatefulWidget {
  const TareaNuevaPage({super.key});

  @override
  ConsumerState<TareaNuevaPage> createState() => _TareaNuevaPageState();
}

class _TareaNuevaPageState extends ConsumerState<TareaNuevaPage> {
  static const _rolesResponsables = 'auxiliar,admin';

  final _form = GlobalKey<FormState>();
  final _titulo = TextEditingController();
  final _descripcion = TextEditingController();

  String _prioridad = 'normal';
  int? _laboratorio;
  final Set<int> _responsables = {};
  DateTime? _fechaLimite;
  bool _guardando = false;
  String? _error;
  Map<String, String> _errores = {};

  @override
  void dispose() {
    _titulo.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  Future<void> _elegirResponsables() async {
    final elegidos = await seleccionar(
      context,
      titulo: 'Responsables',
      seleccion: _responsables,
      opciones: ref.read(personasProvider(_rolesResponsables).future).then(
            (l) => [for (final p in l) OpcionSeleccion(p.id, p.nombreCompleto, p.email)],
          ),
    );
    if (elegidos != null && mounted) {
      setState(() => _responsables
        ..clear()
        ..addAll(elegidos));
    }
  }

  Future<void> _elegirFecha() async {
    final ahora = DateTime.now();
    final hoy = DateTime(ahora.year, ahora.month, ahora.day);
    final elegida = await showDatePicker(
      context: context,
      initialDate: _fechaLimite ?? hoy.add(const Duration(days: 7)),
      firstDate: hoy,
      lastDate: DateTime(hoy.year + 2, hoy.month, hoy.day),
      helpText: 'Fecha límite',
    );
    if (elegida != null && mounted) setState(() => _fechaLimite = elegida);
  }

  Future<void> _guardar() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _errores = {};
    });
    if (!_form.currentState!.validate()) return;

    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _guardando = true);
    try {
      await ref.read(repositorioProvider).crearTarea({
        'titulo': _titulo.text.trim(),
        'descripcion': _descripcion.text.trim(),
        'prioridad': _prioridad,
        'laboratorio': _laboratorio,
        'responsables': _responsables.toList(),
        'fecha_limite': _fechaLimite == null ? null : fechaIso(_fechaLimite!),
      });
      contenedor.invalidate(tareasProvider);
      if (!mounted) return;
      avisar(
        context,
        _responsables.isEmpty ? 'Tarea creada.' : 'Tarea creada. Les avisamos a los responsables.',
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errores = erroresDeCampos(e);
        _error = mensajeDeError(e);
      });
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final laboratorios = ref.watch(laboratoriosProvider).value?.where((l) => l.activo).toList() ?? const [];
    final personas = ref.watch(personasProvider(_rolesResponsables)).value ?? const <UsuarioOpcion>[];
    final nombres = [for (final p in personas) if (_responsables.contains(p.id)) p.nombreCompleto];

    return Scaffold(
      appBar: AppBar(title: const Text('Nueva tarea')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _guardando ? null : _guardar,
            child: _guardando
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                : const Text('Crear tarea'),
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
            TextFormField(
              controller: _titulo,
              textCapitalization: TextCapitalization.sentences,
              maxLength: 150,
              decoration: InputDecoration(
                labelText: 'Título',
                hintText: 'Ej.: Instalar Docker Desktop en LAB-3',
                errorText: _errores['titulo'],
              ),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe un título.' : null,
            ),
            TextFormField(
              controller: _descripcion,
              textCapitalization: TextCapitalization.sentences,
              minLines: 2,
              maxLines: 5,
              decoration: InputDecoration(
                labelText: 'Descripción (opcional)',
                hintText: 'Detalles, pasos o lo que haga falta saber',
                alignLabelWithHint: true,
                errorText: _errores['descripcion'],
              ),
            ),

            const TituloSeccion('Prioridad'),
            SizedBox(
              width: double.infinity,
              child: SegmentedButton<String>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: 'baja', label: Text('Baja')),
                  ButtonSegment(value: 'normal', label: Text('Normal')),
                  ButtonSegment(value: 'alta', label: Text('Alta')),
                ],
                selected: {_prioridad},
                onSelectionChanged: (s) => setState(() => _prioridad = s.first),
              ),
            ),

            const TituloSeccion('Dónde y quién'),
            DropdownButtonFormField<int?>(
              key: ValueKey('labs-${laboratorios.length}'),
              initialValue: _laboratorio,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'Laboratorio (opcional)',
                prefixIcon: const Icon(Icons.computer_outlined),
                errorText: _errores['laboratorio'],
              ),
              items: [
                const DropdownMenuItem<int?>(value: null, child: Text('Ninguno en especial')),
                for (final l in laboratorios)
                  DropdownMenuItem<int?>(
                    value: l.id,
                    child: Text('${l.codigo} · ${l.nombre}', overflow: TextOverflow.ellipsis),
                  ),
              ],
              onChanged: (v) => setState(() => _laboratorio = v),
            ),
            const SizedBox(height: 12),
            InkWell(
              onTap: _elegirResponsables,
              borderRadius: BorderRadius.circular(10),
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: 'Responsables',
                  prefixIcon: const Icon(Icons.people_outline),
                  suffixIcon: const Icon(Icons.arrow_drop_down),
                  errorText: _errores['responsables'],
                ),
                child: Text(
                  _responsables.isEmpty
                      ? 'Sin asignar (opcional)'
                      : (nombres.isEmpty ? '${_responsables.length} elegidos' : nombres.join(', ')),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: _responsables.isEmpty ? TextStyle(color: esquema.onSurfaceVariant) : null,
                ),
              ),
            ),
            const SizedBox(height: 12),
            InkWell(
              onTap: _elegirFecha,
              borderRadius: BorderRadius.circular(10),
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: 'Fecha límite',
                  prefixIcon: const Icon(Icons.event_outlined),
                  errorText: _errores['fecha_limite'],
                  suffixIcon: _fechaLimite == null
                      ? null
                      : IconButton(
                          tooltip: 'Quitar fecha',
                          onPressed: () => setState(() => _fechaLimite = null),
                          icon: const Icon(Icons.close),
                        ),
                ),
                child: Text(
                  _fechaLimite == null ? 'Sin fecha (opcional)' : fechaLarga(_fechaLimite!),
                  style: _fechaLimite == null ? TextStyle(color: esquema.onSurfaceVariant) : null,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Los responsables recibirán un aviso. Todos los auxiliares ven el pizarrón.',
              style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
