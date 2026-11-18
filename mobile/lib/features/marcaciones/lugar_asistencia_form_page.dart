import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'marcaciones_comun.dart';

const radioMinimoM = 20;
const radioMaximoM = 2000;
const radioPorDefectoM = 100;

/// Crea o edita un lugar de asistencia. [inicial] null = nuevo.
/// [primero]: es el primer lugar que se crea, así que se propone como predeterminado.
class LugarAsistenciaFormPage extends ConsumerStatefulWidget {
  const LugarAsistenciaFormPage({super.key, this.inicial, this.primero = false});
  final LugarAsistencia? inicial;
  final bool primero;

  @override
  ConsumerState<LugarAsistenciaFormPage> createState() => _LugarAsistenciaFormPageState();
}

class _LugarAsistenciaFormPageState extends ConsumerState<LugarAsistenciaFormPage> {
  final _nombre = TextEditingController();
  final _referencia = TextEditingController();
  final _coordenadas = TextEditingController();
  final _radio = TextEditingController(text: '$radioPorDefectoM');
  bool _predeterminado = false;
  bool _activo = true;
  bool _guardando = false;
  bool _ubicando = false;

  /// Precisión del GPS de la última vez que se usó "mi ubicación actual".
  double? _precision;
  final _errores = <String, String>{};

  bool get _esNuevo => widget.inicial == null;

  @override
  void initState() {
    super.initState();
    final l = widget.inicial;
    if (l != null) {
      _nombre.text = l.nombre;
      _referencia.text = l.referencia;
      _coordenadas.text = l.coordenadas;
      _radio.text = '${l.radioM}';
      _predeterminado = l.predeterminado;
      _activo = l.activo;
    } else {
      _predeterminado = widget.primero;
    }
  }

  @override
  void dispose() {
    _nombre.dispose();
    _referencia.dispose();
    _coordenadas.dispose();
    _radio.dispose();
    super.dispose();
  }

  Future<void> _usarMiUbicacion() async {
    setState(() {
      _ubicando = true;
      _errores.remove('coordenadas');
    });
    try {
      final p = await leerUbicacion();
      if (!mounted) return;
      setState(() {
        _coordenadas.text = '${p.latitude.toStringAsFixed(6)}, ${p.longitude.toStringAsFixed(6)}';
        _precision = p.accuracy;
      });
    } on FallaDispositivo catch (falla) {
      if (mounted) avisar(context, falla.mensaje, error: true);
    } catch (_) {
      if (mounted) avisar(context, 'No se pudo leer tu ubicación.', error: true);
    } finally {
      if (mounted) setState(() => _ubicando = false);
    }
  }

