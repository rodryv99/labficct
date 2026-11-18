import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:local_auth/local_auth.dart';

import '../../core/modelos/modelos.dart';
import '../../shared/widgets/comunes.dart';

// ── Textos ──

/// 125 → "2 h 05 min"; 40 → "40 min".
String duracionTexto(int minutos) {
  final h = minutos ~/ 60;
  final m = minutos % 60;
  return h > 0 ? '$h h ${m.toString().padLeft(2, '0')} min' : '$m min';
}

String metrosTexto(double? valor) => valor == null ? '—' : '${valor.round()} m';

/// Nombres de los días de la semana (0 = lunes).
const diasAsistencia = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const diasAsistenciaCortos = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/// "08:00:00" → "08:00".
String hhmm(String hora) => hora.length >= 5 ? hora.substring(0, 5) : hora;

/// Resume los bloques: "Lun, Mié 08:00–12:00 · Vie 14:00–18:00".
String resumenHorario(List<BloqueHorario> bloques) {
  if (bloques.isEmpty) return 'Sin bloques';
  final orden = [...bloques]..sort((a, b) => a.dia != b.dia ? a.dia - b.dia : a.inicio.compareTo(b.inicio));
  final grupos = <String, List<int>>{};
  for (final b in orden) {
    final tramo = '${hhmm(b.inicio)}–${hhmm(b.fin)}';
    grupos.putIfAbsent(tramo, () => []).add(b.dia);
  }
  return grupos.entries
      .map((e) => '${e.value.map((d) => diasAsistenciaCortos[d]).join(', ')} ${e.key}')
      .join(' · ');
}

/// Minutos semanales que suman los bloques.
int minutosSemana(List<BloqueHorario> bloques) {
  var total = 0;
  for (final b in bloques) {
    final i = hhmm(b.inicio).split(':');
    final f = hhmm(b.fin).split(':');
    final mi = (int.tryParse(i.first) ?? 0) * 60 + (int.tryParse(i.last) ?? 0);
    final mf = (int.tryParse(f.first) ?? 0) * 60 + (int.tryParse(f.last) ?? 0);
    if (mf > mi) total += mf - mi;
  }
  return total;
}

/// "2026-11-15" → "15/11/2026".
String fechaNumerica(String iso) {
  final f = DateTime.tryParse(iso);
  if (f == null) return iso;
  return '${f.day.toString().padLeft(2, '0')}/${f.month.toString().padLeft(2, '0')}/${f.year}';
}

/// Etiqueta de cómo va hoy un auxiliar.
(String, Tono) situacionAuxiliar(String situacion) => switch (situacion) {
      'presente' => ('Presente', Tono.exito),
      'salio' => ('Ya salió', Tono.info),
      _ => ('Sin marcar', Tono.neutro),
    };

const _numero = r'(-?\d+(?:\.\d+)?)';
final _patronesCoordenadas = [
  // Enlaces de Google Maps: …!3d-17.77!4d-63.19, …?q=-17.77,-63.19, …@-17.77,-63.19,17z
  RegExp('!3d$_numero!4d$_numero'),
  RegExp('[?&](?:q|query|ll)=$_numero,\\s*$_numero'),
  RegExp('@$_numero,$_numero'),
  // Coordenadas sueltas: "-17.7762, -63.1950" (así las copia Google Maps).
  RegExp('^\\(?\\s*$_numero\\s*[,;\\s]\\s*$_numero\\s*\\)?\$'),
];

/// Saca latitud y longitud de un texto pegado: coordenadas o un enlace de Google Maps.
({double latitud, double longitud})? leerCoordenadas(String texto) {
  final limpio = texto.trim();
  if (limpio.isEmpty) return null;
  for (final patron in _patronesCoordenadas) {
    final m = patron.firstMatch(limpio);
    if (m == null) continue;
    final latitud = double.tryParse(m.group(1) ?? '');
    final longitud = double.tryParse(m.group(2) ?? '');
    if (latitud != null && longitud != null && latitud.abs() <= 90 && longitud.abs() <= 180) {
      return (latitud: latitud, longitud: longitud);
    }
  }
  return null;
}

