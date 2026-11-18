import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../core/dictado/dictado_frase.dart';
import '../../core/dictado/nucleo.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/seleccion.dart';
import 'dictado_horario.dart';
import 'planificacion_comun.dart';

/// Crea una clase nueva o edita una existente (una fila = la misma clase en
/// varios días). [grupo] null = nueva.
class HorarioFormPage extends ConsumerStatefulWidget {
  const HorarioFormPage({super.key, this.grupo, this.periodoInicial});
  final GrupoHorario? grupo;
  final int? periodoInicial;

  @override
  ConsumerState<HorarioFormPage> createState() => _HorarioFormPageState();
}

class _HorarioFormPageState extends ConsumerState<HorarioFormPage> {
  int? _periodo;
  int? _laboratorio;
  int? _materia;
  int? _docente;
  final _grupoCtrl = TextEditingController();
  final _observaciones = TextEditingController();
  final Set<int> _dias = {};
  TimeOfDay? _inicio;
  TimeOfDay? _fin;
  bool _activo = true;
  bool _guardando = false;
  final _errores = <String, String>{};

  bool get _esNuevo => widget.grupo == null;

  @override
  void initState() {
    super.initState();
    final g = widget.grupo;
    if (g != null) {
      final b = g.base;
      _periodo = b.periodo;
      _laboratorio = b.laboratorio;
      _materia = b.materia;
      _docente = b.docente;
      _grupoCtrl.text = b.grupo;
      _observaciones.text = b.observaciones;
      _dias.addAll(g.dias);
      _inicio = _aHora(b.horaInicio);
      _fin = _aHora(b.horaFin);
      _activo = b.activo;
    } else {
      _periodo = widget.periodoInicial;
    }
  }

  @override
  void dispose() {
    _grupoCtrl.dispose();
    _observaciones.dispose();
    super.dispose();
  }

  TimeOfDay? _aHora(String texto) {
    final partes = horaCorta(texto).split(':');
    if (partes.length < 2) return null;
    final h = int.tryParse(partes[0]);
    final m = int.tryParse(partes[1]);
    return (h == null || m == null) ? null : TimeOfDay(hour: h, minute: m);
  }

