import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';

/// Tipos de entrada de la bitácora (iguales a los del servidor).
const tiposBitacora = {
  'instalacion': 'Instalación de programas',
  'revision': 'Revisión de equipos',
  'mantenimiento': 'Mantenimiento',
  'incidencia': 'Falla o incidencia',
  'limpieza': 'Limpieza',
  'otro': 'Otro',
};

Tono tonoDeBitacora(String tipo) => switch (tipo) {
      'instalacion' => Tono.marca,
      'revision' => Tono.info,
      'mantenimiento' => Tono.aviso,
      'incidencia' => Tono.peligro,
      'limpieza' => Tono.exito,
      _ => Tono.neutro,
    };

/// Bitácora de un laboratorio: lo que se hizo o pasó, con mapa pintado si lo tiene.
class BitacoraPage extends ConsumerWidget {
  const BitacoraPage({super.key, required this.laboratorioId});
  final int laboratorioId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entradas = ref.watch(bitacoraProvider(laboratorioId));
    final codigo = ref.watch(laboratorioProvider(laboratorioId)).value?.codigo;
    final registra = ref.watch(sesionProvider).usuario?.puede('bitacora.gestionar') ?? false;

    return Scaffold(
      appBar: AppBar(
        title: Text(codigo == null ? 'Bitácora' : 'Bitácora · $codigo'),
        actions: [
          if (registra)
            IconButton(
              tooltip: 'Importar archivo de bitácora',
              icon: const Icon(Icons.file_upload_outlined),
              onPressed: () => _importar(context, ref, laboratorioId),
            ),
        ],
      ),
      floatingActionButton: registra
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/bitacora/nueva?lab=$laboratorioId'),
              icon: const Icon(Icons.add),
              label: const Text('Registrar'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(bitacoraProvider(laboratorioId).future),
        child: entradas.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(bitacoraProvider(laboratorioId))),
          ]),
          data: (lista) {
            if (lista.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 80),
                EstadoVacio(
                  icono: Icons.menu_book_outlined,
                  titulo: 'La bitácora está vacía',
                  descripcion: 'Registra instalaciones, revisiones de equipos, fallas y limpiezas. '
                      'En una revisión puedes pintar el mapa del laboratorio.',
                ),
              ]);
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              itemCount: lista.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _TarjetaEntrada(entrada: lista[i]),
            );
          },
        ),
      ),
    );
  }
}

/// Elige un archivo .bitacora.json y lo importa a este laboratorio.
Future<void> _importar(BuildContext context, WidgetRef ref, int laboratorio) async {
  final List<PlatformFile> elegido;
  try {
    elegido = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['json'],
    );
  } catch (e) {
    if (context.mounted) avisar(context, 'No se pudo abrir el selector de archivos.', error: true);
    return;
  }
  if (elegido.isEmpty) return;
  Uint8List bytes;
  try {
    bytes = await elegido.first.readAsBytes();
  } catch (_) {
    if (context.mounted) avisar(context, 'No se pudo leer el archivo.', error: true);
    return;
  }
  Object contenido;
  try {
    contenido = jsonDecode(utf8.decode(bytes));
  } catch (_) {
    if (context.mounted) avisar(context, 'El archivo no es un .bitacora.json válido.', error: true);
    return;
  }
  final contenedor = ProviderScope.containerOf(context, listen: false);
  try {
    final entrada = await ref.read(repositorioProvider).importarBitacora(contenido, laboratorio: laboratorio);
    contenedor.invalidate(bitacoraProvider(laboratorio));
    if (!context.mounted) return;
    avisar(context, 'Entrada importada.');
    context.push('/bitacora/${entrada.id}');
  } catch (e) {
    if (context.mounted) avisar(context, mensajeDeError(e), error: true);
  }
}

class _TarjetaEntrada extends StatelessWidget {
  const _TarjetaEntrada({required this.entrada});
  final EntradaBitacora entrada;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final e = entrada;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/bitacora/${e.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Etiqueta(e.tipoNombre, tono: tonoDeBitacora(e.tipo)),
                  if (e.mapa != null) const Etiqueta('Con mapa', tono: Tono.info),
                ],
              ),
              const SizedBox(height: 8),
              Text(e.titulo, style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
              if (e.descripcion.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(e.descripcion, maxLines: 2, overflow: TextOverflow.ellipsis, style: tema.textTheme.bodyMedium),
              ],
              const SizedBox(height: 6),
              Text(
                [if (e.fecha != null) fechaHora(e.fecha!), e.autorNombre].join(' · '),
                style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
