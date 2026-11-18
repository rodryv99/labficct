import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/seleccion.dart';
import 'marcaciones_comun.dart';
import 'mis_marcaciones_page.dart';

/// Control de asistencia para el Admin: cómo van hoy los auxiliares, las marcaciones,
/// los totales por auxiliar y los lugares donde se puede marcar.
class ControlAsistenciaPage extends ConsumerStatefulWidget {
  const ControlAsistenciaPage({super.key});

  @override
  ConsumerState<ControlAsistenciaPage> createState() => _ControlAsistenciaPageState();
}

class _ControlAsistenciaPageState extends ConsumerState<ControlAsistenciaPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 5, vsync: this)..addListener(_alCambiarTab);

  RangoFechas _rango = RangoFechas.mes;

  /// Fechas elegidas a mano; cuando hay, mandan sobre [_rango].
  DateTimeRange? _otrasFechas;
  int? _auxiliar;
  String _auxiliarNombre = '';
  bool _soloAbiertas = false;
  bool _soloRetraso = false;
  int _retrasoMin = 0; // 0 = sin filtro de minutos
  int _minRetrasos = 0; // resumen: cantidad mínima de retrasos
  String? _exportando;

  void _alCambiarTab() {
    if (!_tabs.indexIsChanging && mounted) setState(() {});
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  ({String desde, String hasta}) get _fechas {
    final otras = _otrasFechas;
    if (otras != null) return (desde: fechaIso(otras.start), hasta: fechaIso(otras.end));
    return fechasDe(_rango);
  }

  FiltroMarcaciones get _filtro {
    final f = _fechas;
    return (
      desde: f.desde,
      hasta: f.hasta,
      usuario: _auxiliar,
      lugar: null,
      abiertas: _soloAbiertas ? true : null,
      conRetraso: _soloRetraso,
      retrasoMin: _retrasoMin,
    );
  }

  FiltroResumen get _filtroResumen {
    final f = _fechas;
    return (
      desde: f.desde,
      hasta: f.hasta,
      conRetraso: _soloRetraso,
      retrasoMin: _retrasoMin,
      minRetrasos: _minRetrasos,
    );
  }

  Future<void> _elegirFechas() async {
    final ahora = DateTime.now();
    final elegido = await showDateRangePicker(
      context: context,
      firstDate: DateTime(ahora.year - 2),
      lastDate: ahora,
      initialDateRange: _otrasFechas,
      helpText: 'Elige las fechas',
      saveText: 'Listo',
    );
    if (elegido != null) setState(() => _otrasFechas = elegido);
  }

  Future<void> _elegirAuxiliar() async {
    var auxiliares = const <AuxiliarAsistencia>[];
    final sel = await seleccionar(
      context,
      titulo: 'Auxiliar',
      multiple: false,
      opciones: ref.read(repositorioProvider).auxiliaresAsistencia().then((lista) {
        auxiliares = lista;
        return [
          const OpcionSeleccion(0, 'Todos los auxiliares'),
          for (final a in lista) OpcionSeleccion(a.id, a.nombreCompleto, a.email),
        ];
      }),
      seleccion: {_auxiliar ?? 0},
    );
    if (sel == null || sel.isEmpty || !mounted) return;
    final id = sel.first;
    setState(() {
      _auxiliar = id == 0 ? null : id;
      _auxiliarNombre = auxiliares.where((a) => a.id == id).map((a) => a.nombreCompleto).firstOrNull ?? '';
    });
  }

  Future<void> _exportar(String formato) async {
    final f = _fechas;
    // Se descarga lo que se está viendo: en el resumen, todas las marcaciones de esas fechas.
    final enResumen = _tabs.index == 2;
    setState(() => _exportando = formato);
    try {
      final archivo = await ref.read(repositorioProvider).exportarMarcaciones(
            formato,
            desde: f.desde,
            hasta: f.hasta,
            usuario: enResumen ? null : _auxiliar,
            abiertas: (!enResumen && _soloAbiertas) ? true : null,
            conRetraso: _soloRetraso,
            retrasoMin: _retrasoMin,
          );
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(archivo.bytes, mimeType: archivo.tipo, name: archivo.nombre)],
        ),
      );
    } catch (e) {
      if (mounted) avisar(context, 'No se pudo exportar. ${mensajeDeError(e)}', error: true);
    } finally {
      if (mounted) setState(() => _exportando = null);
    }
  }

  /// Al tocar un auxiliar: elegir si se cambia su lugar o su horario.
  Future<void> _abrirAuxiliar(AuxiliarAsistencia a) async {
    final opcion = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(a.nombreCompleto, style: Theme.of(context).textTheme.titleMedium),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.place_outlined),
              title: const Text('Dónde marca'),
              subtitle: Text(a.lugarEfectivo == null ? 'Sin lugar' : a.lugarNombre),
              onTap: () => Navigator.pop(context, 'lugar'),
            ),
            ListTile(
              leading: const Icon(Icons.schedule_outlined),
              title: const Text('Horario de trabajo'),
              subtitle: Text(a.horario == null ? 'Sin horario' : a.horarioNombre),
              onTap: () => Navigator.pop(context, 'horario'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (!mounted) return;
    if (opcion == 'lugar') await _asignarLugar(a);
    if (opcion == 'horario') await _asignarHorario(a);
  }

  /// Cambia el lugar donde marca un auxiliar (o lo devuelve al predeterminado).
  Future<void> _asignarLugar(AuxiliarAsistencia a) async {
    final repo = ref.read(repositorioProvider);
    final contenedor = ProviderScope.containerOf(context, listen: false);
    final sel = await seleccionar(
      context,
      titulo: 'Dónde marca ${a.nombreCompleto}',
      multiple: false,
      opciones: repo.lugaresAsistencia().then((lugares) {
        final predeterminado = lugares.where((l) => l.predeterminado && l.activo).firstOrNull;
        return [
          OpcionSeleccion(
            0,
            predeterminado == null ? 'Sin lugar propio' : 'El predeterminado',
            predeterminado?.nombre ?? 'No hay un lugar predeterminado: no podrá marcar',
          ),
          for (final l in lugares.where((l) => l.activo || l.id == a.lugar))
            OpcionSeleccion(l.id, l.nombre, 'Radio de ${l.radioM} m'),
        ];
      }),
      seleccion: {a.lugar ?? 0},
    );
    if (sel == null || sel.isEmpty || !mounted) return;
    final nuevo = sel.first == 0 ? null : sel.first;
    if (nuevo == a.lugar) return;
    try {
      await repo.asignarLugarAsistencia(a.id, nuevo);
      refrescarAsistencia(contenedor);
      if (mounted) avisar(context, 'Lugar de ${a.nombreCompleto} actualizado.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  /// Cambia el horario de trabajo de un auxiliar (o se lo quita).
  Future<void> _asignarHorario(AuxiliarAsistencia a) async {
    final repo = ref.read(repositorioProvider);
    final contenedor = ProviderScope.containerOf(context, listen: false);
    final sel = await seleccionar(
      context,
      titulo: 'Horario de ${a.nombreCompleto}',
      multiple: false,
      opciones: repo.horariosAsistencia().then((horarios) {
        return [
          const OpcionSeleccion(0, 'Sin horario'),
          for (final h in horarios.where((h) => h.activo || h.id == a.horario))
            OpcionSeleccion(h.id, h.nombre, resumenHorario(h.bloques)),
        ];
      }),
      seleccion: {a.horario ?? 0},
    );
    if (sel == null || sel.isEmpty || !mounted) return;
    final nuevo = sel.first == 0 ? null : sel.first;
    if (nuevo == a.horario) return;
    try {
      await repo.asignarHorarioAsistencia(a.id, nuevo);
      refrescarAsistencia(contenedor);
      if (mounted) avisar(context, 'Horario de ${a.nombreCompleto} actualizado.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final enLugares = _tabs.index == 3;
    final enHorarios = _tabs.index == 4;
    final conExportar = _tabs.index == 1 || _tabs.index == 2;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Control de asistencia'),
        actions: [
          if (conExportar)
            PopupMenuButton<String>(
              tooltip: 'Exportar',
              icon: _exportando != null
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.file_download_outlined),
              onSelected: _exportar,
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'xlsx', child: Text('Exportar a Excel')),
                PopupMenuItem(value: 'csv', child: Text('Exportar a CSV')),
                PopupMenuItem(value: 'pdf', child: Text('Exportar a PDF')),
              ],
            ),
        ],
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: const [
            Tab(text: 'Hoy'),
            Tab(text: 'Marcaciones'),
            Tab(text: 'Resumen'),
            Tab(text: 'Lugares'),
            Tab(text: 'Horarios'),
          ],
        ),
      ),
      floatingActionButton: enLugares
          ? FloatingActionButton.extended(
              onPressed: () {
                final hay = ref.read(lugaresAsistenciaProvider).value?.isNotEmpty ?? true;
                context.push('/control-asistencia/lugar/nuevo', extra: !hay);
              },
              icon: const Icon(Icons.add_location_alt_outlined),
              label: const Text('Lugar'),
            )
          : enHorarios
              ? FloatingActionButton.extended(
                  onPressed: () => context.push('/control-asistencia/horario/nuevo'),
                  icon: const Icon(Icons.more_time_outlined),
                  label: const Text('Horario'),
                )
              : null,
      body: TabBarView(
        controller: _tabs,
        children: [_hoy(), _marcaciones(), _resumen(), _lugares(), _horarios()],
      ),
    );
  }

  // ── Hoy ──

  Widget _hoy() {
    final auxiliares = ref.watch(auxiliaresAsistenciaProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(auxiliaresAsistenciaProvider.future),
      child: auxiliares.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ListView(children: [
          const SizedBox(height: 80),
          EstadoError(error: e, onReintentar: () => ref.invalidate(auxiliaresAsistenciaProvider)),
        ]),
        data: (lista) {
          if (lista.isEmpty) {
            return ListView(children: const [
              SizedBox(height: 80),
              EstadoVacio(
                icono: Icons.group_outlined,
                titulo: 'No hay auxiliares activos',
                descripcion: 'Los auxiliares se crean en Usuarios.',
              ),
            ]);
          }
          final sinLugar = lista.where((a) => a.lugarEfectivo == null).length;
          final presentes = lista.where((a) => a.situacion == 'presente').length;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              if (sinLugar > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _Aviso(
                    '${sinLugar == 1 ? 'Un auxiliar no tiene' : '$sinLugar auxiliares no tienen'} dónde marcar. '
                    'Crea un lugar predeterminado en la pestaña Lugares o asígnales uno tocando su tarjeta.',
                  ),
                ),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '$presentes de ${lista.length} presentes ahora · toca un auxiliar para cambiar su lugar u horario',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              for (final a in lista)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _TarjetaAuxiliar(auxiliar: a, onTap: () => _abrirAuxiliar(a)),
                ),
            ],
          );
        },
      ),
    );
  }

  // ── Filtro de fechas (Marcaciones y Resumen) ──

  Widget _filtros({required bool conAuxiliar}) {
    final otras = _otrasFechas;
    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        children: [
          for (final rango in RangoFechas.values)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(etiquetasRango[rango]!),
                selected: otras == null && _rango == rango,
                onSelected: (_) => setState(() {
                  _rango = rango;
                  _otrasFechas = null;
                }),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              avatar: const Icon(Icons.date_range, size: 18),
              label: Text(
                otras == null
                    ? 'Otras fechas'
                    : '${fechaNumerica(fechaIso(otras.start))} – ${fechaNumerica(fechaIso(otras.end))}',
              ),
              selected: otras != null,
              onSelected: (_) => _elegirFechas(),
            ),
          ),
          if (conAuxiliar) ...[
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                avatar: const Icon(Icons.person_outline, size: 18),
                label: Text(_auxiliar == null || _auxiliarNombre.isEmpty ? 'Todos los auxiliares' : _auxiliarNombre),
                selected: _auxiliar != null,
                onSelected: (_) => _elegirAuxiliar(),
              ),
            ),
            FilterChip(
              label: const Text('Solo sin salida'),
              selected: _soloAbiertas,
              onSelected: (v) => setState(() => _soloAbiertas = v),
            ),
          ],
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: FilterChip(
              label: const Text('Solo con retraso'),
              selected: _soloRetraso,
              onSelected: (v) => setState(() => _soloRetraso = v),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: ChoiceChip(
              avatar: const Icon(Icons.timer_outlined, size: 18),
              label: Text(_retrasoMin > 0 ? 'Retraso ≥ $_retrasoMin min' : 'Retraso ≥ …'),
              selected: _retrasoMin > 0,
              onSelected: (_) async {
                final n = await _pedirNumero('Retraso de al menos (min)', _retrasoMin);
                if (n != null) setState(() => _retrasoMin = n);
              },
            ),
          ),
          if (!conAuxiliar)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: ChoiceChip(
                avatar: const Icon(Icons.repeat, size: 18),
                label: Text(_minRetrasos > 0 ? '≥ $_minRetrasos retrasos' : 'Cantidad de retrasos'),
                selected: _minRetrasos > 0,
                onSelected: (_) async {
                  final n = await _pedirNumero('Cantidad mínima de retrasos', _minRetrasos);
                  if (n != null) setState(() => _minRetrasos = n);
                },
              ),
            ),
        ],
      ),
    );
  }

  /// Pide un número (0 = sin filtro) en un diálogo simple.
  Future<int?> _pedirNumero(String titulo, int actual) async {
    final control = TextEditingController(text: actual > 0 ? '$actual' : '');
    return showDialog<int>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: Text(titulo),
        content: TextField(
          controller: control,
          keyboardType: TextInputType.number,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Deja vacío para quitar el filtro'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogo, 0), child: const Text('Quitar')),
          FilledButton(
            onPressed: () => Navigator.pop(dialogo, int.tryParse(control.text.trim()) ?? 0),
            child: const Text('Aplicar'),
          ),
        ],
      ),
    );
  }

  // ── Marcaciones ──

  Widget _marcaciones() {
    final filtro = _filtro;
    final marcaciones = ref.watch(marcacionesProvider(filtro));
    return Column(
      children: [
        _filtros(conAuxiliar: true),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(marcacionesProvider(filtro).future),
            child: marcaciones.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ListView(children: [
                const SizedBox(height: 80),
                EstadoError(error: e, onReintentar: () => ref.invalidate(marcacionesProvider)),
              ]),
              data: (lista) {
                if (lista.isEmpty) {
                  return ListView(children: const [
                    SizedBox(height: 80),
                    EstadoVacio(
                      icono: Icons.fingerprint,
                      titulo: 'No hay marcaciones con esos filtros',
                      descripcion: 'Los auxiliares marcan su entrada y su salida desde la app, en «Mi asistencia».',
                    ),
                  ]);
                }
                final minutos = lista.fold<int>(0, (suma, m) => suma + (m.minutos ?? 0));
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                  itemCount: lista.length + 1,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    if (i == 0) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(
                          '${lista.length == 1 ? '1 marcación' : '${lista.length} marcaciones'} · ${duracionTexto(minutos)} en total',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      );
                    }
                    return TarjetaMarcacion(marcacion: lista[i - 1], conNombre: true);
                  },
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  // ── Resumen por auxiliar ──

  Widget _resumen() {
    final filtro = _filtroResumen;
    final resumen = ref.watch(resumenAsistenciaProvider(filtro));
    final tema = Theme.of(context);
    return Column(
      children: [
        _filtros(conAuxiliar: false),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(resumenAsistenciaProvider(filtro).future),
            child: resumen.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ListView(children: [
                const SizedBox(height: 80),
                EstadoError(error: e, onReintentar: () => ref.invalidate(resumenAsistenciaProvider)),
              ]),
              data: (lista) {
                if (lista.isEmpty) {
                  return ListView(children: const [
                    SizedBox(height: 80),
                    EstadoVacio(
                      icono: Icons.insights_outlined,
                      titulo: 'Nadie marcó en esas fechas',
                      descripcion: 'Cambia el rango de fechas para ver otros días.',
                    ),
                  ]);
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                  itemCount: lista.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final r = lista[i];
                    return Card(
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        // Lleva a las marcaciones de ese auxiliar, con las mismas fechas.
                        onTap: () {
                          setState(() {
                            _auxiliar = r.usuario;
                            _auxiliarNombre = r.usuarioNombre;
                            _soloAbiertas = false;
                          });
                          _tabs.animateTo(1);
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      r.usuarioNombre,
                                      style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                                    ),
                                  ),
                                  Text(
                                    duracionTexto(r.minutos),
                                    style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Text(
                                    '${r.dias == 1 ? '1 día' : '${r.dias} días'} · '
                                    '${r.marcaciones == 1 ? '1 marcación' : '${r.marcaciones} marcaciones'}',
                                    style: tema.textTheme.bodySmall,
                                  ),
                                  if (r.retrasos > 0)
                                    Etiqueta(
                                      r.retrasos == 1
                                          ? '1 retraso · prom ${r.retrasoPromedioMin}m · máx ${r.retrasoMaxMin}m'
                                          : '${r.retrasos} retrasos · prom ${r.retrasoPromedioMin}m · máx ${r.retrasoMaxMin}m',
                                      tono: Tono.peligro,
                                    ),
                                  if (r.sinSalida > 0) Etiqueta('${r.sinSalida} sin salida', tono: Tono.aviso),
                                  if (r.salidasManuales > 0)
                                    Etiqueta(
                                      r.salidasManuales == 1 ? '1 salida a mano' : '${r.salidasManuales} salidas a mano',
                                      tono: Tono.info,
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  // ── Lugares ──

  Widget _lugares() {
    final lugares = ref.watch(lugaresAsistenciaProvider);
    final tema = Theme.of(context);
    final gris = tema.colorScheme.onSurfaceVariant;
    return RefreshIndicator(
      onRefresh: () => ref.refresh(lugaresAsistenciaProvider.future),
      child: lugares.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ListView(children: [
          const SizedBox(height: 80),
          EstadoError(error: e, onReintentar: () => ref.invalidate(lugaresAsistenciaProvider)),
        ]),
        data: (lista) {
          if (lista.isEmpty) {
            return ListView(children: const [
              SizedBox(height: 80),
              EstadoVacio(
                icono: Icons.add_location_alt_outlined,
                titulo: 'Todavía no hay lugares',
                descripcion: 'Agrega con el botón + el lugar donde los auxiliares marcan su asistencia. '
                    'Sin un lugar no pueden marcar.',
              ),
            ]);
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
            itemCount: lista.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final l = lista[i];
              return Card(
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => context.push('/control-asistencia/lugar/editar', extra: l),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                l.nombre,
                                style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                              ),
                            ),
                            if (l.predeterminado) const Etiqueta('Predeterminado', tono: Tono.marca),
                            if (!l.activo) ...[
                              const SizedBox(width: 6),
                              const Etiqueta('Inactivo', tono: Tono.neutro),
                            ],
                          ],
                        ),
                        if (l.referencia.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(l.referencia, style: tema.textTheme.bodySmall?.copyWith(color: gris)),
                          ),
                        const SizedBox(height: 6),
                        Text('${l.coordenadas} · radio de ${l.radioM} m', style: tema.textTheme.bodySmall),
                        const SizedBox(height: 2),
                        Text(
                          l.predeterminado
                              ? 'Marcan aquí los auxiliares sin lugar propio'
                                  '${l.asignados > 0 ? ' y ${l.asignados} que lo tienen asignado' : ''}.'
                              : (l.asignados == 0
                                  ? 'Ningún auxiliar lo tiene asignado.'
                                  : (l.asignados == 1
                                      ? '1 auxiliar lo tiene asignado.'
                                      : '${l.asignados} auxiliares lo tienen asignado.')),
                          style: tema.textTheme.bodySmall?.copyWith(color: gris),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  // ── Horarios ──

  Widget _horarios() {
    final horarios = ref.watch(horariosAsistenciaProvider);
    final tema = Theme.of(context);
    final gris = tema.colorScheme.onSurfaceVariant;
    return RefreshIndicator(
      onRefresh: () => ref.refresh(horariosAsistenciaProvider.future),
      child: horarios.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ListView(children: [
          const SizedBox(height: 80),
          EstadoError(error: e, onReintentar: () => ref.invalidate(horariosAsistenciaProvider)),
        ]),
        data: (lista) {
          if (lista.isEmpty) {
            return ListView(children: const [
              SizedBox(height: 80),
              EstadoVacio(
                icono: Icons.more_time_outlined,
                titulo: 'Todavía no hay horarios',
                descripcion: 'Agrega con el botón + un horario de trabajo (por ejemplo, «Mañana: Lun a Vie de '
                    '08:00 a 12:00») y luego asígnalo a los auxiliares tocando su tarjeta en «Hoy».',
              ),
            ]);
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
            itemCount: lista.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final h = lista[i];
              return Card(
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => context.push('/control-asistencia/horario/editar', extra: h),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                h.nombre,
                                style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                              ),
                            ),
                            if (!h.activo) const Etiqueta('Inactivo', tono: Tono.neutro),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(resumenHorario(h.bloques), style: tema.textTheme.bodySmall),
                        const SizedBox(height: 2),
                        Text(
                          '${duracionTexto(minutosSemana(h.bloques))} por semana · '
                          '${h.asignados == 0 ? 'ningún auxiliar' : h.asignados == 1 ? '1 auxiliar' : '${h.asignados} auxiliares'}',
                          style: tema.textTheme.bodySmall?.copyWith(color: gris),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

/// Recuadro de advertencia.
class _Aviso extends StatelessWidget {
  const _Aviso(this.texto);
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFFFF4E0), borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, size: 20, color: Color(0xFF8A5300)),
          const SizedBox(width: 8),
          Expanded(child: Text(texto, style: const TextStyle(color: Color(0xFF8A5300)))),
        ],
      ),
    );
  }
}

/// Un auxiliar en la pestaña "Hoy": dónde marca y cómo va.
class _TarjetaAuxiliar extends StatelessWidget {
  const _TarjetaAuxiliar({required this.auxiliar, required this.onTap});
  final AuxiliarAsistencia auxiliar;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = auxiliar;
    final tema = Theme.of(context);
    final gris = tema.colorScheme.onSurfaceVariant;
    final (texto, tono) = situacionAuxiliar(a.situacion);
    final entrada = a.entradaEn;
    final salida = a.salidaEn;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      a.nombreCompleto,
                      style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Etiqueta(texto, tono: tono),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.place_outlined, size: 16, color: a.lugarEfectivo == null ? tema.colorScheme.error : gris),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      a.lugarEfectivo == null
                          ? 'Sin lugar: no puede marcar'
                          : '${a.lugarNombre} · ${a.usaPredeterminado ? 'predeterminado' : 'lugar propio'}',
                      style: tema.textTheme.bodySmall?.copyWith(
                        color: a.lugarEfectivo == null ? tema.colorScheme.error : gris,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Icon(Icons.edit_location_alt_outlined, size: 18, color: gris),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.schedule_outlined, size: 16, color: gris),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      a.horario == null ? 'Sin horario' : a.horarioNombre,
                      style: tema.textTheme.bodySmall?.copyWith(color: gris),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              if (entrada != null) ...[
                const SizedBox(height: 6),
                Text(
                  'Entrada ${hora(entrada)}'
                  '${salida != null ? ' · Salida ${hora(salida)}' : ''}'
                  '${a.minutosHoy > 0 ? ' · ${duracionTexto(a.minutosHoy)}' : ''}',
                  style: tema.textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
