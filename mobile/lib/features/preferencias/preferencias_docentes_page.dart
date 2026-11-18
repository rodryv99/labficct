import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
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

/// Lista de docentes con sus preferencias (Admin y auxiliares).
/// Los auxiliares solo las ven; el Admin (preferencias.gestionar) las edita.
class PreferenciasDocentesPage extends ConsumerStatefulWidget {
  const PreferenciasDocentesPage({super.key});

  @override
  ConsumerState<PreferenciasDocentesPage> createState() => _PreferenciasDocentesPageState();
}

class _PreferenciasDocentesPageState extends ConsumerState<PreferenciasDocentesPage> {
  String _buscar = '';
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lista = ref.watch(preferenciasDocentesProvider(_buscar));
    final puedeEditar = ref.watch(sesionProvider).usuario?.puede('preferencias.gestionar') ?? false;

    return Scaffold(
      appBar: AppBar(title: const Text('Preferencias de docentes')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Buscar docente',
                prefixIcon: Icon(Icons.search),
                isDense: true,
              ),
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 350), () => setState(() => _buscar = v.trim()));
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(preferenciasDocentesProvider(_buscar).future),
              child: lista.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [
                  const SizedBox(height: 80),
                  EstadoError(error: e, onReintentar: () => ref.invalidate(preferenciasDocentesProvider)),
                ]),
                data: (docentes) {
                  if (docentes.isEmpty) {
                    return ListView(children: const [
                      SizedBox(height: 80),
                      EstadoVacio(icono: Icons.rule_folder_outlined, titulo: 'Sin docentes'),
                    ]);
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: docentes.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _TarjetaDocente(preferencias: docentes[i], puedeEditar: puedeEditar),
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

class _TarjetaDocente extends ConsumerWidget {
  const _TarjetaDocente({required this.preferencias, required this.puedeEditar});
  final Preferencias preferencias;
  final bool puedeEditar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = preferencias;
    final tema = Theme.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () async {
          if (puedeEditar) {
            final cambio = await context.push<bool>('/preferencias/docente/editar', extra: p);
            if (cambio == true) ref.invalidate(preferenciasDocentesProvider);
          } else {
            _verResumen(context, p);
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(p.docenteNombre,
                        style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                  ),
                  if (puedeEditar) const Icon(Icons.edit_outlined, size: 18),
                ],
              ),
              const SizedBox(height: 6),
              if (p.resumen.isEmpty)
                Text('Sin preferencias marcadas.',
                    style: tema.textTheme.bodyMedium?.copyWith(color: tema.colorScheme.onSurfaceVariant))
              else
                for (final frase in p.resumen)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [const Text('•  '), Expanded(child: Text(frase))],
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }

  void _verResumen(BuildContext context, Preferencias p) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(p.docenteNombre, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            if (p.resumen.isEmpty)
              const Text('Sin preferencias marcadas.')
            else
              for (final frase in p.resumen)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [const Text('•  '), Expanded(child: Text(frase))],
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

/// Editor de las preferencias de un docente (solo Admin).
class PreferenciasDocenteEditorPage extends ConsumerWidget {
  const PreferenciasDocenteEditorPage({super.key, required this.preferencias});
  final Preferencias preferencias;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final opciones = ref.watch(opcionesActivasProvider);
    return Scaffold(
      appBar: AppBar(title: Text(preferencias.docenteNombre)),
      body: opciones.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoError(error: e, onReintentar: () => ref.invalidate(opcionesActivasProvider)),
        data: (lista) => _Formulario(preferencias: preferencias, opciones: lista),
      ),
    );
  }
}

class _Formulario extends ConsumerStatefulWidget {
  const _Formulario({required this.preferencias, required this.opciones});
  final Preferencias preferencias;
  final List<OpcionPreferencia> opciones;

  @override
  ConsumerState<_Formulario> createState() => _FormularioState();
}

class _FormularioState extends ConsumerState<_Formulario> {
  late final Map<int, _Respuesta> _respuestas = {
    for (final o in widget.opciones) o.id: _desde(widget.preferencias.valores[o.id]),
  };
  late final _nota = TextEditingController(text: widget.preferencias.nota);
  bool _guardando = false;
  String? _error;

  @override
  void dispose() {
    _nota.dispose();
    super.dispose();
  }

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
      await ref.read(repositorioProvider).guardarPreferenciasDocente(
        widget.preferencias.docente,
        {
          // Reemplaza todo: se conservan las respuestas a opciones desactivadas.
          ...widget.preferencias.valores,
          for (final e in _respuestas.entries) e.key: _aValor(e.value),
        },
        _nota.text.trim(),
      );
      refrescarPreferenciasDocentes(contenedor);
      contenedor.invalidate(agendaDiaProvider);
      if (!mounted) return;
      avisar(context, 'Preferencias guardadas.');
      context.pop(true);
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

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: esquema.errorContainer, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: TextStyle(color: esquema.onErrorContainer)),
                ),
              Text(
                'Marca cómo quiere este docente que se prepare el aula para sus clases.',
                style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
              ),
              if (widget.opciones.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Text('No hay preguntas de preferencias activas.',
                      style: TextStyle(color: esquema.onSurfaceVariant)),
                ),
              for (final o in widget.opciones) ...[
                const SizedBox(height: 10),
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
                  alignLabelWithHint: true,
                ),
              ),
              const TituloSeccion('Así lo verán los auxiliares'),
              Card(
                color: esquema.surfaceContainerLow,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: vista.isEmpty
                      ? Text('Sin preferencias: prepararán el aula como siempre.',
                          style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant))
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            for (final frase in vista)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 3),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [const Text('•  '), Expanded(child: Text(frase))],
                                ),
                              ),
                          ],
                        ),
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
