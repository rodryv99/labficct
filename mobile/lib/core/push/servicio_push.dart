import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../network/repositorio.dart';

/// Canal de Android donde se muestran los avisos (debe coincidir con el backend).
const _canalAvisos = AndroidNotificationChannel(
  'labficct_avisos',
  'Avisos de LabFICCT',
  description: 'Asistencia, reservas, tareas y recordatorios de turno.',
  importance: Importance.high,
);

/// Se ejecuta cuando llega un push con la app cerrada o en segundo plano.
/// Debe ser una función de nivel superior. El sistema muestra la notificación
/// solo; aquí no hace falta nada, pero Firebase exige registrarla.
@pragma('vm:entry-point')
Future<void> manejadorPushEnSegundoPlano(RemoteMessage message) async {
  // Sin trabajo: la bandeja del sistema muestra el aviso. Queda por si luego
  // se quiere, por ejemplo, actualizar un contador local.
}

/// Conecta la app con Firebase Cloud Messaging: pide permiso, registra el token
/// en el backend y muestra los avisos que llegan con la app abierta.
///
/// Todo es tolerante a fallos: si Firebase no está configurado todavía, la app
/// sigue funcionando y solo se pierde el push (la campana no depende de esto).
class ServicioPush {
  ServicioPush(this._repo);

  final Repositorio _repo;
  final _local = FlutterLocalNotificationsPlugin();

  bool _iniciado = false;
  String? _token;

  /// La fija la capa de UI para navegar al tocar un aviso.
  void Function(Map<String, dynamic> datos)? alAbrir;

  /// Prepara el canal y los manejadores. Se llama una sola vez, al arrancar.
  Future<void> preparar() async {
    if (_iniciado) return;
    _iniciado = true;
    try {
      await _local.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(),
        ),
        onDidReceiveNotificationResponse: (respuesta) => _abrirDesdePayload(respuesta.payload),
      );
      await _local
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_canalAvisos);

      // Con la app abierta: mostramos el aviso nosotros (iOS no lo hace solo).
      FirebaseMessaging.onMessage.listen(_mostrarLocal);
      // Tocó el aviso y la app estaba en segundo plano.
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _abrir(m.data));
    } catch (e) {
      debugPrint('Push: no se pudo preparar ($e). La app sigue sin push.');
    }
  }

  /// Tras iniciar sesión: pide permiso, obtiene el token y lo registra.
  Future<void> iniciarSesion() async {
    await preparar();
    try {
      final mensajeria = FirebaseMessaging.instance;
      await mensajeria.requestPermission();
      await mensajeria.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);

      final token = await mensajeria.getToken();
      if (token != null) {
        _token = token;
        await _repo.registrarDispositivo(token);
      }
      // Si FCM renueva el token, lo volvemos a registrar.
      mensajeria.onTokenRefresh.listen((nuevo) async {
        _token = nuevo;
        try {
          await _repo.registrarDispositivo(nuevo);
        } catch (_) {}
      });

      // Si la app se abrió tocando un aviso (estaba cerrada del todo).
      final inicial = await mensajeria.getInitialMessage();
      if (inicial != null) _abrir(inicial.data);
    } catch (e) {
      debugPrint('Push: no se pudo iniciar sesión de push ($e).');
    }
  }

  /// Al cerrar sesión: da de baja este teléfono para que no reciba más avisos.
  Future<void> cerrarSesion() async {
    final token = _token;
    _token = null;
    if (token == null) return;
    try {
      await _repo.bajaDispositivo(token);
    } catch (_) {
      // Aunque el servidor no responda, se intentará limpiar al próximo envío.
    }
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }

  Future<void> _mostrarLocal(RemoteMessage mensaje) async {
    final aviso = mensaje.notification;
    if (aviso == null) return;
    try {
      await _local.show(
        aviso.hashCode,
        aviso.title,
        aviso.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _canalAvisos.id,
            _canalAvisos.name,
            channelDescription: _canalAvisos.description,
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        payload: jsonEncode(mensaje.data),
      );
    } catch (e) {
      debugPrint('Push: no se pudo mostrar el aviso ($e).');
    }
  }

  void _abrirDesdePayload(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      final datos = Map<String, dynamic>.from(jsonDecode(payload) as Map);
      _abrir(datos);
    } catch (_) {}
  }

  void _abrir(Map<String, dynamic> datos) {
    alAbrir?.call(datos);
  }
}
