import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/datos/proveedores.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'asistencia_page.dart';

/// Pedir ayuda a los auxiliares: dónde, qué pasa y si es urgente.
class SolicitudNuevaPage extends ConsumerStatefulWidget {
  const SolicitudNuevaPage({super.key});

  @override
  ConsumerState<SolicitudNuevaPage> createState() => _SolicitudNuevaPageState();
}

class _SolicitudNuevaPageState extends ConsumerState<SolicitudNuevaPage> {
  /// Valor del menú para "Otro lugar" (fuera de un laboratorio).
  static const _otroLugar = -1;

  final _form = GlobalKey<FormState>();
  final _lugar = TextEditingController();
  final _descripcion = TextEditingController();

  int? _laboratorio;
  String? _categoria;
  bool _urgente = false;
  bool _intentado = false;
  bool _guardando = false;
  String? _error;
  Map<String, String> _errores = {};

  bool get _fueraDeLaboratorio => _laboratorio == _otroLugar;

  @override
  void dispose() {
    _lugar.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _intentado = true;
      _error = null;
      _errores = {};
    });
    final formularioOk = _form.currentState!.validate();
    if (!formularioOk || _categoria == null) {
      setState(() => _error = 'Revisa los datos marcados.');
      return;
    }

    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _guardando = true);
    try {
      await ref.read(repositorioProvider).crearSolicitud({
        'laboratorio': _fueraDeLaboratorio ? null : _laboratorio,
        'lugar': _lugar.text.trim(),
        'categoria': _categoria,
        'descripcion': _descripcion.text.trim(),
        'urgente': _urgente,
      });
      refrescarSolicitudes(contenedor);
      if (!mounted) return;
      avisar(context, 'Solicitud enviada. Te avisaremos cuando un auxiliar la tome.');
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errores = erroresDeCampos(e);
        _error = mensajeDeError(e);
      });
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final laboratorios = ref.watch(laboratoriosProvider).value?.where((l) => l.activo).toList() ?? const [];
    final errorCategoria =
        _errores['categoria'] ?? (_intentado && _categoria == null ? 'Elige qué tipo de problema es.' : null);

    return Scaffold(
      appBar: AppBar(title: const Text('Pedir asistencia')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton.icon(
            onPressed: _guardando ? null : _enviar,
            icon: _guardando
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                : const Icon(Icons.send),
            label: const Text('Enviar solicitud'),
          ),
        ),
      ),
      body: Form(
        key: _form,
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
              'Un auxiliar recibirá tu pedido al instante y te avisaremos cuando vaya en camino.',
              style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
            ),

            // ── Dónde ──
            const TituloSeccion('¿Dónde estás?'),
            DropdownButtonFormField<int>(
              // La key vuelve a armar el menú cuando llega la lista de laboratorios.
              key: ValueKey('labs-${laboratorios.length}'),
              initialValue: _laboratorio,
              isExpanded: true,
              hint: const Text('Elige el laboratorio'),
              decoration: InputDecoration(
                labelText: 'Laboratorio',
                prefixIcon: const Icon(Icons.computer_outlined),
                errorText: _errores['laboratorio'],
              ),
              items: [
                for (final l in laboratorios)
                  DropdownMenuItem(
                    value: l.id,
                    child: Text('${l.codigo} · ${l.nombre}', overflow: TextOverflow.ellipsis),
                  ),
                const DropdownMenuItem(value: _otroLugar, child: Text('Otro lugar')),
              ],
              onChanged: (v) => setState(() => _laboratorio = v),
              validator: (v) => v == null ? 'Elige el laboratorio o "Otro lugar".' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _lugar,
              maxLength: 150,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: _fueraDeLaboratorio ? 'Lugar' : 'Lugar exacto (opcional)',
                hintText: _fueraDeLaboratorio ? 'Ej.: Aula 236, módulo nuevo' : 'Ej.: PC-12, al fondo',
                errorText: _errores['lugar'],
              ),
              validator: (v) => _fueraDeLaboratorio && (v ?? '').trim().isEmpty ? 'Escribe dónde estás.' : null,
            ),

            // ── Qué pasa ──
            const TituloSeccion('¿Qué pasa?'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final c in categoriasAsistencia.entries)
                  ChoiceChip(
                    avatar: Icon(c.value.$2, size: 18),
                    label: Text(c.value.$1),
                    selected: _categoria == c.key,
                    onSelected: (_) => setState(() => _categoria = c.key),
                  ),
              ],
            ),
            if (errorCategoria != null)
              Padding(
                padding: const EdgeInsets.only(top: 8, left: 4),
                child: Text(errorCategoria, style: tema.textTheme.bodySmall?.copyWith(color: esquema.error)),
              ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _descripcion,
              textCapitalization: TextCapitalization.sentences,
              minLines: 3,
              maxLines: 6,
              maxLength: 1000,
              decoration: InputDecoration(
                labelText: 'Cuéntanos qué necesitas',
                hintText: 'Ej.: El proyector no muestra imagen.',
                alignLabelWithHint: true,
                errorText: _errores['descripcion'],
              ),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Cuenta brevemente qué necesitas.' : null,
            ),
            const SizedBox(height: 4),
            Card(
              child: SwitchListTile(
                value: _urgente,
                onChanged: (v) => setState(() => _urgente = v),
                secondary: Icon(Icons.priority_high, color: _urgente ? esquema.error : null),
                title: const Text('Es urgente'),
                subtitle: const Text('Por ejemplo, la clase no puede empezar sin esto.'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
