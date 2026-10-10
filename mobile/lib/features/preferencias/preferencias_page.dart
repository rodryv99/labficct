import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';

enum _Respuesta { si, no, igual }

_Respuesta _desde(bool? valor) => switch (valor) {
      true => _Respuesta.si,
      false => _Respuesta.no,
      null => _Respuesta.igual,
    };

bool? _aValor(_Respuesta r) => switch (r) {
      _Respuesta.si => true,
      _Respuesta.no => false,
      _Respuesta.igual => null,
    };

/// Cómo prefiere el docente que los auxiliares preparen el aula para sus clases.
class PreferenciasPage extends ConsumerWidget {
  const PreferenciasPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(misPreferenciasProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Mis preferencias')),
      body: datos.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoError(error: e, onReintentar: () => ref.invalidate(misPreferenciasProvider)),
        data: (d) => _Formulario(opciones: d.opciones, mias: d.mias),
      ),
    );
  }
}

class _Formulario extends ConsumerStatefulWidget {
  const _Formulario({required this.opciones, required this.mias});
  final List<OpcionPreferencia> opciones;
  final Preferencias mias;

  @override
  ConsumerState<_Formulario> createState() => _FormularioState();
}

class _FormularioState extends ConsumerState<_Formulario> {
  late final Map<int, _Respuesta> _respuestas = {
    for (final o in widget.opciones) o.id: _desde(widget.mias.valores[o.id]),
  };
  late final _nota = TextEditingController(text: widget.mias.nota);
  bool _guardando = false;
  String? _error;

  @override
  void dispose() {
    _nota.dispose();
    super.dispose();
  }

  /// Lo que leerán los auxiliares, igual que lo arma el servidor.
  List<String> get _vistaPrevia => [
        for (final o in widget.opciones)
          if (_respuestas[o.id] == _Respuesta.si && o.textoSi.isNotEmpty)
            o.textoSi
          else if (_respuestas[o.id] == _Respuesta.no && o.textoNo.isNotEmpty)
            o.textoNo,
        if (_nota.text.trim().isNotEmpty) _nota.text.trim(),
      ];

  Future<void> _guardar() async {
    FocusScope.of(context).unfocus();
    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() {
      _guardando = true;
      _error = null;
    });
    try {
      await ref.read(repositorioProvider).guardarMisPreferencias(
        {
          // Guardar reemplaza todo: se conservan las respuestas a opciones que el admin
          // desactivó (aquí no se muestran). El servidor ya no devuelve las borradas.
          ...widget.mias.valores,
          for (final e in _respuestas.entries) e.key: _aValor(e.value),
        },
        _nota.text.trim(),
      );
      // La pizarra de los auxiliares muestra las preferencias con cada clase.
      contenedor.invalidate(agendaDiaProvider);
      if (!mounted) return;
      avisar(context, 'Preferencias guardadas.');
      context.pop();
    } catch (e) {
      if (!mounted) return;
      final campos = erroresDeCampos(e);
      setState(() => _error = campos['nota'] ?? mensajeDeError(e));
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final vista = _vistaPrevia;
    final actualizado = widget.mias.actualizadoEn;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: esquema.errorContainer, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: TextStyle(color: esquema.onErrorContainer)),
                ),
              Text(
                'Cuéntales a los auxiliares cómo prefieres encontrar el aula. '
                'Lo verán en la pizarra y en el aviso antes de cada clase.',
                style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
              ),
              if (widget.opciones.isNotEmpty) const TituloSeccion('Para tus clases'),
              for (final o in widget.opciones) ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(o.pregunta, style: tema.textTheme.titleSmall),
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          child: SegmentedButton<_Respuesta>(
                            showSelectedIcon: false,
                            segments: const [
                              ButtonSegment(value: _Respuesta.si, label: Text('Sí')),
                              ButtonSegment(value: _Respuesta.no, label: Text('No')),
                              ButtonSegment(value: _Respuesta.igual, label: Text('Me da igual')),
                            ],
                            selected: {_respuestas[o.id] ?? _Respuesta.igual},
                            onSelectionChanged: (s) => setState(() => _respuestas[o.id] = s.first),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              const TituloSeccion('Otras indicaciones'),
              TextField(
                controller: _nota,
                onChanged: (_) => setState(() {}),
                textCapitalization: TextCapitalization.sentences,
                minLines: 3,
                maxLines: 6,
                maxLength: 1000,
                decoration: const InputDecoration(
                  labelText: 'Otras indicaciones (opcional)',
                  hintText: 'Ej.: Llego 5 minutos antes.',
                  alignLabelWithHint: true,
                ),
              ),
              const TituloSeccion('Así lo verán los auxiliares'),
              Card(
                color: esquema.surfaceContainerLow,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: vista.isEmpty
                      ? Text(
                          'Todavía no marcaste nada: prepararán el aula como siempre.',
                          style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            for (final frase in vista)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 3),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('•  '),
                                    Expanded(child: Text(frase)),
                                  ],
                                ),
                              ),
                          ],
                        ),
                ),
              ),
              if (actualizado != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10, left: 4),
                  child: Text(
                    'Guardadas por última vez: ${fechaHora(actualizado)}',
                    style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                  ),
                ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _guardando ? null : _guardar,
                child: _guardando
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                    : const Text('Guardar'),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
