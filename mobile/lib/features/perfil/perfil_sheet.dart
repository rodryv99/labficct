import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/config/env.dart';
import '../../core/datos/proveedores.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';

/// Avatar con las iniciales; va a la derecha de cada barra superior.
class BotonPerfil extends ConsumerWidget {
  const BotonPerfil({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(sesionProvider).usuario;
    final esquema = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: IconButton(
        tooltip: 'Mi cuenta',
        onPressed: () => mostrarPerfil(context),
        icon: CircleAvatar(
          radius: 16,
          backgroundColor: esquema.primary,
          child: Text(
            usuario?.iniciales ?? '',
            style: TextStyle(color: esquema.onPrimary, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ),
      ),
    );
  }
}

Future<void> mostrarPerfil(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    useSafeArea: true,
    // Crece según el contenido y se desplaza en teléfonos pequeños.
    isScrollControlled: true,
    builder: (_) => const _HojaPerfil(),
  );
}

class _HojaPerfil extends ConsumerWidget {
  const _HojaPerfil();

  /// Cierra la hoja y abre una pantalla completa.
  void _abrir(BuildContext context, String ruta) {
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.push(ruta);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(sesionProvider).usuario;
    final tema = Theme.of(context);
    if (usuario == null) return const SizedBox(height: 120);
    final abiertas =
        usuario.puede('asistencia.atender') ? (ref.watch(solicitudesAbiertasProvider).value ?? 0) : 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            leading: CircleAvatar(
              radius: 24,
              backgroundColor: tema.colorScheme.primary,
              child: Text(usuario.iniciales, style: TextStyle(color: tema.colorScheme.onPrimary)),
            ),
            title: Text(usuario.nombreCompleto, style: tema.textTheme.titleMedium),
            subtitle: Text(usuario.email),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 16, bottom: 8),
            child: Align(alignment: Alignment.centerLeft, child: Etiqueta(usuario.rolNombre, tono: Tono.marca)),
          ),
          const Divider(),
          if (usuario.puede('preferencias.propias'))
            ListTile(
              leading: const Icon(Icons.tune),
              title: const Text('Mis preferencias'),
              subtitle: const Text('Cómo quieres encontrar el aula'),
              onTap: () => _abrir(context, '/preferencias'),
            ),
          if (usuario.puede('asistencia.atender'))
            ListTile(
              leading: const Icon(Icons.support_agent),
              title: const Text('Solicitudes de asistencia'),
              trailing: abiertas > 0 ? Badge(label: Text('$abiertas')) : null,
              onTap: () => _abrir(context, '/solicitudes'),
            ),
          ListTile(
            leading: const Icon(Icons.lock_reset_outlined),
            title: const Text('Cambiar contraseña'),
            onTap: () async {
              final cambiada = await showDialog<bool>(context: context, builder: (_) => const _DialogoPassword());
              if (cambiada == true && context.mounted) {
                avisar(context, 'Contraseña actualizada.');
                Navigator.of(context).pop();
              }
            },
          ),
          ListTile(
            leading: Icon(Icons.logout, color: tema.colorScheme.error),
            title: Text('Cerrar sesión', style: TextStyle(color: tema.colorScheme.error)),
            onTap: () async {
              final confirmar = await showDialog<bool>(
                context: context,
                builder: (dialogo) => AlertDialog(
                  title: const Text('¿Cerrar sesión?'),
                  content: const Text('Tendrás que volver a ingresar tu usuario y contraseña.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Cancelar')),
                    FilledButton(onPressed: () => Navigator.pop(dialogo, true), child: const Text('Cerrar sesión')),
                  ],
                ),
              );
              if (confirmar != true || !context.mounted) return;
              final sesion = ref.read(sesionProvider.notifier);
              Navigator.of(context).pop();
              await sesion.cerrar();
            },
          ),
          const SizedBox(height: 8),
          Text(
            '${Env.appName} · ${Uri.tryParse(Env.apiBaseUrl)?.host ?? ''}',
            textAlign: TextAlign.center,
            style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _DialogoPassword extends ConsumerStatefulWidget {
  const _DialogoPassword();

  @override
  ConsumerState<_DialogoPassword> createState() => _DialogoPasswordState();
}

class _DialogoPasswordState extends ConsumerState<_DialogoPassword> {
  final _form = GlobalKey<FormState>();
  final _actual = TextEditingController();
  final _nueva = TextEditingController();
  final _repetir = TextEditingController();
  bool _guardando = false;
  bool _ver = false;
  String? _error;

  @override
  void dispose() {
    _actual.dispose();
    _nueva.dispose();
    _repetir.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _guardando = true;
      _error = null;
    });
    try {
      await ref.read(repositorioProvider).cambiarPassword(_actual.text, _nueva.text);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      final campos = erroresDeCampos(e);
      setState(() => _error = campos['actual'] ?? campos['nueva'] ?? mensajeDeError(e));
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ojo = IconButton(
      tooltip: _ver ? 'Ocultar' : 'Mostrar',
      onPressed: () => setState(() => _ver = !_ver),
      icon: Icon(_ver ? Icons.visibility_off_outlined : Icons.visibility_outlined),
    );
    return AlertDialog(
      title: const Text('Cambiar contraseña'),
      content: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_error != null) ...[
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              const SizedBox(height: 12),
            ],
            TextFormField(
              controller: _actual,
              obscureText: !_ver,
              decoration: InputDecoration(labelText: 'Contraseña actual', suffixIcon: ojo),
              validator: (v) => (v ?? '').isEmpty ? 'Escribe tu contraseña actual.' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _nueva,
              obscureText: !_ver,
              decoration: const InputDecoration(labelText: 'Nueva contraseña', helperText: 'Mínimo 8 caracteres.'),
              validator: (v) => (v ?? '').length < 8 ? 'Usa al menos 8 caracteres.' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _repetir,
              obscureText: !_ver,
              decoration: const InputDecoration(labelText: 'Repite la nueva contraseña'),
              validator: (v) => v != _nueva.text ? 'No coincide con la nueva contraseña.' : null,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: _guardando ? null : () => Navigator.pop(context, false), child: const Text('Cancelar')),
        FilledButton(
          onPressed: _guardando ? null : _guardar,
          child: _guardando
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Guardar'),
        ),
      ],
    );
  }
}
