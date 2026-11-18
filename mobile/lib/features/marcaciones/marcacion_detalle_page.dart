import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'marcaciones_comun.dart';

/// Todo lo que se guardó de una marcación. Si quedó sin salida, el Admin puede ponerla.
class MarcacionDetallePage extends ConsumerStatefulWidget {
  const MarcacionDetallePage({super.key, required this.id});
  final int id;

  @override
  ConsumerState<MarcacionDetallePage> createState() => _MarcacionDetallePageState();
}

class _MarcacionDetallePageState extends ConsumerState<MarcacionDetallePage> {
  bool _guardando = false;

  Future<void> _ponerSalida(Marcacion m) async {
    final datos = await showDialog<({DateTime salida, String nota})>(
      context: context,
      builder: (_) => _DialogoSalida(marcacion: m),
    );
    if (datos == null || !mounted) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _guardando = true);
    try {
      await ref.read(repositorioProvider).cerrarMarcacion(m.id, salidaEn: datos.salida, nota: datos.nota);
      refrescarAsistencia(contenedor);
      if (!mounted) return;
      avisar(context, 'Salida registrada a las ${hora(datos.salida)}.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final marcacion = ref.watch(marcacionProvider(widget.id));
    final gestiona = ref.watch(sesionProvider).usuario?.puede('marcaciones.gestionar') ?? false;
    final m = marcacion.value;

    return Scaffold(
      appBar: AppBar(title: const Text('Marcación')),
      bottomNavigationBar: (m != null && m.abierta && gestiona)
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: FilledButton.icon(
                  onPressed: _guardando ? null : () => _ponerSalida(m),
                  icon: const Icon(Icons.schedule),
                  label: Text(_guardando ? 'Guardando…' : 'Poner la salida'),
                ),
              ),
            )
          : null,
      body: marcacion.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoError(error: e, onReintentar: () => ref.invalidate(marcacionProvider(widget.id))),
        data: (m) => _ficha(context, m, gestiona),
      ),
    );
  }

  Widget _ficha(BuildContext context, Marcacion m, bool gestiona) {
    final tema = Theme.of(context);
    final gris = tema.colorScheme.onSurfaceVariant;
    final dia = DateTime.tryParse(m.fecha) ?? m.entradaEn;
    final salidaEn = m.salidaEn;
    final salidaLatitud = m.salidaLatitud;
    final salidaLongitud = m.salidaLongitud;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        Text(m.usuarioNombre, style: tema.textTheme.headlineSmall),
        const SizedBox(height: 2),
        Text('${fechaLarga(dia)} · ${m.lugarNombre}', style: tema.textTheme.bodyMedium?.copyWith(color: gris)),
        const SizedBox(height: 10),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            if (m.abierta)
              const Etiqueta('Sin salida', tono: Tono.aviso)
            else
              const Etiqueta('Completa', tono: Tono.exito),
            if (m.salidaManual) const Etiqueta('Salida puesta por el administrador', tono: Tono.info),
          ],
        ),
        if (m.abierta && gestiona)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              'Todavía no marcó la salida. Si se olvidó, puedes ponerla tú: queda anotado que fue a mano.',
              style: tema.textTheme.bodySmall?.copyWith(color: gris),
            ),
          ),

        const TituloSeccion('Entrada'),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                FilaDato('Hora', hora(m.entradaEn)),
                FilaDato('Distancia', '${metrosTexto(m.entradaDistanciaM)} del lugar (se permite hasta ${m.radioM} m)'),
                if (m.entradaPrecisionM != null) FilaDato('Precisión GPS', '± ${m.entradaPrecisionM!.round()} m'),
                FilaDato(
                  'Dónde estaba',
                  '${m.entradaLatitud.toStringAsFixed(6)}, ${m.entradaLongitud.toStringAsFixed(6)}',
                  copiable: true,
                ),
              ],
            ),
          ),
        ),

        const TituloSeccion('Salida'),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: salidaEn == null
                ? Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Sin marcar', style: TextStyle(color: gris)),
                  )
                : Column(
                    children: [
                      FilaDato('Hora', hora(salidaEn)),
                      if (m.salidaManual)
                        const FilaDato('Cómo', 'Puesta a mano por el administrador: sin GPS ni huella')
                      else ...[
                        FilaDato('Distancia', '${metrosTexto(m.salidaDistanciaM)} del lugar'),
                        if (m.salidaPrecisionM != null) FilaDato('Precisión GPS', '± ${m.salidaPrecisionM!.round()} m'),
                        if (salidaLatitud != null && salidaLongitud != null)
                          FilaDato(
                            'Dónde estaba',
                            '${salidaLatitud.toStringAsFixed(6)}, ${salidaLongitud.toStringAsFixed(6)}',
                            copiable: true,
                          ),
                      ],
                    ],
                  ),
          ),
        ),

        const TituloSeccion('Resumen'),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                FilaDato('Tiempo', m.minutos == null ? 'En curso' : duracionTexto(m.minutos!)),
                if (m.turnoInicio != null)
                  FilaDato(
                    'Turno',
                    '${m.turnoInicio}–${m.turnoFin ?? ''}'
                        '${m.retrasoMin > 0 ? ' · ${m.retrasoMin} min tarde' : ' · entró puntual'}'
                        '${m.salidaTempranaMin > 0 ? ' · salió ${m.salidaTempranaMin} min antes' : ''}',
                  ),
                FilaDato('Lugar', '${m.lugarNombre} · radio de ${m.radioM} m'),
                if (m.nota.isNotEmpty) FilaDato('Nota', m.nota),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'La huella la verifica el teléfono del auxiliar antes de enviar cada marca. '
          'El sistema guarda la hora y la ubicación.',
          style: tema.textTheme.bodySmall?.copyWith(color: gris),
        ),
      ],
    );
  }
}