  Future<void> _guardar() async {
    setState(() => _errores.clear());
    final nombre = _nombre.text.trim();
    final punto = leerCoordenadas(_coordenadas.text);
    final radio = int.tryParse(_radio.text.trim()) ?? 0;
    if (nombre.isEmpty) _errores['nombre'] = 'Escribe el nombre del lugar.';
    if (punto == null) _errores['coordenadas'] = 'Ej.: -17.776200, -63.195000 (o usa tu ubicación actual).';
    if (radio < radioMinimoM || radio > radioMaximoM) _errores['radio_m'] = 'Entre $radioMinimoM y $radioMaximoM m.';
    if (_errores.isNotEmpty || punto == null) {
      setState(() {});
      return;
    }

    setState(() => _guardando = true);
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).guardarLugarAsistencia(
        {
          'nombre': nombre,
          'referencia': _referencia.text.trim(),
          'latitud': double.parse(punto.latitud.toStringAsFixed(6)),
          'longitud': double.parse(punto.longitud.toStringAsFixed(6)),
          'radio_m': radio,
          'predeterminado': _predeterminado,
          'activo': _predeterminado ? true : _activo,
        },
        id: widget.inicial?.id,
      );
      refrescarAsistencia(contenedor);
      if (!mounted) return;
      avisar(context, _esNuevo ? 'Lugar agregado.' : 'Cambios guardados.');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      final campos = erroresDeCampos(e);
      setState(() {
        _guardando = false;
        _errores.addAll(campos);
        final coordenada = campos['latitud'] ?? campos['longitud'];
        if (coordenada != null) _errores['coordenadas'] = coordenada;
      });
      avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<void> _eliminar() async {
    final lugar = widget.inicial;
    if (lugar == null) return;
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: Text('¿Eliminar «${lugar.nombre}»?'),
        content: const Text(
          'Los auxiliares que lo tenían asignado pasan al lugar predeterminado. '
          'Si ya tiene marcaciones no se puede eliminar: desactívalo.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(dialogo, true), child: const Text('Eliminar')),
        ],
      ),
    );
    if (confirmar != true || !mounted) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _guardando = true);
    try {
      await ref.read(repositorioProvider).eliminarLugarAsistencia(lugar.id);
      refrescarAsistencia(contenedor);
      if (!mounted) return;
      avisar(context, 'Lugar eliminado.');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _guardando = false);
      avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final gris = tema.colorScheme.onSurfaceVariant;
    final precision = _precision;

    return Scaffold(
      appBar: AppBar(
        title: Text(_esNuevo ? 'Nuevo lugar' : 'Editar lugar'),
        actions: [
          if (!_esNuevo)
            IconButton(
              tooltip: 'Eliminar',
              onPressed: _guardando ? null : _eliminar,
              icon: const Icon(Icons.delete_outline),
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _guardando ? null : _guardar,
            child: Text(_guardando ? 'Guardando…' : (_esNuevo ? 'Agregar lugar' : 'Guardar cambios')),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Text(
            'Los auxiliares solo pueden marcar si su teléfono los ubica dentro del radio de este punto.',
            style: tema.textTheme.bodySmall?.copyWith(color: gris),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _nombre,
            maxLength: 100,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: 'Nombre',
              hintText: 'Módulo 236 · Laboratorios FICCT',
              errorText: _errores['nombre'],
            ),
          ),
          const SizedBox(height: 4),
          TextField(
            controller: _referencia,
            maxLength: 200,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: 'Referencia (opcional)',
              hintText: 'Planta alta, al lado de la jefatura',
              errorText: _errores['referencia'],
            ),
          ),
          const SizedBox(height: 4),
          TextField(
            controller: _coordenadas,
            keyboardType: TextInputType.text,
            decoration: InputDecoration(
              labelText: 'Coordenadas (latitud, longitud)',
              hintText: '-17.776200, -63.195000',
              helperText: 'Puedes pegar las coordenadas o un enlace de Google Maps.',
              helperMaxLines: 2,
              errorText: _errores['coordenadas'],
              errorMaxLines: 2,
            ),
            onChanged: (_) {
              if (_precision != null) setState(() => _precision = null);
            },
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton.tonalIcon(
              onPressed: _ubicando ? null : _usarMiUbicacion,
              icon: _ubicando
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.my_location),
              label: Text(_ubicando ? 'Buscando tu ubicación…' : 'Usar mi ubicación actual'),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              precision == null
                  ? 'Lo más exacto: párate en el lugar (cerca de una ventana o afuera) y toca el botón.'
                  : 'Ubicación tomada con una precisión de ± ${precision.round()} m.'
                      '${precision > 30 ? ' Es poco precisa: acércate a una ventana y vuelve a tocar el botón.' : ''}',
              style: tema.textTheme.bodySmall?.copyWith(color: gris),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _radio,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)],
            decoration: InputDecoration(
              labelText: 'Radio permitido (metros)',
              helperText: 'Dentro de un edificio el GPS falla por 20 a 50 m: con menos de 80 m puede rechazar marcas válidas.',
              helperMaxLines: 3,
              errorText: _errores['radio_m'],
            ),
          ),
          const SizedBox(height: 8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Lugar predeterminado'),
            subtitle: const Text('Aquí marcan los auxiliares que no tienen un lugar propio.'),
            value: _predeterminado,
            onChanged: (v) => setState(() => _predeterminado = v),
          ),
          if (!_predeterminado)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Activo'),
              subtitle: Text(_activo ? 'Se puede marcar aquí.' : 'Nadie puede marcar aquí.'),
              value: _activo,
              onChanged: (v) => setState(() => _activo = v),
            ),
          if (_errores['activo'] != null)
            Text(_errores['activo']!, style: TextStyle(color: tema.colorScheme.error)),
        ],
      ),
    );
  }
}
