import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/seleccion.dart';
import '../notificaciones/notificaciones_page.dart';
import '../perfil/perfil_sheet.dart';
import 'inventario_comun.dart';

/// 15. Inventario de activos fijos: qué hay, dónde está, sus movimientos y las
/// verificaciones. Dos pestañas: Activos y Verificaciones.
class InventarioPage extends ConsumerStatefulWidget {
  const InventarioPage({super.key});

  @override
  ConsumerState<InventarioPage> createState() => _InventarioPageState();
}

class _InventarioPageState extends ConsumerState<InventarioPage> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this)..addListener(_alCambiarTab);

  // Filtros de activos (se comparten con la exportación).
  String _buscar = '';
  int? _tipo;
  int? _lugar;
  String _estado = '';
  Timer? _espera;

  // Filtros de verificaciones.
  String _estadoV = '';
  bool _soloMias = false;

  String? _exportando;

  void _alCambiarTab() {
    if (!_tabs.indexIsChanging) setState(() {});
  }

  @override
  void dispose() {
    _tabs.removeListener(_alCambiarTab);
    _tabs.dispose();
    _espera?.cancel();
    super.dispose();
  }

  void _alEscribir(String texto) {
    _espera?.cancel();
    _espera = Timer(const Duration(milliseconds: 350), () {
      if (mounted) setState(() => _buscar = texto.trim());
    });
  }

  FiltroActivos get _filtroActivos => (
        buscar: _buscar,
        tipos: _tipo == null ? '' : '$_tipo',
        lugares: _lugar == null ? '' : '$_lugar',
        estado: _estado,
        ordering: 'codigo',
      );

  Future<void> _exportar(String formato) async {
    setState(() => _exportando = formato);
    try {
      final archivo = await ref.read(repositorioProvider).exportarActivos(
            formato,
            buscar: _buscar,
            tipos: _tipo == null ? '' : '$_tipo',
            lugares: _lugar == null ? '' : '$_lugar',
            estado: _estado,
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

  @override
  Widget build(BuildContext context) {
    final gestionar = ref.watch(sesionProvider).usuario?.puede('inventario.gestionar') ?? false;
    final enActivos = _tabs.index == 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventario'),
        actions: [
          _MenuInventario(
            gestionar: gestionar,
            exportando: _exportando,
            onExportar: _exportar,
          ),
          const BotonNotificaciones(),
          const BotonPerfil(),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'Activos'), Tab(text: 'Verificaciones')],
        ),
      ),
      floatingActionButton: !gestionar
          ? null
          : enActivos
              ? FloatingActionButton.extended(
                  onPressed: () => context.push('/inventario/activo/nuevo'),
                  icon: const Icon(Icons.add),
                  label: const Text('Registrar'),
                )
              : FloatingActionButton.extended(
                  onPressed: () => context.push('/inventario/verificacion/nueva'),
                  icon: const Icon(Icons.fact_check_outlined),
                  label: const Text('Pedir verificación'),
                ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _TabActivos(
            filtro: _filtroActivos,
            buscar: _buscar,
            tipo: _tipo,
            lugar: _lugar,
            estado: _estado,
            onBuscar: _alEscribir,
            onTipo: (v) => setState(() => _tipo = v),
            onLugar: (v) => setState(() => _lugar = v),
            onEstado: (v) => setState(() => _estado = v),
          ),
          _TabVerificaciones(
            estado: _estadoV,
            soloMias: _soloMias,
            onEstado: (v) => setState(() => _estadoV = v),
            onSoloMias: (v) => setState(() => _soloMias = v),
          ),
        ],
      ),
    );
  }
}

/// Menú de la barra superior: exportar y, para el Admin, catálogos.
class _MenuInventario extends StatelessWidget {
  const _MenuInventario({required this.gestionar, required this.exportando, required this.onExportar});

  final bool gestionar;
  final String? exportando;
  final void Function(String formato) onExportar;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: 'Más opciones',
      icon: exportando != null
          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
          : const Icon(Icons.more_vert),
      onSelected: (valor) {
        switch (valor) {
          case 'xlsx' || 'csv' || 'pdf':
            onExportar(valor);
          case 'importar':
            context.push('/inventario/importar');
          case 'tipos':
            context.push('/inventario/tipos');
          case 'lugares':
            context.push('/inventario/lugares');
        }
      },
      itemBuilder: (_) => [
        const PopupMenuItem(value: 'xlsx', child: Text('Exportar a Excel')),
        const PopupMenuItem(value: 'csv', child: Text('Exportar a CSV')),
        const PopupMenuItem(value: 'pdf', child: Text('Exportar a PDF')),
        if (gestionar) ...[
          const PopupMenuDivider(),
          const PopupMenuItem(value: 'importar', child: Text('Importar de Excel o CSV')),
          const PopupMenuItem(value: 'tipos', child: Text('Tipos de activo')),
          const PopupMenuItem(value: 'lugares', child: Text('Lugares')),
        ],
      ],
    );
  }
}

