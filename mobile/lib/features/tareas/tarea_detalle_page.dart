import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'tareas_page.dart';

/// Una tarea del pizarrón: datos, columna, progreso y sus avances.
class TareaDetallePage extends ConsumerStatefulWidget {
  const TareaDetallePage({super.key, required this.id});
  final int id;

  @override
  ConsumerState<TareaDetallePage> createState() => _TareaDetallePageState();
}

class _TareaDetallePageState extends ConsumerState<TareaDetallePage> {
  final _texto = TextEditingController();
  final _scroll = ScrollController();

  /// Columna elegida mientras se guarda (para que el botón no salte atrás).
  String? _estadoElegido;
  bool _conProgreso = false;
  double _progreso = 0;
  bool _enviando = false;

  @override
  void dispose() {
    _texto.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _irAlFinal() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _mover(Tarea t, String estado) async {
    if (estado == t.estado) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    final id = widget.id;
    setState(() => _estadoElegido = estado);
    try {
      await ref.read(repositorioProvider).cambiarEstadoTarea(t.id, estado);
      contenedor.invalidate(tareasProvider);
      contenedor.invalidate(tareaProvider(id));
      if (mounted) avisar(context, 'Listo, ahora está en ${nombreDeEstadoTarea(estado)}.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _estadoElegido = null);
      avisar(context, mensajeDeError(e), error: true);
    }
  }

  void _alternarProgreso(Tarea t) {
    setState(() {
      _conProgreso = !_conProgreso;
      // Empieza en el progreso actual, redondeado a la decena.
      if (_conProgreso) _progreso = ((t.progreso / 10).round() * 10).clamp(0, 100).toDouble();
    });
  }

  Future<void> _enviarAvance(Tarea t) async {
    final texto = _texto.text.trim();
    final progreso = _conProgreso ? _progreso.round() : null;
    if (texto.isEmpty && progreso == null) {
      avisar(context, 'Escribe cómo va o marca el progreso.', error: true);
      return;
    }
    final contenedor = ProviderScope.containerOf(context, listen: false);
    final id = widget.id;
    setState(() => _enviando = true);
    try {
      await ref.read(repositorioProvider).agregarAvance(t.id, texto: texto, progreso: progreso);
      contenedor.invalidate(tareasProvider);
      contenedor.invalidate(tareaProvider(id));
      if (!mounted) return;
      _texto.clear();
      FocusScope.of(context).unfocus();
      setState(() => _conProgreso = false);
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _eliminar(Tarea t) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: const Text('¿Eliminar la tarea?'),
        content: Text('«${t.titulo}» se borra del pizarrón con todos sus avances. No se puede deshacer.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Volver')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(dialogo).colorScheme.error),
            onPressed: () => Navigator.pop(dialogo, true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirmar != true || !mounted) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarTarea(t.id);
      contenedor.invalidate(tareasProvider);
      if (!mounted) return;
      avisar(context, 'Tarea eliminada.');
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/tareas');
      }
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tarea = ref.watch(tareaProvider(widget.id));
    final usuario = ref.watch(sesionProvider).usuario;
    final gestiona = usuario?.puede('tareas.gestionar') ?? false;
    final actual = tarea.value;

    // Al llegar la versión nueva: suelta la columna elegida y, si hay un avance nuevo, baja hasta él.
    ref.listen<AsyncValue<Tarea>>(tareaProvider(widget.id), (anterior, siguiente) {
      final ahora = siguiente.value;
      if (siguiente.isLoading || ahora == null) return;
      if (_estadoElegido != null) setState(() => _estadoElegido = null);
      final antes = anterior?.value;
      if (antes != null && ahora.avances.length > antes.avances.length) _irAlFinal();
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tarea'),
        actions: [
          if (actual != null &&
              usuario != null &&
              (actual.creadoPor == usuario.id || usuario.puede('tareas.eliminar_todas')))
            PopupMenuButton<String>(
              tooltip: 'Más opciones',
              onSelected: (_) => _eliminar(actual),
              itemBuilder: (menu) => [
                PopupMenuItem(
                  value: 'eliminar',
                  child: Row(
                    children: [
                      Icon(Icons.delete_outline, color: Theme.of(menu).colorScheme.error),
                      const SizedBox(width: 12),
                      const Text('Eliminar tarea'),
                    ],
                  ),
                ),
              ],
            ),
        ],
      ),
      body: tarea.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoError(error: e, onReintentar: () => ref.invalidate(tareaProvider(widget.id))),
        data: (t) => Column(
          children: [
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => ref.refresh(tareaProvider(widget.id).future),
                child: _Contenido(
                  tarea: t,
                  controlador: _scroll,
                  estadoVisible: _estadoElegido ?? t.estado,
                  onMover: gestiona && _estadoElegido == null ? (estado) => _mover(t, estado) : null,
                ),
              ),
            ),
            if (gestiona)
              _Redactor(
                texto: _texto,
                conProgreso: _conProgreso,
                progreso: _progreso,
                enviando: _enviando,
                onAlternarProgreso: () => _alternarProgreso(t),
                onProgreso: (v) => setState(() => _progreso = v),
                onEnviar: () => _enviarAvance(t),
              ),
          ],
        ),
      ),
    );
  }
}

