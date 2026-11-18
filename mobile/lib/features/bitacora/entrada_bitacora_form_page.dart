import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'bitacora_page.dart';
import 'mapa_bitacora.dart';
import 'pintar_mapa_page.dart';

/// Registrar o editar una entrada de la bitácora de un laboratorio, con mapa pintado opcional.
class EntradaBitacoraFormPage extends ConsumerWidget {
  const EntradaBitacoraFormPage({super.key, required this.laboratorioId, this.entradaId});

  final int laboratorioId;
  /// null = entrada nueva.
  final int? entradaId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (entradaId == null) return _Formulario(laboratorioId: laboratorioId);
    final entrada = ref.watch(entradaBitacoraProvider(entradaId!));
    return entrada.when(
      loading: () => Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: EstadoError(error: e, onReintentar: () => ref.invalidate(entradaBitacoraProvider(entradaId!))),
      ),
      data: (e) => _Formulario(laboratorioId: e.laboratorio, entrada: e),
    );
  }
}

class _Formulario extends ConsumerStatefulWidget {
  const _Formulario({required this.laboratorioId, this.entrada});

  final int laboratorioId;
  final EntradaBitacora? entrada;

  @override
  ConsumerState<_Formulario> createState() => _FormularioState();
}

class _FormularioState extends ConsumerState<_Formulario> {
  final _form = GlobalKey<FormState>();
  late final _titulo = TextEditingController(text: widget.entrada?.titulo ?? '');
  late final _elementos = TextEditingController(text: widget.entrada?.elementos ?? '');
  late final _descripcion = TextEditingController(text: widget.entrada?.descripcion ?? '');
  late String _tipo = widget.entrada?.tipo ?? 'revision';
  late DateTime _fecha = widget.entrada?.fecha ?? DateTime.now();

  late bool _conMapa = widget.entrada?.mapa != null;
  late List<AtributoMapa> _atributos = widget.entrada?.mapa?.atributos ?? atributosIniciales;
  late Map<(int, int), int> _marcas = widget.entrada?.mapa?.marcas ?? {};

  bool _guardando = false;
  String? _error;
  Map<String, String> _errores = {};

  bool get _esNueva => widget.entrada == null;

