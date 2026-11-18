import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';

import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import 'marcaciones_comun.dart';

/// El auxiliar marca aquí su entrada y su salida: primero se comprueba el GPS,
/// después pide la huella y recién entonces se registra.
class MiAsistenciaPage extends ConsumerStatefulWidget {
  const MiAsistenciaPage({super.key});

  @override
  ConsumerState<MiAsistenciaPage> createState() => _MiAsistenciaPageState();
}

/// La última lectura del GPS, para mostrar a qué distancia está del lugar.
typedef _Lectura = ({double distancia, double precision, bool dentro});

class _MiAsistenciaPageState extends ConsumerState<MiAsistenciaPage> {
  /// Texto del paso en curso ("Buscando tu ubicación…"); null = sin nada en curso.
  String? _paso;
  FallaDispositivo? _falla;
  _Lectura? _lectura;

  bool get _ocupado => _paso != null;

  /// Lee el GPS y revisa que sirva para marcar en [lugar]. Lanza [FallaDispositivo] si no.
  Future<Position> _ubicarme(EstadoAsistencia estado, LugarAsistencia lugar) async {
    final p = await leerUbicacion();
    final distancia = Geolocator.distanceBetween(p.latitude, p.longitude, lugar.latitud, lugar.longitud);
    final dentro = distancia <= lugar.radioM;
    if (mounted) {
      setState(() => _lectura = (distancia: distancia, precision: p.accuracy, dentro: dentro));
    }
    if (p.isMocked) {
      throw const FallaDispositivo(
        'El teléfono está usando una ubicación simulada. Desactívala (Opciones de desarrollador) para marcar.',
      );
    }
    if (p.accuracy > estado.precisionMaximaM) {
      throw FallaDispositivo(
        p.accuracy > 1000
            ? 'El teléfono solo dio una ubicación aproximada. En los ajustes de la app, en Permisos → Ubicación, '
                'activa «Usar ubicación precisa».'
            : 'La señal del GPS es muy imprecisa (± ${p.accuracy.round()} m). '
                'Acércate a una ventana o sal a un lugar abierto e intenta de nuevo.',
        ajustes: p.accuracy > 1000 ? 'app' : null,
      );
    }
    if (!dentro) {
      throw FallaDispositivo(
        'Estás a ${distancia.round()} m de ${lugar.nombre}. Para marcar debes estar a ${lugar.radioM} m o menos.',
      );
    }
    return p;
  }

  Future<void> _marcar(EstadoAsistencia estado) async {
    final lugar = estado.lugar;
    if (lugar == null || _ocupado) return;
    final tipo = estado.abierta == null ? 'entrada' : 'salida';
    final contenedor = ProviderScope.containerOf(context, listen: false);
    final repo = ref.read(repositorioProvider);
    setState(() {
      _paso = 'Buscando tu ubicación…';
      _falla = null;
    });
    try {
      final p = await _ubicarme(estado, lugar);
      if (!mounted) return;
      setState(() => _paso = 'Confirma tu huella…');
      await confirmarHuella(
        tipo == 'entrada' ? 'Confirma tu huella para marcar tu entrada' : 'Confirma tu huella para marcar tu salida',
      );
      if (!mounted) return;
      setState(() => _paso = 'Registrando…');
      final m = await repo.marcarAsistencia(
        tipo: tipo,
        latitud: p.latitude,
        longitud: p.longitude,
        precisionM: p.accuracy,
        simulada: p.isMocked,
      );
      refrescarAsistencia(contenedor);
      if (!mounted) return;
      final minutos = m.minutos;
      avisar(
        context,
        tipo == 'entrada'
            ? 'Entrada marcada a las ${hora(m.entradaEn)}.'
            : 'Salida marcada a las ${hora(m.salidaEn ?? DateTime.now())}.'
                '${minutos == null ? '' : ' Estuviste ${duracionTexto(minutos)}.'}',
      );
    } on FallaDispositivo catch (falla) {
      if (mounted) setState(() => _falla = falla);
    } catch (e) {
      // El servidor también comprueba la distancia: su mensaje ya explica qué pasó.
      if (mounted) setState(() => _falla = FallaDispositivo(mensajeDeError(e)));
    } finally {
      if (mounted) setState(() => _paso = null);
    }
  }