  String _hhmm(TimeOfDay t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  TimeOfDay? _horaDesdeTexto(String hhmm) {
    final p = hhmm.split(':');
    if (p.length < 2) return null;
    final h = int.tryParse(p[0]);
    final m = int.tryParse(p[1]);
    return (h == null || m == null) ? null : TimeOfDay(hour: h, minute: m);
  }

  void _aplicarDictado(ResultadoHorario r) {
    setState(() {
      if (r.materia != null) _materia = r.materia;
      if (r.docente != null) _docente = r.docente;
      if (r.periodo != null) _periodo = r.periodo;
      if (r.laboratorio != null) _laboratorio = r.laboratorio;
      if (r.grupo != null) _grupoCtrl.text = r.grupo!;
      if (r.observaciones != null) _observaciones.text = r.observaciones!;
      if (r.dias != null) {
        _dias
          ..clear()
          ..addAll(r.dias!);
      }
      if (r.horaInicio != null) _inicio = _horaDesdeTexto(r.horaInicio!) ?? _inicio;
      if (r.horaFin != null) _fin = _horaDesdeTexto(r.horaFin!) ?? _fin;
    });
  }

  Future<void> _elegirPeriodo() async {
    final lista = await ref.read(periodosProvider.future);
    if (!mounted) return;
    final sel = await seleccionar(
      context,
      titulo: 'Periodo',
      multiple: false,
      opciones: Future.value([
        for (final p in lista) OpcionSeleccion(p.id, p.nombre, p.vigente ? 'Vigente' : ''),
      ]),
      seleccion: _periodo == null ? {} : {_periodo!},
    );
    if (sel != null && sel.isNotEmpty) setState(() => _periodo = sel.first);
  }

  Future<void> _elegirLaboratorio() async {
    final lista = await ref.read(laboratoriosProvider.future);
    if (!mounted) return;
    final sel = await seleccionar(
      context,
      titulo: 'Laboratorio',
      multiple: false,
      opciones: Future.value([
        for (final l in lista.where((l) => l.activo)) OpcionSeleccion(l.id, l.codigo, l.nombre),
      ]),
      seleccion: _laboratorio == null ? {} : {_laboratorio!},
    );
    if (sel != null && sel.isNotEmpty) setState(() => _laboratorio = sel.first);
  }

  Future<void> _elegirMateria() async {
    final lista = await ref.read(materiasProvider.future);
    if (!mounted) return;
    final sel = await seleccionar(
      context,
      titulo: 'Materia',
      multiple: false,
      opciones: Future.value([
        for (final m in lista) OpcionSeleccion(m.id, m.sigla, m.nombre),
      ]),
      seleccion: _materia == null ? {} : {_materia!},
    );
    if (sel != null && sel.isNotEmpty) setState(() => _materia = sel.first);
  }

  Future<void> _elegirDocente() async {
    final lista = await ref.read(docentesAdminProvider('').future);
    if (!mounted) return;
    final sel = await seleccionar(
      context,
      titulo: 'Docente (opcional)',
      multiple: false,
      opciones: Future.value([
        const OpcionSeleccion(0, 'Sin docente'),
        for (final d in lista.where((d) => d.activo)) OpcionSeleccion(d.id, d.nombreCompleto, d.email),
      ]),
      seleccion: {_docente ?? 0},
    );
    if (sel != null && sel.isNotEmpty) setState(() => _docente = sel.first == 0 ? null : sel.first);
  }

  Future<void> _elegirHora(bool inicio) async {
    final elegida = await showTimePicker(
      context: context,
      initialTime: (inicio ? _inicio : _fin) ?? const TimeOfDay(hour: 7, minute: 0),
      builder: (contexto, hijo) => MediaQuery(
        data: MediaQuery.of(contexto).copyWith(alwaysUse24HourFormat: true),
        child: hijo!,
      ),
    );
    if (elegida == null) return;
    setState(() => inicio ? _inicio = elegida : _fin = elegida);
  }

  Future<void> _guardar() async {
    setState(() => _errores.clear());
    if (_periodo == null) return _faltan('Elige el periodo.');
    if (_laboratorio == null) return _faltan('Elige el laboratorio.');
    if (_materia == null) return _faltan('Elige la materia.');
    if (_grupoCtrl.text.trim().isEmpty) return _faltan('Escribe el grupo.');
    if (_dias.isEmpty) return _faltan('Elige al menos un día.');
    if (_inicio == null || _fin == null) return _faltan('Elige las horas.');

    setState(() => _guardando = true);
    final contenedor = ProviderScope.containerOf(context, listen: false);
    final datos = <String, dynamic>{
      'periodo': _periodo,
      'laboratorio': _laboratorio,
      'materia': _materia,
      'grupo': _grupoCtrl.text.trim(),
      'docente': _docente,
      'hora_inicio': _hhmm(_inicio!),
      'hora_fin': _hhmm(_fin!),
      'observaciones': _observaciones.text.trim(),
      'activo': _activo,
    };
    final dias = _dias.toList()..sort();
    try {
      final repo = ref.read(repositorioProvider);
      if (_esNuevo) {
        await repo.crearHorariosEnDias(datos, dias);
      } else {
        await repo.editarHorariosEnDias(widget.grupo!.ids, datos, dias);
      }
      refrescarPlanificacion(contenedor);
      if (!mounted) return;
      avisar(context, _esNuevo ? 'Clase creada.' : 'Cambios guardados.');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        _errores.addAll(erroresDeCampos(e));
      });
      avisar(context, _errores['dias'] ?? _errores['hora_inicio'] ?? mensajeDeError(e), error: true);
    }
  }

  void _faltan(String mensaje) => avisar(context, mensaje, error: true);

  // ── Suspender / reanudar un día puntual ──
  Future<void> _suspenderOReanudar(bool suspender) async {
    final hoy = DateTime.now();
    final fecha = await showDatePicker(
      context: context,
      initialDate: hoy,
      firstDate: DateTime(hoy.year - 1),
      lastDate: DateTime(hoy.year + 1),
      helpText: suspender ? 'Día a suspender' : 'Día a reanudar',
    );
    if (fecha == null || !mounted) return;
    // El día de la semana debe coincidir con un día de esta clase.
    final horario = widget.grupo!.horarios.where((h) => h.diaSemana == fecha.weekday).firstOrNull;
    if (horario == null) {
      avisar(context, 'Esta clase no se dicta ese día de la semana.', error: true);
      return;
    }
    final iso = '${fecha.year.toString().padLeft(4, '0')}-'
        '${fecha.month.toString().padLeft(2, '0')}-${fecha.day.toString().padLeft(2, '0')}';
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      final repo = ref.read(repositorioProvider);
      if (suspender) {
        final motivo = await pedirTexto(
          context,
          titulo: 'Suspender la clase',
          mensaje: 'La clase del ${fechaLarga(fecha)} no se dictará.',
          etiqueta: 'Motivo',
          boton: 'Suspender',
        );
        if (motivo == null) return;
        await repo.suspenderClase(horario.id, iso, motivo);
      } else {
        await repo.reanudarClase(horario.id, iso);
      }
      refrescarPlanificacion(contenedor);
      if (mounted) avisar(context, suspender ? 'Clase suspendida ese día.' : 'Clase reanudada.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final periodos = ref.watch(periodosProvider).value ?? const [];
    final laboratorios = ref.watch(laboratoriosProvider).value ?? const [];
    final materias = ref.watch(materiasProvider).value ?? const [];
    final docentes = ref.watch(docentesAdminProvider('')).value ?? const [];

    final nombrePeriodo = periodos.where((p) => p.id == _periodo).map((p) => p.nombre).firstOrNull;
    final lab = laboratorios.where((l) => l.id == _laboratorio).firstOrNull;
    final materia = materias.where((m) => m.id == _materia).firstOrNull;
    final nombreDocente = _docente == null
        ? 'Sin docente'
        : docentes.where((d) => d.id == _docente).map((d) => d.nombreCompleto).firstOrNull ?? '—';

    return Scaffold(
      appBar: AppBar(
        title: Text(_esNuevo ? 'Nueva clase' : 'Editar clase'),
        actions: [
          if (!_esNuevo)
            PopupMenuButton<String>(
              onSelected: (v) => _suspenderOReanudar(v == 'suspender'),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'suspender', child: Text('Suspender un día')),
                PopupMenuItem(value: 'reanudar', child: Text('Reanudar un día')),
              ],
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
        children: [
          if (_esNuevo) ...[
            DictadoFrase<ResultadoHorario>(
              ejemplo: 'Ej.: Programación I grupo A con el ingeniero Justiniano, los lunes y '
                  'miércoles de 8 a 10 en el laboratorio 41.',
              placeholder: 'Qué materia y grupo, qué docente, qué días, de qué hora a qué hora y en qué aula',
              sustantivo: 'una clase',
              interpretar: (frase) => interpretarDictadoHorario(
                frase,
                ContextoHorario(
                  materias: [for (final m in materias) MateriaCtx(m.id, m.sigla, m.nombre)],
                  docentes: [for (final d in docentes) PersonaCtx(d.id, d.nombreCompleto)],
                  laboratorios: [for (final l in laboratorios.where((x) => x.activo)) LabCtx(l.id, l.codigo, l.nombre)],
                  periodos: [for (final p in periodos) ItemCatalogo(p.id, p.nombre)],
                ),
              ),
              onAplicar: _aplicarDictado,
            ),
            const SizedBox(height: 16),
          ],
          _Selector(
            etiqueta: 'Periodo',
            valor: nombrePeriodo,
            error: _errores['periodo'],
            onTap: _elegirPeriodo,
          ),
          _Selector(
            etiqueta: 'Laboratorio',
            valor: lab == null ? null : '${lab.codigo} · ${lab.nombre}',
            error: _errores['laboratorio'],
            onTap: _elegirLaboratorio,
          ),
          _Selector(
            etiqueta: 'Materia',
            valor: materia == null ? null : '${materia.sigla} · ${materia.nombre}',
            error: _errores['materia'],
            onTap: _elegirMateria,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _grupoCtrl,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(labelText: 'Grupo', hintText: 'SA, SB…', errorText: _errores['grupo']),
          ),
          const SizedBox(height: 8),
          _Selector(etiqueta: 'Docente', valor: nombreDocente, onTap: _elegirDocente),
          const SizedBox(height: 16),
          const Text('Días', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            children: [
              for (final (valor, _, corto) in diasSemana)
                FilterChip(
                  label: Text(corto),
                  selected: _dias.contains(valor),
                  onSelected: (s) => setState(() => s ? _dias.add(valor) : _dias.remove(valor)),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _elegirHora(true),
                  icon: const Icon(Icons.schedule),
                  label: Text(_inicio == null ? 'Hora de inicio' : 'Inicio ${_hhmm(_inicio!)}'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _elegirHora(false),
                  icon: const Icon(Icons.schedule),
                  label: Text(_fin == null ? 'Hora de fin' : 'Fin ${_hhmm(_fin!)}'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _observaciones,
            minLines: 1,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Observaciones (opcional)'),
          ),
          if (!_esNuevo)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Activa'),
              value: _activo,
              onChanged: (v) => setState(() => _activo = v),
            ),
        ],
      ),
      bottomNavigationBar: Padding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + MediaQuery.of(context).padding.bottom),
        child: FilledButton(
          onPressed: _guardando ? null : _guardar,
          child: _guardando
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(_esNuevo ? 'Crear clase' : 'Guardar cambios'),
        ),
      ),
    );
  }
}

class _Selector extends StatelessWidget {
  const _Selector({required this.etiqueta, required this.valor, required this.onTap, this.error});
  final String etiqueta;
  final String? valor;
  final VoidCallback onTap;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: InputDecorator(
          decoration: InputDecoration(labelText: etiqueta, errorText: error, border: const OutlineInputBorder()),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  valor ?? 'Elegir…',
                  style: TextStyle(color: valor == null ? Theme.of(context).hintColor : null),
                ),
              ),
              const Icon(Icons.arrow_drop_down),
            ],
          ),
        ),
      ),
    );
  }
}
