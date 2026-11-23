import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/sesion.dart';
import 'terminos.dart';

/// Pantalla bloqueante de términos y condiciones. Se muestra tras iniciar sesión
/// mientras el usuario no haya aceptado la versión vigente. Si acepta, continúa;
/// si no acepta, se cierra la sesión (y le vuelve a aparecer la próxima vez).
class TerminosPage extends ConsumerStatefulWidget {
  const TerminosPage({super.key});

  @override
  ConsumerState<TerminosPage> createState() => _TerminosPageState();
}

class _TerminosPageState extends ConsumerState<TerminosPage> {
  bool _enviando = false;

  Future<void> _aceptar() async {
    setState(() => _enviando = true);
    try {
      await ref.read(sesionProvider.notifier).aceptarTerminos();
      // Al cambiar el estado de la sesión, la app deja ver el contenido normal.
    } catch (_) {
      if (!mounted) return;
      setState(() => _enviando = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo registrar la aceptación. Inténtalo de nuevo.')),
      );
    }
  }

  Future<void> _rechazar() async {
    setState(() => _enviando = true);
    try {
      await ref.read(sesionProvider.notifier).cerrar();
    } catch (_) {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return PopScope(
      canPop: false,
      child: Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(terminosTitulo, style: tema.textTheme.headlineSmall),
                    const SizedBox(height: 8),
                    Text(terminosIntro, style: tema.textTheme.bodyMedium),
                  ],
                ),
              ),
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                  itemCount: terminosSecciones.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 16),
                  itemBuilder: (context, i) {
                    final s = terminosSecciones[i];
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          s.titulo,
                          style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        Text(s.cuerpo, style: tema.textTheme.bodyMedium),
                      ],
                    );
                  },
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _enviando ? null : _rechazar,
                          child: const Text('No acepto'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: _enviando ? null : _aceptar,
                          child: _enviando
                              ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Acepto'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
