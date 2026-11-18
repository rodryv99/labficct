import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';

/// Respaldos (copias de seguridad) de la base de datos, para el Admin.
class RespaldosPage extends ConsumerStatefulWidget {
  const RespaldosPage({super.key});

  @override
  ConsumerState<RespaldosPage> createState() => _RespaldosPageState();
}

class _RespaldosPageState extends ConsumerState<RespaldosPage> {
  bool _generando = false;
  int? _descargando;

  Future<void> _generar() async {
    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _generando = true);
    try {
      final r = await ref.read(repositorioProvider).generarRespaldo();
      refrescarRespaldos(contenedor);
      if (mounted) avisar(context, 'Respaldo creado: ${r.archivo}');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _generando = false);
    }
  }

  Future<void> _descargar(Respaldo r) async {
    setState(() => _descargando = r.id);
    try {
      final archivo = await ref.read(repositorioProvider).descargarRespaldo(r);
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(archivo.bytes, mimeType: archivo.tipo, name: archivo.nombre)],
        ),
      );
    } catch (e) {
      if (mounted) avisar(context, 'No se pudo descargar. ${mensajeDeError(e)}', error: true);
    } finally {
      if (mounted) setState(() => _descargando = null);
    }
  }

  Future<void> _eliminar(Respaldo r) async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: const Text('¿Eliminar este respaldo?'),
        content: Text('Se borrará el archivo «${r.archivo}» del servidor. No se puede deshacer.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(dialogo, true), child: const Text('Eliminar')),
        ],
      ),
    );
    if (confirmar != true || !mounted) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarRespaldo(r.id);
      refrescarRespaldos(contenedor);
      if (mounted) avisar(context, 'Respaldo eliminado.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final estado = ref.watch(estadoRespaldosProvider);
    final lista = ref.watch(respaldosProvider);
    final disponible = estado.value?.pgDumpDisponible ?? true;

    return Scaffold(
      appBar: AppBar(title: const Text('Respaldos')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: (!disponible || _generando) ? null : _generar,
        icon: _generando
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.backup_outlined),
        label: Text(_generando ? 'Creando…' : 'Generar respaldo'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(estadoRespaldosProvider);
          await ref.refresh(respaldosProvider.future);
        },
        child: lista.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(respaldosProvider)),
          ]),
          data: (respaldos) {
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
              children: [
                if (!disponible)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _Aviso(
                      'El servidor todavía no puede crear respaldos porque le falta pg_dump. Reconstruye la '
                      'imagen del backend (docker compose build backend worker) y vuelve a entrar.',
                    ),
                  )
                else if (estado.value != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      'Se conservan los ${estado.value!.maximos} respaldos más recientes.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                if (respaldos.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 64),
                    child: EstadoVacio(
                      icono: Icons.backup_outlined,
                      titulo: 'Todavía no hay respaldos',
                      descripcion: 'Crea el primero con el botón «Generar respaldo».',
                    ),
                  )
                else
                  for (final r in respaldos)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _TarjetaRespaldo(
                        respaldo: r,
                        descargando: _descargando == r.id,
                        onDescargar: () => _descargar(r),
                        onEliminar: () => _eliminar(r),
                      ),
                    ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TarjetaRespaldo extends StatelessWidget {
  const _TarjetaRespaldo({
    required this.respaldo,
    required this.descargando,
    required this.onDescargar,
    required this.onEliminar,
  });
  final Respaldo respaldo;
  final bool descargando;
  final VoidCallback onDescargar;
  final VoidCallback onEliminar;

  @override
  Widget build(BuildContext context) {
    final r = respaldo;
    final tema = Theme.of(context);
    final gris = tema.colorScheme.onSurfaceVariant;
    final fecha = r.creadoEn;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          r.archivo,
                          style: tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (r.origen == 'automatico') ...[
                        const SizedBox(width: 6),
                        const Etiqueta('Automático', tono: Tono.info),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${r.tamano}${fecha != null ? ' · ${fechaLarga(fecha)} ${hora(fecha)}' : ''}'
                    '${r.creadoPorNombre.isNotEmpty ? ' · ${r.creadoPorNombre}' : ''}',
                    style: tema.textTheme.bodySmall?.copyWith(color: gris),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Descargar / compartir',
              onPressed: descargando ? null : onDescargar,
              icon: descargando
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.file_download_outlined),
            ),
            IconButton(
              tooltip: 'Eliminar',
              onPressed: onEliminar,
              icon: const Icon(Icons.delete_outline),
            ),
          ],
        ),
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
