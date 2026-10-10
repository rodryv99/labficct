import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/seleccion.dart';

String _hhmm(TimeOfDay t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
int _minutos(TimeOfDay t) => t.hour * 60 + t.minute;

/// Un día con su horario y laboratorio. [choques] es null mientras no se revisó.
/// Si [requiereAprobacion], los choques no impiden guardar: la reserva queda por aprobar.
class _Bloque {
  _Bloque({this.laboratorio, required this.fecha, required this.inicio, required this.fin}) : clave = _siguiente++;

  static int _siguiente = 0;

  /// Identidad estable para que Flutter no confunda los campos al quitar un día.
  final int clave;
  int? laboratorio;
  DateTime fecha;
  TimeOfDay inicio;
  TimeOfDay fin;
  List<String>? choques;
  bool requiereAprobacion = false;
  bool revisando = false;
  int version = 0;

  bool get horasValidas => _minutos(fin) > _minutos(inicio);

  _Bloque copiaAlDiaSiguiente() => _Bloque(
        laboratorio: laboratorio,
        fecha: fecha.add(const Duration(days: 1)),
        inicio: inicio,
        fin: fin,
      );

  Map<String, dynamic> aJson() => {
        'laboratorio': laboratorio,
        'fecha': fechaIso(fecha),
        'hora_inicio': _hhmm(inicio),
        'hora_fin': _hhmm(fin),
      };
}

/// 5. Nueva reserva: evento único o de pocos días, con programas y apoyo de auxiliares.
class ReservaNuevaPage extends ConsumerStatefulWidget {
  const ReservaNuevaPage({super.key});

  @override
  ConsumerState<ReservaNuevaPage> createState() => _ReservaNuevaPageState();
}

class _ReservaNuevaPageState extends ConsumerState<ReservaNuevaPage> {
  final _form = GlobalKey<FormState>();
  final _titulo = TextEditingController();
  final _descripcion = TextEditingController();
  final _externo = TextEditingController();
  final _contacto = TextEditingController();

  bool _esExterno = false;
  UsuarioOpcion? _solicitante;
  final List<_Bloque> _bloques = [
    _Bloque(
      fecha: DateTime.now(),
      inicio: const TimeOfDay(hour: 8, minute: 0),
      fin: const TimeOfDay(hour: 10, minute: 0),
    ),
  ];
  final Set<int> _programas = {};
  bool _requiereApoyo = false;
  int _auxiliaresRequeridos = 1;
  final Set<int> _auxiliares = {};

  bool _guardando = false;
  String? _errorGeneral;
  Map<String, String> _errores = {};

  @override
  void dispose() {
    _titulo.dispose();
    _descripcion.dispose();
    _externo.dispose();
    _contacto.dispose();
    super.dispose();
  }

  // ── Disponibilidad en vivo ──
  Future<void> _revisar(_Bloque b) async {
    b.choques = null;
    b.requiereAprobacion = false;
    if (b.laboratorio == null || !b.horasValidas) {
      setState(() {});
      return;
    }
    final version = ++b.version;
    setState(() => b.revisando = true);
    try {
      final r = await ref.read(repositorioProvider).disponibilidad(
            laboratorio: b.laboratorio!,
            fecha: fechaIso(b.fecha),
            horaInicio: _hhmm(b.inicio),
            horaFin: _hhmm(b.fin),
          );
      if (!mounted || version != b.version) return;
      setState(() {
        b.choques = r.choques;
        b.requiereAprobacion = r.requiereAprobacion;
      });
    } catch (_) {
      // Si no se pudo revisar, el servidor lo validará igual al guardar.
    } finally {
      if (mounted && version == b.version) setState(() => b.revisando = false);
    }
  }

  Future<void> _elegirFecha(_Bloque b) async {
    final hoy = DateTime.now();
    final primero = DateTime(hoy.year, hoy.month, hoy.day);
    final ultimo = DateTime(hoy.year + 1, hoy.month, hoy.day);
    final f = await showDatePicker(
      context: context,
      initialDate: b.fecha.isBefore(primero) ? primero : (b.fecha.isAfter(ultimo) ? ultimo : b.fecha),
      firstDate: primero,
      lastDate: ultimo,
    );
    if (f == null) return;
    b.fecha = f;
    _revisar(b);
  }

  Future<void> _elegirHora(_Bloque b, {required bool inicio}) async {
    final t = await showTimePicker(
      context: context,
      initialTime: inicio ? b.inicio : b.fin,
      builder: (context, hijo) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: hijo!,
      ),
    );
    if (t == null) return;
    if (inicio) {
      final duracion = _minutos(b.fin) - _minutos(b.inicio);
      b.inicio = t;
      // Mantiene la duración al mover la hora de inicio.
      final finMinutos = _minutos(t) + (duracion > 0 ? duracion : 90);
      if (finMinutos < 24 * 60) b.fin = TimeOfDay(hour: finMinutos ~/ 60, minute: finMinutos % 60);
    } else {
      b.fin = t;
    }
    _revisar(b);
  }

  // ── Selectores ──
  Future<void> _elegirSolicitante() async {
    final repo = ref.read(repositorioProvider);
    final personas = repo.opcionesUsuarios('docente,administrativo,auxiliar,admin');
    final elegido = await seleccionar(
      context,
      titulo: 'Solicitante',
      multiple: false,
      seleccion: {if (_solicitante != null) _solicitante!.id},
      opciones: personas.then((l) => [for (final p in l) OpcionSeleccion(p.id, p.nombreCompleto, p.email)]),
    );
    if (elegido == null || elegido.isEmpty) return;
    final lista = await personas;
    setState(() => _solicitante = lista.firstWhere((p) => p.id == elegido.first));
  }

  Future<void> _elegirProgramas() async {
    final elegidos = await seleccionar(
      context,
      titulo: 'Programas que se necesitan',
      seleccion: _programas,
      opciones: ref.read(softwareProvider.future).then(
            (l) => [for (final s in l) OpcionSeleccion(s.id, s.nombreCompleto)],
          ),
    );
    if (elegidos != null) {
      setState(() => _programas
        ..clear()
        ..addAll(elegidos));
    }
  }

  Future<void> _elegirAuxiliares() async {
    final elegidos = await seleccionar(
      context,
      titulo: 'Auxiliares asignados',
      seleccion: _auxiliares,
      opciones: ref.read(personasProvider('auxiliar').future).then(
            (l) => [for (final p in l) OpcionSeleccion(p.id, p.nombreCompleto, p.email)],
          ),
    );
    if (elegidos != null) {
      setState(() => _auxiliares
        ..clear()
        ..addAll(elegidos));
    }
  }

  // ── Guardar ──
  Future<void> _guardar() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _errorGeneral = null;
      _errores = {};
    });
    final formularioOk = _form.currentState!.validate();
    final bloquesOk = _bloques.every((b) => b.laboratorio != null && b.horasValidas);
    if (!_esExterno && _solicitante == null) {
      setState(() => _errores = {'solicitante': 'Elige quién solicita la reserva.'});
    }
    if (!formularioOk || !bloquesOk || (!_esExterno && _solicitante == null)) {
      setState(() => _errorGeneral = 'Revisa los datos marcados.');
      return;
    }
    // Un choque con una clase u otra reserva no impide guardar (queda por aprobar);
    // estar fuera del horario de atención sí.
    if (_bloques.any((b) => (b.choques ?? const []).isNotEmpty && !b.requiereAprobacion)) {
      setState(() => _errorGeneral = 'Hay días fuera del horario de atención. Cambia el horario.');
      return;
    }

    final datos = {
      'titulo': _titulo.text.trim(),
      'descripcion': _descripcion.text.trim(),
      'solicitante': _esExterno ? null : _solicitante?.id,
      'solicitante_externo': _esExterno ? _externo.text.trim() : '',
      'contacto': _contacto.text.trim(),
      'programas': _programas.toList(),
      'requiere_apoyo': _requiereApoyo,
      'auxiliares_requeridos': _requiereApoyo ? _auxiliaresRequeridos : 0,
      'auxiliares': _requiereApoyo ? _auxiliares.toList() : <int>[],
      'bloques': [for (final b in _bloques) b.aJson()],
    };

    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _guardando = true);
    try {
      final reserva = await ref.read(repositorioProvider).crearReserva(datos);
      refrescarAgenda(contenedor);
      if (!mounted) return;
      if (reserva.advertencias.isNotEmpty) {
        await showDialog<void>(
          context: context,
          builder: (dialogo) => AlertDialog(
            icon: const Icon(Icons.warning_amber_rounded),
            title: const Text('Reserva guardada, con avisos'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [for (final a in reserva.advertencias) Text('• $a')],
            ),
            actions: [FilledButton(onPressed: () => Navigator.pop(dialogo), child: const Text('Entendido'))],
          ),
        );
        if (!mounted) return;
      }
      if (reserva.estado == 'pendiente') {
        await showDialog<void>(
          context: context,
          builder: (dialogo) => AlertDialog(
            icon: const Icon(Icons.hourglass_top_rounded),
            title: const Text('Reserva por aprobar'),
            content: const Text(
              'Choca con otra actividad, así que quedó por aprobar. Un administrador debe aprobarla; '
              'si la aprueba, la reserva tendrá prioridad.',
            ),
            actions: [FilledButton(onPressed: () => Navigator.pop(dialogo), child: const Text('Entendido'))],
          ),
        );
        if (!mounted) return;
      } else {
        avisar(context, 'Reserva registrada.');
      }
      context.pop();
    } catch (e) {
      if (!mounted) return;
      final choques = choquesDeError(e);
      setState(() {
        _errores = erroresDeCampos(e);
        _errorGeneral = choques.isEmpty ? mensajeDeError(e) : '${mensajeDeError(e)}\n• ${choques.join('\n• ')}';
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
    final software = ref.watch(softwareProvider).value ?? const <Software>[];
    final nombresProgramas = [for (final s in software) if (_programas.contains(s.id)) s.nombreCompleto];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nueva reserva'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton(
              onPressed: _guardando ? null : _guardar,
              style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
              child: _guardando
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Guardar'),
            ),
          ),
        ],
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            if (_errorGeneral != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: esquema.errorContainer, borderRadius: BorderRadius.circular(10)),
                child: Text(_errorGeneral!, style: TextStyle(color: esquema.onErrorContainer)),
              ),

            // ── Qué ──
            TextFormField(
              controller: _titulo,
              textCapitalization: TextCapitalization.sentences,
              maxLength: 150,
              decoration: InputDecoration(
                labelText: 'Título del evento',
                hintText: 'Ej.: Taller de Docker, examen de ingreso',
                errorText: _errores['titulo'],
              ),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe un título.' : null,
            ),
            TextFormField(
              controller: _descripcion,
              textCapitalization: TextCapitalization.sentences,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'Descripción (opcional)'),
            ),

            // ── Quién ──
            const TituloSeccion('Solicitante'),
            SegmentedButton<bool>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: false, label: Text('Usuario del sistema')),
                ButtonSegment(value: true, label: Text('Persona externa')),
              ],
              selected: {_esExterno},
              onSelectionChanged: (s) => setState(() => _esExterno = s.first),
            ),
            const SizedBox(height: 12),
            if (!_esExterno)
              _CampoSelector(
                icono: Icons.person_search_outlined,
                etiqueta: 'Solicitante',
                valor: _solicitante?.nombreCompleto,
                marcador: 'Elegir docente, administrativo o auxiliar',
                error: _errores['solicitante'],
                onTap: _elegirSolicitante,
              )
            else
              TextFormField(
                controller: _externo,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(
                  labelText: 'Nombre de quien solicita',
                  errorText: _errores['solicitante_externo'],
                ),
                validator: (v) => _esExterno && (v ?? '').trim().isEmpty ? 'Escribe el nombre.' : null,
              ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _contacto,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Contacto (opcional)', hintText: 'Teléfono o correo'),
            ),

            // ── Cuándo y dónde ──
            TituloSeccion(_bloques.length == 1 ? 'Día, horario y laboratorio' : 'Días (${_bloques.length})'),
            for (var i = 0; i < _bloques.length; i++) ...[
              _TarjetaBloque(
                key: ObjectKey(_bloques[i]),
                numero: i + 1,
                bloque: _bloques[i],
                laboratorios: laboratorios,
                error: _errores.entries
                    .where((e) => e.key.startsWith('bloques.$i'))
                    .map((e) => e.value)
                    .firstOrNull,
                onLaboratorio: (id) {
                  _bloques[i].laboratorio = id;
                  _revisar(_bloques[i]);
                },
                onFecha: () => _elegirFecha(_bloques[i]),
                onInicio: () => _elegirHora(_bloques[i], inicio: true),
                onFin: () => _elegirHora(_bloques[i], inicio: false),
                onQuitar: _bloques.length == 1 ? null : () => setState(() => _bloques.removeAt(i)),
              ),
              const SizedBox(height: 10),
            ],
            if (_errores['bloques'] != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(_errores['bloques']!, style: TextStyle(color: esquema.error)),
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _bloques.length >= 30
                    ? null
                    : () {
                        final nuevo = _bloques.last.copiaAlDiaSiguiente();
                        setState(() => _bloques.add(nuevo));
                        _revisar(nuevo);
                      },
                icon: const Icon(Icons.add),
                label: const Text('Agregar otro día'),
              ),
            ),

            // ── Qué se necesita ──
            const TituloSeccion('Programas'),
            _CampoSelector(
              icono: Icons.apps_outlined,
              etiqueta: 'Programas que se necesitan',
              valor: nombresProgramas.isEmpty ? null : nombresProgramas.join(', '),
              marcador: 'Ninguno en especial',
              onTap: _elegirProgramas,
            ),
            const SizedBox(height: 4),
            Text(
              'Si un programa no está instalado en el laboratorio elegido, te avisaremos al guardar.',
              style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
            ),

            const TituloSeccion('Apoyo'),
            Card(
              child: Column(
                children: [
                  SwitchListTile(
                    value: _requiereApoyo,
                    onChanged: (v) => setState(() => _requiereApoyo = v),
                    title: const Text('Necesita apoyo de auxiliares'),
                    subtitle: const Text('Para instalar, encender equipos o acompañar el evento.'),
                  ),
                  if (_requiereApoyo) ...[
                    const Divider(height: 1),
                    ListTile(
                      title: const Text('¿Cuántos auxiliares?'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            tooltip: 'Menos',
                            onPressed: _auxiliaresRequeridos > 1 ? () => setState(() => _auxiliaresRequeridos--) : null,
                            icon: const Icon(Icons.remove_circle_outline),
                          ),
                          Text('$_auxiliaresRequeridos', style: tema.textTheme.titleMedium),
                          IconButton(
                            tooltip: 'Más',
                            onPressed: _auxiliaresRequeridos < 10 ? () => setState(() => _auxiliaresRequeridos++) : null,
                            icon: const Icon(Icons.add_circle_outline),
                          ),
                        ],
                      ),
                    ),
                    ListTile(
                      title: const Text('Asignar auxiliares'),
                      subtitle: Text(
                        _auxiliares.isEmpty ? 'Opcional: se pueden asignar después' : '${_auxiliares.length} elegidos',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: _elegirAuxiliares,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CampoSelector extends StatelessWidget {
  const _CampoSelector({
    required this.icono,
    required this.etiqueta,
    required this.valor,
    required this.marcador,
    required this.onTap,
    this.error,
  });

  final IconData icono;
  final String etiqueta;
  final String? valor;
  final String marcador;
  final VoidCallback onTap;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: etiqueta,
          prefixIcon: Icon(icono),
          suffixIcon: const Icon(Icons.arrow_drop_down),
          errorText: error,
        ),
        isEmpty: valor == null,
        child: Text(
          valor ?? marcador,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: valor == null ? TextStyle(color: esquema.onSurfaceVariant) : null,
        ),
      ),
    );
  }
}

