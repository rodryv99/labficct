import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'bitacora_page.dart';
import 'mapa_bitacora.dart';

/// Una entrada de la bitácora: datos, mapa pintado y exportar para compartir (WhatsApp, correo…).
class EntradaBitacoraPage extends ConsumerStatefulWidget {
  const EntradaBitacoraPage({super.key, required this.id});
  final int id;

  @override
  ConsumerState<EntradaBitacoraPage> createState() => _EntradaBitacoraPageState();
}

class _EntradaBitacoraPageState extends ConsumerState<EntradaBitacoraPage> {
  bool _ocupado = false;

  Future<void> _exportar(EntradaBitacora e, String formato) async {
    setState(() => _ocupado = true);
    try {
      final archivo = await ref.read(repositorioProvider).exportarEntradaBitacora(e.id, formato);
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(archivo.bytes, mimeType: archivo.tipo, name: archivo.nombre)],
          fileNameOverrides: [archivo.nombre],
          subject: '${e.laboratorioCodigo} · ${e.titulo}',
        ),
      );
    } catch (error) {
      if (mounted) avisar(context, mensajeDeError(error), error: true);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _eliminar(EntradaBitacora e) async {
    final si = await showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: Text('¿Eliminar «${e.titulo}»?'),
        content: const Text('La entrada se borra de la bitácora y no se puede recuperar.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(dialogo, true), child: const Text('Eliminar')),
        ],
      ),
    );
    if (si != true || !mounted) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _ocupado = true);
    try {
      await ref.read(repositorioProvider).eliminarEntradaBitacora(e.id);
      contenedor.invalidate(bitacoraProvider(e.laboratorio));
      if (!mounted) return;
      avisar(context, 'Entrada eliminada.');
      context.pop();
    } catch (error) {
      if (mounted) {
        avisar(context, mensajeDeError(error), error: true);
        setState(() => _ocupado = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final entrada = ref.watch(entradaBitacoraProvider(widget.id));
    final tema = Theme.of(context);
    final e = entrada.value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bitácora'),
        actions: [
          if (e != null)
            PopupMenuButton<String>(
              tooltip: 'Exportar o compartir',
              icon: _ocupado
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.share_outlined),
              enabled: !_ocupado,
              onSelected: (formato) => _exportar(e, formato),
              itemBuilder: (_) => [
                if (e.mapa != null) const PopupMenuItem(value: 'jpg', child: Text('Imagen (JPG)')),
                if (e.mapa != null) const PopupMenuItem(value: 'pdf', child: Text('PDF')),
                const PopupMenuItem(value: 'json', child: Text('Archivo de bitácora (para importar)')),
              ],
            ),
          if (e != null && e.editable)
            PopupMenuButton<String>(
              enabled: !_ocupado,
              onSelected: (accion) {
                if (accion == 'editar') {
                  context.push('/bitacora/${e.id}/editar');
                } else {
                  _eliminar(e);
                }
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'editar', child: Text('Editar')),
                PopupMenuItem(value: 'eliminar', child: Text('Eliminar')),
              ],
            ),
        ],
      ),
      body: entrada.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => EstadoError(error: error, onReintentar: () => ref.invalidate(entradaBitacoraProvider(widget.id))),
        data: (e) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                Etiqueta(e.tipoNombre, tono: tonoDeBitacora(e.tipo)),
                Etiqueta(e.laboratorioCodigo, tono: Tono.marca),
              ],
            ),
            const SizedBox(height: 10),
            Text(e.titulo, style: tema.textTheme.headlineSmall),
            const SizedBox(height: 4),
            Text(
              [if (e.fecha != null) fechaHora(e.fecha!), 'Registró ${e.autorNombre}'].join(' · '),
              style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
            ),
            if (e.elementos.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Elementos: ${e.elementos}', style: tema.textTheme.bodyMedium),
            ],
            const SizedBox(height: 12),
            Text(
              e.descripcion.isEmpty ? 'Sin descripción.' : e.descripcion,
              style: e.descripcion.isEmpty
                  ? tema.textTheme.bodyMedium?.copyWith(color: tema.colorScheme.onSurfaceVariant)
                  : tema.textTheme.bodyLarge,
            ),
            if (e.mapa != null) ...[
              const TituloSeccion('Mapa del laboratorio'),
              LeyendaMapa(mapa: e.mapa!, atributos: e.mapa!.atributos, marcas: e.mapa!.marcas),
              const SizedBox(height: 10),
              MapaBitacoraVista(mapa: e.mapa!, atributos: e.mapa!.atributos, marcas: e.mapa!.marcas, alto: 420),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => VerMapaPage(
                      mapa: e.mapa!,
                      atributos: e.mapa!.atributos,
                      marcas: e.mapa!.marcas,
                      titulo: e.laboratorioNombre.isEmpty ? 'Mapa del laboratorio' : e.laboratorioNombre,
                    ),
                  ),
                ),
                icon: const Icon(Icons.fullscreen),
                label: const Text('Ver en pantalla completa'),
              ),
              const SizedBox(height: 6),
              Text(
                'Toca un elemento para ver su ficha. Comparte el mapa desde el botón de arriba.',
                style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
