import 'package:flutter/material.dart';

/// Colores tomados del logo de la FICCT (los mismos que usa la web).
abstract final class ColoresFicct {
  static const azul = Color(0xFF034481);
  static const azulOscuro = Color(0xFF013972);
  static const oro = Color(0xFFF89000);
  static const clase = Color(0xFF034481);
  static const reserva = Color(0xFFB45309);
}

ThemeData temaFicct(Brightness brillo) {
  final esquema = ColorScheme.fromSeed(seedColor: ColoresFicct.azul, brightness: brillo).copyWith(
    primary: brillo == Brightness.light ? ColoresFicct.azul : const Color(0xFF7FB9F0),
  );
  final base = ThemeData(colorScheme: esquema, useMaterial3: true, brightness: brillo);
  final redondeo = BorderRadius.circular(10);

  return base.copyWith(
    scaffoldBackgroundColor: brillo == Brightness.light ? const Color(0xFFF7F8FA) : esquema.surface,
    appBarTheme: AppBarTheme(
      backgroundColor: brillo == Brightness.light ? const Color(0xFFF7F8FA) : esquema.surface,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleTextStyle: base.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600, color: esquema.onSurface),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: esquema.surfaceContainerLowest,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: esquema.outlineVariant),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: redondeo),
      filled: true,
      fillColor: esquema.surfaceContainerLowest,
      isDense: true,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        shape: RoundedRectangleBorder(borderRadius: redondeo),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 44),
        shape: RoundedRectangleBorder(borderRadius: redondeo),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: esquema.surfaceContainerLowest,
      indicatorColor: esquema.primaryContainer,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
    ),
    chipTheme: base.chipTheme.copyWith(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
  );
}
