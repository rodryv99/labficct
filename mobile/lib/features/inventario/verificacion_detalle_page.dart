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

/// Una verificación: la lista de activos para marcar uno por uno, y su cierre.
class VerificacionDetallePage extends ConsumerStatefulWidget {
  const VerificacionDetallePage({super.key, required this.id});
  final int id;

  @override
  ConsumerState<VerificacionDetallePage> createState() => _VerificacionDetallePageState();
}

class _VerificacionDetallePageState extends ConsumerState<VerificacionDetallePage> {
  Verificacion? _v;
  Object? _error;
  bool _cargando = true;

  String _buscar = '';
  String _lugar = '';
  String _resultado = '';
  final Set<int> _enviando = {};

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
      final v = await ref.read(repositorioProvider).verificacion(widget.id);
      if (mounted) setState(() => _v = v);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  void _aplicar(Verificacion v) {
    final contenedor = ProviderScope.containerOf(context, listen: false);
    refrescarVerificaciones(contenedor);
    if (mounted) setState(() => _v = v);
  }

  Future<void> _marcar({
    required List<int> items,
    required String resultado,
    int? lugarEncontrado,
    String nota = '',
  }) async {
    setState(() => _enviando.addAll(items));
    try {
      final v = await ref.read(repositorioProvider).marcarItems(widget.id, {
        'items': items,
        'resultado': resultado,
        'lugar_encontrado': lugarEncontrado,
        'nota': nota,
      });
      _aplicar(v);
      if (mounted && items.length > 1) avisar(context, '${items.length} activos marcados.');
      if (mounted && v.conteo.pendientes == 0 && v.conteo.total > 0) {
        avisar(context, 'Todo revisado.');
      }
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _enviando.removeAll(items));
    }
  }

  /// Toca un resultado: si ya lo tenía, lo deja sin revisar; si es "en otro
  /// lugar", pide el lugar y una nota; si no, lo marca directo.
  Future<void> _tocarResultado(ItemVerificacion item, String resultado) async {
    if (item.resultado == resultado) {
      await _marcar(items: [item.id], resultado: 'pendiente');
    } else if (resultado == 'otro_lugar') {
      await _abrirNota(item, resultado);
    } else {
      await _marcar(items: [item.id], resultado: resultado, nota: item.nota);
    }
  }

  Future<void> _abrirNota(ItemVerificacion item, String resultado) async {
    final lugares = resultado == 'otro_lugar'
        ? (await ref.read(lugaresProvider.future)).where((l) => l.activo && l.id != item.lugar).toList()
        : const <Lugar>[];
    if (!mounted) return;
    final datos = await showModalBottomSheet<({int? lugar, String nota})>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: _HojaNota(item: item, resultado: resultado, lugares: lugares),
      ),
    );
    if (datos == null) return;
    await _marcar(items: [item.id], resultado: resultado, lugarEncontrado: datos.lugar, nota: datos.nota);
  }

  Future<void> _marcarTodos(List<ItemVerificacion> pendientes) async {
    final confirmar = await _confirmar(
      titulo: '¿Marcar «Está» en ${pendientes.length} activos?',
      mensaje: 'Son los que siguen sin revisar en la lista que ves (con sus filtros). Los que ya marcaste no cambian.',
      boton: 'Marcar todos',
    );
    if (confirmar == true) await _marcar(items: pendientes.map((i) => i.id).toList(), resultado: 'esta');
  }

  Future<void> _cerrar() async {
    final conclusion = await pedirTexto(
      context,
      titulo: '¿Cerrar «${_v?.titulo ?? ''}»?',
      mensaje: (_v?.conteo.pendientes ?? 0) > 0
          ? 'Todavía hay ${_v!.conteo.pendientes} sin revisar: quedarán así. Ya no se podrá marcar y la tarea del pizarrón quedará hecha.'
          : 'Ya no se podrá marcar y la tarea del pizarrón quedará hecha. Los traslados o bajas que correspondan los registras tú en cada activo.',
      etiqueta: 'Conclusión',
      boton: 'Cerrar verificación',
    );
    if (conclusion == null || !mounted) return;
    try {
      _aplicar(await ref.read(repositorioProvider).cerrarVerificacion(widget.id, conclusion));
      if (mounted) avisar(context, 'Verificación cerrada. Su tarea del pizarrón quedó hecha.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<void> _cancelar() async {
    final confirmar = await _confirmar(
      titulo: '¿Cancelar «${_v?.titulo ?? ''}»?',
      mensaje: 'Úsalo si se pidió por error. Queda como cancelada y su tarea sale del pizarrón.',
      boton: 'Sí, cancelarla',
      peligro: true,
    );
    if (confirmar != true || !mounted) return;
    try {
      _aplicar(await ref.read(repositorioProvider).cancelarVerificacion(widget.id));
      if (mounted) avisar(context, 'Verificación cancelada.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<bool?> _confirmar({
    required String titulo,
    required String mensaje,
    required String boton,
    bool peligro = false,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: Text(titulo),
        content: Text(mensaje),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Volver')),
          FilledButton(
            style: peligro ? FilledButton.styleFrom(backgroundColor: Theme.of(dialogo).colorScheme.error) : null,
            onPressed: () => Navigator.pop(dialogo, true),
            child: Text(boton),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final gestionar = ref.watch(sesionProvider).usuario?.puede('inventario.gestionar') ?? false;
    final puedeTareas = ref.watch(sesionProvider).usuario?.puede('tareas.ver') ?? false;
    final v = _v;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Verificación'),
        actions: [
          if (v != null && v.abierta && gestionar)
            PopupMenuButton<String>(
              tooltip: 'Acciones',
              onSelected: (valor) => valor == 'cerrar' ? _cerrar() : _cancelar(),
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'cerrar', child: _ItemMenu(Icons.check_circle_outline, 'Cerrar verificación')),
                const PopupMenuItem(value: 'cancelar', child: _ItemMenu(Icons.cancel_outlined, 'Cancelar verificación')),
              ],
            ),
        ],
      ),
      body: v == null
          ? (_cargando
              ? const Center(child: CircularProgressIndicator())
              : EstadoError(error: _error ?? 'Error', onReintentar: _cargar))
          : _Contenido(
              v: v,
              puedeTareas: puedeTareas,
              buscar: _buscar,
              lugar: _lugar,
              resultado: _resultado,
              enviando: _enviando,
              onBuscar: (x) => setState(() => _buscar = x),
              onLugar: (x) => setState(() => _lugar = x),
              onResultado: (x) => setState(() => _resultado = x),
              onTocar: _tocarResultado,
              onNota: (i) => _abrirNota(i, i.resultado),
              onMarcarTodos: _marcarTodos,
              onRefrescar: _cargar,
            ),
    );
  }
}