  @override
  void dispose() {
    _titulo.dispose();
    _elementos.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  Future<void> _elegirFechaHora() async {
    final ahora = DateTime.now();
    final dia = await showDatePicker(
      context: context,
      initialDate: _fecha,
      // Una entrada vieja (de hace más de un año) también se puede editar sin que falle el selector.
      firstDate: _fecha.isBefore(ahora.subtract(const Duration(days: 365)))
          ? _fecha
          : ahora.subtract(const Duration(days: 365)),
      lastDate: ahora,
    );
    if (dia == null || !mounted) return;
    final hora = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_fecha),
      builder: (context, hijo) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: hijo!,
      ),
    );
    if (hora == null || !mounted) return;
    var elegida = DateTime(dia.year, dia.month, dia.day, hora.hour, hora.minute);
    if (elegida.isAfter(ahora)) elegida = ahora;
    setState(() => _fecha = elegida);
  }

  Future<void> _pintar(MapaBitacora base) async {
    final r = await Navigator.of(context).push<MapaPintado>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => PintarMapaPage(mapa: base, atributos: _atributos, marcas: _marcas),
      ),
    );
    if (r != null && mounted) {
      setState(() {
        _atributos = r.atributos;
        _marcas = r.marcas;
      });
    }
  }

  Future<void> _guardar(MapaBitacora? base) async {
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _errores = {};
    });
    if (!_form.currentState!.validate()) return;
    if (_conMapa && base == null) {
      setState(() => _error = 'Espera a que cargue la grilla del laboratorio.');
      return;
    }
    final ocupadas = {for (final c in base?.celdas ?? const <CeldaMapa>[]) (c.fila, c.columna)};
    final datos = <String, dynamic>{
      if (_esNueva) 'laboratorio': widget.laboratorioId,
      'tipo': _tipo,
      'titulo': _titulo.text.trim(),
      'fecha': _fecha.toUtc().toIso8601String(),
      'elementos': _elementos.text.trim(),
      'descripcion': _descripcion.text.trim(),
      'mapa': _conMapa
          ? pintadoAJson(_atributos, {
              for (final e in _marcas.entries)
                if (ocupadas.contains(e.key)) e.key: e.value,
            })
          : null,
    };
    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _guardando = true);
    try {
      final guardada = await ref.read(repositorioProvider).guardarEntradaBitacora(widget.entrada?.id, datos);
      contenedor.invalidate(bitacoraProvider(widget.laboratorioId));
      contenedor.invalidate(entradaBitacoraProvider(guardada.id));
      if (!mounted) return;
      avisar(context, _esNueva ? 'Registrado en la bitácora.' : 'Cambios guardados.');
      if (_esNueva) {
        context.pushReplacement('/bitacora/${guardada.id}');
      } else {
        context.pop();
      }
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
    // La grilla: la copia guardada si la entrada ya tenía mapa; si no, la del laboratorio hoy.
    final copia = widget.entrada?.mapa;
    final plantilla = _conMapa && copia == null ? ref.watch(plantillaBitacoraProvider(widget.laboratorioId)) : null;
    final base = copia ?? plantilla?.value;
    final codigo = ref.watch(laboratorioProvider(widget.laboratorioId)).value?.codigo;

    return Scaffold(
      appBar: AppBar(
        title: Text(_esNueva ? 'Registrar en la bitácora' : 'Editar entrada'),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _guardando ? null : () => _guardar(base),
            child: _guardando
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                : Text(_esNueva ? 'Registrar' : 'Guardar cambios'),
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
            if (codigo != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text('Laboratorio $codigo', style: tema.textTheme.titleSmall),
              ),
            DropdownButtonFormField<String>(
              initialValue: _tipo,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Tipo'),
              items: [
                for (final t in tiposBitacora.entries) DropdownMenuItem(value: t.key, child: Text(t.value)),
              ],
              onChanged: (v) => setState(() => _tipo = v ?? 'otro'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _titulo,
              maxLength: 150,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: 'Título',
                hintText: 'Ej.: Revisión de equipos de noviembre',
                errorText: _errores['titulo'],
              ),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe qué se hizo.' : null,
            ),
            InkWell(
              onTap: _elegirFechaHora,
              borderRadius: BorderRadius.circular(10),
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: 'Fecha y hora',
                  prefixIcon: const Icon(Icons.schedule),
                  errorText: _errores['fecha'],
                ),
                child: Text(fechaHora(_fecha)),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _elementos,
              maxLength: 200,
              decoration: const InputDecoration(labelText: 'Elementos (opcional)', hintText: 'Ej.: PC-01, PC-07'),
            ),
            TextFormField(
              controller: _descripcion,
              minLines: 3,
              maxLines: 6,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Descripción (opcional)',
                hintText: 'Qué se hizo, qué se encontró, qué falta.',
              ),
            ),

            // ── Mapa estilo OrganiLab ──
            const TituloSeccion('Mapa del laboratorio'),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _conMapa,
              onChanged: (v) => setState(() => _conMapa = v),
              title: const Text('Agregar mapa pintado'),
              subtitle: const Text('Pinta cada equipo con un color: funciona, con falla…'),
            ),
            if (_conMapa) ...[
              if (base != null) ...[
                if (copia != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      'Se usa la grilla como estaba cuando se hizo este mapa.',
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                    ),
                  ),
                LeyendaMapa(mapa: base, atributos: _atributos, marcas: _marcas),
                const SizedBox(height: 10),
                MapaBitacoraVista(mapa: base, atributos: _atributos, marcas: _marcas, alto: 300),
                const SizedBox(height: 10),
                FilledButton.tonalIcon(
                  onPressed: () => _pintar(base),
                  icon: const Icon(Icons.brush_outlined),
                  label: Text(_marcas.isEmpty ? 'Pintar mapa' : 'Seguir pintando'),
                ),
              ] else if (plantilla != null && plantilla.hasError)
                Text(mensajeDeError(plantilla.error!), style: TextStyle(color: esquema.error))
              else
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(child: CircularProgressIndicator()),
                ),
            ] else if (!_esNueva && copia != null)
              Text(
                'Al guardar se quitará el mapa de esta entrada.',
                style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
              ),
          ],
        ),
      ),
    );
  }
}
