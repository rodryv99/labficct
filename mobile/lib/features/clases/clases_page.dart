import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/theme/tema.dart';
import '../../shared/widgets/comunes.dart';
import '../notificaciones/notificaciones_page.dart';
import '../perfil/perfil_sheet.dart';

const _dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/// 4. Horarios, vistos por quien no gestiona la pizarra:
/// el docente ve sus clases y el administrativo, todas las del periodo vigente.
class ClasesPage extends ConsumerWidget {
  const ClasesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(sesionProvider).usuario;
    final esDocente = usuario?.rol == 'docente';
    final conPreferencias = esDocente && (usuario?.puede('preferencias.propias') ?? false);
    final clases = ref.watch(misClasesProvider);
    final hoy = DateTime.now().weekday;

    return Scaffold(
      appBar: AppBar(
        title: Text(esDocente ? 'Mis clases' : 'Horarios'),
        actions: [
          if (conPreferencias)
            IconButton(
              tooltip: 'Mis preferencias',
              onPressed: () => context.push('/preferencias'),
              icon: const Icon(Icons.tune),
            ),
          const BotonNotificaciones(),
          const BotonPerfil(),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(misClasesProvider.future),
        child: clases.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(misClasesProvider)),
          ]),
          data: (lista) {
            if (lista.isEmpty) {
              return ListView(children: [
                const SizedBox(height: 80),
                EstadoVacio(
                  icono: Icons.school_outlined,
                  titulo: esDocente ? 'No tienes clases asignadas' : 'No hay clases registradas',
                  descripcion: esDocente
                      ? 'Si falta alguna, pídele al administrador de laboratorios que la registre.'
                      : 'Todavía no se cargaron los horarios del periodo.',
                ),
              ]);
            }

            final porDia = <int, List<Horario>>{};
            for (final h in lista) {
              porDia.putIfAbsent(h.diaSemana, () => []).add(h);
            }
            for (final l in porDia.values) {
              l.sort((a, b) => minutosDe(a.horaInicio).compareTo(minutosDe(b.horaInicio)));
            }
            // Empieza por hoy y sigue en orden: lo más útil queda arriba.
            final dias = porDia.keys.toList()..sort((a, b) => ((a - hoy) % 7).compareTo((b - hoy) % 7));
            final deHoy = porDia[hoy]?.length ?? 0;

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                _Resumen(clasesHoy: deHoy, total: lista.length, esDocente: esDocente),
                for (final d in dias) ...[
                  TituloSeccion(d == hoy ? 'Hoy · ${_dias[d - 1]}' : _dias[d - 1]),
                  for (final h in porDia[d]!) ...[
                    _TarjetaClase(horario: h, esHoy: d == hoy, mostrarDocente: !esDocente),
                    const SizedBox(height: 8),
                  ],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Resumen extends StatelessWidget {
  const _Resumen({required this.clasesHoy, required this.total, required this.esDocente});
  final int clasesHoy;
  final int total;
  final bool esDocente;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final texto = clasesHoy == 0
        ? (esDocente ? 'Hoy no tienes clases en laboratorio.' : 'Hoy no hay clases en laboratorio.')
        : '${esDocente ? 'Hoy tienes' : 'Hoy hay'} $clasesHoy ${clasesHoy == 1 ? 'clase' : 'clases'} en laboratorio.';
    return Container(
      margin: const EdgeInsets.only(top: 4, bottom: 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: esquema.primaryContainer, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          Icon(Icons.today_outlined, color: esquema.onPrimaryContainer),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(texto, style: tema.textTheme.titleSmall?.copyWith(color: esquema.onPrimaryContainer)),
                Text(
                  '$total ${total == 1 ? 'clase' : 'clases'} por semana en el periodo vigente',
                  style: tema.textTheme.bodySmall?.copyWith(color: esquema.onPrimaryContainer),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TarjetaClase extends StatelessWidget {
  const _TarjetaClase({required this.horario, required this.esHoy, required this.mostrarDocente});
  final Horario horario;
  final bool esHoy;
  final bool mostrarDocente;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final h = horario;
    final ahora = minutosAhora();
    final enCurso = esHoy && minutosDe(h.horaInicio) <= ahora && ahora < minutosDe(h.horaFin);

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: enCurso ? ColoresFicct.clase : esquema.outlineVariant, width: enCurso ? 1.5 : 1),
      ),
      child: InkWell(
        onTap: () => context.push('/laboratorio/${h.laboratorio}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              SizedBox(
                width: 52,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(h.horaInicio, style: tema.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
                    Text(h.horaFin, style: tema.textTheme.labelMedium?.copyWith(color: esquema.onSurfaceVariant)),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${h.materiaSigla} · ${h.grupo}',
                      style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      mostrarDocente && h.docenteNombre.isNotEmpty
                          ? '${h.materiaNombre} · ${h.docenteNombre}'
                          : h.materiaNombre,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      children: [
                        Etiqueta(h.laboratorioCodigo),
                        if (enCurso) const Etiqueta('En curso', tono: Tono.exito),
                      ],
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: esquema.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