class _ItemMenu extends StatelessWidget {
  const _ItemMenu(this.icono, this.texto);
  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) =>
      Row(children: [Icon(icono, size: 20), const SizedBox(width: 12), Text(texto)]);
}

class _Contenido extends StatelessWidget {
  const _Contenido({
    required this.v,
    required this.puedeTareas,
    required this.buscar,
    required this.lugar,
    required this.resultado,
    required this.enviando,
    required this.onBuscar,
    required this.onLugar,
    required this.onResultado,
    required this.onTocar,
    required this.onNota,
    required this.onMarcarTodos,
    required this.onRefrescar,
  });

  final Verificacion v;
  final bool puedeTareas;
  final String buscar;
  final String lugar;
  final String resultado;
  final Set<int> enviando;
  final ValueChanged<String> onBuscar;
  final ValueChanged<String> onLugar;
  final ValueChanged<String> onResultado;
  final void Function(ItemVerificacion item, String resultado) onTocar;
  final void Function(ItemVerificacion item) onNota;
  final void Function(List<ItemVerificacion> pendientes) onMarcarTodos;
  final Future<void> Function() onRefrescar;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final c = v.conteo;
    final lugaresDeLista = {for (final i in v.items) i.lugarNombre}.toList()..sort();
    final q = buscar.trim().toLowerCase();
    final filtrados = v.items.where((i) {
      final okLugar = lugar.isEmpty || i.lugarNombre == lugar;
      final okResultado = resultado.isEmpty || i.resultado == resultado;
      final okBuscar = q.isEmpty || '${i.codigo} ${i.descripcion} ${i.tipoNombre}'.toLowerCase().contains(q);
      return okLugar && okResultado && okBuscar;
    }).toList();
    final pendientesVisibles = filtrados.where((i) => i.pendiente).toList();

