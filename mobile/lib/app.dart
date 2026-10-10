import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config/env.dart';
import 'core/router/router.dart';
import 'core/theme/tema.dart';

class LabFicctApp extends ConsumerWidget {
  const LabFicctApp({super.key});

  static const _idiomas = [Locale('es'), Locale('en')];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final problema = Env.problema;
    if (problema != null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: temaFicct(Brightness.light),
        home: _FaltaConfiguracion(mensaje: problema),
      );
    }

    return MaterialApp.router(
      title: Env.appName,
      debugShowCheckedModeBanner: false,
      theme: temaFicct(Brightness.light),
      darkTheme: temaFicct(Brightness.dark),
      routerConfig: ref.watch(routerProvider),
      locale: const Locale('es'),
      supportedLocales: _idiomas,
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
    );
  }
}

/// Se muestra si la app se compiló sin env/dev.env: así el error es evidente.
class _FaltaConfiguracion extends StatelessWidget {
  const _FaltaConfiguracion({required this.mensaje});
  final String mensaje;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.settings_suggest_outlined, size: 40, color: tema.colorScheme.error),
              const SizedBox(height: 16),
              Text('Falta configuración', style: tema.textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(mensaje, style: tema.textTheme.bodyLarge),
              const SizedBox(height: 16),
              const SelectableText('flutter run --dart-define-from-file=env/dev.env'),
            ],
          ),
        ),
      ),
    );
  }
}
