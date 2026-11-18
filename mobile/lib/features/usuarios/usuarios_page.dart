import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../shared/widgets/comunes.dart';
import '../notificaciones/notificaciones_page.dart';
import '../perfil/perfil_sheet.dart';
import 'usuarios_comun.dart';

/// 1. Gestión de usuarios: crear cuentas de auxiliares, docentes y
/// administrativos (el Superadmin, además, administradores).
class UsuariosPage extends ConsumerStatefulWidget {
  const UsuariosPage({super.key});

  @override
  ConsumerState<UsuariosPage> createState() => _UsuariosPageState();
}

class _UsuariosPageState extends ConsumerState<UsuariosPage> {
  String _buscar = '';
  String _rol = '';
  String _activo = 'true';
  Timer? _espera;

  @override
  void dispose() {
    _espera?.cancel();
    super.dispose();
  }

  void _alEscribir(String texto) {
    _espera?.cancel();
    _espera = Timer(const Duration(milliseconds: 350), () {
      if (mounted) setState(() => _buscar = texto.trim());
    });
  }

  @override
  Widget build(BuildContext context) {
    final yo = ref.watch(sesionProvider).usuario;
    final permitidos = rolesPermitidosPara(yo?.rol ?? 'admin');
    final filtro = (buscar: _buscar, rol: _rol, activo: _activo, ordering: 'apellidos');
    final usuarios = ref.watch(usuariosAdminProvider(filtro));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Usuarios'),
        actions: const [BotonNotificaciones(), BotonPerfil()],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/usuarios/nuevo'),
        icon: const Icon(Icons.person_add_alt),
        label: const Text('Nuevo'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              onChanged: _alEscribir,
              decoration: const InputDecoration(
                hintText: 'Buscar por nombre, correo o código',
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
                _ChipMenu(
                  etiqueta: _rol.isEmpty ? 'Rol' : etiquetaRol(_rol),
                  activo: _rol.isNotEmpty,
                  opciones: [('', 'Todos los roles'), for (final (v, n) in permitidos) (v, n)],
                  onElegir: (v) => setState(() => _rol = v),
                ),
                const SizedBox(width: 8),
                _ChipMenu(
                  etiqueta: switch (_activo) { 'true' => 'Activos', 'false' => 'Inactivos', _ => 'Todos' },
                  activo: _activo != 'true',
                  opciones: const [('true', 'Solo activos'), ('false', 'Solo inactivos'), ('', 'Activos e inactivos')],
                  onElegir: (v) => setState(() => _activo = v),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(usuariosAdminProvider(filtro).future),
              child: usuarios.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [
                  const SizedBox(height: 80),
                  EstadoError(error: e, onReintentar: () => ref.invalidate(usuariosAdminProvider(filtro))),
                ]),
                data: (lista) {
                  if (lista.isEmpty) {
                    return ListView(children: [
                      const SizedBox(height: 80),
                      EstadoVacio(
                        icono: Icons.group_outlined,
                        titulo: _buscar.isNotEmpty || _rol.isNotEmpty ? 'Nadie coincide' : 'Todavía no hay usuarios',
                        descripcion: 'Crea la cuenta de cada persona para que pueda entrar al sistema.',
                      ),
                    ]);
                  }
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                    itemCount: lista.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _TarjetaUsuario(usuario: lista[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChipMenu extends StatelessWidget {
  const _ChipMenu({required this.etiqueta, required this.activo, required this.opciones, required this.onElegir});

  final String etiqueta;
  final bool activo;
  final List<(String, String)> opciones;
  final ValueChanged<String> onElegir;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    return PopupMenuButton<String>(
      onSelected: onElegir,
      itemBuilder: (_) => [for (final (v, n) in opciones) PopupMenuItem(value: v, child: Text(n))],
      child: Chip(
        label: Text(etiqueta),
        avatar: const Icon(Icons.arrow_drop_down, size: 20),
        backgroundColor: activo ? esquema.secondaryContainer : null,
      ),
    );
  }
}

class _TarjetaUsuario extends StatelessWidget {
  const _TarjetaUsuario({required this.usuario});
  final UsuarioAdmin usuario;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final u = usuario;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/usuarios/${u.id}', extra: u),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: u.activo ? esquema.primaryContainer : esquema.surfaceContainerHighest,
                child: Text(
                  u.iniciales,
                  style: TextStyle(
                    color: u.activo ? esquema.onPrimaryContainer : esquema.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      u.nombreCompleto,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      u.email,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        Etiqueta(u.rolNombre, tono: tonoDeRol(u.rol)),
                        if (!u.activo) const Etiqueta('Inactivo', tono: Tono.neutro),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
