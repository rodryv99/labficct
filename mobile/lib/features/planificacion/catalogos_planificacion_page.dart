import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/seleccion.dart';

/// Periodos, materias y docentes en una sola pantalla con pestañas.
class CatalogosPlanificacionPage extends ConsumerStatefulWidget {
  const CatalogosPlanificacionPage({super.key});

  @override
  ConsumerState<CatalogosPlanificacionPage> createState() => _CatalogosPlanificacionPageState();
}

class _CatalogosPlanificacionPageState extends ConsumerState<CatalogosPlanificacionPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this)
    ..addListener(() => setState(() {}));

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  void _agregar() {
    switch (_tabs.index) {
      case 0:
        _editarPeriodo(context, ref);
      case 1:
        _editarMateria(context, ref);
      case 2:
        _editarDocente(context, ref);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Planificación · catálogos'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'Periodos'), Tab(text: 'Materias'), Tab(text: 'Docentes')],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _agregar,
        icon: const Icon(Icons.add),
        label: Text(['Periodo', 'Materia', 'Docente'][_tabs.index]),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [_PeriodosTab(), _MateriasTab(), _DocentesTab()],
      ),
    );
  }
}

// ── Periodos ──
class _PeriodosTab extends ConsumerWidget {
  const _PeriodosTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final periodos = ref.watch(periodosProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(periodosProvider.future),
      child: periodos.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ListView(children: [
          const SizedBox(height: 80),
          EstadoError(error: e, onReintentar: () => ref.invalidate(periodosProvider)),
        ]),
        data: (lista) {
          if (lista.isEmpty) {
            return ListView(children: const [
              SizedBox(height: 80),
              EstadoVacio(icono: Icons.event_note_outlined, titulo: 'Sin periodos'),
            ]);
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 90),
            itemCount: lista.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final p = lista[i];
              return ListTile(
                title: Row(
                  children: [
                    Flexible(child: Text(p.nombre)),
                    if (p.vigente) ...[const SizedBox(width: 8), const Etiqueta('Vigente', tono: Tono.exito)],
                  ],
                ),
                subtitle: Text('${p.fechaInicio} → ${p.fechaFin} · ${p.totalHorarios} clases'),
                trailing: PopupMenuButton<String>(
                  onSelected: (v) {
                    if (v == 'editar') _editarPeriodo(context, ref, p);
                    if (v == 'clonar') _clonar(context, ref, p, lista);
                    if (v == 'borrar') _borrarPeriodo(context, ref, p);
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'editar', child: Text('Editar')),
                    PopupMenuItem(value: 'clonar', child: Text('Clonar horarios a otro…')),
                    PopupMenuItem(value: 'borrar', child: Text('Borrar')),
                  ],
                ),
                onTap: () => _editarPeriodo(context, ref, p),
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _clonar(BuildContext context, WidgetRef ref, Periodo origen, List<Periodo> todos) async {
    final otros = todos.where((p) => p.id != origen.id).toList();
    if (otros.isEmpty) {
      avisar(context, 'Necesitas otro periodo como destino.', error: true);
      return;
    }
    final sel = await seleccionar(
      context,
      titulo: 'Clonar los horarios a…',
      multiple: false,
      opciones: Future.value([for (final p in otros) OpcionSeleccion(p.id, p.nombre)]),
    );
    if (sel == null || sel.isEmpty) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      final r = await ref.read(repositorioProvider).clonarHorarios(origen.id, sel.first);
      refrescarPlanificacion(contenedor);
      if (!context.mounted) return;
      final extra = r.omitidos.isEmpty ? '' : ' Se saltaron ${r.omitidos.length} por choque.';
      avisar(context, 'Se clonaron ${r.creados} clase(s).$extra');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<void> _borrarPeriodo(BuildContext context, WidgetRef ref, Periodo p) async {
    final ok = await _confirmarBorrado(context, 'el periodo "${p.nombre}"');
    if (!ok) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarPeriodo(p.id);
      refrescarPlanificacion(contenedor);
      if (context.mounted) avisar(context, 'Periodo borrado.');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }
}

Future<void> _editarPeriodo(BuildContext context, WidgetRef ref, [Periodo? inicial]) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _HojaPeriodo(inicial: inicial),
  );
}

class _HojaPeriodo extends ConsumerStatefulWidget {
  const _HojaPeriodo({this.inicial});
  final Periodo? inicial;