    return RefreshIndicator(
      onRefresh: onRefrescar,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Row(
            children: [
              Expanded(child: Text(v.titulo, style: tema.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600))),
              const SizedBox(width: 8),
              Etiqueta(v.estadoNombre, tono: tonoDeVerificacion(v.estado)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              if (v.alcance.isNotEmpty) v.alcance,
              'pedida por ${v.creadoPorNombre}, ${relativo(v.creadoEn)}',
            ].join(' · '),
            style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
          ),
          Text(
            v.responsablesNombres.isEmpty
                ? 'Para todos los auxiliares'
                : 'Responsables: ${v.responsablesNombres.join(', ')}',
            style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
          ),
          if (v.fechaLimite.isNotEmpty)
            Text(
              'Hasta el ${fechaCortaIso(v.fechaLimite)}',
              style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
            ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: LinearProgressIndicator(
              value: c.total == 0 ? 0 : v.progreso / 100,
              minHeight: 10,
              color: v.cerrada ? Colors.green.shade600 : esquema.primary,
            ),
          ),
          const SizedBox(height: 8),
          Text('${c.revisados} de ${c.total} revisados (${v.progreso}%)', style: tema.textTheme.bodyMedium),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              if (c.esta > 0) Etiqueta('${c.esta} están', tono: Tono.exito),
              if (c.falta > 0) Etiqueta('${c.falta} faltan', tono: Tono.peligro),
              if (c.otroLugar > 0) Etiqueta('${c.otroLugar} en otro lugar', tono: Tono.aviso),
              if (c.danado > 0) Etiqueta('${c.danado} dañados', tono: Tono.aviso),
            ],
          ),
          if (v.abierta && !v.puedeMarcar)
            _Aviso('Esta verificación está asignada a otras personas: puedes verla, pero no marcarla.'),
          if (v.tarea != null && puedeTareas)
            _Aviso(
              'Está en el pizarrón de tareas. Su avance se calcula solo con lo que se marca aquí.',
              accion: TextButton(
                onPressed: () => context.push('/tarea/${v.tarea}'),
                child: const Text('Ver en el pizarrón'),
              ),
            ),
          if (v.instrucciones.isNotEmpty) ...[
            const TituloSeccion('Instrucciones'),
            Text(v.instrucciones),
          ],
          if (!v.abierta) ...[
            TituloSeccion(v.cerrada ? 'Cierre' : 'Cancelación'),
            Text([
              if (v.cerradaPorNombre.isNotEmpty) v.cerradaPorNombre else '—',
              if (v.cerradaEn != null) relativo(v.cerradaEn!),
            ].join(', ')),
            if (v.conclusion.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(v.conclusion)),
          ],
          const TituloSeccion('Activos'),
          TextField(
            onChanged: onBuscar,
            decoration: const InputDecoration(
              hintText: 'Buscar por código o descripción',
              prefixIcon: Icon(Icons.search),
              isDense: true,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              if (lugaresDeLista.length > 1) ...[
                Expanded(
                  child: _Desplegable(
                    valor: lugar,
                    etiqueta: 'Lugar',
                    opciones: [('', 'Todos los lugares'), for (final l in lugaresDeLista) (l, l)],
                    onCambio: onLugar,
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: _Desplegable(
                  valor: resultado,
                  etiqueta: 'Resultado',
                  opciones: [
                    ('', 'Todos'),
                    ('pendiente', 'Sin revisar (${c.pendientes})'),
                    for (final (valor, nombre) in resultadosVerificacion)
                      (valor, '$nombre (${_conteoDe(c, valor)})'),
                  ],
                  onCambio: onResultado,
                ),
              ),
            ],
          ),
          if (v.puedeMarcar && pendientesVisibles.length > 1) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: () => onMarcarTodos(pendientesVisibles),
                icon: const Icon(Icons.done_all, size: 18),
                label: Text('Marcar «Está» los ${pendientesVisibles.length} sin revisar'),
              ),
            ),
          ],
          const SizedBox(height: 8),
          if (filtrados.isEmpty)
            Text('Ningún activo coincide.', style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant)),
          for (final i in filtrados)
            _LineaItem(
              item: i,
              puedeMarcar: v.puedeMarcar,
              ocupado: enviando.contains(i.id),
              onTocar: (r) => onTocar(i, r),
              onNota: () => onNota(i),
            ),
        ],
      ),
    );
  }

  int _conteoDe(ConteoVerificacion c, String valor) => switch (valor) {
        'esta' => c.esta,
        'falta' => c.falta,
        'otro_lugar' => c.otroLugar,
        'danado' => c.danado,
        _ => 0,
      };
}

class _Aviso extends StatelessWidget {
  const _Aviso(this.texto, {this.accion});
  final String texto;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: esquema.surfaceContainerHigh, borderRadius: BorderRadius.circular(10)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(Icons.info_outline, size: 18, color: esquema.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(child: Text(texto, style: Theme.of(context).textTheme.bodySmall)),
          if (accion != null) accion!,
        ],
      ),
    );
  }
}

