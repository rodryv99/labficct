import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'objetos_page.dart';

class ObjetoDetallePage extends ConsumerStatefulWidget {
  const ObjetoDetallePage({super.key, required this.id});
  final int id;

  @override
  ConsumerState<ObjetoDetallePage> createState() => _ObjetoDetallePageState();
}

class _ObjetoDetallePageState extends ConsumerState<ObjetoDetallePage> {
  bool _trabajando = false;

  void _actualizado(String mensaje) {
    ref.invalidate(objetoProvider(widget.id));
    ref.invalidate(objetosProvider);
    avisar(context, mensaje);
  }

  Future<void> _entregar(ObjetoPerdido o) async {
    final datos = await showModalBottomSheet<DatosEntrega>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => _HojaEntrega(objeto: o),
    );
    if (datos == null || !mounted) return;
    setState(() => _trabajando = true);
    try {
      await ref.read(repositorioProvider).entregarObjeto(o.id, datos);
      if (mounted) _actualizado('Entrega registrada.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _trabajando = false);
    }
  }

  Future<void> _anular(ObjetoPerdido o) async {
    final motivo = await pedirTexto(
      context,
      titulo: 'Anular ${o.codigo}',
      mensaje: 'El registro no se borra: queda marcado como anulado, con el motivo y tu nombre.',
      etiqueta: 'Motivo',
      boton: 'Anular',
      obligatorio: true,
      peligro: true,
      maximo: 500,
    );
    if (motivo == null || !mounted) return;
    setState(() => _trabajando = true);
    try {
      await ref.read(repositorioProvider).anularObjeto(o.id, motivo);
      if (mounted) _actualizado('Registro anulado.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _trabajando = false);
    }
  }

  void _verFoto(String url) => _pantallaCompleta(context, Image.network(url));

  void _pantallaCompleta(BuildContext context, Widget imagen, [String titulo = '']) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            foregroundColor: Colors.white,
            title: Text(titulo, style: const TextStyle(color: Colors.white)),
          ),
          body: Center(child: InteractiveViewer(maxScale: 5, child: imagen)),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final objeto = ref.watch(objetoProvider(widget.id));
    final usuario = ref.watch(sesionProvider).usuario;

