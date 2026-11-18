import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

import 'app.dart';
import 'core/push/servicio_push.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es');
  Intl.defaultLocale = 'es';

  // Push: si Firebase no está configurado todavía, la app arranca igual (sin push).
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(manejadorPushEnSegundoPlano);
  } catch (e) {
    debugPrint('Firebase no disponible ($e). La app funciona sin push.');
  }

  runApp(
    ProviderScope(
      // Sin reintentos automáticos: cada pantalla tiene su botón "Reintentar"
      // y deslizar hacia abajo para actualizar.
      retry: (intento, error) => null,
      child: const LabFicctApp(),
    ),
  );
}
