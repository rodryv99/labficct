import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/datos/proveedores.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'objetos_page.dart';

/// Registrar un objeto encontrado, con foto tomada en el momento.
class ObjetoNuevoPage extends ConsumerStatefulWidget {
  const ObjetoNuevoPage({super.key});

  @override
  ConsumerState<ObjetoNuevoPage> createState() => _ObjetoNuevoPageState();
}

class _ObjetoNuevoPageState extends ConsumerState<ObjetoNuevoPage> {
  final _form = GlobalKey<FormState>();
  final _descripcion = TextEditingController();
  final _caracteristicas = TextEditingController();
  final _lugar = TextEditingController();
  final _encontradoPor = TextEditingController();

  String _categoria = 'otro';
  int? _laboratorio;
  DateTime _fecha = DateTime.now();
  XFile? _foto;
  bool _guardando = false;
  String? _error;
  Map<String, String> _errores = {};

  @override
  void dispose() {
    _descripcion.dispose();
    _caracteristicas.dispose();
    _lugar.dispose();
    _encontradoPor.dispose();
    super.dispose();
  }

  Future<void> _tomarFoto(ImageSource origen) async {
    try {
      final foto = await ImagePicker().pickImage(source: origen, maxWidth: 1600, imageQuality: 80);
      if (foto != null && mounted) setState(() => _foto = foto);
    } catch (e) {
      if (mounted) {
        avisar(
          context,
          origen == ImageSource.camera
              ? 'No se pudo abrir la cámara. Revisa los permisos de la app.'
              : 'No se pudo abrir la galería.',
          error: true,
        );
      }
    }
  }

  Future<void> _elegirFechaHora() async {
    final ahora = DateTime.now();
    final dia = await showDatePicker(
      context: context,
      initialDate: _fecha,
      firstDate: ahora.subtract(const Duration(days: 60)),
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
    if (hora == null) return;
    var elegida = DateTime(dia.year, dia.month, dia.day, hora.hour, hora.minute);
    if (elegida.isAfter(ahora)) elegida = ahora;
    setState(() => _fecha = elegida);
  }

  Future<void> _guardar() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _errores = {};
    });
    if (!_form.currentState!.validate()) return;

    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _guardando = true);
    try {
      final objeto = await ref.read(repositorioProvider).registrarObjeto(
        {
          'descripcion': _descripcion.text.trim(),
          'categoria': _categoria,
          'caracteristicas': _caracteristicas.text.trim(),
          'laboratorio': _laboratorio,
          'lugar': _lugar.text.trim(),
          'fecha_hallazgo': _fecha.toUtc().toIso8601String(),
          'encontrado_por': _encontradoPor.text.trim(),
        },
        rutaFoto: _foto?.path,
      );
      contenedor.invalidate(objetosProvider);
      if (!mounted) return;
      avisar(context, 'Registrado como ${objeto.codigo}.');
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

    return Scaffold(
      appBar: AppBar(title: const Text('Registrar objeto')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _guardando ? null : _guardar,
            child: _guardando
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                : const Text('Registrar objeto'),
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

            // ── Foto ──
            AspectRatio(
              aspectRatio: 4 / 3,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Material(
                  color: esquema.surfaceContainerHigh,
                  child: _foto == null
                      ? InkWell(
                          onTap: () => _tomarFoto(ImageSource.camera),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.photo_camera_outlined, size: 44, color: esquema.primary),
                              const SizedBox(height: 8),
                              Text('Tomar foto', style: tema.textTheme.titleMedium),
                              Text(
                                'Ayuda a que el dueño lo reconozca',
                                style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                              ),
                            ],
                          ),
                        )
                      : Stack(
                          fit: StackFit.expand,
                          children: [
                            Image.file(File(_foto!.path), fit: BoxFit.cover),
                            Positioned(
                              top: 8,
                              right: 8,
                              child: IconButton.filledTonal(
                                tooltip: 'Quitar foto',
                                onPressed: () => setState(() => _foto = null),
                                icon: const Icon(Icons.close),
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TextButton.icon(
                  onPressed: () => _tomarFoto(ImageSource.camera),
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: Text(_foto == null ? 'Cámara' : 'Tomar otra'),
                ),
                TextButton.icon(
                  onPressed: () => _tomarFoto(ImageSource.gallery),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: const Text('Galería'),
                ),
              ],
            ),
            if (_errores['foto'] != null) Text(_errores['foto']!, style: TextStyle(color: esquema.error)),

            // ── Qué ──
            const TituloSeccion('Qué se encontró'),
            TextFormField(
              controller: _descripcion,
              textCapitalization: TextCapitalization.sentences,
              maxLength: 200,
              decoration: InputDecoration(
                labelText: 'Descripción',
                hintText: 'Ej.: Cargador de laptop HP',
                errorText: _errores['descripcion'],
              ),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Describe el objeto.' : null,
            ),
            DropdownButtonFormField<String>(
              initialValue: _categoria,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Categoría'),
              items: [
                for (final e in categoriasObjeto.entries)
                  DropdownMenuItem(
                    value: e.key,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [Icon(e.value.$2, size: 20), const SizedBox(width: 10), Text(e.value.$1)],
                    ),
                  ),
              ],
              onChanged: (v) => setState(() => _categoria = v ?? 'otro'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _caracteristicas,
              textCapitalization: TextCapitalization.sentences,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Características (opcional)',
                hintText: 'Color, marca, stickers… lo que ayude a reconocerlo',
              ),
            ),

            // ── Dónde y cuándo ──
            const TituloSeccion('Dónde y cuándo'),
            DropdownButtonFormField<int?>(
              key: ValueKey('labs-${laboratorios.length}'),
              initialValue: _laboratorio,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Laboratorio', prefixIcon: Icon(Icons.computer_outlined)),
              items: [
                const DropdownMenuItem<int?>(value: null, child: Text('Fuera de un laboratorio')),
                for (final l in laboratorios)
                  DropdownMenuItem<int?>(value: l.id, child: Text('${l.codigo} · ${l.nombre}', overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (v) => setState(() => _laboratorio = v),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _lugar,
              decoration: InputDecoration(
                labelText: _laboratorio == null ? 'Lugar' : 'Lugar exacto (opcional)',
                hintText: 'Ej.: PC-12, debajo del escritorio',
                errorText: _errores['lugar'],
              ),
              validator: (v) =>
                  _laboratorio == null && (v ?? '').trim().isEmpty ? 'Elige un laboratorio o escribe el lugar.' : null,
            ),
            const SizedBox(height: 12),
            InkWell(
              onTap: _elegirFechaHora,
              borderRadius: BorderRadius.circular(10),
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: 'Fecha y hora del hallazgo',
                  prefixIcon: const Icon(Icons.schedule),
                  errorText: _errores['fecha_hallazgo'],
                ),
                child: Text(fechaHora(_fecha)),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _encontradoPor,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Encontrado por (opcional)',
                hintText: 'Quién lo trajo, si no fuiste tú',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.lock_outline, size: 16, color: esquema.onSurfaceVariant),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Los registros no se pueden borrar: si hay un error, el administrador puede anularlo.',
                    style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
