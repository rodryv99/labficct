import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/evento.dart';
import '../notificaciones/notificaciones_page.dart';
import '../perfil/perfil_sheet.dart';

enum _Vista { hora, laboratorio }

/// 6. Pizarra de actividades en el teléfono: el día elegido, por hora o por laboratorio.
class InicioPage extends ConsumerStatefulWidget {
  const InicioPage({super.key, this.fecha});

  /// Día que se abre (p. ej. desde una notificación). null = hoy.
  final DateTime? fecha;

  @override
  ConsumerState<InicioPage> createState() => _InicioPageState();
}

class _InicioPageState extends ConsumerState<InicioPage> {
  late DateTime _dia = _soloFecha(widget.fecha ?? DateTime.now());
  _Vista _vista = _Vista.hora;
  String? _laboratorio;

  static DateTime _soloFecha(DateTime f) => DateTime(f.year, f.month, f.day);

  @override
  void didUpdateWidget(covariant InicioPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Al abrir /hoy?fecha=… con la pestaña ya abierta, salta a ese día.
    final fecha = widget.fecha;
    if (fecha != null && fecha != oldWidget.fecha) {
      _dia = _soloFecha(fecha);
      _laboratorio = null;
    }
  }

  bool get _esHoy => _dia == _soloFecha(DateTime.now());

  String get _titulo {
    final diferencia = _dia.difference(_soloFecha(DateTime.now())).inDays;
    return switch (diferencia) {
      0 => 'Hoy',
      1 => 'Mañana',
      -1 => 'Ayer',
      _ => fechaLarga(_dia).split(' ').first,
    };
  }

  void _irA(DateTime dia) => setState(() {
        _dia = _soloFecha(dia);
        _laboratorio = null;
      });

  Future<void> _elegirFecha() async {
    final elegida = await showDatePicker(
      context: context,
      initialDate: _dia,
      firstDate: DateTime(_dia.year - 1),
      lastDate: DateTime(_dia.year + 2),
    );
    if (elegida != null) _irA(elegida);
  }