class _Contenido extends StatelessWidget {
  const _Contenido({
    required this.tarea,
    required this.controlador,
    required this.estadoVisible,
    required this.onMover,
  });

  final Tarea tarea;
  final ScrollController controlador;
  final String estadoVisible;

  /// null: no se puede mover (sin permiso o guardando).
  final ValueChanged<String>? onMover;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final t = tarea;
    final mover = onMover;
    final fecha = DateTime.tryParse(t.fechaLimite ?? '');

    return ListView(
      controller: controlador,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 4,
          children: [
            Etiqueta(t.estadoNombre, tono: tonoDeTarea(t.estado)),
            if (t.alta)
              const Etiqueta('Prioridad alta', tono: Tono.peligro)
            else if (t.prioridadNombre.isNotEmpty)
              Etiqueta('Prioridad ${t.prioridadNombre.toLowerCase()}'),
            if (t.vencida) const Etiqueta('Vencida', tono: Tono.peligro),
          ],
        ),
        const SizedBox(height: 10),
        Text(t.titulo, style: tema.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
        if (t.descripcion.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(t.descripcion, style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant)),
        ],
        const TituloSeccion('Columna'),
        SizedBox(
          width: double.infinity,
          child: SegmentedButton<String>(
            showSelectedIcon: false,
            segments: [
              for (final (valor, nombre) in estadosTarea) ButtonSegment(value: valor, label: Text(nombre)),
            ],
            selected: {estadoVisible},
            onSelectionChanged: mover == null ? null : (s) => mover(s.first),
          ),
        ),
        if (t.progreso > 0) ...[
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(value: t.progreso / 100, minHeight: 8),
                ),
              ),
              const SizedBox(width: 10),
              Text('${t.progreso} %', style: tema.textTheme.labelLarge),
            ],
          ),
        ],
        const TituloSeccion('Detalles'),
        if (t.laboratorioCodigo.isNotEmpty) _Fila(Icons.computer_outlined, t.laboratorioCodigo),
        if (fecha != null)
          _Fila(
            Icons.event_outlined,
            '${t.vencida ? 'Venció' : 'Vence'}: ${fechaLarga(fecha)}',
            color: t.vencida ? esquema.error : null,
          ),
        _Fila(
          Icons.people_outline,
          t.responsablesNombres.isEmpty ? 'Sin responsables' : t.responsablesNombres.join(', '),
        ),
        _Fila(Icons.edit_note_outlined, 'Creada por ${t.creadoPorNombre} · ${relativo(t.creadoEn)}'),
        if (t.revisionTitulo.isNotEmpty) _Fila(Icons.fact_check, 'Revisión periódica: ${t.revisionTitulo}'),
        if (t.hecha && t.completadaEn != null)
          _Fila(
            Icons.check_circle_outline,
            [
              'Hecha',
              if (t.completadaPorNombre.isNotEmpty) 'por ${t.completadaPorNombre}',
              '· ${relativo(t.completadaEn!)}',
            ].join(' '),
          ),
        TituloSeccion('Avances (${t.avances.length})'),
        if (t.avances.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              'Todavía no hay avances. Anota cómo va para que todos lo vean.',
              style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
            ),
          ),
        for (var i = 0; i < t.avances.length; i++)
          _LineaAvance(avance: t.avances[i], ultimo: i == t.avances.length - 1),
      ],
    );
  }
}