  @override
  ConsumerState<_HojaPeriodo> createState() => _HojaPeriodoState();
}

class _HojaPeriodoState extends ConsumerState<_HojaPeriodo> {
  late final TextEditingController _nombre = TextEditingController(text: widget.inicial?.nombre ?? '');
  late String _inicio = widget.inicial?.fechaInicio ?? '';
  late String _fin = widget.inicial?.fechaFin ?? '';
  late bool _vigente = widget.inicial?.vigente ?? true;
  bool _guardando = false;
  final _errores = <String, String>{};

  @override
  void dispose() {
    _nombre.dispose();
    super.dispose();
  }

  Future<void> _elegirFecha(bool inicio) async {
    final base = DateTime.tryParse(inicio ? _inicio : _fin) ?? DateTime.now();
    final f = await showDatePicker(
      context: context,
      initialDate: base,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (f == null) return;
    final iso = '${f.year.toString().padLeft(4, '0')}-${f.month.toString().padLeft(2, '0')}-${f.day.toString().padLeft(2, '0')}';
    setState(() => inicio ? _inicio = iso : _fin = iso);
  }

  Future<void> _guardar() async {
    setState(() => _errores.clear());
    if (_nombre.text.trim().isEmpty) {
      setState(() => _errores['nombre'] = 'Escribe el nombre.');
      return;
    }
    if (_inicio.isEmpty || _fin.isEmpty) {
      avisar(context, 'Elige las fechas de inicio y fin.', error: true);
      return;
    }
    setState(() => _guardando = true);
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).guardarPeriodo(
        {'nombre': _nombre.text.trim(), 'fecha_inicio': _inicio, 'fecha_fin': _fin, 'vigente': _vigente},
        id: widget.inicial?.id,
      );
      refrescarPlanificacion(contenedor);
      if (!mounted) return;
      Navigator.pop(context);
      avisar(context, widget.inicial == null ? 'Periodo creado.' : 'Cambios guardados.');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        _errores.addAll(erroresDeCampos(e));
      });
      avisar(context, _errores['fecha_fin'] ?? mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.inicial == null ? 'Nuevo periodo' : 'Editar periodo',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            TextField(
              controller: _nombre,
              decoration: InputDecoration(labelText: 'Nombre', hintText: '2-2026', errorText: _errores['nombre']),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _elegirFecha(true),
                    child: Text(_inicio.isEmpty ? 'Fecha inicio' : _inicio),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _elegirFecha(false),
                    child: Text(_fin.isEmpty ? 'Fecha fin' : _fin),
                  ),
                ),
              ],
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Vigente'),
              value: _vigente,
              onChanged: (v) => setState(() => _vigente = v),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: _guardando ? null : _guardar,
                child: _guardando
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Guardar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Materias ──
class _MateriasTab extends ConsumerWidget {
  const _MateriasTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final materias = ref.watch(materiasProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(materiasProvider.future),
      child: materias.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ListView(children: [
          const SizedBox(height: 80),
          EstadoError(error: e, onReintentar: () => ref.invalidate(materiasProvider)),
        ]),
        data: (lista) {
          if (lista.isEmpty) {
            return ListView(children: const [
              SizedBox(height: 80),
              EstadoVacio(icono: Icons.menu_book_outlined, titulo: 'Sin materias'),
            ]);
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 90),
            itemCount: lista.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final m = lista[i];
              return ListTile(
                leading: CircleAvatar(child: Text(m.sigla.isEmpty ? '?' : m.sigla[0])),
                title: Text(m.sigla),
                subtitle: Text(m.nombre),
                trailing: PopupMenuButton<String>(
                  onSelected: (v) => v == 'editar' ? _editarMateria(context, ref, m) : _borrarMateria(context, ref, m),
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'editar', child: Text('Editar')),
                    PopupMenuItem(value: 'borrar', child: Text('Borrar')),
                  ],
                ),
                onTap: () => _editarMateria(context, ref, m),
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _borrarMateria(BuildContext context, WidgetRef ref, Materia m) async {
    final ok = await _confirmarBorrado(context, 'la materia "${m.sigla}"');
    if (!ok) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarMateria(m.id);
      refrescarPlanificacion(contenedor);
      if (context.mounted) avisar(context, 'Materia borrada.');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }
}

Future<void> _editarMateria(BuildContext context, WidgetRef ref, [Materia? inicial]) async {
  final nombreCtrl = TextEditingController(text: inicial?.nombre ?? '');
  final siglaCtrl = TextEditingController(text: inicial?.sigla ?? '');
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (hoja) => _HojaCampos(
      titulo: inicial == null ? 'Nueva materia' : 'Editar materia',
      campos: [
        (siglaCtrl, 'Sigla', 'INF-110', true),
        (nombreCtrl, 'Nombre', '', true),
      ],
      onGuardar: () async {
        final repo = ref.read(repositorioProvider);
        await repo.guardarMateria(
          {'sigla': siglaCtrl.text.trim(), 'nombre': nombreCtrl.text.trim()},
          id: inicial?.id,
        );
        refrescarPlanificacion(ProviderScope.containerOf(hoja, listen: false));
      },
    ),
  );
  nombreCtrl.dispose();
  siglaCtrl.dispose();
}

