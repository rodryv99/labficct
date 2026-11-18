import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'marcaciones_comun.dart';

/// Un bloque editable dentro del formulario (día + horas, como TimeOfDay).
class _BloqueEdit {
  _BloqueEdit(this.dia, this.inicio, this.fin);
  int dia;
  TimeOfDay inicio;
  TimeOfDay fin;

  bool get valido => inicio.hour * 60 + inicio.minute < fin.hour * 60 + fin.minute;
}

TimeOfDay _aHora(String hhmmTexto) {
  final p = hhmm(hhmmTexto).split(':');
  return TimeOfDay(hour: int.tryParse(p.first) ?? 0, minute: int.tryParse(p.last) ?? 0);
}

String _deHora(TimeOfDay t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

/// Crea o edita un horario de trabajo. [inicial] null = nuevo.
class HorarioAsistenciaFormPage extends ConsumerStatefulWidget {
  const HorarioAsistenciaFormPage({super.key, this.inicial});
  final HorarioTrabajo? inicial;

  @override
  ConsumerState<HorarioAsistenciaFormPage> createState() => _HorarioAsistenciaFormPageState();
}

class _HorarioAsistenciaFormPageState extends ConsumerState<HorarioAsistenciaFormPage> {
  final _nombre = TextEditingController();
  final _descripcion = TextEditingController();
  bool _activo = true;
  bool _guardando = false;
  final _errores = <String, String>{};
  late List<_BloqueEdit> _bloques;

  bool get _esNuevo => widget.inicial == null;

  @override
  void initState() {
    super.initState();
    final h = widget.inicial;
    if (h != null) {
      _nombre.text = h.nombre;
      _descripcion.text = h.descripcion;
      _activo = h.activo;
      _bloques = [for (final b in h.bloques) _BloqueEdit(b.dia, _aHora(b.inicio), _aHora(b.fin))];
    }
    if (widget.inicial == null || _bloques.isEmpty) {
      _bloques = [_BloqueEdit(0, const TimeOfDay(hour: 8, minute: 0), const TimeOfDay(hour: 12, minute: 0))];
    }
  }

  @override
  void dispose() {
    _nombre.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  Future<void> _elegirHora(_BloqueEdit b, bool inicio) async {
    final elegido = await showTimePicker(
      context: context,
      initialTime: inicio ? b.inicio : b.fin,
      helpText: inicio ? 'Hora de inicio' : 'Hora de fin',
    );
    if (elegido == null) return;
    setState(() {
      if (inicio) {
        b.inicio = elegido;
      } else {
        b.fin = elegido;
      }
    });
  }

  Future<void> _guardar() async {
    setState(() => _errores.clear());
    final nombre = _nombre.text.trim();
    if (nombre.isEmpty) _errores['nombre'] = 'Escribe el nombre del horario.';
    if (_bloques.any((b) => !b.valido)) {
      _errores['bloques'] = 'En cada bloque, la hora de fin debe ser posterior a la de inicio.';
    }
    if (_errores.isNotEmpty) {
      setState(() {});
      return;
    }

    setState(() => _guardando = true);
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).guardarHorarioAsistencia(
        {
          'nombre': nombre,
          'descripcion': _descripcion.text.trim(),
          'activo': _activo,
          'bloques': [
            for (final b in _bloques) {'dia': b.dia, 'inicio': _deHora(b.inicio), 'fin': _deHora(b.fin)},
          ],
        },
        id: widget.inicial?.id,
      );
      refrescarAsistencia(contenedor);
      if (!mounted) return;
      avisar(context, _esNuevo ? 'Horario agregado.' : 'Cambios guardados.');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        _errores.addAll(erroresDeCampos(e));
      });
      avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<void> _eliminar() async {
    final horario = widget.inicial;
    if (horario == null) return;
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: Text('¿Eliminar «${horario.nombre}»?'),
        content: const Text(
          'Los auxiliares que lo tenían asignado quedan sin horario. Esto no borra sus marcaciones.',
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
      await ref.read(repositorioProvider).eliminarHorarioAsistencia(horario.id);
      refrescarAsistencia(contenedor);
      if (!mounted) return;
      avisar(context, 'Horario eliminado.');
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

    return Scaffold(
      appBar: AppBar(
        title: Text(_esNuevo ? 'Nuevo horario' : 'Editar horario'),
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
            child: Text(_guardando ? 'Guardando…' : (_esNuevo ? 'Agregar horario' : 'Guardar cambios')),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Text(
            'Dale un nombre y agrega los bloques por día. Luego lo asignas a cada auxiliar desde «Hoy».',
            style: tema.textTheme.bodySmall?.copyWith(color: gris),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _nombre,
            maxLength: 100,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: 'Nombre',
              hintText: 'Mañana · Lun a Vie',
              errorText: _errores['nombre'],
            ),
          ),
          const SizedBox(height: 4),
          TextField(
            controller: _descripcion,
            maxLength: 200,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Descripción (opcional)',
              hintText: 'Turno de la mañana en el módulo 236',
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text('Bloques', style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              ),
              TextButton.icon(
                onPressed: () => setState(() => _bloques.add(
                      _BloqueEdit(0, const TimeOfDay(hour: 8, minute: 0), const TimeOfDay(hour: 12, minute: 0)),
                    )),
                icon: const Icon(Icons.add),
                label: const Text('Agregar'),
              ),
            ],
          ),
          for (int i = 0; i < _bloques.length; i++) _filaBloque(i, gris),
          if (_errores['bloques'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(_errores['bloques']!, style: TextStyle(color: tema.colorScheme.error)),
            ),
          const SizedBox(height: 8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Activo'),
            subtitle: Text(_activo ? 'Se puede asignar a auxiliares.' : 'No se puede asignar.'),
            value: _activo,
            onChanged: (v) => setState(() => _activo = v),
          ),
        ],
      ),
    );
  }

  Widget _filaBloque(int i, Color gris) {
    final b = _bloques[i];
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: DropdownButtonFormField<int>(
              initialValue: b.dia,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Día', isDense: true),
              items: [
                for (int d = 0; d < diasAsistencia.length; d++)
                  DropdownMenuItem(value: d, child: Text(diasAsistencia[d])),
              ],
              onChanged: (v) => setState(() => b.dia = v ?? b.dia),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: _BotonHora(etiqueta: 'Inicio', hora: b.inicio, onTap: () => _elegirHora(b, true)),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: _BotonHora(etiqueta: 'Fin', hora: b.fin, onTap: () => _elegirHora(b, false)),
          ),
          IconButton(
            tooltip: 'Quitar',
            onPressed: _bloques.length == 1 ? null : () => setState(() => _bloques.removeAt(i)),
            icon: const Icon(Icons.close),
          ),
        ],
      ),
    );
  }
}

/// Botón que muestra una hora y abre el selector al tocarlo.
class _BotonHora extends StatelessWidget {
  const _BotonHora({required this.etiqueta, required this.hora, required this.onTap});
  final String etiqueta;
  final TimeOfDay hora;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(labelText: etiqueta, isDense: true),
      child: InkWell(
        onTap: onTap,
        child: Text(_deHora(hora)),
      ),
    );
  }
}
