import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/datos/proveedores.dart';
import '../../shared/widgets/comunes.dart';
import 'marcaciones_comun.dart';

/// Rangos rápidos de fechas que comparten el historial del auxiliar y las vistas del Admin.
enum RangoFechas { hoy, semana, mes, mesPasado }

const etiquetasRango = {
  RangoFechas.hoy: 'Hoy',
  RangoFechas.semana: 'Esta semana',
  RangoFechas.mes: 'Este mes',
  RangoFechas.mesPasado: 'Mes pasado',
};

/// Primer y último día (AAAA-MM-DD) de un rango rápido.
({String desde, String hasta}) fechasDe(RangoFechas rango) {
  final ahora = DateTime.now();
  final hoy = DateTime(ahora.year, ahora.month, ahora.day);
  switch (rango) {
    case RangoFechas.hoy:
      return (desde: fechaIso(hoy), hasta: fechaIso(hoy));
    case RangoFechas.semana:
      final lunes = hoy.subtract(Duration(days: hoy.weekday - 1));
      return (desde: fechaIso(lunes), hasta: fechaIso(hoy));
    case RangoFechas.mes:
      return (desde: fechaIso(DateTime(hoy.year, hoy.month, 1)), hasta: fechaIso(hoy));
    case RangoFechas.mesPasado:
      // El día 0 de este mes es el último día del mes anterior.
      return (
        desde: fechaIso(DateTime(hoy.year, hoy.month - 1, 1)),
        hasta: fechaIso(DateTime(hoy.year, hoy.month, 0)),
      );
  }
}

/// Las marcaciones del propio auxiliar, con el total de horas del rango.
class MisMarcacionesPage extends ConsumerStatefulWidget {
  const MisMarcacionesPage({super.key});

  @override
  ConsumerState<MisMarcacionesPage> createState() => _MisMarcacionesPageState();
}

class _MisMarcacionesPageState extends ConsumerState<MisMarcacionesPage> {
  RangoFechas _rango = RangoFechas.mes;

  @override
  Widget build(BuildContext context) {
    final fechas = fechasDe(_rango);
    // El servidor ya devuelve solo las del auxiliar que tiene la sesión.
    final FiltroMarcaciones filtro = (
      desde: fechas.desde,
      hasta: fechas.hasta,
      usuario: null,
      lugar: null,
      abiertas: null,
      conRetraso: false,
      retrasoMin: 0,
    );
    final marcaciones = ref.watch(marcacionesProvider(filtro));
    final tema = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Mi historial')),
      body: Column(
        children: [
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              children: [
                for (final rango in [RangoFechas.semana, RangoFechas.mes, RangoFechas.mesPasado])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(etiquetasRango[rango]!),
                      selected: _rango == rango,
                      onSelected: (_) => setState(() => _rango = rango),
                    ),
                  ),
              ],
            ),
          ),
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
                        icono: Icons.history,
                        titulo: 'Sin marcaciones en estas fechas',
                        descripcion: 'Aquí aparecen tus entradas y salidas.',
                      ),
                    ]);
                  }
                  final minutos = lista.fold<int>(0, (suma, m) => suma + (m.minutos ?? 0));
                  final dias = lista.map((m) => m.fecha).toSet().length;
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                    itemCount: lista.length + 1,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      if (i == 0) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Text(
                            '${dias == 1 ? '1 día' : '$dias días'} · ${duracionTexto(minutos)} en total',
                            style: tema.textTheme.titleSmall,
                          ),
                        );
                      }
                      return TarjetaMarcacion(marcacion: lista[i - 1]);
                    },
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
