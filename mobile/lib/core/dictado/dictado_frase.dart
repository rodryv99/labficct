import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_to_text.dart';

import 'nucleo.dart';

/// Bloque de dictado por voz reutilizable para los formularios.
///
/// Muestra el micrófono, el cuadro de texto y el resumen de lo entendido.
/// Cada formulario le pasa su propio intérprete (`interpretar`) y recibe el
/// resultado por `onAplicar` para volcar los valores en sus campos.
///
/// Es el mismo comportamiento que el dictado de reservas, puesto en un solo
/// lugar para no repetirlo en tareas, objetos, horarios e inventario.
class DictadoFrase<R extends ResultadoBase> extends StatefulWidget {
  const DictadoFrase({
    super.key,
    required this.ejemplo,
    required this.placeholder,
    required this.sustantivo,
    required this.interpretar,
    required this.onAplicar,
  });

  /// Frase de ejemplo que se muestra debajo del título.
  final String ejemplo;

  /// Texto guía del cuadro de escritura.
  final String placeholder;

  /// Qué se está dictando, para el aviso de "No entendí datos de …".
  final String sustantivo;

  /// Convierte la frase dictada en un resultado con los campos a rellenar.
  final R Function(String frase) interpretar;

  /// Se llama con el resultado para que el formulario vuelque los valores.
  final void Function(R resultado) onAplicar;

  @override
  State<DictadoFrase<R>> createState() => _DictadoFraseState<R>();
}

class _DictadoFraseState<R extends ResultadoBase> extends State<DictadoFrase<R>> {
  final _frase = TextEditingController();
  final SpeechToText _voz = SpeechToText();
  bool _vozDisponible = false;
  bool _escuchando = false;
  String _parcial = '';
  String? _errorVoz;
  R? _entendido;

  @override
  void initState() {
    super.initState();
    _prepararVoz();
  }

  @override
  void dispose() {
    _frase.dispose();
    _voz.cancel();
    super.dispose();
  }

  Future<void> _prepararVoz() async {
    try {
      final ok = await _voz.initialize(
        onError: (SpeechRecognitionError e) {
          if (!mounted) return;
          setState(() {
            _escuchando = false;
            _errorVoz = _mensajeVoz(e.errorMsg);
          });
        },
        onStatus: (estado) {
          if (!mounted) return;
          // El guard _escuchando evita rellenar dos veces: el reconocedor emite
          // 'notListening' y 'done' al terminar.
          if ((estado == 'done' || estado == 'notListening') && _escuchando) {
            final texto = _parcial.trim();
            setState(() => _escuchando = false);
            if (texto.isNotEmpty) {
              _frase.text = texto;
              _rellenarCon(texto);
            }
          }
        },
      );
      if (mounted) setState(() => _vozDisponible = ok);
    } catch (_) {
      if (mounted) setState(() => _vozDisponible = false);
    }
  }

  String _mensajeVoz(String codigo) {
    if (codigo.contains('permission')) {
      return 'No hay permiso para usar el micrófono. Actívalo en los ajustes de la app.';
    }
    if (codigo.contains('no_match') || codigo.contains('speech_timeout')) {
      return 'No te escuché bien. Intenta de nuevo o escribe la frase.';
    }
    if (codigo.contains('network')) {
      return 'El dictado necesita internet. Mientras tanto puedes escribir la frase.';
    }
    return 'No se pudo usar el dictado. Puedes escribir la frase.';
  }

  Future<void> _empezarDictado() async {
    if (!_vozDisponible || _escuchando) return;
    setState(() {
      _errorVoz = null;
      _parcial = '';
      _escuchando = true;
    });
    try {
      await _voz.listen(
        onResult: (r) {
          if (!mounted) return;
          setState(() => _parcial = r.recognizedWords);
        },
        localeId: 'es_BO',
        listenFor: const Duration(seconds: 60),
        pauseFor: const Duration(seconds: 4),
        listenOptions: SpeechListenOptions(
          partialResults: true,
          listenMode: ListenMode.dictation,
          cancelOnError: true,
        ),
      );
    } catch (_) {
      if (mounted) {
        setState(() {
          _escuchando = false;
          _errorVoz = 'No se pudo iniciar el dictado. Intenta de nuevo.';
        });
      }
    }
  }

  Future<void> _detenerDictado() async {
    try {
      await _voz.stop();
    } catch (_) {
      // Lo gestiona onStatus.
    }
  }

  void _rellenarCon(String frase) {
    final r = widget.interpretar(frase);
    setState(() => _entendido = r);
    widget.onAplicar(r);
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: esquema.surfaceContainerHighest.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: esquema.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.mic_none, size: 18, color: esquema.primary),
              const SizedBox(width: 6),
              Text(
                'Dictado por voz',
                style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            widget.ejemplo,
            style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
          ),
          const SizedBox(height: 10),
          if (_escuchando)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: esquema.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: esquema.primary),
              ),
              child: Text(_parcial.isEmpty ? 'Te escucho…' : _parcial),
            )
          else
            TextField(
              controller: _frase,
              minLines: 2,
              maxLines: 4,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: widget.placeholder,
                border: const OutlineInputBorder(),
              ),
            ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (_vozDisponible)
                if (_escuchando)
                  FilledButton.icon(
                    onPressed: _detenerDictado,
                    icon: const Icon(Icons.stop),
                    label: const Text('Detener'),
                  )
                else
                  FilledButton.tonalIcon(
                    onPressed: _empezarDictado,
                    icon: const Icon(Icons.mic),
                    label: const Text('Dictar'),
                  ),
              OutlinedButton.icon(
                onPressed: _escuchando
                    ? null
                    : () {
                        final t = _frase.text.trim();
                        if (t.isNotEmpty) _rellenarCon(t);
                      },
                icon: const Icon(Icons.edit_note),
                label: const Text('Rellenar formulario'),
              ),
              if (_escuchando)
                Text(
                  'Escuchando… haz una pausa al terminar.',
                  style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                ),
            ],
          ),
          if (!_vozDisponible)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Este dispositivo no tiene dictado por voz. Puedes escribir la frase y pulsar «Rellenar formulario».',
                style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
              ),
            ),
          if (_errorVoz != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 16, color: esquema.error),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(_errorVoz!, style: tema.textTheme.bodySmall?.copyWith(color: esquema.error)),
                  ),
                ],
              ),
            ),
          if (_entendido != null && !_escuchando) ...[
            const SizedBox(height: 10),
            _resumen(tema, esquema, _entendido!),
          ],
        ],
      ),
    );
  }

  Widget _resumen(ThemeData tema, ColorScheme esquema, R r) {
    final hayDatos = r.entendido.isNotEmpty;
    final color = hayDatos ? const Color(0xFF0E7A3E) : const Color(0xFFB26A00);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            hayDatos
                ? 'Rellené esto. Revísalo antes de guardar:'
                : 'No entendí datos de ${widget.sustantivo} en esa frase.',
            style: tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: color),
          ),
          if (hayDatos) ...[
            const SizedBox(height: 4),
            for (final linea in r.entendido)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text('• $linea', style: tema.textTheme.bodySmall),
              ),
          ],
          if (hayDatos && r.faltantes.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Me faltó: ${r.faltantes.join(', ')}. Complétalo abajo.',
                style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
              ),
            ),
        ],
      ),
    );
  }
}
