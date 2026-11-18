import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'inventario_comun.dart';

/// Ficha de un activo: sus datos, dónde está y todo lo que le pasó.
class ActivoDetallePage extends ConsumerStatefulWidget {
  const ActivoDetallePage({super.key, required this.id});
  final int id;

  @override
  ConsumerState<ActivoDetallePage> createState() => _ActivoDetallePageState();
}

class _ActivoDetallePageState extends ConsumerState<ActivoDetallePage> {
  bool _ocupado = false;

  Future<void> _accion(Activo a, String modo) async {
    final repo = ref.read(repositorioProvider);
    final lugares = modo == 'trasladar'
        ? (await ref.read(lugaresProvider.future)).where((l) => l.activo && l.id != a.lugar).toList()
        : const <Lugar>[];
    if (!mounted) return;
    final datos = await _pedirMovimiento(context, modo: modo, activo: a, lugares: lugares);
    if (datos == null || !mounted) return;

    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _ocupado = true);
    try {
      switch (modo) {
        case 'trasladar':
          await repo.trasladarActivo(a.id, datos);
        case 'estado':
          await repo.cambiarEstadoActivo(a.id, datos);
        case 'baja':
          await repo.darDeBajaActivo(a.id, datos);
      }
      contenedor.invalidate(activoProvider(a.id));
      refrescarInventario(contenedor);
      if (mounted) {
        avisar(context, switch (modo) {
          'trasladar' => 'Activo trasladado.',
          'estado' => a.deBaja ? 'Activo reincorporado.' : 'Estado cambiado.',
          _ => 'Activo dado de baja.',
        });
      }
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _corregir(Activo a, MovimientoActivo m) async {
    final datos = await _pedirMovimiento(context, modo: 'corregir', activo: a, movimiento: m);
    if (datos == null || !mounted) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _ocupado = true);
    try {
      await ref.read(repositorioProvider).corregirMovimiento(m.id, datos);
      contenedor.invalidate(activoProvider(a.id));
      if (mounted) avisar(context, 'Movimiento corregido. La corrección quedó en el historial.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final consulta = ref.watch(activoProvider(widget.id));
    final gestionar = ref.watch(sesionProvider).usuario?.puede('inventario.gestionar') ?? false;
    final a = consulta.value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Activo'),
        actions: [
          if (a != null && gestionar)
            PopupMenuButton<String>(
              enabled: !_ocupado,
              tooltip: 'Acciones',
              onSelected: (valor) {
                switch (valor) {
                  case 'editar':
                    context.push('/inventario/activo/${a.id}/editar', extra: a);
                  case 'estado':
                    _accion(a, 'estado');
                  case 'trasladar':
                    _accion(a, 'trasladar');
                  case 'baja':
                    _accion(a, 'baja');
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'editar', child: _ItemMenu(Icons.edit_outlined, 'Editar datos')),
                if (!a.deBaja)
                  const PopupMenuItem(value: 'trasladar', child: _ItemMenu(Icons.swap_horiz, 'Trasladar')),
                PopupMenuItem(
                  value: 'estado',
                  child: _ItemMenu(Icons.tune, a.deBaja ? 'Reincorporar' : 'Cambiar estado'),
                ),
                if (!a.deBaja) ...[
                  const PopupMenuDivider(),
                  const PopupMenuItem(value: 'baja', child: _ItemMenu(Icons.block, 'Dar de baja')),
                ],
              ],
            ),
        ],
      ),
      body: consulta.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoError(error: e, onReintentar: () => ref.invalidate(activoProvider(widget.id))),
        data: (a) => RefreshIndicator(
          onRefresh: () => ref.refresh(activoProvider(widget.id).future),
          child: _Contenido(
            activo: a,
            gestionar: gestionar,
            onCorregir: gestionar ? (m) => _corregir(a, m) : null,
          ),
        ),
      ),
    );
  }
}

class _ItemMenu extends StatelessWidget {
  const _ItemMenu(this.icono, this.texto);
  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(children: [Icon(icono, size: 20), const SizedBox(width: 12), Text(texto)]);
  }
}

class _Contenido extends StatelessWidget {
  const _Contenido({required this.activo, required this.gestionar, required this.onCorregir});