// ── GPS y huella ──

/// Un problema con el GPS o con la huella, con el mensaje para mostrar.
class FallaDispositivo implements Exception {
  const FallaDispositivo(this.mensaje, {this.ajustes});
  final String mensaje;

  /// Qué ajustes ayudan a resolverlo: 'ubicacion' (GPS apagado) o 'app' (permiso negado).
  final String? ajustes;

  @override
  String toString() => mensaje;
}

/// Lee la ubicación actual con la mayor precisión posible. Pide el permiso si hace falta.
Future<Position> leerUbicacion() async {
  bool encendido;
  try {
    encendido = await Geolocator.isLocationServiceEnabled();
  } catch (_) {
    encendido = true;
  }
  if (!encendido) {
    throw const FallaDispositivo(
      'La ubicación (GPS) del teléfono está apagada. Enciéndela e intenta de nuevo.',
      ajustes: 'ubicacion',
    );
  }

  var permiso = await Geolocator.checkPermission();
  if (permiso == LocationPermission.denied) {
    permiso = await Geolocator.requestPermission();
  }
  if (permiso == LocationPermission.deniedForever) {
    throw const FallaDispositivo(
      'La app no tiene permiso para usar la ubicación. Actívalo en los ajustes de la app (Permisos → Ubicación).',
      ajustes: 'app',
    );
  }
  if (permiso != LocationPermission.whileInUse && permiso != LocationPermission.always) {
    throw const FallaDispositivo('Sin el permiso de ubicación no se puede marcar la asistencia.');
  }

  try {
    return await Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.best,
        timeLimit: const Duration(seconds: 25),
      ),
    );
  } on TimeoutException {
    throw const FallaDispositivo(
      'El GPS tardó demasiado en ubicarte. Acércate a una ventana o sal a un lugar abierto e intenta de nuevo.',
    );
  } catch (_) {
    throw const FallaDispositivo(
      'No se pudo leer tu ubicación. Revisa que el GPS esté encendido e intenta de nuevo.',
      ajustes: 'ubicacion',
    );
  }
}

/// Abre los ajustes que indica la falla (si indica alguno).
Future<void> abrirAjustesDe(FallaDispositivo falla) async {
  if (falla.ajustes == 'ubicacion') {
    await Geolocator.openLocationSettings();
  } else if (falla.ajustes == 'app') {
    await Geolocator.openAppSettings();
  }
}

String _mensajeHuella(String codigo) {
  final c = codigo.toLowerCase();
  if (c.contains('cancel') || c == 'timeout') {
    return 'No se confirmó la huella, así que no se marcó nada.';
  }
  if (c.contains('enrolled') || c.contains('credentials')) {
    return 'No tienes ninguna huella registrada en el teléfono. '
        'Regístrala en Ajustes → Seguridad → Huella digital y vuelve a intentar.';
  }
  if (c.contains('lockout')) {
    return 'Demasiados intentos fallidos. Desbloquea el teléfono con tu PIN o patrón y vuelve a intentar.';
  }
  if (c.contains('hardware')) {
    return 'El lector de huella no está disponible en este teléfono.';
  }
  return 'No se pudo usar el lector de huella. Intenta de nuevo.';
}

