import 'dart:math';

import '../../shared/widgets/comunes.dart';

/// Roles del sistema, con su etiqueta, en el orden de la web.
const roles = <(String, String)>[
  ('superadmin', 'Superadmin'),
  ('admin', 'Admin (jefe de laboratorio)'),
  ('auxiliar', 'Auxiliar'),
  ('docente', 'Docente'),
  ('administrativo', 'Administrativo'),
];

/// Un Admin solo gestiona estos; el Superadmin, todos.
const rolesGestionablesPorAdmin = {'auxiliar', 'docente', 'administrativo'};

List<(String, String)> rolesPermitidosPara(String miRol) =>
    miRol == 'superadmin' ? roles : roles.where((r) => rolesGestionablesPorAdmin.contains(r.$1)).toList();

String etiquetaRol(String rol) =>
    roles.firstWhere((r) => r.$1 == rol, orElse: () => (rol, rol)).$2;

Tono tonoDeRol(String rol) => switch (rol) {
      'superadmin' => Tono.peligro,
      'admin' => Tono.marca,
      'auxiliar' => Tono.info,
      'docente' => Tono.exito,
      _ => Tono.neutro,
    };

/// Contraseña inicial fácil de dictar (sin caracteres que se confunden).
String generarPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  final r = Random.secure();
  return List.generate(10, (_) => abc[r.nextInt(abc.length)]).join();
}