  final Activo activo;
  final bool gestionar;
  final void Function(MovimientoActivo movimiento)? onCorregir;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final a = activo;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(a.descripcion, style: tema.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
            ),
            const SizedBox(width: 8),
            Etiqueta(a.estadoNombre, tono: tonoDeEstadoActivo(a.estado)),
          ],
        ),
        const SizedBox(height: 10),
        _Dato('Código', a.codigo),
        _Dato('Tipo', a.tipoNombre.isEmpty ? 'Sin tipo' : a.tipoNombre),
        _Dato(a.deBaja ? 'Último lugar' : 'Lugar', a.lugarNombre),
        _Dato('Marca y modelo', [a.marca, a.modelo].where((x) => x.isNotEmpty).join(' · '), vacio: 'Sin registrar'),
        _Dato('Número de serie', a.serie, vacio: 'Sin registrar'),
        _Dato('Adquisición', fechaCortaIso(a.fechaAdquisicion), vacio: 'Sin registrar'),
        if (a.enMapa.isNotEmpty)
          _Dato('En el mapa', a.enMapa.map((c) => '${c.laboratorioCodigo} · ${c.etiqueta}').join(', ')),
        if (a.observaciones.isNotEmpty) ...[
          const TituloSeccion('Observaciones'),
          Text(a.observaciones),
        ],
        TituloSeccion('Historial (${a.movimientos.length})'),
        if (a.movimientos.isEmpty)
          Text(
            'Sin movimientos todavía.',
            style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
          ),
        for (final m in a.movimientos)
          _LineaMovimiento(
            movimiento: m,
            correcciones: a.correccionesDe(m),
            onCorregir: onCorregir == null ? null : () => onCorregir!(m),
          ),
        if (a.correccionesDeDatos.isNotEmpty) ...[
          const TituloSeccion('Correcciones a sus datos'),
          for (final c in a.correccionesDeDatos) _Correccion(cambio: c),
        ],
      ],
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato(this.clave, this.valor, {this.vacio});
  final String clave;
  final String valor;
  final String? vacio;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final texto = valor.isEmpty ? (vacio ?? '—') : valor;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(clave, style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(texto)),
        ],
      ),
    );
  }
}

String _resumenMovimiento(MovimientoActivo m) {
  String lugar(String x) => x.isEmpty ? '—' : x;
  return switch (m.tipo) {
    'alta' => 'Entró al inventario en ${lugar(m.lugarDestinoNombre)} (${m.estadoNuevoNombre.toLowerCase()}).',
    'traslado' => 'De ${lugar(m.lugarOrigenNombre)} a ${lugar(m.lugarDestinoNombre)}.',
    'estado' => 'De «${m.estadoAnteriorNombre}» a «${m.estadoNuevoNombre}».',
    _ => 'Dado de baja. Estaba en ${lugar(m.lugarOrigenNombre)} (${m.estadoAnteriorNombre.toLowerCase()}).',
  };
}

class _LineaMovimiento extends StatelessWidget {
  const _LineaMovimiento({required this.movimiento, required this.correcciones, this.onCorregir});

  final MovimientoActivo movimiento;
  final List<CambioInventario> correcciones;
  final VoidCallback? onCorregir;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final m = movimiento;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: esquema.outlineVariant))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Etiqueta(m.tipoNombre, tono: tonoDeMovimiento(m.tipo)),
              const SizedBox(width: 8),
              Text(fechaCortaIso(m.fecha), style: tema.textTheme.titleSmall),
              const Spacer(),
              if (onCorregir != null)
                IconButton(
                  tooltip: 'Corregir fecha, motivo o documento',
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  onPressed: onCorregir,
                ),
            ],
          ),
          const SizedBox(height: 2),
          Text(_resumenMovimiento(m)),
          Text('Registró ${m.registradoPor}', style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant)),
          if (m.motivo.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(m.motivo)),
          if (m.documento.isNotEmpty)
            Text('Documento: ${m.documento}', style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant)),
          for (final c in correcciones) _Correccion(cambio: c),
        ],
      ),
    );
  }
}

class _Correccion extends StatelessWidget {
  const _Correccion({required this.cambio});
  final CambioInventario cambio;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: esquema.surfaceContainerHigh, borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Corregido por ${cambio.usuarioNombre}, ${relativo(cambio.creadoEn)}',
            style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
          ),
          for (final c in cambio.cambios)
            Text.rich(
              TextSpan(children: [
                TextSpan(text: '${c.campo}: '),
                TextSpan(
                  text: c.antes.isEmpty ? 'vacío' : c.antes,
                  style: TextStyle(decoration: TextDecoration.lineThrough, color: esquema.onSurfaceVariant),
                ),
                TextSpan(text: ' → ${c.despues.isEmpty ? 'vacío' : c.despues}'),
              ]),
              style: tema.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}

// ── Hoja para registrar o corregir un movimiento ──