// ── Pestaña de activos ──

class _TabActivos extends ConsumerWidget {
  const _TabActivos({
    required this.filtro,
    required this.buscar,
    required this.tipo,
    required this.lugar,
    required this.estado,
    required this.onBuscar,
    required this.onTipo,
    required this.onLugar,
    required this.onEstado,
  });

  final FiltroActivos filtro;
  final String buscar;
  final int? tipo;
  final int? lugar;
  final String estado;
  final ValueChanged<String> onBuscar;
  final ValueChanged<int?> onTipo;
  final ValueChanged<int?> onLugar;
  final ValueChanged<String> onEstado;

  String get _etiquetaEstado => switch (estado) {
        '' => 'En inventario',
        'todos' => 'Todos',
        _ => estadosActivo.firstWhere((e) => e.$1 == estado, orElse: () => ('', 'Estado')).$2,
      };

  Future<void> _elegirTipo(BuildContext context, WidgetRef ref) async {
    final tipos = await ref.read(tiposActivoProvider.future);
    if (!context.mounted) return;
    final elegido = await seleccionar(
      context,
      titulo: 'Filtrar por tipo',
      multiple: false,
      seleccion: tipo == null ? const {} : {tipo!},
      opciones: Future.value([
        const OpcionSeleccion(0, 'Todos los tipos'),
        for (final t in tipos) OpcionSeleccion(t.id, t.nombre, '${t.totalActivos} activos'),
      ]),
    );
    if (elegido != null) onTipo(elegido.contains(0) || elegido.isEmpty ? null : elegido.first);
  }

