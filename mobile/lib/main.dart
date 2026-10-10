import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es');
  Intl.defaultLocale = 'es';

  runApp(
    ProviderScope(
      // Sin reintentos automáticos: cada pantalla tiene su botón "Reintentar"
      // y deslizar hacia abajo para actualizar.
      retry: (intento, error) => null,
      child: const LabFicctApp(),
    ),
  );
}
