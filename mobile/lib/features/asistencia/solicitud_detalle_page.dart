import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'asistencia_page.dart';

/// Detalle de una solicitud de asistencia. Quien atiende la toma y la resuelve;
/// quien la pidió puede cancelarla mientras siga abierta.
class SolicitudDetallePage extends ConsumerStatefulWidget {
  const SolicitudDetallePage({super.key, required this.id});
  final int id;

  @override
  ConsumerState<SolicitudDetallePage> createState() => _SolicitudDetallePageState();
}

class _SolicitudDetallePageState extends ConsumerState<SolicitudDetallePage> {
  bool _trabajando = false;

  Future<void> _accion(Future<SolicitudAsistencia> Function(Repositorio repo) llamada, String mensaje) async {
    final contenedor = ProviderScope.containerOf(context, listen: false);
    final id = widget.id;
    setState(() => _trabajando = true);
    try {
      await llamada(ref.read(repositorioProvider));
      if (mounted) avisar(context, mensaje);
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      // También tras un error: si otro auxiliar la tomó antes, se ve cómo quedó.
      refrescarSolicitudes(contenedor);
      contenedor.invalidate(solicitudProvider(id));
      if (mounted) setState(() => _trabajando = false);
    }
  }

  Future<void> _tomar(SolicitudAsistencia s) => _accion(
        (repo) => repo.tomarSolicitud(s.id),
        'Listo. Le avisamos a ${s.solicitanteNombre} que vas en camino.',
      );

  Future<void> _resolver(SolicitudAsistencia s) async {
    final respuesta = await pedirTexto(
      context,
      titulo: 'Marcar como resuelta',
      mensaje: 'Le avisaremos a ${s.solicitanteNombre} que ya está resuelta.',
      etiqueta: 'Qué se hizo',
      boton: 'Marcar resuelta',
      maximo: 500,
    );
    if (respuesta == null || !mounted) return;
    await _accion((repo) => repo.resolverSolicitud(s.id, respuesta), 'Solicitud resuelta. ¡Gracias!');
  }

  Future<void> _cancelar(SolicitudAsistencia s) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: const Text('¿Cancelar la solicitud?'),
        content: const Text(
          'Los auxiliares ya no la verán como pendiente. Si vuelves a necesitar ayuda, pide de nuevo.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Volver')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(dialogo).colorScheme.error),
            onPressed: () => Navigator.pop(dialogo, true),
            child: const Text('Cancelar solicitud'),
          ),
        ],
      ),
    );
    if (confirmar != true || !mounted) return;
    await _accion((repo) => repo.cancelarSolicitud(s.id), 'Solicitud cancelada.');
  }

  Future<void> _copiarTelefono(String telefono) async {
    await Clipboard.setData(ClipboardData(text: telefono));
    if (mounted) avisar(context, 'Teléfono copiado.');
  }

  /// Botones de abajo según quién mira y cómo está la solicitud. null si no hay nada que hacer.
  Widget? _acciones(SolicitudAsistencia s, Usuario u) {
    final atiende = u.puede('asistencia.atender');
    final esMia = s.solicitante == u.id;
    final error = Theme.of(context).colorScheme.error;
    final botones = <Widget>[
      if (atiende && s.pendiente)
        FilledButton.icon(
          onPressed: _trabajando ? null : () => _tomar(s),
          icon: const Icon(Icons.directions_walk),
          label: const Text('Voy en camino'),
        ),
      if (atiende && s.enCurso)
        FilledButton.icon(
          onPressed: _trabajando ? null : () => _resolver(s),
          icon: const Icon(Icons.check_circle_outline),
          label: const Text('Marcar resuelta'),
        ),
      if (atiende && s.pendiente)
        OutlinedButton.icon(
          onPressed: _trabajando ? null : () => _resolver(s),
          icon: const Icon(Icons.check_circle_outline),
          label: const Text('Marcar resuelta'),
        ),
      if (esMia && s.abierta)
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: error),
          onPressed: _trabajando ? null : () => _cancelar(s),
          icon: const Icon(Icons.close),
          label: const Text('Cancelar solicitud'),
        ),
    ];
    if (botones.isEmpty) return null;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < botones.length; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              botones[i],
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final solicitud = ref.watch(solicitudProvider(widget.id));
    final usuario = ref.watch(sesionProvider).usuario;
    final actual = solicitud.value;

    return Scaffold(
      appBar: AppBar(title: Text(actual == null ? 'Solicitud' : 'Solicitud #${actual.id}')),
      body: solicitud.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoError(error: e, onReintentar: () => ref.invalidate(solicitudProvider(widget.id))),
        data: (s) => RefreshIndicator(
          onRefresh: () => ref.refresh(solicitudProvider(widget.id).future),
          child: _Contenido(
            solicitud: s,
            esQuienAtiende: usuario?.puede('asistencia.atender') ?? false,
            onCopiarTelefono: _copiarTelefono,
          ),
        ),
      ),
      bottomNavigationBar: actual == null || usuario == null ? null : _acciones(actual, usuario),
    );
  }
}