/// Pide la fecha y hora de salida y el motivo.
class _DialogoSalida extends StatefulWidget {
  const _DialogoSalida({required this.marcacion});
  final Marcacion marcacion;

  @override
  State<_DialogoSalida> createState() => _DialogoSalidaState();
}

class _DialogoSalidaState extends State<_DialogoSalida> {
  late DateTime _salida;
  final _nota = TextEditingController();
  String? _error;

  @override
  void initState() {
    super.initState();
    final entrada = widget.marcacion.entradaEn;
    final ahora = DateTime.now();
    final esHoy = entrada.year == ahora.year && entrada.month == ahora.month && entrada.day == ahora.day;
    // Si la entrada es de otro día, propone el mismo día a la hora de entrada, para corregirla.
    _salida = esHoy ? ahora : entrada;
  }

  @override
  void dispose() {
    _nota.dispose();
    super.dispose();
  }

  Future<void> _elegirFecha() async {
    final entrada = widget.marcacion.entradaEn;
    final f = await showDatePicker(
      context: context,
      initialDate: _salida,
      firstDate: DateTime(entrada.year, entrada.month, entrada.day),
      lastDate: DateTime.now(),
    );
    if (f != null) setState(() => _salida = DateTime(f.year, f.month, f.day, _salida.hour, _salida.minute));
  }

  Future<void> _elegirHora() async {
    final h = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_salida));
    if (h != null) {
      setState(() => _salida = DateTime(_salida.year, _salida.month, _salida.day, h.hour, h.minute));
    }
  }

  void _aceptar() {
    final entrada = widget.marcacion.entradaEn;
    final nota = _nota.text.trim();
    if (!_salida.isAfter(entrada)) {
      setState(() => _error = 'La salida debe ser posterior a la entrada (${hora(entrada)}).');
      return;
    }
    if (_salida.isAfter(DateTime.now())) {
      setState(() => _error = 'La salida no puede estar en el futuro.');
      return;
    }
    if (nota.isEmpty) {
      setState(() => _error = 'Escribe por qué pones la salida a mano.');
      return;
    }
    Navigator.pop(context, (salida: _salida, nota: nota));
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.marcacion;
    final esquema = Theme.of(context).colorScheme;
    return AlertDialog(
      title: const Text('Poner la salida'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${m.usuarioNombre} entró a las ${hora(m.entradaEn)}. Queda anotado que la salida se puso a mano.'),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _elegirFecha,
                    icon: const Icon(Icons.event, size: 18),
                    label: Text(fechaNumerica(fechaIso(_salida))),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: _elegirHora,
                  icon: const Icon(Icons.schedule, size: 18),
                  label: Text(hora(_salida)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nota,
              maxLength: 300,
              minLines: 2,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Motivo',
                hintText: 'Ej.: olvidó marcar; salió a las 12:30',
                border: OutlineInputBorder(),
              ),
            ),
            if (_error != null) Text(_error!, style: TextStyle(color: esquema.error)),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        FilledButton(onPressed: _aceptar, child: const Text('Guardar salida')),
      ],
    );
  }
}
