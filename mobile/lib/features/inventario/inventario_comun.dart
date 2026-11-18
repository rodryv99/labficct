import 'package:intl/intl.dart';

import '../../shared/widgets/comunes.dart';

/// Textos, colores y utilidades que comparten las pantallas de inventario.

/// Estados de un activo, en el orden en que se muestran.
const estadosActivo = <(String, String)>[
  ('operativo', 'Operativo'),
  ('danado', 'Dañado'),
  ('en_reparacion', 'En reparación'),
  ('baja', 'De baja'),
];

/// Tipos de lugar que se pueden crear a mano (el laboratorio es automático).
const tiposLugar = <(String, String)>[
  ('deposito', 'Depósito'),
  ('otro', 'Otro lugar'),
];

/// Resultados de verificación, en el orden en que se ofrecen al marcar.
const resultadosVerificacion = <(String, String)>[
  ('esta', 'Está'),
  ('falta', 'Falta'),
  ('otro_lugar', 'En otro lugar'),
  ('danado', 'Dañado'),
];

Tono tonoDeEstadoActivo(String estado) => switch (estado) {
      'operativo' => Tono.exito,
      'danado' => Tono.peligro,
      'en_reparacion' => Tono.aviso,
      _ => Tono.neutro,
    };

Tono tonoDeMovimiento(String tipo) => switch (tipo) {
      'alta' => Tono.exito,
      'traslado' => Tono.marca,
      'estado' => Tono.aviso,
      _ => Tono.peligro,
    };

Tono tonoDeResultado(String resultado) => switch (resultado) {
      'esta' => Tono.exito,
      'falta' => Tono.peligro,
      'otro_lugar' => Tono.aviso,
      'danado' => Tono.aviso,
      _ => Tono.neutro,
    };

Tono tonoDeVerificacion(String estado) => switch (estado) {
      'abierta' => Tono.marca,
      'cerrada' => Tono.exito,
      _ => Tono.neutro,
    };

/// "2026-11-15" → "15 nov 2026". Vacío si la fecha viene vacía o no se entiende.
String fechaCortaIso(String iso) {
  if (iso.isEmpty) return '';
  final f = DateTime.tryParse(iso);
  return f == null ? iso : DateFormat('d MMM yyyy', 'es').format(f);
}