  /// Solo mide la distancia al lugar, sin marcar nada.
  Future<void> _comprobar(EstadoAsistencia estado) async {
    final lugar = estado.lugar;
    if (lugar == null || _ocupado) return;
    setState(() {
      _paso = 'Buscando tu ubicación…';
      _falla = null;
    });
    try {
      await _ubicarme(estado, lugar);
    } on FallaDispositivo catch (falla) {
      if (mounted) setState(() => _falla = falla);
    } catch (_) {
      if (mounted) setState(() => _falla = const FallaDispositivo('No se pudo leer tu ubicación.'));
    } finally {
      if (mounted) setState(() => _paso = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final estado = ref.watch(estadoAsistenciaProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi asistencia'),
        actions: [
          IconButton(
            tooltip: 'Mi historial',
            onPressed: () => context.push('/mi-asistencia/historial'),
            icon: const Icon(Icons.history),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(estadoAsistenciaProvider.future),
        child: estado.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 80),
            EstadoError(error: e, onReintentar: () => ref.invalidate(estadoAsistenciaProvider)),
          ]),
          data: (datos) => _contenido(context, datos),
        ),
      ),
    );
  }

  Widget _contenido(BuildContext context, EstadoAsistencia estado) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final lugar = estado.lugar;
    final abierta = estado.abierta;

    if (lugar == null) {
      return ListView(children: const [
        SizedBox(height: 60),
        EstadoVacio(
          icono: Icons.location_off_outlined,
          titulo: 'Todavía no tienes un lugar de asistencia',
          descripcion: 'El administrador tiene que asignarte el lugar donde marcas. Avísale y vuelve a entrar aquí.',
        ),
      ]);
    }

    final lectura = _lectura;
    final enCurso = abierta == null ? 0 : DateTime.now().difference(abierta.entradaEn).inMinutes;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        // ── Dónde ──
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.place_outlined, color: esquema.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(lugar.nombre, style: tema.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      if (lugar.referencia.isNotEmpty)
                        Text(lugar.referencia, style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant)),
                      const SizedBox(height: 4),
                      Text('Para marcar debes estar a ${lugar.radioM} m o menos de este lugar.'),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // ── Cómo voy ──
        Center(
          child: Column(
            children: [
              Icon(
                abierta == null ? Icons.radio_button_unchecked : Icons.check_circle,
                size: 44,
                color: abierta == null ? esquema.outline : const Color(0xFF0E7A3E),
              ),
              const SizedBox(height: 8),
              Text(
                abierta == null
                    ? (estado.hoy.isEmpty ? 'Todavía no marcaste tu entrada' : 'Ya marcaste tu salida')
                    : 'Entraste a las ${hora(abierta.entradaEn)}',
                style: tema.textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                abierta != null
                    ? 'Llevas ${duracionTexto(enCurso)}. No olvides marcar la salida al irte.'
                    : (estado.minutosHoy > 0 ? 'Hoy estuviste ${duracionTexto(estado.minutosHoy)}.' : fechaLarga(DateTime.now())),
                style: tema.textTheme.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // ── Marcar ──
        SizedBox(
          height: 56,
          child: FilledButton.icon(
            onPressed: _ocupado ? null : () => _marcar(estado),
            icon: _ocupado
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
                : const Icon(Icons.fingerprint),
            label: Text(
              _paso ?? (abierta == null ? 'Marcar entrada' : 'Marcar salida'),
              style: const TextStyle(fontSize: 16),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: TextButton.icon(
            onPressed: _ocupado ? null : () => _comprobar(estado),
            icon: const Icon(Icons.my_location, size: 18),
            label: const Text('Comprobar mi ubicación'),
          ),
        ),

        if (_falla != null) ...[
          const SizedBox(height: 8),
          AvisoFalla(falla: _falla!),
        ],
        if (lectura != null) ...[
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                lectura.dentro ? Icons.check_circle_outline : Icons.social_distance,
                size: 18,
                color: lectura.dentro ? const Color(0xFF0E7A3E) : esquema.error,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  'Estás a ${lectura.distancia.round()} m del lugar (GPS ± ${lectura.precision.round()} m)',
                  style: tema.textTheme.bodySmall,
                ),
              ),
            ],
          ),
        ],

        // ── Hoy ──
        if (estado.hoy.isNotEmpty) ...[
          const TituloSeccion('Hoy'),
          for (final m in estado.hoy)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: TarjetaMarcacion(marcacion: m),
            ),
        ],

        const SizedBox(height: 16),
        Text(
          'Tu huella la verifica tu propio teléfono y no se envía a ningún lado. '
          'Se guarda la hora y dónde estabas al marcar.',
          style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