  Future<void> _elegirLugar(BuildContext context, WidgetRef ref) async {
    final lugares = await ref.read(lugaresProvider.future);
    if (!context.mounted) return;
    final elegido = await seleccionar(
      context,
      titulo: 'Filtrar por lugar',
      multiple: false,
      seleccion: lugar == null ? const {} : {lugar!},
      opciones: Future.value([
        const OpcionSeleccion(0, 'Todos los lugares'),
        for (final l in lugares) OpcionSeleccion(l.id, l.nombre, '${l.totalActivos} activos'),
      ]),
    );
    if (elegido != null) onLugar(elegido.contains(0) || elegido.isEmpty ? null : elegido.first);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activos = ref.watch(activosProvider(filtro));
    final tiposMapa = ref.watch(tiposActivoProvider).value ?? const [];
    final lugaresMapa = ref.watch(lugaresProvider).value ?? const [];
    final nombreTipo = tipo == null
        ? 'Tipo'
        : tiposMapa.where((t) => t.id == tipo).map((t) => t.nombre).firstOrNull ?? 'Tipo';
    final nombreLugar = lugar == null
        ? 'Lugar'
        : lugaresMapa.where((l) => l.id == lugar).map((l) => l.nombre).firstOrNull ?? 'Lugar';
    final hayFiltros = buscar.isNotEmpty || tipo != null || lugar != null || estado.isNotEmpty;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: TextField(
            onChanged: onBuscar,
            decoration: const InputDecoration(
              hintText: 'Buscar por código, descripción, marca o serie',
              prefixIcon: Icon(Icons.search),
            ),
          ),
        ),
        SizedBox(
          height: 46,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            children: [
              _ChipFiltro(
                etiqueta: nombreTipo,
                activo: tipo != null,
                onTap: () => _elegirTipo(context, ref),
                onQuitar: tipo == null ? null : () => onTipo(null),
              ),
              const SizedBox(width: 8),
              _ChipFiltro(
                etiqueta: nombreLugar,
                activo: lugar != null,
                onTap: () => _elegirLugar(context, ref),
                onQuitar: lugar == null ? null : () => onLugar(null),
              ),
              const SizedBox(width: 8),
              _ChipEstado(etiqueta: _etiquetaEstado, activo: estado.isNotEmpty, onElegir: onEstado),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(activosProvider(filtro).future),
            child: activos.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ListView(children: [
                const SizedBox(height: 80),
                EstadoError(error: e, onReintentar: () => ref.invalidate(activosProvider(filtro))),
              ]),
              data: (lista) {
                if (lista.isEmpty) {
                  return ListView(children: [
                    const SizedBox(height: 80),
                    EstadoVacio(
                      icono: Icons.inventory_outlined,
                      titulo: hayFiltros ? 'Ningún activo coincide' : 'Todavía no hay activos',
                      descripcion: hayFiltros
                          ? 'Prueba con otra búsqueda o quita algún filtro.'
                          : 'El jefe de laboratorio registra aquí los activos de los laboratorios.',
                    ),
                  ]);
                }
                return ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  itemCount: lista.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _TarjetaActivo(activo: lista[i]),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _ChipFiltro extends StatelessWidget {
  const _ChipFiltro({required this.etiqueta, required this.activo, required this.onTap, this.onQuitar});

  final String etiqueta;
  final bool activo;
  final VoidCallback onTap;
  final VoidCallback? onQuitar;

  @override
  Widget build(BuildContext context) {
    return InputChip(
      label: Text(etiqueta, overflow: TextOverflow.ellipsis),
      avatar: activo ? null : const Icon(Icons.arrow_drop_down, size: 20),
      selected: activo,
      showCheckmark: false,
      onSelected: (_) => onTap(),
      onDeleted: onQuitar,
    );
  }
}

class _ChipEstado extends StatelessWidget {
  const _ChipEstado({required this.etiqueta, required this.activo, required this.onElegir});

  final String etiqueta;
  final bool activo;
  final ValueChanged<String> onElegir;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    return PopupMenuButton<String>(
      tooltip: 'Estado',
      onSelected: onElegir,
      itemBuilder: (_) => [
        const PopupMenuItem(value: '', child: Text('En inventario (sin bajas)')),
        for (final (valor, nombre) in estadosActivo) PopupMenuItem(value: valor, child: Text(nombre)),
        const PopupMenuItem(value: 'todos', child: Text('Todos, con las bajas')),
      ],
      child: Chip(
        label: Text(etiqueta),
        avatar: const Icon(Icons.arrow_drop_down, size: 20),
        backgroundColor: activo ? esquema.secondaryContainer : null,
      ),
    );
  }
}

class _TarjetaActivo extends StatelessWidget {
  const _TarjetaActivo({required this.activo});
  final Activo activo;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final a = activo;
    final detalle = [a.marca, a.modelo, if (a.serie.isNotEmpty) 'Serie ${a.serie}'].where((x) => x.isNotEmpty).join(' · ');

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/inventario/activo/${a.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(a.codigo, style: tema.textTheme.labelMedium?.copyWith(color: esquema.primary)),
                  const Spacer(),
                  Etiqueta(a.estadoNombre, tono: tonoDeEstadoActivo(a.estado)),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                a.descripcion,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 2),
              Text(
                [if (a.tipoNombre.isNotEmpty) a.tipoNombre, a.lugarNombre].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
              ),
              if (detalle.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  detalle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Pestaña de verificaciones ──

class _TabVerificaciones extends ConsumerWidget {
  const _TabVerificaciones({
    required this.estado,
    required this.soloMias,
    required this.onEstado,
    required this.onSoloMias,
  });

  final String estado;
  final bool soloMias;
  final ValueChanged<String> onEstado;
  final ValueChanged<bool> onSoloMias;

  static const _estados = <(String, String)>[
    ('', 'Todas'),
    ('abierta', 'Abiertas'),
    ('cerrada', 'Cerradas'),
    ('cancelada', 'Canceladas'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filtro = (estado: estado, mias: soloMias);
    final verificaciones = ref.watch(verificacionesProvider(filtro));

    return Column(
      children: [
        SizedBox(
          height: 46,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            children: [
              for (final (valor, nombre) in _estados) ...[
                ChoiceChip(
                  label: Text(nombre),
                  selected: estado == valor,
                  onSelected: (_) => onEstado(valor),
                ),
                const SizedBox(width: 6),
              ],
              const SizedBox(width: 2),
              FilterChip(
                label: const Text('Solo las mías'),
                selected: soloMias,
                onSelected: onSoloMias,
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(verificacionesProvider(filtro).future),
            child: verificaciones.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ListView(children: [
                const SizedBox(height: 80),
                EstadoError(error: e, onReintentar: () => ref.invalidate(verificacionesProvider(filtro))),
              ]),
              data: (lista) {
                if (lista.isEmpty) {
                  return ListView(children: [
                    const SizedBox(height: 80),
                    EstadoVacio(
                      icono: Icons.fact_check_outlined,
                      titulo: estado.isNotEmpty || soloMias ? 'Ninguna verificación coincide' : 'Todavía no hay verificaciones',
                      descripcion:
                          'El jefe de laboratorio pide verificaciones para revisar si los activos están donde deberían.',
                    ),
                  ]);
                }
                return ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  itemCount: lista.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _TarjetaVerificacion(verificacion: lista[i]),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _TarjetaVerificacion extends StatelessWidget {
  const _TarjetaVerificacion({required this.verificacion});
  final Verificacion verificacion;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final v = verificacion;
    final c = v.conteo;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/inventario/verificacion/${v.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      v.titulo,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Etiqueta(v.estadoNombre, tono: tonoDeVerificacion(v.estado)),
                ],
              ),
              if (v.alcance.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  v.alcance,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                ),
              ],
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: c.total == 0 ? 0 : v.progreso / 100,
                  minHeight: 7,
                  color: v.cerrada ? Colors.green.shade600 : esquema.primary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '${c.revisados} de ${c.total} revisados',
                style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
              ),
              if (c.revisados > 0 && c.hayDiferencias) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (c.falta > 0) Etiqueta('${c.falta} faltan', tono: Tono.peligro),
                    if (c.otroLugar > 0) Etiqueta('${c.otroLugar} en otro lugar', tono: Tono.aviso),
                    if (c.danado > 0) Etiqueta('${c.danado} dañados', tono: Tono.aviso),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
