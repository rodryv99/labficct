import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../notificaciones/notificaciones_page.dart';
import '../perfil/perfil_sheet.dart';

Tono tonoDeReserva(String estado) => switch (estado) {
      'confirmada' => Tono.exito,
      'pendiente' => Tono.aviso,
      'cancelada' => Tono.neutro,
      _ => Tono.neutro,
    };

/// "Sáb 27 sep · 08:00–12:00 · LAB-2"
String resumenBloque(Bloque b) {
  final dia = DateFormat('EEE d MMM', 'es').format(DateTime.parse(b.fecha));
  return '${dia[0].toUpperCase()}${dia.substring(1)} · ${b.horaInicio}–${b.horaFin} · ${b.laboratorioCodigo}';
}

class ReservasPage extends ConsumerStatefulWidget {
  const ReservasPage({super.key});

  @override
  ConsumerState<ReservasPage> createState() => _ReservasPageState();
}

class _ReservasPageState extends ConsumerState<ReservasPage> {
  String _cuando = 'proximas';

  @override
  Widget build(BuildContext context) {
    final usuario = ref.watch(sesionProvider).usuario;
    final gestiona = usuario?.puede('reservas.gestionar') ?? false;
    final reservas = ref.watch(reservasProvider(_cuando));

    return Scaffold(
      appBar: AppBar(
        title: Text(gestiona ? 'Reservas' : 'Mis reservas'),
        actions: const [BotonNotificaciones(), BotonPerfil()],
      ),
      floatingActionButton: gestiona
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/reserva/nueva'),
              icon: const Icon(Icons.add),
              label: const Text('Nueva'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: SizedBox(
              width: double.infinity,
              child: SegmentedButton<String>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: 'proximas', label: Text('Próximas')),
                  ButtonSegment(value: 'pasadas', label: Text('Pasadas')),
                ],
                selected: {_cuando},
                onSelectionChanged: (s) => setState(() => _cuando = s.first),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(reservasProvider(_cuando).future),
              child: reservas.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [
                  const SizedBox(height: 80),
                  EstadoError(error: e, onReintentar: () => ref.invalidate(reservasProvider(_cuando))),
                ]),
                data: (lista) {
                  if (lista.isEmpty) {
                    return ListView(children: [
                      const SizedBox(height: 80),
                      EstadoVacio(
                        icono: Icons.event_available_outlined,
                        titulo: _cuando == 'proximas' ? 'No hay reservas próximas' : 'Sin reservas pasadas',
                        descripcion: gestiona && _cuando == 'proximas'
                            ? 'Registra un evento único o de pocos días con el botón Nueva.'
                            : null,
                      ),
                    ]);
                  }
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                    itemCount: lista.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _TarjetaReserva(reserva: lista[i], gestiona: gestiona),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TarjetaReserva extends StatelessWidget {
  const _TarjetaReserva({required this.reserva, required this.gestiona});
  final Reserva reserva;
  final bool gestiona;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final r = reserva;
    final primero = r.bloques.isEmpty ? null : r.bloques.first;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => mostrarReserva(context, r, gestiona: gestiona),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      r.titulo,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        decoration: r.cancelada ? TextDecoration.lineThrough : null,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Etiqueta(r.estadoNombre, tono: tonoDeReserva(r.estado)),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                r.solicitanteNombre,
                style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
              ),
              if (primero != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.schedule, size: 16, color: esquema.onSurfaceVariant),
                    const SizedBox(width: 6),
                    Expanded(child: Text(resumenBloque(primero), style: tema.textTheme.bodyMedium)),
                  ],
                ),
                if (r.bloques.length > 1)
                  Padding(
                    padding: const EdgeInsets.only(left: 22, top: 2),
                    child: Text(
                      '+${r.bloques.length - 1} ${r.bloques.length == 2 ? 'día más' : 'días más'}',
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.primary),
                    ),
                  ),
              ],
              if (r.requiereApoyo || r.programas.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (r.requiereApoyo)
                      Etiqueta(
                        r.auxiliaresRequeridos > 1 ? '${r.auxiliaresRequeridos} auxiliares' : 'Con apoyo',
                        tono: Tono.info,
                      ),
                    if (r.programas.isNotEmpty)
                      Etiqueta(
                        '${r.programas.length} ${r.programas.length == 1 ? 'programa' : 'programas'}',
                        tono: Tono.neutro,
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Ficha completa de la reserva, con la opción de cancelarla.
Future<void> mostrarReserva(BuildContext context, Reserva r, {required bool gestiona}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (_) => _HojaReserva(reserva: r, gestiona: gestiona),
  );
}

class _HojaReserva extends ConsumerStatefulWidget {
  const _HojaReserva({required this.reserva, required this.gestiona});
  final Reserva reserva;
  final bool gestiona;

  @override
  ConsumerState<_HojaReserva> createState() => _HojaReservaState();
}

class _HojaReservaState extends ConsumerState<_HojaReserva> {
  bool _cancelando = false;

  Future<void> _cancelar() async {
    final texto = await pedirTexto(
      context,
      titulo: '¿Cancelar la reserva?',
      mensaje: 'Los laboratorios quedarán libres en esos horarios. La reserva no se borra: queda como cancelada.',
      etiqueta: 'Motivo',
      boton: 'Cancelar reserva',
      peligro: true,
    );
    if (texto == null || !mounted) return;

    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _cancelando = true);
    try {
      await ref.read(repositorioProvider).cancelarReserva(widget.reserva.id, texto);
      refrescarAgenda(contenedor);
      if (!mounted) return;
      avisar(context, 'Reserva cancelada.');
      Navigator.pop(context);
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _cancelando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.reserva;
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final fin = r.fin;
    final sePuedeCancelar = widget.gestiona && !r.cancelada && fin != null && fin.isAfter(DateTime.now());

    Widget fila(IconData icono, String texto) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icono, size: 20, color: esquema.onSurfaceVariant),
              const SizedBox(width: 12),
              Expanded(child: Text(texto)),
            ],
          ),
        );

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Etiqueta(r.estadoNombre, tono: tonoDeReserva(r.estado)),
          const SizedBox(height: 10),
          Text(r.titulo, style: tema.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
          if (r.descripcion.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(r.descripcion, style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant)),
          ],
          const SizedBox(height: 10),
          fila(Icons.person_outline, r.solicitanteNombre),
          if (r.contacto.isNotEmpty) fila(Icons.call_outlined, r.contacto),
          if (r.cancelada && r.motivoCancelacion.isNotEmpty) fila(Icons.info_outline, 'Motivo: ${r.motivoCancelacion}'),
          TituloSeccion(r.bloques.length == 1 ? 'Día y horario' : 'Días y horarios (${r.bloques.length})'),
          for (final b in r.bloques) fila(Icons.event_outlined, resumenBloque(b)),
          if (r.requiereApoyo) ...[
            const TituloSeccion('Apoyo de auxiliares'),
            fila(
              Icons.support_agent_outlined,
              r.auxiliares.isEmpty
                  ? 'Se necesitan ${r.auxiliaresRequeridos} (sin asignar todavía)'
                  : '${r.auxiliares.join(', ')} (${r.auxiliares.length} de ${r.auxiliaresRequeridos})',
            ),
          ],
          if (r.programas.isNotEmpty) ...[
            const TituloSeccion('Programas solicitados'),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [for (final p in r.programas) Chip(label: Text(p), visualDensity: VisualDensity.compact)],
            ),
          ],
          if (sePuedeCancelar) ...[
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(foregroundColor: esquema.error),
                onPressed: _cancelando ? null : _cancelar,
                icon: _cancelando
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.event_busy_outlined),
                label: const Text('Cancelar reserva'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