/// Pide los datos de un movimiento. [modo]: 'trasladar' | 'estado' | 'baja' | 'corregir'.
/// Devuelve el cuerpo listo para la API, o null si se cancela.
Future<Map<String, dynamic>?> _pedirMovimiento(
  BuildContext context, {
  required String modo,
  required Activo activo,
  List<Lugar> lugares = const [],
  MovimientoActivo? movimiento,
}) {
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: _HojaMovimiento(modo: modo, activo: activo, lugares: lugares, movimiento: movimiento),
    ),
  );
}

class _HojaMovimiento extends StatefulWidget {
  const _HojaMovimiento({required this.modo, required this.activo, required this.lugares, this.movimiento});

  final String modo;
  final Activo activo;
  final List<Lugar> lugares;
  final MovimientoActivo? movimiento;

  @override
  State<_HojaMovimiento> createState() => _HojaMovimientoState();
}

class _HojaMovimientoState extends State<_HojaMovimiento> {
  late final TextEditingController _motivo;
  late final TextEditingController _documento;
  late DateTime _fecha;
  int? _lugar;
  String? _estado;

  bool get _motivoObligatorio => widget.modo == 'baja';

  @override
  void initState() {
    super.initState();
    final m = widget.movimiento;
    _motivo = TextEditingController(text: m?.motivo ?? '');
    _documento = TextEditingController(text: m?.documento ?? '');
    _fecha = (m == null ? null : DateTime.tryParse(m.fecha)) ?? DateTime.now();
  }

  @override
  void dispose() {
    _motivo.dispose();
    _documento.dispose();
    super.dispose();
  }

  String get _titulo => switch (widget.modo) {
        'trasladar' => 'Trasladar ${widget.activo.codigo}',
        'estado' => widget.activo.deBaja ? 'Reincorporar ${widget.activo.codigo}' : 'Cambiar estado',
        'baja' => 'Dar de baja ${widget.activo.codigo}',
        _ => 'Corregir el movimiento',
      };

  bool get _completo {
    if (widget.modo == 'trasladar' && _lugar == null) return false;
    if (widget.modo == 'estado' && _estado == null) return false;
    if (_motivoObligatorio && _motivo.text.trim().isEmpty) return false;
    return true;
  }

  Future<void> _elegirFecha() async {
    final dia = await showDatePicker(
      context: context,
      initialDate: _fecha,
      firstDate: DateTime(1990),
      lastDate: DateTime.now(),
    );
    if (dia != null) setState(() => _fecha = dia);
  }

  void _confirmar() {
    final datos = <String, dynamic>{
      'fecha': fechaIso(_fecha),
      'motivo': _motivo.text.trim(),
      'documento': _documento.text.trim(),
    };
    if (widget.modo == 'trasladar') datos['lugar'] = _lugar;
    if (widget.modo == 'estado') datos['estado'] = _estado;
    Navigator.pop(context, datos);
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final estados = estadosActivo
        .where((e) => e.$1 != 'baja' && e.$1 != widget.activo.estado)
        .toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(_titulo, style: tema.textTheme.titleMedium),
          const SizedBox(height: 16),
          if (widget.modo == 'trasladar') ...[
            DropdownButtonFormField<int?>(
              initialValue: _lugar,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Nuevo lugar'),
              items: [
                for (final l in widget.lugares)
                  DropdownMenuItem<int?>(value: l.id, child: Text(l.nombre, overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (v) => setState(() => _lugar = v),
            ),
            const SizedBox(height: 12),
          ],
          if (widget.modo == 'estado') ...[
            if (widget.activo.deBaja)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'Vuelve al inventario con el estado que elijas. La baja queda en el historial.',
                  style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
                ),
              ),
            DropdownButtonFormField<String>(
              initialValue: _estado,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Nuevo estado'),
              items: [for (final (valor, nombre) in estados) DropdownMenuItem(value: valor, child: Text(nombre))],
              onChanged: (v) => setState(() => _estado = v),
            ),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: _elegirFecha,
                  borderRadius: BorderRadius.circular(10),
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Fecha', prefixIcon: Icon(Icons.event_outlined)),
                    child: Text(fechaCortaIso(fechaIso(_fecha))),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _documento,
                  maxLength: 100,
                  decoration: const InputDecoration(labelText: 'Documento', counterText: '', hintText: 'Opcional'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _motivo,
            minLines: 2,
            maxLines: 4,
            maxLength: 2000,
            textCapitalization: TextCapitalization.sentences,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: _motivoObligatorio ? 'Motivo' : 'Motivo (opcional)',
              counterText: '',
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _completo ? _confirmar : null,
            child: Text(switch (widget.modo) {
              'trasladar' => 'Trasladar',
              'estado' => widget.activo.deBaja ? 'Reincorporar' : 'Cambiar estado',
              'baja' => 'Dar de baja',
              _ => 'Guardar corrección',
            }),
          ),
        ],
      ),
    );
  }
}