    return Scaffold(
      appBar: AppBar(title: Text(objeto.value?.codigo ?? 'Objeto')),
      body: objeto.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => EstadoError(error: e, onReintentar: () => ref.invalidate(objetoProvider(widget.id))),
        data: (o) => RefreshIndicator(
          onRefresh: () => ref.refresh(objetoProvider(widget.id).future),
          child: _Contenido(
            objeto: o,
            onVerFoto: _verFoto,
            onVerFotoEntrega: (bytes, titulo) => _pantallaCompleta(context, Image.memory(bytes), titulo),
          ),
        ),
      ),
      bottomNavigationBar: switch (objeto.value) {
        final o? when o.enCustodia && (usuario?.puede('objetos.registrar') ?? false) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Row(
                children: [
                  if (usuario?.puede('objetos.anular') ?? false) ...[
                    OutlinedButton(
                      onPressed: _trabajando ? null : () => _anular(o),
                      style: OutlinedButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
                      child: const Text('Anular'),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _trabajando ? null : () => _entregar(o),
                      icon: const Icon(Icons.handshake_outlined),
                      label: const Text('Entregar a su dueño'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        _ => null,
      },
    );
  }
}

const _nombresFoto = {'ci-anverso': 'CI · anverso', 'ci-reverso': 'CI · reverso', 'persona': 'Quien recibió'};

class _Contenido extends StatelessWidget {
  const _Contenido({required this.objeto, required this.onVerFoto, required this.onVerFotoEntrega});
  final ObjetoPerdido objeto;
  final ValueChanged<String> onVerFoto;
  final void Function(Uint8List bytes, String titulo) onVerFotoEntrega;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final o = objeto;
    final categoria = categoriasObjeto[o.categoria]?.$1 ?? o.categoriaNombre;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (o.foto != null)
          GestureDetector(
            onTap: () => onVerFoto(o.foto!),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: AspectRatio(
                aspectRatio: 4 / 3,
                child: ColoredBox(
                  color: esquema.surfaceContainerHigh,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.network(
                        o.foto!,
                        // Completa, sin recortes; al tocarla se abre en pantalla completa.
                        fit: BoxFit.contain,
                        errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined, size: 40),
                      ),
                      const Positioned(
                        right: 8,
                        bottom: 8,
                        child: Icon(Icons.zoom_out_map, color: Colors.white, shadows: [Shadow(blurRadius: 6)]),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          )
        else
          Row(children: [MiniaturaObjeto(objeto: o, lado: 72)]),
        const SizedBox(height: 14),
        Row(
          children: [
            Etiqueta(o.estadoNombre, tono: tonoDeObjeto(o.estado)),
            const SizedBox(width: 6),
            Etiqueta(categoria),
          ],
        ),
        const SizedBox(height: 8),
        Text(o.descripcion, style: tema.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
        if (o.caracteristicas.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(o.caracteristicas, style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant)),
        ],
        const TituloSeccion('Hallazgo'),
        _Fila(Icons.place_outlined, [o.laboratorioCodigo, o.lugar].where((t) => t.isNotEmpty).join(' · ')),
        _Fila(Icons.schedule, fechaHora(o.fechaHallazgo)),
        if (o.encontradoPor.isNotEmpty) _Fila(Icons.person_search_outlined, 'Lo encontró: ${o.encontradoPor}'),
        if (o.registradoPorNombre.isNotEmpty) _Fila(Icons.edit_note_outlined, 'Registró: ${o.registradoPorNombre}'),
        if (o.estado == 'entregado') ...[
          const TituloSeccion('Entrega'),
          _Fila(Icons.handshake_outlined, [o.entregadoA, if (o.entregadoCi.isNotEmpty) 'CI ${o.entregadoCi}'].join(' · ')),
          if (o.entregadoEn != null) _Fila(Icons.schedule, fechaHora(o.entregadoEn!)),
          if (o.entregadoPorNombre.isNotEmpty) _Fila(Icons.badge_outlined, 'Entregó: ${o.entregadoPorNombre}'),
          if (o.fotosEntrega.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                for (final nombre in o.fotosEntrega)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _MiniaturaEntrega(
                        objeto: o.id,
                        nombre: nombre,
                        titulo: _nombresFoto[nombre] ?? nombre,
                        onVer: onVerFotoEntrega,
                      ),
                    ),
                  ),
                for (var i = o.fotosEntrega.length; i < 3; i++) const Expanded(child: SizedBox()),
              ],
            ),
          ],
        ],
        if (o.estado == 'anulado' && o.motivoAnulacion.isNotEmpty) ...[
          const TituloSeccion('Anulación'),
          _Fila(Icons.block, o.motivoAnulacion),
        ],
        if (o.eventos.isNotEmpty) ...[
          const TituloSeccion('Historial'),
          for (var i = 0; i < o.eventos.length; i++)
            _EventoLinea(evento: o.eventos[i], ultimo: i == o.eventos.length - 1),
        ],
      ],
    );
  }
}

class _Fila extends StatelessWidget {
  const _Fila(this.icono, this.texto);
  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    if (texto.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icono, size: 20, color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(width: 12),
          Expanded(child: Text(texto)),
        ],
      ),
    );
  }
}

