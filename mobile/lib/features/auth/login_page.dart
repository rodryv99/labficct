import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/sesion.dart';
import '../../core/config/env.dart';
import '../../core/network/api_cliente.dart';
import '../../core/theme/tema.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _form = GlobalKey<FormState>();
  final _usuario = TextEditingController();
  final _password = TextEditingController();
  bool _ver = false;
  bool _enviando = false;
  String? _error;

  @override
  void dispose() {
    _usuario.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await ref.read(sesionProvider.notifier).iniciar(_usuario.text.trim(), _password.text);
      // El router lleva a la primera pestaña del rol.
    } catch (e) {
      if (mounted) setState(() => _error = mensajeDeError(e, 'No se pudo iniciar sesión.'));
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final expirada = ref.watch(sesionProvider).expirada;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: AutofillGroup(
                child: Form(
                  key: _form,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Image.asset('assets/images/logo_ficct.png', height: 104),
                      const SizedBox(height: 24),
                      Text(
                        Env.appName,
                        textAlign: TextAlign.center,
                        style: tema.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: esquema.brightness == Brightness.light ? ColoresFicct.azulOscuro : esquema.onSurface,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Ingresa con tu correo institucional o tu código.',
                        textAlign: TextAlign.center,
                        style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
                      ),
                      const SizedBox(height: 28),
                      if (_error != null || expirada) ...[
                        _Aviso(
                          texto: _error ?? 'Tu sesión expiró. Vuelve a iniciar sesión.',
                          esError: _error != null,
                        ),
                        const SizedBox(height: 16),
                      ],
                      TextFormField(
                        controller: _usuario,
                        autofillHints: const [AutofillHints.username, AutofillHints.email],
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autocorrect: false,
                        enabled: !_enviando,
                        decoration: const InputDecoration(
                          labelText: 'Correo o código',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe tu correo o tu código.' : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _password,
                        obscureText: !_ver,
                        autofillHints: const [AutofillHints.password],
                        textInputAction: TextInputAction.done,
                        enabled: !_enviando,
                        onFieldSubmitted: (_) => _entrar(),
                        decoration: InputDecoration(
                          labelText: 'Contraseña',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            tooltip: _ver ? 'Ocultar contraseña' : 'Mostrar contraseña',
                            onPressed: () => setState(() => _ver = !_ver),
                            icon: Icon(_ver ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                          ),
                        ),
                        validator: (v) => (v ?? '').isEmpty ? 'Escribe tu contraseña.' : null,
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: _enviando ? null : _entrar,
                        child: _enviando
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                              )
                            : const Text('Iniciar sesión'),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '¿Olvidaste tu contraseña? Pídele al administrador de laboratorios que la restablezca.',
                        textAlign: TextAlign.center,
                        style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                      ),
                      const SizedBox(height: 40),
                      Text(
                        'Facultad de Ingeniería en Ciencias de la Computación y Telecomunicaciones · UAGRM',
                        textAlign: TextAlign.center,
                        style: tema.textTheme.labelSmall?.copyWith(color: esquema.outline),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Aviso extends StatelessWidget {
  const _Aviso({required this.texto, required this.esError});
  final String texto;
  final bool esError;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    final fondo = esError ? esquema.errorContainer : esquema.secondaryContainer;
    final frente = esError ? esquema.onErrorContainer : esquema.onSecondaryContainer;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: fondo, borderRadius: BorderRadius.circular(10)),
      child: Row(
        children: [
          Icon(esError ? Icons.error_outline : Icons.info_outline, color: frente, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(texto, style: TextStyle(color: frente))),
        ],
      ),
    );
  }
}
