import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../core/theme/tema.dart';
import 'comunes.dart';

Color colorDeEvento(EventoAgenda e) => e.esClase ? ColoresFicct.clase : ColoresFicct.reserva;

/// Una clase o reserva en la lista del día. La barra de la izquierda indica el tipo.
class TarjetaEvento extends StatelessWidget {
  const TarjetaEvento({super.key, required this.evento, this.enCurso = false, this.mostrarLaboratorio = true});

  final EventoAgenda evento;
  final bool enCurso;
  final bool mostrarLaboratorio;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final color = colorDeEvento(evento);
    final apagado = evento.suspendida;

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: enCurso ? color : esquema.outlineVariant, width: enCurso ? 1.5 : 1),
      ),
      child: InkWell(
        onTap: () => mostrarEvento(context, evento),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, color: apagado ? esquema.outlineVariant : color),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 4, 12),
                child: SizedBox(
                  width: 48,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(evento.horaInicio, style: tema.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
                      Text(evento.horaFin, style: tema.textTheme.labelMedium?.copyWith(color: esquema.onSurfaceVariant)),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(4, 12, 12, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        evento.titulo,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: tema.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          decoration: apagado ? TextDecoration.lineThrough : null,
                          color: apagado ? esquema.onSurfaceVariant : null,
                        ),
                      ),
                      if (evento.detalle.isNotEmpty || evento.responsable.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            [evento.detalle, evento.responsable].where((t) => t.isNotEmpty).join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                          ),
                        ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (mostrarLaboratorio) Etiqueta(evento.laboratorioCodigo, tono: Tono.neutro),
                          if (enCurso) const Etiqueta('En curso', tono: Tono.exito),
                          if (apagado) const Etiqueta('Suspendida', tono: Tono.peligro),
                          if (!evento.esClase && evento.estado == 'pendiente')
                            const Etiqueta('Pendiente', tono: Tono.aviso),
                          if (evento.requiereApoyo) const Etiqueta('Con apoyo', tono: Tono.info),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ficha completa de una clase o reserva.
Future<void> mostrarEvento(BuildContext context, EventoAgenda e) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (_) => _HojaEvento(evento: e),
  );
}

class _HojaEvento extends ConsumerStatefulWidget {
  const _HojaEvento({required this.evento});
  final EventoAgenda evento;

  @override
  ConsumerState<_HojaEvento> createState() => _HojaEventoState();
}

class _HojaEventoState extends ConsumerState<_HojaEvento> {
  /// 'alistar' o 'cerrar' mientras se envía el aviso.
  String? _enviando;

  Future<void> _avisar(String tipo) async {
    final e = widget.evento;
    final alistar = tipo == 'alistar';
    final nota = await pedirTexto(
      context,
      titulo: alistar ? 'Avisar: alistar aula' : 'Avisar: cerrar aula',
      mensaje: alistar
          ? 'Los auxiliares recibirán un aviso para preparar ${e.laboratorioCodigo} antes de las ${e.horaInicio}.'
          : 'Los auxiliares recibirán un aviso para cerrar ${e.laboratorioCodigo} al terminar (${e.horaFin}).',
      etiqueta: 'Nota',
      boton: 'Enviar aviso',
      maximo: 300,
    );
    if (nota == null || !mounted) return;
    setState(() => _enviando = tipo);
    try {
      final enviadas = await ref.read(repositorioProvider).avisarAula(
            tipo: tipo,
            evento: e.id,
            fecha: e.fecha,
            nota: nota,
          );
      if (!mounted) return;
      avisar(context, 'Aviso enviado a $enviadas ${enviadas == 1 ? 'auxiliar' : 'auxiliares'}');
      Navigator.pop(context);
    } catch (falla) {
      if (mounted) avisar(context, mensajeDeError(falla), error: true);
    } finally {
      if (mounted) setState(() => _enviando = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final e = widget.evento;
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final puedeAvisar = (ref.watch(sesionProvider).usuario?.puede('avisos.enviar') ?? false) && !e.suspendida;

    Widget fila(IconData icono, String texto) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icono, size: 20, color: esquema.onSurfaceVariant),
              const SizedBox(width: 12),
              Expanded(child: Text(texto, style: tema.textTheme.bodyMedium)),
            ],
          ),
        );

    Widget botonAviso(String tipo, IconData icono, String texto) => OutlinedButton.icon(
          onPressed: _enviando == null ? () => _avisar(tipo) : null,
          icon: _enviando == tipo
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : Icon(icono),
          label: Text(texto, overflow: TextOverflow.ellipsis),
        );

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(spacing: 6, children: [
            Etiqueta(e.esClase ? 'Clase' : 'Reserva', tono: e.esClase ? Tono.marca : Tono.aviso),
            if (e.suspendida) const Etiqueta('Suspendida', tono: Tono.peligro),
            if (!e.esClase && e.estado == 'pendiente') const Etiqueta('Pendiente', tono: Tono.aviso),
          ]),
          const SizedBox(height: 10),
          Text(e.titulo, style: tema.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
          if (e.detalle.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(e.detalle, style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant)),
          ],
          const SizedBox(height: 12),
          fila(Icons.schedule, '${fechaLarga(DateTime.parse(e.fecha))} · ${e.horaInicio} – ${e.horaFin}'),
          fila(Icons.computer_outlined, e.laboratorioCodigo),
          if (e.responsable.isNotEmpty) fila(Icons.person_outline, e.responsable),
          if (e.nota.isNotEmpty) fila(Icons.info_outline, e.suspendida ? 'Motivo: ${e.nota}' : e.nota),
          if (e.requiereApoyo) fila(Icons.support_agent_outlined, 'Necesita apoyo de auxiliares'),
          if (e.programas.isNotEmpty) ...[
            const TituloSeccion('Programas solicitados'),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [for (final p in e.programas) Chip(label: Text(p), visualDensity: VisualDensity.compact)],
            ),
          ],
          if (e.preferencias.isNotEmpty) ...[
            const TituloSeccion('Preferencias del docente'),
            for (final p in e.preferencias)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('•  '),
                    Expanded(child: Text(p, style: tema.textTheme.bodyMedium)),
                  ],
                ),
              ),
          ],
          if (puedeAvisar) ...[
            const TituloSeccion('Avisar a los auxiliares'),
            Row(
              children: [
                Expanded(child: botonAviso('alistar', Icons.door_front_door_outlined, 'Alistar aula')),
                const SizedBox(width: 8),
                Expanded(child: botonAviso('cerrar', Icons.lock_outline, 'Cerrar aula')),
              ],
            ),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                final router = GoRouter.of(context);
                Navigator.pop(context);
                router.push('/laboratorio/${e.laboratorio}');
              },
              icon: const Icon(Icons.grid_view_outlined),
              label: Text('Ver ${e.laboratorioCodigo}'),
            ),
          ),
        ],
      ),
    );
  }
}