class _Fila extends StatelessWidget {
  const _Fila(this.icono, this.texto, {this.color});
  final IconData icono;
  final String texto;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icono, size: 20, color: color ?? Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(width: 12),
          Expanded(child: Text(texto, style: color == null ? null : TextStyle(color: color))),
        ],
      ),
    );
  }
}

/// Un paso de la historia de la tarea: quién, cuándo, qué escribió y si la movió de columna.
class _LineaAvance extends StatelessWidget {
  const _LineaAvance({required this.avance, required this.ultimo});
  final AvanceTarea avance;
  final bool ultimo;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final a = avance;
    final movio = a.estadoNuevo.isNotEmpty;
    final nombreEstado = a.estadoNuevoNombre.isNotEmpty ? a.estadoNuevoNombre : nombreDeEstadoTarea(a.estadoNuevo);
    final progreso = a.progreso;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 20,
            child: Column(
              children: [
                const SizedBox(height: 4),
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: movio ? esquema.tertiary : esquema.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                if (!ultimo) Expanded(child: Container(width: 2, color: esquema.outlineVariant)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(a.autorNombre, style: tema.textTheme.titleSmall),
                  Text(
                    haceCuanto(a.creadoEn),
                    style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                  ),
                  if (movio)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        'Movió a $nombreEstado',
                        style: tema.textTheme.bodyMedium?.copyWith(
                          fontStyle: FontStyle.italic,
                          color: esquema.onSurfaceVariant,
                        ),
                      ),
                    ),
                  if (a.texto.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(a.texto)),
                  if (progreso != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Etiqueta('Progreso: $progreso %', tono: Tono.info),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Barra de abajo para anotar un avance, con progreso opcional (0–100, de 10 en 10).
class _Redactor extends StatelessWidget {
  const _Redactor({
    required this.texto,
    required this.conProgreso,
    required this.progreso,
    required this.enviando,
    required this.onAlternarProgreso,
    required this.onProgreso,
    required this.onEnviar,
  });

  final TextEditingController texto;
  final bool conProgreso;
  final double progreso;
  final bool enviando;
  final VoidCallback onAlternarProgreso;
  final ValueChanged<double> onProgreso;
  final VoidCallback onEnviar;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: esquema.surfaceContainerLowest,
        border: Border(top: BorderSide(color: esquema.outlineVariant)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (conProgreso)
                Row(
                  children: [
                    const SizedBox(width: 8),
                    Text('Progreso', style: tema.textTheme.labelLarge),
                    Expanded(
                      child: Slider(
                        value: progreso,
                        min: 0,
                        max: 100,
                        divisions: 10,
                        label: '${progreso.round()} %',
                        onChanged: enviando ? null : onProgreso,
                      ),
                    ),
                    SizedBox(
                      width: 48,
                      child: Text('${progreso.round()} %', textAlign: TextAlign.end, style: tema.textTheme.labelLarge),
                    ),
                    const SizedBox(width: 8),
                  ],
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: conProgreso ? 'Quitar progreso' : 'Marcar progreso',
                    isSelected: conProgreso,
                    onPressed: enviando ? null : onAlternarProgreso,
                    icon: const Icon(Icons.trending_up),
                  ),
                  Expanded(
                    child: TextField(
                      controller: texto,
                      enabled: !enviando,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 2000,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(hintText: 'Anota un avance…', counterText: ''),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton.filled(
                    tooltip: 'Enviar avance',
                    onPressed: enviando ? null : onEnviar,
                    icon: enviando
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.send),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