class _TarjetaBloque extends StatelessWidget {
  const _TarjetaBloque({
    super.key,
    required this.numero,
    required this.bloque,
    required this.laboratorios,
    required this.onLaboratorio,
    required this.onFecha,
    required this.onInicio,
    required this.onFin,
    required this.onQuitar,
    this.error,
  });

  final int numero;
  final _Bloque bloque;
  final List<Laboratorio> laboratorios;
  final ValueChanged<int?> onLaboratorio;
  final VoidCallback onFecha;
  final VoidCallback onInicio;
  final VoidCallback onFin;
  final VoidCallback? onQuitar;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final b = bloque;
    final dia = DateFormat("EEE d 'de' MMM", 'es').format(b.fecha);

    Widget estado;
    if (!b.horasValidas) {
      estado = _Linea(Icons.error_outline, 'La hora de fin debe ser posterior a la de inicio.', esquema.error);
    } else if (b.laboratorio == null) {
      estado = _Linea(Icons.info_outline, 'Elige un laboratorio para revisar si está libre.', esquema.onSurfaceVariant);
    } else if (b.revisando) {
      estado = _Linea(Icons.hourglass_empty, 'Revisando disponibilidad…', esquema.onSurfaceVariant);
    } else if (b.choques == null) {
      estado = const SizedBox.shrink();
    } else if (b.choques!.isEmpty) {
      estado = const _Linea(Icons.check_circle_outline, 'Libre en ese horario.', Color(0xFF0E7A3E));
    } else if (b.requiereAprobacion) {
      const ambar = Color(0xFFB26A00);
      estado = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Linea(Icons.warning_amber_rounded, 'Choca con:', ambar),
          for (final c in b.choques!)
            Padding(
              padding: const EdgeInsets.only(left: 26, top: 2),
              child: Text(c, style: tema.textTheme.bodySmall?.copyWith(color: ambar)),
            ),
          Padding(
            padding: const EdgeInsets.only(left: 26, top: 4),
            child: Text(
              'Puedes guardarla igual: quedará por aprobar. Si se aprueba, la reserva tiene prioridad.',
              style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
            ),
          ),
        ],
      );
    } else {
      estado = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Linea(Icons.block, 'No disponible:', esquema.error),
          for (final c in b.choques!)
            Padding(
              padding: const EdgeInsets.only(left: 26, top: 2),
              child: Text(c, style: tema.textTheme.bodySmall?.copyWith(color: esquema.error)),
            ),
        ],
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 6, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Día $numero', style: tema.textTheme.labelLarge?.copyWith(color: esquema.primary)),
                const Spacer(),
                if (onQuitar != null)
                  IconButton(tooltip: 'Quitar este día', onPressed: onQuitar, icon: const Icon(Icons.close, size: 20)),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: DropdownButtonFormField<int>(
                // La key fuerza a reconstruir el campo si cambia la lista de laboratorios.
                key: ValueKey('lab-${b.clave}-${laboratorios.length}'),
                initialValue: laboratorios.any((l) => l.id == b.laboratorio) ? b.laboratorio : null,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Laboratorio', prefixIcon: Icon(Icons.computer_outlined)),
                items: [
                  for (final l in laboratorios)
                    DropdownMenuItem(
                      value: l.id,
                      child: Text(
                        l.estado == 'operativo' ? '${l.codigo} · ${l.nombre}' : '${l.codigo} · ${l.estadoNombre}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: onLaboratorio,
                validator: (v) => v == null ? 'Elige un laboratorio.' : null,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  flex: 5,
                  child: OutlinedButton.icon(
                    onPressed: onFecha,
                    icon: const Icon(Icons.event_outlined, size: 18),
                    label: Text(dia[0].toUpperCase() + dia.substring(1), overflow: TextOverflow.ellipsis),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(flex: 3, child: OutlinedButton(onPressed: onInicio, child: Text(_hhmm(b.inicio)))),
                const Padding(padding: EdgeInsets.symmetric(horizontal: 4), child: Text('–')),
                Expanded(flex: 3, child: OutlinedButton(onPressed: onFin, child: Text(_hhmm(b.fin)))),
                const SizedBox(width: 8),
              ],
            ),
            const SizedBox(height: 8),
            estado,
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(error!, style: TextStyle(color: esquema.error)),
              ),
          ],
        ),
      ),
    );
  }
}

class _Linea extends StatelessWidget {
  const _Linea(this.icono, this.texto, this.color);
  final IconData icono;
  final String texto;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icono, size: 18, color: color),
        const SizedBox(width: 8),
        Expanded(child: Text(texto, style: TextStyle(color: color, fontSize: 13))),
      ],
    );
  }
}
