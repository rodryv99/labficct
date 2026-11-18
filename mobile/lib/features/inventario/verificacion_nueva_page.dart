import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/datos/proveedores.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/seleccion.dart';

/// Pedir una verificación: todos los activos, los de ciertos tipos o lugares, o
/// una selección. Se copia la lista como está, aparece una tarea y se avisa.
class VerificacionNuevaPage extends ConsumerStatefulWidget {
  const VerificacionNuevaPage({super.key});

  @override
  ConsumerState<VerificacionNuevaPage> createState() => _VerificacionNuevaPageState();
}

class _VerificacionNuevaPageState extends ConsumerState<VerificacionNuevaPage> {
  final _titulo = TextEditingController();
  final _instrucciones = TextEditingController();

  String _modo = 'filtros'; // filtros | seleccion | todos
  final Set<int> _tipos = {};
  final Set<int> _lugares = {};
  final Set<int> _activos = {};
  final Set<int> _responsables = {};
  DateTime? _fechaLimite;

  int _total = 0;
  bool _contando = false;
  bool _guardando = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _recontar();
  }

  @override
  void dispose() {
    _titulo.dispose();
    _instrucciones.dispose();
    super.dispose();
  }

  Future<void> _recontar() async {
    if (_modo == 'seleccion') {
      setState(() => _total = _activos.length);
      return;
    }
    setState(() => _contando = true);
    try {
      final n = await ref.read(repositorioProvider).contarActivos(
            tipos: _modo == 'filtros' ? _tipos.join(',') : '',
            lugares: _modo == 'filtros' ? _lugares.join(',') : '',
          );
      if (mounted) setState(() => _total = n);
    } catch (_) {
      if (mounted) setState(() => _total = 0);
    } finally {
      if (mounted) setState(() => _contando = false);
    }
  }

  Future<void> _elegirTipos() async {
    final tipos = await ref.read(tiposActivoProvider.future);
    if (!mounted) return;
    final elegido = await seleccionar(
      context,
      titulo: 'Tipos',
      seleccion: _tipos,
      opciones: Future.value([for (final t in tipos) OpcionSeleccion(t.id, t.nombre, '${t.totalActivos} activos')]),
    );
    if (elegido != null) {
      setState(() {
        _tipos
          ..clear()
          ..addAll(elegido);
      });
      _recontar();
    }
  }

  Future<void> _elegirLugares() async {
    final lugares = await ref.read(lugaresProvider.future);
    if (!mounted) return;
    final elegido = await seleccionar(
      context,
      titulo: 'Lugares',
      seleccion: _lugares,
      opciones: Future.value([for (final l in lugares) OpcionSeleccion(l.id, l.nombre, '${l.totalActivos} activos')]),
    );
    if (elegido != null) {
      setState(() {
        _lugares
          ..clear()
          ..addAll(elegido);
      });
      _recontar();
    }
  }

  Future<void> _elegirActivos() async {
    final repo = ref.read(repositorioProvider);
    final candidatos = await repo.activos(
      tipos: _tipos.join(','),
      lugares: _lugares.join(','),
      estado: '',
      ordering: 'lugar__nombre',
      cantidad: 500,
    );
    if (!mounted) return;
    final elegido = await seleccionar(
      context,
      titulo: 'Activos',
      seleccion: _activos,
      opciones: Future.value([
        for (final a in candidatos)
          OpcionSeleccion(a.id, '${a.codigo} · ${a.descripcion}', '${a.tipoNombre} · ${a.lugarNombre}'),
      ]),
    );
    if (elegido != null) {
      setState(() {
        _activos
          ..clear()
          ..addAll(elegido);
        _total = _activos.length;
      });
    }
  }

  Future<void> _elegirResponsables() async {
    final personas = await ref.read(personasProvider('auxiliar,admin').future);
    if (!mounted) return;
    final elegido = await seleccionar(
      context,
      titulo: 'Responsables',
      seleccion: _responsables,
      opciones: Future.value([for (final p in personas) OpcionSeleccion(p.id, p.nombreCompleto, p.rol)]),
    );
    if (elegido != null) {
      setState(() {
        _responsables
          ..clear()
          ..addAll(elegido);
      });
    }
  }

  Future<void> _elegirFecha() async {
    final hoy = DateTime.now();
    final dia = await showDatePicker(
      context: context,
      initialDate: _fechaLimite ?? hoy,
      firstDate: hoy,
      lastDate: hoy.add(const Duration(days: 365)),
    );
    if (dia != null && mounted) setState(() => _fechaLimite = dia);
  }

  Future<void> _guardar() async {
    FocusScope.of(context).unfocus();
    if (_titulo.text.trim().isEmpty) {
      setState(() => _error = 'Escribe un título.');
      return;
    }
    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() {
      _guardando = true;
      _error = null;
    });
    try {
      final v = await ref.read(repositorioProvider).crearVerificacion({
        'titulo': _titulo.text.trim(),
        'instrucciones': _instrucciones.text.trim(),
        'fecha_limite': _fechaLimite == null ? null : fechaIso(_fechaLimite!),
        'responsables': _responsables.toList(),
        'tipos': _modo == 'filtros' ? _tipos.toList() : <int>[],
        'lugares': _modo == 'filtros' ? _lugares.toList() : <int>[],
        'activos': _modo == 'seleccion' ? _activos.toList() : <int>[],
      });
      refrescarVerificaciones(contenedor);
      if (!mounted) return;
      avisar(context, 'Verificación pedida: ${v.conteo.total} activos. Ya está en el pizarrón.');
      context.pushReplacement('/inventario/verificacion/${v.id}');
    } catch (e) {
      if (!mounted) return;
      final campos = erroresDeCampos(e);
      setState(() => _error = campos.values.firstOrNull ?? mensajeDeError(e));
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final completo = _titulo.text.trim().isNotEmpty && _total > 0 && !_contando;

    return Scaffold(
      appBar: AppBar(title: const Text('Pedir verificación')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: !completo || _guardando ? null : _guardar,
            child: _guardando
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                : Text(_total > 0 ? 'Mandar a verificar $_total ${_total == 1 ? 'activo' : 'activos'}' : 'Mandar a verificar'),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Text(
            'Los auxiliares revisan si cada activo está donde debería. Verificar no mueve nada: tú decides después qué '
            'trasladar o dar de baja.',
            style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
          ),
          const SizedBox(height: 12),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: esquema.errorContainer, borderRadius: BorderRadius.circular(10)),
              child: Text(_error!, style: TextStyle(color: esquema.onErrorContainer)),
            ),
          TextField(
            controller: _titulo,
            maxLength: 150,
            textCapitalization: TextCapitalization.sentences,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'Título', hintText: 'Ej.: Sillas y mesas del LAB-41'),
          ),
          const TituloSeccion('Qué verificar'),
          for (final (valor, titulo) in const [
            ('filtros', 'Los activos de ciertos tipos o lugares'),
            ('seleccion', 'Activos que elijo uno por uno'),
            ('todos', 'Absolutamente todos los activos'),
          ])
            _OpcionModo(
              titulo: titulo,
              elegido: _modo == valor,
              onTap: () {
                setState(() => _modo = valor);
                _recontar();
              },
            ),
          if (_modo != 'todos') ...[
            _BotonSeleccion(
              icono: Icons.category_outlined,
              etiqueta: 'Tipos',
              resumen: _tipos.isEmpty ? (_modo == 'filtros' ? 'Todos los tipos' : 'Sin filtrar') : '${_tipos.length} elegidos',
              onTap: _elegirTipos,
            ),
            _BotonSeleccion(
              icono: Icons.place_outlined,
              etiqueta: 'Lugares',
              resumen: _lugares.isEmpty ? (_modo == 'filtros' ? 'Todos los lugares' : 'Sin filtrar') : '${_lugares.length} elegidos',
              onTap: _elegirLugares,
            ),
          ],
          if (_modo == 'seleccion')
            _BotonSeleccion(
              icono: Icons.checklist,
              etiqueta: 'Activos',
              resumen: _activos.isEmpty ? 'Elegir activos' : '${_activos.length} elegidos',
              onTap: _elegirActivos,
            ),
          const SizedBox(height: 8),
          Text(
            _contando
                ? 'Contando activos…'
                : _total > 0
                    ? 'Se ${_total == 1 ? 'verificará 1 activo' : 'verificarán $_total activos'}. Los dados de baja no entran.'
                    : _modo == 'seleccion'
                        ? 'Marca al menos un activo.'
                        : 'No hay activos con esos filtros.',
            style: tema.textTheme.bodyMedium?.copyWith(
              color: _total > 0 ? null : esquema.onSurfaceVariant,
              fontWeight: _total > 0 ? FontWeight.w600 : null,
            ),
          ),
          const TituloSeccion('Opcional'),
          _BotonSeleccion(
            icono: Icons.people_outline,
            etiqueta: 'Responsables',
            resumen: _responsables.isEmpty ? 'Todos los auxiliares' : '${_responsables.length} elegidos',
            onTap: _elegirResponsables,
          ),
          const SizedBox(height: 4),
          InkWell(
            onTap: _elegirFecha,
            borderRadius: BorderRadius.circular(10),
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: 'Fecha límite (opcional)',
                prefixIcon: const Icon(Icons.event_outlined),
                suffixIcon: _fechaLimite == null
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => setState(() => _fechaLimite = null),
                      ),
              ),
              child: Text(
                _fechaLimite == null ? 'Sin fecha' : fechaLarga(_fechaLimite!),
                style: _fechaLimite == null ? TextStyle(color: esquema.onSurfaceVariant) : null,
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _instrucciones,
            minLines: 2,
            maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Instrucciones (opcional)',
              hintText: 'Ej.: Revisar el código pegado en cada silla. Si falta la etiqueta, anotarlo.',
            ),
          ),
        ],
      ),
    );
  }
}

class _OpcionModo extends StatelessWidget {
  const _OpcionModo({required this.titulo, required this.elegido, required this.onTap});

  final String titulo;
  final bool elegido;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(
              elegido ? Icons.radio_button_checked : Icons.radio_button_unchecked,
              color: elegido ? esquema.primary : esquema.onSurfaceVariant,
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(titulo)),
          ],
        ),
      ),
    );
  }
}

class _BotonSeleccion extends StatelessWidget {
  const _BotonSeleccion({required this.icono, required this.etiqueta, required this.resumen, required this.onTap});

  final IconData icono;
  final String etiqueta;
  final String resumen;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: InputDecorator(
          decoration: InputDecoration(labelText: etiqueta, prefixIcon: Icon(icono)),
          child: Row(
            children: [
              Expanded(child: Text(resumen)),
              Icon(Icons.chevron_right, color: tema.colorScheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