class _Contenido extends StatelessWidget {
  const _Contenido({required this.solicitud, required this.esQuienAtiende, required this.onCopiarTelefono});

  final SolicitudAsistencia solicitud;
  final bool esQuienAtiende;
  final ValueChanged<String> onCopiarTelefono;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final s = solicitud;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 4,
          children: [
            Etiqueta(s.estadoNombre, tono: tonoDeSolicitud(s.estado)),
            if (s.urgente) const Etiqueta('Urgente', tono: Tono.peligro),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Icon(iconoDeCategoria(s.categoria), color: esquema.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Text(s.categoriaNombre, style: tema.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(s.descripcion, style: tema.textTheme.bodyLarge),
        if (s.pendiente && !esQuienAtiende)
          Container(
            margin: const EdgeInsets.only(top: 14),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: esquema.primaryContainer, borderRadius: BorderRadius.circular(10)),
            child: Row(
              children: [
                Icon(Icons.hourglass_top_rounded, color: esquema.onPrimaryContainer),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Todavía nadie la tomó. Te avisaremos cuando un auxiliar vaya en camino.',
                    style: TextStyle(color: esquema.onPrimaryContainer),
                  ),
                ),
              ],
            ),
          ),
        const TituloSeccion('Dónde'),
        _Fila(Icons.place_outlined, s.donde.isEmpty ? 'Sin indicar' : s.donde),
        const TituloSeccion('Quién la pidió'),
        _Fila(Icons.person_outline, s.solicitanteNombre),
        if (s.solicitanteTelefono.isNotEmpty)
          _Fila(
            Icons.call_outlined,
            s.solicitanteTelefono,
            accion: IconButton(
              tooltip: 'Copiar teléfono',
              visualDensity: VisualDensity.compact,
              onPressed: () => onCopiarTelefono(s.solicitanteTelefono),
              icon: const Icon(Icons.copy_outlined, size: 18),
            ),
          ),
        const TituloSeccion('Seguimiento'),
        _Fila(Icons.schedule, 'Pedida: ${fechaHora(s.creadoEn)}'),
        if (s.atendidaPorNombre.isNotEmpty)
          _Fila(
            Icons.directions_walk,
            s.atendidaEn == null
                ? 'Atiende: ${s.atendidaPorNombre}'
                : 'Atiende: ${s.atendidaPorNombre} (desde ${fechaHora(s.atendidaEn!)})',
          )
        else if (s.abierta)
          const _Fila(Icons.person_search_outlined, 'Sin auxiliar asignado todavía'),
        if (s.cerradaEn != null)
          _Fila(
            s.estado == 'resuelta' ? Icons.check_circle_outline : Icons.block,
            '${s.estadoNombre}: ${fechaHora(s.cerradaEn!)}',
          ),
        if (s.respuesta.isNotEmpty) ...[
          const TituloSeccion('Qué se hizo'),
          Text(s.respuesta, style: tema.textTheme.bodyLarge),
        ],
      ],
    );
  }
}

class _Fila extends StatelessWidget {
  const _Fila(this.icono, this.texto, {this.accion});
  final IconData icono;
  final String texto;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Icon(icono, size: 20, color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(width: 12),
          Expanded(child: Text(texto)),
          if (accion != null) accion!,
        ],
      ),
    );
  }
}