/// Pide la huella con el diálogo del sistema. Termina sin error solo si el teléfono la confirmó.
/// La huella nunca sale del teléfono: la app solo recibe "sí" o "no".
Future<void> confirmarHuella(String motivo) async {
  final auth = LocalAuthentication();
  try {
    final soportado = await auth.isDeviceSupported();
    final tieneLector = await auth.canCheckBiometrics;
    if (!soportado || !tieneLector) {
      throw const FallaDispositivo(
        'Este teléfono no tiene lector de huella (o no está habilitado). Sin huella no se puede marcar.',
      );
    }
    final registradas = await auth.getAvailableBiometrics();
    if (registradas.isEmpty) {
      throw FallaDispositivo(_mensajeHuella('noBiometricsEnrolled'));
    }
    final confirmada = await auth.authenticate(localizedReason: motivo, biometricOnly: true);
    if (!confirmada) {
      throw FallaDispositivo(_mensajeHuella('userCanceled'));
    }
  } on FallaDispositivo {
    rethrow;
  } on LocalAuthException catch (e) {
    throw FallaDispositivo(_mensajeHuella(e.code.name));
  } catch (_) {
    throw FallaDispositivo(_mensajeHuella(''));
  }
}

// ── Widgets ──

/// Recuadro con el mensaje de una falla y, si aplica, el botón para abrir los ajustes.
class AvisoFalla extends StatelessWidget {
  const AvisoFalla({super.key, required this.falla});
  final FallaDispositivo falla;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: esquema.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.error_outline, size: 20, color: esquema.onErrorContainer),
              const SizedBox(width: 8),
              Expanded(child: Text(falla.mensaje, style: TextStyle(color: esquema.onErrorContainer))),
            ],
          ),
          if (falla.ajustes != null)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => abrirAjustesDe(falla),
                child: Text(falla.ajustes == 'ubicacion' ? 'Abrir ajustes de ubicación' : 'Abrir ajustes de la app'),
              ),
            ),
        ],
      ),
    );
  }
}

/// Una marcación en una lista: fecha, entrada → salida y cuánto duró.
class TarjetaMarcacion extends StatelessWidget {
  const TarjetaMarcacion({super.key, required this.marcacion, this.conNombre = false});
  final Marcacion marcacion;

  /// Muestra de quién es (listas del Admin).
  final bool conNombre;

  @override
  Widget build(BuildContext context) {
    final m = marcacion;
    final tema = Theme.of(context);
    final gris = tema.colorScheme.onSurfaceVariant;
    final dia = DateTime.tryParse(m.fecha) ?? m.entradaEn;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/control-asistencia/marcacion/${m.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      conNombre ? m.usuarioNombre : fechaLarga(dia),
                      style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (m.conRetraso) ...[
                    Etiqueta('${m.retrasoMin} min tarde', tono: Tono.peligro),
                    const SizedBox(width: 6),
                  ],
                  if (m.abierta)
                    const Etiqueta('Sin salida', tono: Tono.aviso)
                  else if (m.salidaManual)
                    const Etiqueta('Salida a mano', tono: Tono.info),
                ],
              ),
              if (conNombre) ...[
                const SizedBox(height: 2),
                Text('${fechaLarga(dia)} · ${m.lugarNombre}', style: tema.textTheme.bodySmall?.copyWith(color: gris)),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.login, size: 16),
                  const SizedBox(width: 6),
                  Text(hora(m.entradaEn)),
                  const SizedBox(width: 14),
                  const Icon(Icons.logout, size: 16),
                  const SizedBox(width: 6),
                  Text(m.salidaEn == null ? '—' : hora(m.salidaEn!)),
                  const Spacer(),
                  if (m.minutos != null)
                    Text(duracionTexto(m.minutos!), style: tema.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Fila "clave: valor" de una ficha.
class FilaDato extends StatelessWidget {
  const FilaDato(this.clave, this.valor, {super.key, this.copiable = false});
  final String clave;
  final String valor;

  /// Muestra un botón para copiar el valor (coordenadas).
  final bool copiable;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 104,
            child: Text(clave, style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant)),
          ),
          Expanded(child: Text(valor)),
          if (copiable)
            InkWell(
              onTap: () async {
                await Clipboard.setData(ClipboardData(text: valor));
                if (context.mounted) avisar(context, 'Copiado. Puedes pegarlo en Google Maps.');
              },
              child: const Padding(
                padding: EdgeInsets.only(left: 8),
                child: Icon(Icons.copy, size: 18),
              ),
            ),
        ],
      ),
    );
  }
}