  @override
  Widget build(BuildContext context) {
    final usuario = ref.watch(sesionProvider).usuario;
    final fecha = fechaIso(_dia);
    final agenda = ref.watch(agendaDiaProvider(fecha));
    final tema = Theme.of(context);
    final atiende = usuario?.puede('asistencia.atender') ?? false;
    final abiertas = atiende ? (ref.watch(solicitudesAbiertasProvider).value ?? 0) : 0;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_titulo, maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(
              fechaLarga(_dia),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
            ),
          ],
        ),
        actions: [
          if (!_esHoy)
            TextButton(onPressed: () => _irA(DateTime.now()), child: const Text('Hoy')),
          IconButton(
            tooltip: 'Elegir fecha',
            onPressed: _elegirFecha,
            icon: const Icon(Icons.calendar_month_outlined),
          ),
          const BotonNotificaciones(),
          const BotonPerfil(),
        ],
      ),
      floatingActionButton: (usuario?.puede('reservas.gestionar') ?? false)
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/reserva/nueva'),
              icon: const Icon(Icons.add),
              label: const Text('Reserva'),
            )
          : null,
      body: Column(
        children: [
          if (abiertas > 0) _AvisoSolicitudes(cantidad: abiertas),
          _TiraSemana(dia: _dia, onCambiar: _irA),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: SizedBox(
              width: double.infinity,
              child: SegmentedButton<_Vista>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: _Vista.hora, icon: Icon(Icons.schedule, size: 18), label: Text('Por hora')),
                  ButtonSegment(
                    value: _Vista.laboratorio,
                    icon: Icon(Icons.grid_view_outlined, size: 18),
                    label: Text('Por laboratorio'),
                  ),
                ],
                selected: {_vista},
                onSelectionChanged: (s) => setState(() => _vista = s.first),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () {
                if (atiende) ref.invalidate(solicitudesAbiertasProvider);
                return ref.refresh(agendaDiaProvider(fecha).future);
              },
              child: agenda.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => _Desplazable(
                  child: EstadoError(error: e, onReintentar: () => ref.invalidate(agendaDiaProvider(fecha))),
                ),
                data: (eventos) => eventos.isEmpty
                    ? const _Desplazable(
                        child: EstadoVacio(
                          icono: Icons.event_available_outlined,
                          titulo: 'Día libre',
                          descripcion: 'No hay clases ni reservas en ningún laboratorio.',
                        ),
                      )
                    : _vista == _Vista.hora
                        ? _PorHora(
                            eventos: eventos,
                            esHoy: _esHoy,
                            laboratorio: _laboratorio,
                            onFiltrar: (l) => setState(() => _laboratorio = l),
                          )
                        : _PorLaboratorio(eventos: eventos, esHoy: _esHoy),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Aviso arriba de la pizarra cuando alguien pidió asistencia y sigue esperando.
class _AvisoSolicitudes extends StatelessWidget {
  const _AvisoSolicitudes({required this.cantidad});
  final int cantidad;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    const fondo = Color(0xFFFFF4E0);
    const frente = Color(0xFF8A5300);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Material(
        color: fondo,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => context.push('/solicitudes'),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
            child: Row(
              children: [
                const Icon(Icons.support_agent, color: frente),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    cantidad == 1
                        ? '1 solicitud de asistencia abierta'
                        : '$cantidad solicitudes de asistencia abiertas',
                    style: tema.textTheme.titleSmall?.copyWith(color: frente, fontWeight: FontWeight.w600),
                  ),
                ),
                const Text('Ver', style: TextStyle(color: frente, fontWeight: FontWeight.w600)),
                const Icon(Icons.chevron_right, color: frente),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Permite deslizar para actualizar aunque la pantalla esté vacía.
class _Desplazable extends StatelessWidget {
  const _Desplazable({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, limites) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(constraints: BoxConstraints(minHeight: limites.maxHeight), child: Center(child: child)),
      ),
    );
  }
}

/// Lunes a domingo de la semana del día elegido, con flechas para cambiar de semana.
class _TiraSemana extends StatelessWidget {
  const _TiraSemana({required this.dia, required this.onCambiar});
  final DateTime dia;
  final ValueChanged<DateTime> onCambiar;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    final lunes = dia.subtract(Duration(days: dia.weekday - 1));
    final ahora = DateTime.now();
    final hoy = DateTime(ahora.year, ahora.month, ahora.day);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Semana anterior',
            onPressed: () => onCambiar(dia.subtract(const Duration(days: 7))),
            icon: const Icon(Icons.chevron_left),
          ),
          for (var i = 0; i < 7; i++)
            Expanded(
              child: Builder(builder: (context) {
                final d = DateTime(lunes.year, lunes.month, lunes.day + i);
                final elegido = d == dia;
                final esHoy = d == hoy;
                return InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => onCambiar(d),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(
                      color: elegido ? esquema.primary : null,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      children: [
                        Text(
                          DateFormat('EEEEE', 'es').format(d).toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            color: elegido ? esquema.onPrimary : esquema.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${d.day}',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: esHoy || elegido ? FontWeight.w700 : FontWeight.w500,
                            color: elegido ? esquema.onPrimary : (esHoy ? esquema.primary : esquema.onSurface),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          IconButton(
            tooltip: 'Semana siguiente',
            onPressed: () => onCambiar(dia.add(const Duration(days: 7))),
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}

bool _enCurso(EventoAgenda e, bool esHoy) {
  if (!esHoy || e.suspendida) return false;
  final m = minutosAhora();
  return e.minutoInicio <= m && m < e.minutoFin;
}

class _PorHora extends StatelessWidget {
  const _PorHora({required this.eventos, required this.esHoy, required this.laboratorio, required this.onFiltrar});

  final List<EventoAgenda> eventos;
  final bool esHoy;
  final String? laboratorio;
  final ValueChanged<String?> onFiltrar;

  @override
  Widget build(BuildContext context) {
    final laboratorios = {for (final e in eventos) e.laboratorioCodigo}.toList()..sort();
    final visibles = laboratorio == null ? eventos : eventos.where((e) => e.laboratorioCodigo == laboratorio).toList();
    final clases = visibles.where((e) => e.esClase && !e.suspendida).length;
    final reservas = visibles.where((e) => !e.esClase).length;
    final enCurso = visibles.where((e) => _enCurso(e, esHoy)).length;

    // La línea "Ahora" va antes del primer evento que todavía no empezó.
    final ahora = minutosAhora();
    final indiceAhora = esHoy ? visibles.indexWhere((e) => e.minutoInicio > ahora) : -1;

    final tema = Theme.of(context);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
      children: [
        if (laboratorios.length > 1)
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: const Text('Todos'),
                    selected: laboratorio == null,
                    onSelected: (_) => onFiltrar(null),
                  ),
                ),
                for (final l in laboratorios)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(label: Text(l), selected: laboratorio == l, onSelected: (_) => onFiltrar(l)),
                  ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(
            [
              '$clases ${clases == 1 ? 'clase' : 'clases'}',
              '$reservas ${reservas == 1 ? 'reserva' : 'reservas'}',
              if (enCurso > 0) '$enCurso en curso',
            ].join(' · '),
            style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
          ),
        ),
        for (var i = 0; i < visibles.length; i++) ...[
          if (i == indiceAhora) const _LineaAhora(),
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: TarjetaEvento(evento: visibles[i], enCurso: _enCurso(visibles[i], esHoy)),
          ),
        ],
        if (esHoy && indiceAhora == -1 && visibles.isNotEmpty) const _LineaAhora(),
      ],
    );
  }
}

class _LineaAhora extends StatelessWidget {
  const _LineaAhora();

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.error;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(
            'Ahora ${hora(DateTime.now())}',
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(width: 8),
          Expanded(child: Container(height: 1.5, color: color)),
        ],
      ),
    );
  }
}