// ── Docentes ──
class _DocentesTab extends ConsumerWidget {
  const _DocentesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docentes = ref.watch(docentesAdminProvider(''));
    return RefreshIndicator(
      onRefresh: () => ref.refresh(docentesAdminProvider('').future),
      child: docentes.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ListView(children: [
          const SizedBox(height: 80),
          EstadoError(error: e, onReintentar: () => ref.invalidate(docentesAdminProvider)),
        ]),
        data: (lista) {
          if (lista.isEmpty) {
            return ListView(children: const [
              SizedBox(height: 80),
              EstadoVacio(icono: Icons.person_outline, titulo: 'Sin docentes'),
            ]);
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 90),
            itemCount: lista.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final d = lista[i];
              return ListTile(
                title: Row(
                  children: [
                    Flexible(child: Text(d.nombreCompleto)),
                    if (!d.activo) ...[const SizedBox(width: 8), const Etiqueta('Inactivo', tono: Tono.neutro)],
                    if (d.tieneUsuario) ...[
                      const SizedBox(width: 8),
                      const Etiqueta('Con usuario', tono: Tono.info),
                    ],
                  ],
                ),
                subtitle: Text([
                  if (d.email.isNotEmpty) d.email,
                  '${d.totalHorarios} clases',
                ].join(' · ')),
                trailing: PopupMenuButton<String>(
                  onSelected: (v) => v == 'editar' ? _editarDocente(context, ref, d) : _borrarDocente(context, ref, d),
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'editar', child: Text('Editar')),
                    PopupMenuItem(value: 'borrar', child: Text('Borrar')),
                  ],
                ),
                onTap: () => _editarDocente(context, ref, d),
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _borrarDocente(BuildContext context, WidgetRef ref, DocenteAdmin d) async {
    final ok = await _confirmarBorrado(context, 'al docente "${d.nombreCompleto}"');
    if (!ok) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarDocente(d.id);
      refrescarPlanificacion(contenedor);
      if (context.mounted) avisar(context, 'Docente borrado.');
    } catch (e) {
      if (context.mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }
}

Future<void> _editarDocente(BuildContext context, WidgetRef ref, [DocenteAdmin? inicial]) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _HojaDocente(inicial: inicial),
  );
}

class _HojaDocente extends ConsumerStatefulWidget {
  const _HojaDocente({this.inicial});
  final DocenteAdmin? inicial;

