import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/network/api_cliente.dart';

/// Estado vacío que explica qué va aquí.
class EstadoVacio extends StatelessWidget {
  const EstadoVacio({super.key, required this.icono, required this.titulo, this.descripcion, this.accion});

  final IconData icono;
  final String titulo;
  final String? descripcion;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: tema.colorScheme.primaryContainer,
              child: Icon(icono, color: tema.colorScheme.onPrimaryContainer),
            ),
            const SizedBox(height: 12),
            Text(titulo, style: tema.textTheme.titleMedium, textAlign: TextAlign.center),
            if (descripcion != null) ...[
              const SizedBox(height: 6),
              Text(
                descripcion!,
                style: tema.textTheme.bodyMedium?.copyWith(color: tema.colorScheme.onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
            ],
            if (accion != null) ...[const SizedBox(height: 16), accion!],
          ],
        ),
      ),
    );
  }
}

/// Error con botón para reintentar.
class EstadoError extends StatelessWidget {
  const EstadoError({super.key, required this.error, required this.onReintentar});

  final Object error;
  final VoidCallback onReintentar;

  @override
  Widget build(BuildContext context) {
    return EstadoVacio(
      icono: Icons.cloud_off_outlined,
      titulo: 'No se pudo cargar',
      descripcion: mensajeDeError(error),
      accion: OutlinedButton.icon(onPressed: onReintentar, icon: const Icon(Icons.refresh), label: const Text('Reintentar')),
    );
  }
}

enum Tono { exito, aviso, peligro, info, neutro, marca }

/// Etiqueta de estado: siempre texto + color.
class Etiqueta extends StatelessWidget {
  const Etiqueta(this.texto, {super.key, this.tono = Tono.neutro});

  final String texto;
  final Tono tono;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    final (fondo, frente) = switch (tono) {
      Tono.exito => (const Color(0xFFE7F4EC), const Color(0xFF0E7A3E)),
      Tono.aviso => (const Color(0xFFFFF4E0), const Color(0xFF8A5300)),
      Tono.peligro => (const Color(0xFFFDE7E9), const Color(0xFFB10E1C)),
      Tono.info => (const Color(0xFFE8F1FB), const Color(0xFF0B5CAD)),
      Tono.marca => (esquema.primaryContainer, esquema.onPrimaryContainer),
      Tono.neutro => (esquema.surfaceContainerHigh, esquema.onSurfaceVariant),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: fondo, borderRadius: BorderRadius.circular(6)),
      child: Text(texto, style: TextStyle(color: frente, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

/// Título pequeño de sección.
class TituloSeccion extends StatelessWidget {
  const TituloSeccion(this.texto, {super.key});
  final String texto;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
      child: Text(
        texto.toUpperCase(),
        style: tema.textTheme.labelSmall?.copyWith(
          color: tema.colorScheme.onSurfaceVariant,
          letterSpacing: 0.6,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

void avisar(BuildContext context, String mensaje, {bool error = false}) {
  final esquema = Theme.of(context).colorScheme;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(mensaje),
        behavior: SnackBarBehavior.floating,
        backgroundColor: error ? esquema.error : null,
      ),
    );
}

// ── Fechas ──
String fechaIso(DateTime f) => DateFormat('yyyy-MM-dd').format(f);
String fechaLarga(DateTime f) {
  final t = DateFormat("EEEE d 'de' MMMM", 'es').format(f);
  return t[0].toUpperCase() + t.substring(1);
}

String fechaHora(DateTime f) => DateFormat("d MMM yyyy, HH:mm", 'es').format(f);
String hora(DateTime f) => DateFormat('HH:mm').format(f);

String relativo(DateTime f) {
  final ahora = DateTime.now();
  final hoy = DateTime(ahora.year, ahora.month, ahora.day);
  final dia = DateTime(f.year, f.month, f.day);
  final diferencia = hoy.difference(dia).inDays;
  if (diferencia == 0) return 'hoy, ${hora(f)}';
  if (diferencia == 1) return 'ayer, ${hora(f)}';
  if (diferencia < 7) return 'hace $diferencia días';
  return DateFormat('d MMM yyyy', 'es').format(f);
}

/// Como [relativo], pero con minutos para lo más reciente: "ahora", "hace 5 min".
String haceCuanto(DateTime f) {
  final minutos = DateTime.now().difference(f).inMinutes;
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return 'hace $minutos min';
  return relativo(f);
}

int minutosAhora() {
  final a = DateTime.now();
  return a.hour * 60 + a.minute;
}

/// Diálogo de confirmación con un campo de texto (motivo, observación…).
/// Devuelve el texto escrito, o null si la persona se arrepiente.
Future<String?> pedirTexto(
  BuildContext context, {
  required String titulo,
  required String mensaje,
  required String etiqueta,
  required String boton,
  bool obligatorio = false,
  bool peligro = false,
  int maximo = 200,
}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _DialogoTexto(
      titulo: titulo,
      mensaje: mensaje,
      etiqueta: etiqueta,
      boton: boton,
      obligatorio: obligatorio,
      peligro: peligro,
      maximo: maximo,
    ),
  );
}

class _DialogoTexto extends StatefulWidget {
  const _DialogoTexto({
    required this.titulo,
    required this.mensaje,
    required this.etiqueta,
    required this.boton,
    required this.obligatorio,
    required this.peligro,
    required this.maximo,
  });

  final String titulo;
  final String mensaje;
  final String etiqueta;
  final String boton;
  final bool obligatorio;
  final bool peligro;
  final int maximo;

  @override
  State<_DialogoTexto> createState() => _DialogoTextoState();
}

class _DialogoTextoState extends State<_DialogoTexto> {
  final _texto = TextEditingController();
  bool _intentado = false;

  @override
  void dispose() {
    _texto.dispose();
    super.dispose();
  }

  void _aceptar() {
    final valor = _texto.text.trim();
    if (widget.obligatorio && valor.isEmpty) {
      setState(() => _intentado = true);
      return;
    }
    Navigator.pop(context, valor);
  }

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    final falta = _intentado && widget.obligatorio && _texto.text.trim().isEmpty;
    return AlertDialog(
      title: Text(widget.titulo),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.mensaje),
          const SizedBox(height: 14),
          TextField(
            controller: _texto,
            autofocus: true,
            minLines: 1,
            maxLines: 3,
            maxLength: widget.maximo,
            onChanged: (_) {
              if (_intentado) setState(() {});
            },
            decoration: InputDecoration(
              labelText: widget.obligatorio ? widget.etiqueta : '${widget.etiqueta} (opcional)',
              errorText: falta ? 'Este dato es obligatorio.' : null,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Volver')),
        FilledButton(
          style: widget.peligro ? FilledButton.styleFrom(backgroundColor: esquema.error) : null,
          onPressed: _aceptar,
          child: Text(widget.boton),
        ),
      ],
    );
  }
}
