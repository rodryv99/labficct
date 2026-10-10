import 'package:dio/dio.dart';

import '../auth/almacen_tokens.dart';
import '../config/env.dart';
import 'endpoints.dart';

/// Cliente HTTP único de la app. Agrega el token a cada petición y, si el
/// servidor responde 401, renueva el token una vez y repite la petición.
class ApiCliente {
  ApiCliente(this.tokens) {
    dio = Dio(_opciones());
    dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onRequest: (opciones, handler) {
          final acceso = tokens.acceso;
          if (acceso != null) opciones.headers['Authorization'] = 'Bearer $acceso';
          handler.next(opciones);
        },
        onError: (error, handler) async {
          final opciones = error.requestOptions;
          final esAuth = opciones.path.startsWith('/auth/login') || opciones.path.startsWith('/auth/refresh');
          if (error.response?.statusCode == 401 && !esAuth && opciones.extra['reintentado'] != true) {
            final nuevo = await renovar();
            if (nuevo != null) {
              opciones.extra['reintentado'] = true;
              opciones.headers['Authorization'] = 'Bearer $nuevo';
              // Un FormData (p. ej. la foto de un objeto) solo se puede enviar una vez.
              final datos = opciones.data;
              if (datos is FormData) opciones.data = datos.clone();
              try {
                // Se repite con un Dio sin interceptores para no bloquear la cola.
                final respuesta = await Dio(_opciones()).fetch<dynamic>(opciones);
                handler.resolve(respuesta);
              } on DioException catch (e) {
                handler.next(e);
              }
              return;
            }
            alExpirarSesion?.call();
          }
          handler.next(error);
        },
      ),
    );
  }

  final AlmacenTokens tokens;
  late final Dio dio;

  /// Lo asigna la sesión para volver al login cuando el token ya no sirve.
  void Function()? alExpirarSesion;

  static BaseOptions _opciones() => BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        // Con esta cabecera el backend devuelve también el token de renovación.
        headers: {'X-Cliente': 'movil'},
      );

  /// Pide un token de acceso nuevo con el de renovación guardado.
  /// Nunca lanza: ante cualquier problema (red, token vencido, almacenamiento
  /// del teléfono dañado) devuelve null y la app vuelve al login.
  Future<String?> renovar() async {
    try {
      final refresh = await tokens.leerRefresh();
      if (refresh == null) return null;
      final respuesta = await Dio(_opciones()).post<Map<String, dynamic>>(
        Endpoints.refresh,
        data: {'refresh': refresh},
      );
      final datos = respuesta.data!;
      await tokens.guardar(acceso: datos['access'] as String, refresh: datos['refresh'] as String?);
      return datos['access'] as String;
    } catch (_) {
      try {
        await tokens.borrar();
      } catch (_) {
        // Si el almacenamiento seguro falla, igual se sigue sin sesión.
      }
      return null;
    }
  }
}

/// Mensaje para mostrar a partir de un error de la API.
String mensajeDeError(Object error, [String porDefecto = 'No se pudo completar la acción.']) {
  if (error is DioException) {
    final datos = error.response?.data;
    if (datos is Map && datos['mensaje'] is String) return datos['mensaje'] as String;
    if (error.response == null) {
      return 'No hay conexión con el servidor. Revisa que el backend esté encendido y la IP de env/dev.env.';
    }
    if ((error.response?.statusCode ?? 0) >= 500) return 'El servidor tuvo un problema. Intenta de nuevo.';
  }
  return porDefecto;
}

/// Lista de choques que devuelve el backend en un 409.
List<String> choquesDeError(Object error) {
  if (error is DioException) {
    final datos = error.response?.data;
    if (datos is Map && datos['choques'] is List) {
      return (datos['choques'] as List).map((c) => c.toString()).toList();
    }
  }
  return const [];
}

/// Errores por campo de un 400: {"titulo": "Este campo es obligatorio.", "bloques.0.hora_fin": "..."}.
Map<String, String> erroresDeCampos(Object error) {
  final salida = <String, String>{};
  void recorrer(dynamic valor, String ruta) {
    if (valor is String) {
      salida.putIfAbsent(ruta, () => valor);
    } else if (valor is List) {
      if (valor.isNotEmpty && valor.every((v) => v is String)) {
        salida.putIfAbsent(ruta, () => valor.first as String);
      } else {
        for (var i = 0; i < valor.length; i++) {
          recorrer(valor[i], ruta.isEmpty ? '$i' : '$ruta.$i');
        }
      }
    } else if (valor is Map) {
      valor.forEach((k, v) => recorrer(v, ruta.isEmpty ? '$k' : '$ruta.$k'));
    }
  }

  if (error is DioException) {
    final datos = error.response?.data;
    if (datos is Map && datos['campos'] is Map) recorrer(datos['campos'], '');
  }
  return salida;
}
