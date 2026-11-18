import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';

/// Preferencias de notificaciones push: el interruptor general y el "solo en turno".
class PreferenciasPushPage extends ConsumerStatefulWidget {
  const PreferenciasPushPage({super.key});

  @override
  ConsumerState<PreferenciasPushPage> createState() => _PreferenciasPushPageState();
}

class _PreferenciasPushPageState extends ConsumerState<PreferenciasPushPage> {
  bool _guardando = false;

  Future<void> _guardar({bool? habilitado, bool? soloEnTurno}) async {
    setState(() => _guardando = true);
    try {
      await ref
          .read(repositorioProvider)
          .guardarPreferenciasPush(habilitado: habilitado, soloEnTurno: soloEnTurno);
      ref.invalidate(preferenciasPushProvider);
      await ref.read(preferenciasPushProvider.future);
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final prefs = ref.watch(preferenciasPushProvider);
    final tema = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Notificaciones')),
      body: prefs.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoError(error: e, onReintentar: () => ref.invalidate(preferenciasPushProvider)),
        data: (p) => ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Text(
                'Avisos en este teléfono',
                style: tema.textTheme.titleSmall?.copyWith(color: tema.colorScheme.primary),
              ),
            ),
            SwitchListTile(
              secondary: const Icon(Icons.notifications_active_outlined),
              title: const Text('Notificaciones push'),
              subtitle: const Text(
                'Recibe avisos en el teléfono aunque la app esté cerrada. '
                'Al apagarlas, los avisos siguen en la campana.',
              ),
              value: p.habilitado,
              onChanged: _guardando ? null : (v) => _guardar(habilitado: v),
            ),
            const Divider(),
            SwitchListTile(
              secondary: const Icon(Icons.schedule_outlined),
              title: const Text('Solo durante mi turno'),
              subtitle: const Text(
                'Recibe push únicamente dentro de tu horario de trabajo. '
                'Fuera de turno, los avisos quedan solo en la campana.',
              ),
              value: p.soloEnTurno,
              // Si el push general está apagado, este ajuste no aplica.
              onChanged: (_guardando || !p.habilitado) ? null : (v) => _guardar(soloEnTurno: v),
            ),
            if (_guardando)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: Text('Guardando…')),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Si no te llegan los avisos, revisa que las notificaciones de la app '
                'estén permitidas en los ajustes del teléfono.',
                style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
