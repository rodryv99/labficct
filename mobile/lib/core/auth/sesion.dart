import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../datos/proveedores.dart';
import '../modelos/modelos.dart';
import '../network/repositorio.dart';

enum EstadoSesion { cargando, anonimo, autenticado }

class Sesion {
  const Sesion(this.estado, {this.usuario, this.expirada = false});

  final EstadoSesion estado;
  final Usuario? usuario;

  /// true cuando la sesión terminó sola (token vencido), para avisarlo en el login.
  final bool expirada;
}

final sesionProvider = NotifierProvider<SesionNotifier, Sesion>(SesionNotifier.new);

class SesionNotifier extends Notifier<Sesion> {
  @override
  Sesion build() {
    ref.read(apiProvider).alExpirarSesion = _expirar;
    Future.microtask(_restaurar);
    return const Sesion(EstadoSesion.cargando);
  }

  Repositorio get _repo => ref.read(repositorioProvider);

  /// Al abrir la app: si hay un token de renovación guardado, la sesión sigue.
  Future<void> _restaurar() async {
    try {
      final token = await ref.read(apiProvider).renovar();
      if (token == null) {
        state = const Sesion(EstadoSesion.anonimo);
        return;
      }
      state = Sesion(EstadoSesion.autenticado, usuario: await _repo.yo());
      _activarPush();
    } catch (_) {
      // Pase lo que pase, la app nunca se queda en la pantalla de carga.
      state = const Sesion(EstadoSesion.anonimo);
    }
  }

  /// Registra este teléfono para recibir push. No bloquea ni rompe la sesión.
  void _activarPush() {
    unawaited(Future(() => ref.read(servicioPushProvider).iniciarSesion()));
  }

  Future<void> iniciar(String usuario, String password) async {
    final datos = await _repo.login(usuario, password);
    await ref.read(almacenTokensProvider).guardar(
          acceso: datos['access'] as String,
          refresh: datos['refresh'] as String?,
        );
    state = Sesion(
      EstadoSesion.autenticado,
      usuario: Usuario.fromJson(datos['usuario'] as Map<String, dynamic>),
    );
    _activarPush();
  }

  /// Registra la aceptación de los términos y actualiza el usuario en sesión.
  Future<void> aceptarTerminos() async {
    final usuario = await _repo.aceptarTerminos();
    state = Sesion(EstadoSesion.autenticado, usuario: usuario);
  }

  Future<void> cerrar() async {
    final tokens = ref.read(almacenTokensProvider);
    // Da de baja este teléfono antes de soltar la sesión (el token de acceso aún sirve).
    try {
      await ref.read(servicioPushProvider).cerrarSesion();
    } catch (_) {}
    try {
      await _repo.logout(await tokens.leerRefresh());
    } catch (_) {
      // Aunque el servidor no responda, la sesión se cierra en el teléfono.
    }
    try {
      await tokens.borrar();
    } catch (_) {
      // El token se pierde de todos modos al cerrar la app.
    }
    state = const Sesion(EstadoSesion.anonimo);
  }

  void _expirar() {
    // Solo cuenta como "expirada" si había una sesión abierta (no tras cerrar sesión a mano).
    if (state.estado != EstadoSesion.autenticado) return;
    ref.read(almacenTokensProvider).borrar().catchError((_) {});
    state = const Sesion(EstadoSesion.anonimo, expirada: true);
  }
}