  @override
  ConsumerState<_HojaDocente> createState() => _HojaDocenteState();
}

class _HojaDocenteState extends ConsumerState<_HojaDocente> {
  late final TextEditingController _nombres = TextEditingController(text: widget.inicial?.nombres ?? '');
  late final TextEditingController _apellidos = TextEditingController(text: widget.inicial?.apellidos ?? '');
  late final TextEditingController _email = TextEditingController(text: widget.inicial?.email ?? '');
  late final TextEditingController _telefono = TextEditingController(text: widget.inicial?.telefono ?? '');
  late bool _activo = widget.inicial?.activo ?? true;
  bool _guardando = false;
  final _errores = <String, String>{};

  @override
  void dispose() {
    _nombres.dispose();
    _apellidos.dispose();
    _email.dispose();
    _telefono.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    setState(() => _errores.clear());
    if (_nombres.text.trim().isEmpty || _apellidos.text.trim().isEmpty) {
      avisar(context, 'Escribe nombres y apellidos.', error: true);
      return;
    }
    setState(() => _guardando = true);
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).guardarDocente(
        {
          'nombres': _nombres.text.trim(),
          'apellidos': _apellidos.text.trim(),
          'email': _email.text.trim(),
          'telefono': _telefono.text.trim(),
          'activo': _activo,
        },
        id: widget.inicial?.id,
      );
      refrescarPlanificacion(contenedor);
      if (!mounted) return;
      Navigator.pop(context);
      avisar(context, widget.inicial == null ? 'Docente creado.' : 'Cambios guardados.');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        _errores.addAll(erroresDeCampos(e));
      });
      avisar(context, _errores['email'] ?? mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.inicial == null ? 'Nuevo docente' : 'Editar docente',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            TextField(
              controller: _nombres,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(labelText: 'Nombres', errorText: _errores['nombres']),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _apellidos,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(labelText: 'Apellidos', errorText: _errores['apellidos']),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: 'Correo (opcional)', errorText: _errores['email']),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _telefono,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(labelText: 'Teléfono (opcional)', errorText: _errores['telefono']),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Activo'),
              value: _activo,
              onChanged: (v) => setState(() => _activo = v),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: _guardando ? null : _guardar,
                child: _guardando
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Guardar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Utilidades compartidas ──
Future<bool> _confirmarBorrado(BuildContext context, String que) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (d) => AlertDialog(
      title: const Text('¿Borrar?'),
      content: Text('Se eliminará $que. Esta acción no se puede deshacer.'),
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
  return r ?? false;
}

/// Hoja simple con uno o varios campos de texto y un botón Guardar.
class _HojaCampos extends StatefulWidget {
  const _HojaCampos({required this.titulo, required this.campos, required this.onGuardar});
  final String titulo;

  /// (controlador, etiqueta, hint, obligatorio)
  final List<(TextEditingController, String, String, bool)> campos;
  final Future<void> Function() onGuardar;

  @override
  State<_HojaCampos> createState() => _HojaCamposState();
}

class _HojaCamposState extends State<_HojaCampos> {
  bool _guardando = false;

  Future<void> _guardar() async {
    for (final (ctrl, etiqueta, _, obligatorio) in widget.campos) {
      if (obligatorio && ctrl.text.trim().isEmpty) {
        avisar(context, 'Falta: $etiqueta.', error: true);
        return;
      }
    }
    setState(() => _guardando = true);
    try {
      await widget.onGuardar();
      if (!mounted) return;
      Navigator.pop(context);
      avisar(context, 'Guardado.');
    } catch (e) {
      if (mounted) {
        setState(() => _guardando = false);
        avisar(context, mensajeDeError(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.titulo, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            for (final (ctrl, etiqueta, hint, _) in widget.campos) ...[
              TextField(
                controller: ctrl,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(labelText: etiqueta, hintText: hint.isEmpty ? null : hint),
              ),
              const SizedBox(height: 12),
            ],
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: _guardando ? null : _guardar,
                child: _guardando
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Guardar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
