import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/grilla_laboratorio.dart';
import 'laboratorios_page.dart';

const _estadosElemento = {
  'operativo': ('Operativo', Tono.exito),
  'con_falla': ('Con falla', Tono.peligro),
  'mantenimiento': ('En mantenimiento', Tono.aviso),
  'baja': ('De baja', Tono.neutro),
};

class LaboratorioDetallePage extends ConsumerWidget {
  const LaboratorioDetallePage({super.key, required this.id});
  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final laboratorio = ref.watch(laboratorioProvider(id));
    final verCredenciales = ref.watch(sesionProvider).usuario?.puede('laboratorios.credenciales') ?? false;
    final pestanas = [
      const Tab(text: 'Distribución'),
      const Tab(text: 'Información'),
      if (verCredenciales) const Tab(text: 'Credenciales'),
    ];

    return DefaultTabController(
      length: pestanas.length,
      child: Scaffold(
        appBar: AppBar(
          title: laboratorio.when(
            data: (l) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.codigo),
                Text(
                  l.nombre,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
              ],
            ),
            loading: () => const Text('Laboratorio'),
            error: (_, _) => const Text('Laboratorio'),
          ),
          bottom: TabBar(tabs: pestanas, isScrollable: false),
        ),
        body: laboratorio.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => EstadoError(error: e, onReintentar: () => ref.invalidate(laboratorioProvider(id))),
          data: (l) => TabBarView(
            // La grilla usa el deslizamiento para moverse; las pestañas se cambian tocándolas.
            physics: const NeverScrollableScrollPhysics(),
            children: [
              _Distribucion(laboratorio: l),
              _Informacion(laboratorio: l),
              if (verCredenciales) _Credenciales(laboratorio: l.id),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Distribución ──
class _Distribucion extends ConsumerWidget {
  const _Distribucion({required this.laboratorio});
  final Laboratorio laboratorio;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final distribucion = ref.watch(distribucionProvider(laboratorio.id));
    final tipos = ref.watch(tiposProvider);
    final tema = Theme.of(context);

    if (distribucion.hasError || tipos.hasError) {
      return EstadoError(
        error: distribucion.error ?? tipos.error!,
        onReintentar: () {
          ref.invalidate(distribucionProvider(laboratorio.id));
          ref.invalidate(tiposProvider);
        },
      );
    }
    final d = distribucion.value;
    final t = tipos.value;
    if (d == null || t == null) return const Center(child: CircularProgressIndicator());

    if (d.celdas.isEmpty) {
      return const EstadoVacio(
        icono: Icons.grid_off_outlined,
        titulo: 'Sin distribución',
        descripcion: 'Este laboratorio todavía no tiene elementos dibujados. Se dibuja desde la web.',
      );
    }

    final conteo = <int, int>{};
    for (final c in d.celdas) {
      conteo[c.tipo] = (conteo[c.tipo] ?? 0) + 1;
    }
    final conFalla = d.celdas.where((c) => c.estado == 'con_falla').length;

    return Column(
      children: [
        SizedBox(
          height: 52,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            children: [
              for (final entrada in conteo.entries)
                if (t[entrada.key] != null)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: Chip(
                      visualDensity: VisualDensity.compact,
                      avatar: Icon(
                        iconosElemento[t[entrada.key]!.icono] ?? Icons.category_outlined,
                        size: 18,
                        color: colorDesdeHex(t[entrada.key]!.color),
                      ),
                      label: Text('${t[entrada.key]!.nombre} · ${entrada.value}'),
                    ),
                  ),
              if (conFalla > 0)
                Chip(
                  visualDensity: VisualDensity.compact,
                  avatar: const Icon(Icons.circle, size: 10, color: colorFalla),
                  label: Text('$conFalla con falla'),
                ),
            ],
          ),
        ),
        Expanded(
          child: ClipRect(
            child: GrillaLaboratorio(
              distribucion: d,
              tipos: t,
              onCelda: (c) => _mostrarElemento(context, c, t[c.tipo]),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
          child: Text(
            'Arrastra para moverte y pellizca para acercar. Toca un elemento para ver su ficha.',
            textAlign: TextAlign.center,
            style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
          ),
        ),
      ],
    );
  }
}

void _mostrarElemento(BuildContext context, Celda c, TipoElemento? tipo) {
  final (estadoTexto, estadoTono) = _estadosElemento[c.estado] ?? (c.estado, Tono.neutro);
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    useSafeArea: true,
    builder: (hoja) {
      final tema = Theme.of(hoja);
      final color = colorDesdeHex(tipo?.color ?? '');
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(iconosElemento[tipo?.icono] ?? Icons.category_outlined, color: color),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.etiqueta, style: tema.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                      Text(tipo?.nombre ?? 'Elemento', style: tema.textTheme.bodyMedium),
                    ],
                  ),
                ),
                Etiqueta(estadoTexto, tono: estadoTono),
              ],
            ),
            const SizedBox(height: 12),
            _Dato('Ubicación en la grilla', 'Fila ${c.fila + 1}, columna ${c.columna + 1}'),
            if ((c.ip ?? '').isNotEmpty) _Dato('Dirección IP', c.ip!, copiable: true),
            if (c.mac.isNotEmpty) _Dato('MAC', c.mac, copiable: true),
            if (c.codigoActivo.isNotEmpty) _Dato('Código de activo', c.codigoActivo),
            if (c.especificaciones.isNotEmpty) _Dato('Especificaciones', c.especificaciones),
            if (c.descripcion.isNotEmpty) _Dato('Notas', c.descripcion),
          ],
        ),
      );
    },
  );
}