/// Un bloque por laboratorio: qué pasa ahora y qué sigue. Incluye los que están libres.
class _PorLaboratorio extends ConsumerWidget {
  const _PorLaboratorio({required this.eventos, required this.esHoy});
  final List<EventoAgenda> eventos;
  final bool esHoy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final labs = ref.watch(laboratoriosProvider).value;

    final porLab = <String, List<EventoAgenda>>{};
    for (final e in eventos) {
      porLab.putIfAbsent(e.laboratorioCodigo, () => []).add(e);
    }
    final codigos = labs == null
        ? (porLab.keys.toList()..sort())
        : [for (final l in labs.where((l) => l.activo)) l.codigo];
    final idPorCodigo = {for (final l in labs ?? const <Laboratorio>[]) l.codigo: l.id};

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
      itemCount: codigos.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, i) {
        final codigo = codigos[i];
        final lista = porLab[codigo] ?? const <EventoAgenda>[];
        final actual = lista.where((e) => _enCurso(e, esHoy)).firstOrNull;
        final id = idPorCodigo[codigo];

        final String estado;
        final Tono tono;
        if (actual != null) {
          estado = 'Ocupado hasta ${actual.horaFin}';
          tono = Tono.peligro;
        } else if (lista.where((e) => !e.suspendida).isEmpty) {
          estado = 'Libre todo el día';
          tono = Tono.exito;
        } else if (esHoy) {
          final ahora = minutosAhora();
          final proxima = lista.where((e) => !e.suspendida && e.minutoInicio > ahora).firstOrNull;
          estado = proxima == null ? 'Libre el resto del día' : 'Libre hasta ${proxima.horaInicio}';
          tono = Tono.exito;
        } else {
          final activos = lista.where((e) => !e.suspendida).length;
          estado = '$activos ${activos == 1 ? 'actividad' : 'actividades'}';
          tono = Tono.info;
        }

        return Card(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(codigo, style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(width: 10),
                    Etiqueta(estado, tono: tono),
                    const Spacer(),
                    if (id != null)
                      IconButton(
                        tooltip: 'Ver laboratorio',
                        onPressed: () => context.push('/laboratorio/$id'),
                        icon: const Icon(Icons.chevron_right),
                      ),
                  ],
                ),
                if (lista.isNotEmpty) const SizedBox(height: 6),
                for (final e in lista)
                  InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () => mostrarEvento(context, e),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: e.suspendida ? esquema.outlineVariant : colorDeEvento(e),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 10),
                          SizedBox(
                            width: 92,
                            child: Text(
                              '${e.horaInicio} – ${e.horaFin}',
                              style: tema.textTheme.labelMedium?.copyWith(
                                fontWeight: _enCurso(e, esHoy) ? FontWeight.w700 : FontWeight.w500,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              e.titulo,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: tema.textTheme.bodyMedium?.copyWith(
                                decoration: e.suspendida ? TextDecoration.lineThrough : null,
                                color: e.suspendida ? esquema.onSurfaceVariant : null,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