/// Un paso de la línea de tiempo del objeto (registrado, editado, entregado, anulado).
class _EventoLinea extends StatelessWidget {
  const _EventoLinea({required this.evento, required this.ultimo});
  final EventoObjeto evento;
  final bool ultimo;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 20,
            child: Column(
              children: [
                const SizedBox(height: 4),
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(color: esquema.primary, shape: BoxShape.circle),
                ),
                if (!ultimo) Expanded(child: Container(width: 2, color: esquema.outlineVariant)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(evento.tipoNombre, style: tema.textTheme.titleSmall),
                  Text(
                    [relativo(evento.fecha), if (evento.usuarioNombre.isNotEmpty) evento.usuarioNombre].join(' · '),
                    style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                  ),
                  if (evento.detalle.isNotEmpty)
                    Padding(padding: const EdgeInsets.only(top: 2), child: Text(evento.detalle)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Miniatura de una foto de la entrega. Se descarga con la sesión (no tiene URL pública).
class _MiniaturaEntrega extends ConsumerWidget {
  const _MiniaturaEntrega({required this.objeto, required this.nombre, required this.titulo, required this.onVer});
  final int objeto;
  final String nombre;
  final String titulo;
  final void Function(Uint8List bytes, String titulo) onVer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final esquema = Theme.of(context).colorScheme;
    final foto = ref.watch(fotoEntregaProvider((objeto, nombre)));
    final bytes = foto.value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: AspectRatio(
            aspectRatio: 4 / 3,
            child: Material(
              color: esquema.surfaceContainerHigh,
              child: InkWell(
                onTap: bytes == null ? null : () => onVer(bytes, titulo),
                child: bytes != null
                    // cacheWidth: la miniatura no necesita la foto a tamaño completo.
                    ? Image.memory(bytes, fit: BoxFit.cover, cacheWidth: 400)
                    : Center(
                        child: foto.hasError
                            ? Icon(Icons.broken_image_outlined, color: esquema.onSurfaceVariant)
                            : const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                      ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(titulo, style: TextStyle(fontSize: 12, color: esquema.onSurfaceVariant)),
      ],
    );
  }
}

/// Datos de quien recibe el objeto, con fotos opcionales del CI y de la persona.
class _HojaEntrega extends StatefulWidget {
  const _HojaEntrega({required this.objeto});
  final ObjetoPerdido objeto;

  @override
  State<_HojaEntrega> createState() => _HojaEntregaState();
}

class _HojaEntregaState extends State<_HojaEntrega> {
  final _form = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _ci = TextEditingController();
  final _observacion = TextEditingController();
  final Map<String, XFile?> _fotos = {'ci_anverso': null, 'ci_reverso': null, 'foto_persona': null};
  String? _error;

  static const _ranuras = [
    ('ci_anverso', 'CI · anverso', CameraDevice.rear),
    ('ci_reverso', 'CI · reverso', CameraDevice.rear),
    ('foto_persona', 'Quien recibe', CameraDevice.front),
  ];

  @override
  void dispose() {
    _nombre.dispose();
    _ci.dispose();
    _observacion.dispose();
    super.dispose();
  }

  Future<void> _elegir(String campo, CameraDevice camara) async {
    final origen = await showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (hoja) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Tomar foto'),
              onTap: () => Navigator.pop(hoja, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Elegir de la galería'),
              onTap: () => Navigator.pop(hoja, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (origen == null) return;
    setState(() => _error = null);
    try {
      final foto = await ImagePicker().pickImage(
        source: origen,
        preferredCameraDevice: camara,
        maxWidth: 1600,
        imageQuality: 80,
      );
      if (foto != null && mounted) setState(() => _fotos[campo] = foto);
    } catch (_) {
      // Se muestra dentro de la hoja: un aviso normal quedaría escondido detrás.
      if (mounted) setState(() => _error = 'No se pudo abrir la cámara o la galería. Revisa los permisos de la app.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    return Padding(
      // Sube el formulario cuando aparece el teclado.
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Entregar ${widget.objeto.codigo}', style: tema.textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(
                'Pide un documento a la persona y anota sus datos.',
                style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _nombre,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Nombre de quien recibe'),
                validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe el nombre.' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _ci,
                decoration: const InputDecoration(labelText: 'Carnet de identidad (opcional)'),
              ),
              const TituloSeccion('Fotos (opcional)'),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(_error!, style: TextStyle(color: esquema.error)),
                ),
              Row(
                children: [
                  for (final (campo, etiqueta, camara) in _ranuras)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: AspectRatio(
                                aspectRatio: 4 / 3,
                                child: Material(
                                  color: esquema.surfaceContainerHigh,
                                  child: InkWell(
                                    onTap: () => _elegir(campo, camara),
                                    child: _fotos[campo] != null
                                        ? Image.file(File(_fotos[campo]!.path), fit: BoxFit.cover)
                                        : Icon(Icons.add_a_photo_outlined, color: esquema.onSurfaceVariant),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    etiqueta,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 12, color: esquema.onSurfaceVariant),
                                  ),
                                ),
                                if (_fotos[campo] != null)
                                  InkWell(
                                    onTap: () => setState(() => _fotos[campo] = null),
                                    child: Icon(Icons.close, size: 16, color: esquema.onSurfaceVariant),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _observacion,
                minLines: 1,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Observación (opcional)'),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () {
                  if (!_form.currentState!.validate()) return;
                  Navigator.pop(
                    context,
                    DatosEntrega(
                      nombre: _nombre.text.trim(),
                      ci: _ci.text.trim(),
                      observacion: _observacion.text.trim(),
                      ciAnverso: _fotos['ci_anverso']?.path,
                      ciReverso: _fotos['ci_reverso']?.path,
                      fotoPersona: _fotos['foto_persona']?.path,
                    ),
                  );
                },
                child: const Text('Registrar entrega'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