class _Dato extends StatelessWidget {
  const _Dato(this.titulo, this.valor, {this.copiable = false});
  final String titulo;
  final String valor;
  final bool copiable;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(titulo, style: tema.textTheme.labelMedium?.copyWith(color: tema.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 2),
                SelectableText(valor, style: tema.textTheme.bodyLarge),
              ],
            ),
          ),
          if (copiable)
            IconButton(
              tooltip: 'Copiar',
              icon: const Icon(Icons.copy_outlined, size: 20),
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: valor));
                if (context.mounted) avisar(context, '$titulo copiado.');
              },
            ),
        ],
      ),
    );
  }
}

// ── Información ──
class _Informacion extends StatelessWidget {
  const _Informacion({required this.laboratorio});
  final Laboratorio laboratorio;

  @override
  Widget build(BuildContext context) {
    final l = laboratorio;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Etiqueta(l.estadoNombre, tono: tonoDeLaboratorio(l.estado)),
                ),
                _Dato('Nombre', l.nombre),
                if (l.ubicacion.isNotEmpty) _Dato('Ubicación', l.ubicacion),
                _Dato('Capacidad', '${l.capacidad} puestos'),
                _Dato('Elementos dibujados', '${l.totalElementos}'),
                if (l.notas.isNotEmpty) _Dato('Notas', l.notas),
              ],
            ),
          ),
        ),
        const TituloSeccion('Software instalado'),
        if (l.software.isEmpty)
          Text(
            'No se registró software para este laboratorio.',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
          )
        else
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final s in l.software)
                Chip(
                  visualDensity: VisualDensity.compact,
                  avatar: const Icon(Icons.apps_outlined, size: 16),
                  label: Text(s.nombreCompleto),
                ),
            ],
          ),
      ],
    );
  }
}

// ── Credenciales ──
class _Credenciales extends ConsumerStatefulWidget {
  const _Credenciales({required this.laboratorio});
  final int laboratorio;

  @override
  ConsumerState<_Credenciales> createState() => _CredencialesState();
}

class _CredencialesState extends ConsumerState<_Credenciales> {
  /// Contraseñas visibles ahora mismo (se ocultan solas a los 30 segundos).
  final Map<int, String> _visibles = {};
  final Map<int, Timer> _temporizadores = {};
  final Set<int> _cargando = {};

  @override
  void dispose() {
    for (final t in _temporizadores.values) {
      t.cancel();
    }
    super.dispose();
  }

  Future<void> _revelar(Credencial c) async {
    setState(() => _cargando.add(c.id));
    try {
      final password = await ref.read(repositorioProvider).revelarCredencial(c.id);
      if (!mounted) return;
      _temporizadores[c.id]?.cancel();
      _temporizadores[c.id] = Timer(const Duration(seconds: 30), () {
        if (mounted) setState(() => _visibles.remove(c.id));
      });
      setState(() => _visibles[c.id] = password);
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _cargando.remove(c.id));
    }
  }

  void _ocultar(int id) {
    _temporizadores.remove(id)?.cancel();
    setState(() => _visibles.remove(id));
  }

  Future<void> _copiar(String texto, String que) async {
    await Clipboard.setData(ClipboardData(text: texto));
    if (mounted) avisar(context, '$que copiado.');
  }

  @override
  Widget build(BuildContext context) {
    final credenciales = ref.watch(credencialesProvider(widget.laboratorio));
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;

    return credenciales.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => EstadoError(
        error: e,
        onReintentar: () => ref.invalidate(credencialesProvider(widget.laboratorio)),
      ),
      data: (lista) {
        if (lista.isEmpty) {
          return const EstadoVacio(
            icono: Icons.key_off_outlined,
            titulo: 'Sin credenciales',
            descripcion: 'El administrador puede guardarlas desde la web (Wi-Fi, cuenta local de las PC, BIOS…).',
          );
        }
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: esquema.secondaryContainer.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(Icons.shield_outlined, size: 20, color: esquema.onSecondaryContainer),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Cada vez que muestras una contraseña queda registrado quién y cuándo la vio.',
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSecondaryContainer),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            for (final c in lista) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.descripcion, style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.person_outline, size: 18),
                          const SizedBox(width: 8),
                          Expanded(child: SelectableText(c.usuario.isEmpty ? '—' : c.usuario)),
                          if (c.usuario.isNotEmpty)
                            IconButton(
                              tooltip: 'Copiar usuario',
                              icon: const Icon(Icons.copy_outlined, size: 18),
                              onPressed: () => _copiar(c.usuario, 'Usuario'),
                            ),
                        ],
                      ),
                      if (c.tienePassword)
                        Row(
                          children: [
                            const Icon(Icons.key_outlined, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _visibles.containsKey(c.id)
                                  ? SelectableText(
                                      _visibles[c.id]!,
                                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600),
                                    )
                                  : const Text('••••••••••'),
                            ),
                            if (_cargando.contains(c.id))
                              const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                              )
                            else if (_visibles.containsKey(c.id)) ...[
                              IconButton(
                                tooltip: 'Copiar contraseña',
                                icon: const Icon(Icons.copy_outlined, size: 18),
                                onPressed: () => _copiar(_visibles[c.id]!, 'Contraseña'),
                              ),
                              IconButton(
                                tooltip: 'Ocultar',
                                icon: const Icon(Icons.visibility_off_outlined, size: 18),
                                onPressed: () => _ocultar(c.id),
                              ),
                            ] else
                              TextButton(onPressed: () => _revelar(c), child: const Text('Mostrar')),
                          ],
                        ),
                      if (c.notas.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 6, right: 8),
                          child: Text(
                            c.notas,
                            style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
          ],
        );
      },
    );
  }
}