class _Desplegable extends StatelessWidget {
  const _Desplegable({required this.valor, required this.etiqueta, required this.opciones, required this.onCambio});

  final String valor;
  final String etiqueta;
  final List<(String, String)> opciones;
  final ValueChanged<String> onCambio;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: valor,
      isExpanded: true,
      isDense: true,
      decoration: InputDecoration(labelText: etiqueta, isDense: true),
      items: [for (final (v, nombre) in opciones) DropdownMenuItem(value: v, child: Text(nombre, overflow: TextOverflow.ellipsis))],
      onChanged: (v) => onCambio(v ?? ''),
    );
  }
}

class _LineaItem extends StatelessWidget {
  const _LineaItem({
    required this.item,
    required this.puedeMarcar,
    required this.ocupado,
    required this.onTocar,
    required this.onNota,
  });

  final ItemVerificacion item;
  final bool puedeMarcar;
  final bool ocupado;
  final void Function(String resultado) onTocar;
  final VoidCallback onNota;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final i = item;
    final notaLinea = [
      if (i.lugarEncontradoNombre.isNotEmpty) 'Está en ${i.lugarEncontradoNombre}',
      if (i.nota.isNotEmpty) i.nota,
    ].join(' · ');

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: esquema.outlineVariant))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(i.codigo, style: tema.textTheme.labelMedium?.copyWith(color: esquema.primary)),
                        const SizedBox(width: 8),
                        Expanded(child: Text(i.descripcion, maxLines: 2, overflow: TextOverflow.ellipsis)),
                      ],
                    ),
                    Text(
                      [
                        if (i.tipoNombre.isNotEmpty) i.tipoNombre,
                        i.lugarNombre,
                        if (i.verificadoPorNombre.isNotEmpty) 'marcó ${i.verificadoPorNombre}',
                      ].join(' · '),
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                    ),
                    if (notaLinea.isNotEmpty)
                      Text(
                        notaLinea,
                        style: tema.textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic, color: esquema.onSurfaceVariant),
                      ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Ver la ficha del activo',
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.open_in_new, size: 18),
                onPressed: () => context.push('/inventario/activo/${i.activo}'),
              ),
            ],
          ),
          const SizedBox(height: 4),
          if (puedeMarcar)
            Row(
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      for (final (valor, nombre) in resultadosVerificacion)
                        ChoiceChip(
                          label: Text(nombre),
                          selected: i.resultado == valor,
                          onSelected: ocupado ? null : (_) => onTocar(valor),
                        ),
                    ],
                  ),
                ),
                if (!i.pendiente)
                  IconButton(
                    tooltip: 'Agregar o cambiar la nota',
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.sticky_note_2_outlined, size: 18),
                    onPressed: ocupado ? null : onNota,
                  ),
              ],
            )
          else
            Etiqueta(i.resultadoNombre, tono: tonoDeResultado(i.resultado)),
        ],
      ),
    );
  }
}

/// Hoja para la nota (y, en "en otro lugar", dónde está).
class _HojaNota extends StatefulWidget {
  const _HojaNota({required this.item, required this.resultado, required this.lugares});

  final ItemVerificacion item;
  final String resultado;
  final List<Lugar> lugares;

  @override
  State<_HojaNota> createState() => _HojaNotaState();
}

class _HojaNotaState extends State<_HojaNota> {
  late final TextEditingController _nota = TextEditingController(text: widget.item.nota);
  late int? _lugar = widget.item.lugarEncontrado;

  @override
  void dispose() {
    _nota.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final nombre = resultadosVerificacion.firstWhere((r) => r.$1 == widget.resultado, orElse: () => ('', '')).$2;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${widget.item.codigo}: $nombre', style: tema.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(widget.item.descripcion, style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 16),
          if (widget.resultado == 'otro_lugar') ...[
            DropdownButtonFormField<int?>(
              initialValue: _lugar,
              isExpanded: true,
              decoration: const InputDecoration(labelText: '¿Dónde está? (opcional)'),
              items: [
                const DropdownMenuItem<int?>(value: null, child: Text('No lo sé')),
                for (final l in widget.lugares)
                  DropdownMenuItem<int?>(value: l.id, child: Text(l.nombre, overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (v) => setState(() => _lugar = v),
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _nota,
            maxLength: 300,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Nota (opcional)',
              hintText: 'Ej.: le falta una rueda; lo tiene la secretaría.',
            ),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: () => Navigator.pop(
              context,
              (lugar: widget.resultado == 'otro_lugar' ? _lugar : null, nota: _nota.text.trim()),
            ),
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
  }
}
