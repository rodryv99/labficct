import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Identidad «Plano de laboratorio» (la misma de la web).
///
/// La app se ve como el plano técnico de un laboratorio: papel azulado, tinta
/// azul marino, líneas finas y la tipografía Barlow. El azul del escudo de la
/// FICCT es el color principal; el oro marca lo seleccionado.
///
/// Hay dos temas, que siguen al del teléfono: Plano (claro) y Nocturno (oscuro).
abstract final class ColoresFicct {
  static const azul = Color(0xFF034481);
  static const azulOscuro = Color(0xFF013972);
  static const oro = Color(0xFFF89000);
  static const clase = Color(0xFF034481);
  static const reserva = Color(0xFFB45309);

  /// Tinta del plano (texto en el tema claro).
  static const tinta = Color(0xFF0B2545);

  /// Marca de selección, según el tema.
  static Color acento(Brightness brillo) =>
      brillo == Brightness.light ? const Color(0xFFF2A100) : const Color(0xFFF5B301);

  /// Líneas de la cuadrícula de fondo, según el tema.
  static Color rejilla(Brightness brillo) =>
      brillo == Brightness.light ? const Color(0x13034481) : const Color(0x1078AAE6);
}

ColorScheme _esquema(Brightness brillo) {
  final base = ColorScheme.fromSeed(seedColor: ColoresFicct.azul, brightness: brillo);
  if (brillo == Brightness.light) {
    return base.copyWith(
      primary: ColoresFicct.azul,
      onPrimary: Colors.white,
      primaryContainer: const Color(0xFFDCE8F6),
      onPrimaryContainer: const Color(0xFF062B54),
      secondary: const Color(0xFF2A4163),
      onSecondary: Colors.white,
      secondaryContainer: const Color(0xFFE3EAF3),
      onSecondaryContainer: ColoresFicct.tinta,
      tertiary: const Color(0xFFA85800),
      onTertiary: Colors.white,
      tertiaryContainer: const Color(0xFFFFE9C2),
      onTertiaryContainer: const Color(0xFF4A2A00),
      error: const Color(0xFFC8102E),
      onError: Colors.white,
      errorContainer: const Color(0xFFFBE3E6),
      onErrorContainer: const Color(0xFF5A0A14),
      surface: const Color(0xFFEDF2F8),
      onSurface: ColoresFicct.tinta,
      onSurfaceVariant: const Color(0xFF4F6583),
      outline: const Color(0xFF8FA3BD),
      outlineVariant: const Color(0xFFC3D2E4),
      surfaceContainerLowest: Colors.white,
      surfaceContainerLow: const Color(0xFFF4F7FB),
      surfaceContainer: const Color(0xFFE6EDF5),
      surfaceContainerHigh: const Color(0xFFDEE7F1),
      surfaceContainerHighest: const Color(0xFFD5E0EC),
      inverseSurface: ColoresFicct.tinta,
      onInverseSurface: const Color(0xFFEDF2F8),
      inversePrimary: const Color(0xFF7DB9FF),
      surfaceTint: Colors.transparent,
    );
  }
  return base.copyWith(
    primary: const Color(0xFF7DB9FF),
    onPrimary: const Color(0xFF08203D),
    primaryContainer: const Color(0xFF12294A),
    onPrimaryContainer: const Color(0xFFD6E7FB),
    secondary: const Color(0xFFA6B8D0),
    onSecondary: const Color(0xFF0C1524),
    secondaryContainer: const Color(0xFF1D2F4C),
    onSecondaryContainer: const Color(0xFFE3ECF7),
    tertiary: const Color(0xFFF5A742),
    onTertiary: const Color(0xFF3A2200),
    tertiaryContainer: const Color(0xFF4A3000),
    onTertiaryContainer: const Color(0xFFFFE1B0),
    error: const Color(0xFFFF8080),
    onError: const Color(0xFF3D0A0A),
    errorContainer: const Color(0xFF5A1A1F),
    onErrorContainer: const Color(0xFFFFD9DB),
    surface: const Color(0xFF0C1524),
    onSurface: const Color(0xFFE3ECF7),
    onSurfaceVariant: const Color(0xFFA6B8D0),
    outline: const Color(0xFF5A7090),
    outlineVariant: const Color(0xFF2B3E58),
    // En el tema Nocturno las tarjetas son más claras que el fondo.
    surfaceContainerLowest: const Color(0xFF131F33),
    surfaceContainerLow: const Color(0xFF111C2E),
    surfaceContainer: const Color(0xFF162338),
    surfaceContainerHigh: const Color(0xFF1A2A44),
    surfaceContainerHighest: const Color(0xFF1F3251),
    inverseSurface: const Color(0xFFE3ECF7),
    onInverseSurface: const Color(0xFF0C1524),
    inversePrimary: ColoresFicct.azul,
    surfaceTint: Colors.transparent,
  );
}

/// Estilo de los títulos: la letra condensada de los rótulos de planos.
TextStyle estiloTitulo({double? tamano, Color? color, FontWeight peso = FontWeight.w600}) =>
    GoogleFonts.barlowCondensed(fontSize: tamano, color: color, fontWeight: peso, height: 1.05);

ThemeData temaFicct(Brightness brillo) {
  final esquema = _esquema(brillo);
  final base = ThemeData(colorScheme: esquema, useMaterial3: true, brightness: brillo);
  final acento = ColoresFicct.acento(brillo);
  final superficie = esquema.surfaceContainerLowest;

  const radioChico = BorderRadius.all(Radius.circular(4));
  const radioMedio = BorderRadius.all(Radius.circular(6));
  final linea = BorderSide(color: esquema.outlineVariant, width: 1.5);

  // Barlow para todo el texto; Barlow Condensed para títulos y cifras grandes.
  final texto = GoogleFonts.barlowTextTheme(base.textTheme).apply(
    bodyColor: esquema.onSurface,
    displayColor: esquema.onSurface,
  );
  TextStyle? condensada(TextStyle? estilo, {double? tamano}) => estilo == null
      ? null
      : GoogleFonts.barlowCondensed(
          textStyle: estilo,
          fontWeight: FontWeight.w600,
          fontSize: tamano ?? estilo.fontSize,
          letterSpacing: 0,
        );
  final tipografia = texto.copyWith(
    displayLarge: condensada(texto.displayLarge),
    displayMedium: condensada(texto.displayMedium),
    displaySmall: condensada(texto.displaySmall),
    headlineLarge: condensada(texto.headlineLarge),
    headlineMedium: condensada(texto.headlineMedium),
    headlineSmall: condensada(texto.headlineSmall, tamano: 28),
    titleLarge: condensada(texto.titleLarge, tamano: 25),
    titleMedium: texto.titleMedium?.copyWith(fontWeight: FontWeight.w600),
    titleSmall: texto.titleSmall?.copyWith(fontWeight: FontWeight.w600),
    labelLarge: texto.labelLarge?.copyWith(fontWeight: FontWeight.w600, fontSize: 15),
  );

  return base.copyWith(
    textTheme: tipografia,
    scaffoldBackgroundColor: esquema.surface,
    dividerColor: esquema.outlineVariant,
    appBarTheme: AppBarTheme(
      backgroundColor: esquema.surface,
      foregroundColor: esquema.onSurface,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: estiloTitulo(tamano: 28, color: esquema.onSurface),
      shape: Border(bottom: linea),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: superficie,
      shape: RoundedRectangleBorder(borderRadius: radioMedio, side: linea),
    ),
    dividerTheme: DividerThemeData(color: esquema.outlineVariant, thickness: 1, space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: superficie,
      isDense: true,
      border: OutlineInputBorder(borderRadius: radioChico, borderSide: BorderSide(color: esquema.outline, width: 1.5)),
      enabledBorder:
          OutlineInputBorder(borderRadius: radioChico, borderSide: BorderSide(color: esquema.outline, width: 1.5)),
      focusedBorder:
          OutlineInputBorder(borderRadius: radioChico, borderSide: BorderSide(color: esquema.primary, width: 2)),
      errorBorder:
          OutlineInputBorder(borderRadius: radioChico, borderSide: BorderSide(color: esquema.error, width: 1.5)),
      focusedErrorBorder:
          OutlineInputBorder(borderRadius: radioChico, borderSide: BorderSide(color: esquema.error, width: 2)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        shape: const RoundedRectangleBorder(borderRadius: radioChico),
        textStyle: tipografia.labelLarge?.copyWith(fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 44),
        foregroundColor: esquema.onSurface,
        side: BorderSide(color: esquema.onSurfaceVariant, width: 1.5),
        shape: const RoundedRectangleBorder(borderRadius: radioChico),
        textStyle: tipografia.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: const RoundedRectangleBorder(borderRadius: radioChico),
        textStyle: tipografia.labelLarge,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        elevation: 0,
        shape: const RoundedRectangleBorder(borderRadius: radioChico),
        textStyle: tipografia.labelLarge,
      ),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: esquema.primary,
      foregroundColor: esquema.onPrimary,
      elevation: 1,
      focusElevation: 1,
      hoverElevation: 2,
      highlightElevation: 2,
      shape: const RoundedRectangleBorder(borderRadius: radioMedio),
      extendedTextStyle: tipografia.labelLarge?.copyWith(fontSize: 16),
    ),
    // La pestaña actual se marca con oro, como un punto señalado en el plano.
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: superficie,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      height: 68,
      indicatorColor: acento,
      indicatorShape: const RoundedRectangleBorder(borderRadius: radioChico),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith(
        (estados) => IconThemeData(
          color: estados.contains(WidgetState.selected) ? ColoresFicct.tinta : esquema.onSurfaceVariant,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (estados) => tipografia.labelMedium?.copyWith(
          fontSize: 13,
          fontWeight: estados.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
          color: estados.contains(WidgetState.selected) ? esquema.onSurface : esquema.onSurfaceVariant,
        ),
      ),
    ),
    tabBarTheme: TabBarThemeData(
      indicatorColor: acento,
      labelColor: esquema.onSurface,
      unselectedLabelColor: esquema.onSurfaceVariant,
      dividerColor: esquema.outlineVariant,
      labelStyle: tipografia.titleSmall,
      unselectedLabelStyle: tipografia.titleSmall?.copyWith(fontWeight: FontWeight.w500),
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: const RoundedRectangleBorder(borderRadius: radioChico),
      side: BorderSide(color: esquema.outlineVariant, width: 1.5),
      labelStyle: tipografia.labelLarge?.copyWith(fontWeight: FontWeight.w500, fontSize: 14),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: superficie,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: radioMedio, side: linea),
      titleTextStyle: estiloTitulo(tamano: 26, color: esquema.onSurface),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: superficie,
      surfaceTintColor: Colors.transparent,
      modalBackgroundColor: superficie,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: superficie,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: radioMedio, side: linea),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: esquema.inverseSurface,
      contentTextStyle: tipografia.bodyMedium?.copyWith(color: esquema.onInverseSurface),
      shape: const RoundedRectangleBorder(borderRadius: radioChico),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: esquema.onSurfaceVariant,
      titleTextStyle: tipografia.bodyLarge?.copyWith(fontWeight: FontWeight.w500),
      subtitleTextStyle: tipografia.bodyMedium?.copyWith(color: esquema.onSurfaceVariant),
    ),
    checkboxTheme: const CheckboxThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(2))),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: esquema.primary),
  );
}

/// Fondo de cuadrícula tipo plano. Va detrás del contenido de una pantalla.
class FondoPlano extends StatelessWidget {
  const FondoPlano({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final brillo = Theme.of(context).brightness;
    return CustomPaint(painter: _Cuadricula(ColoresFicct.rejilla(brillo)), child: child);
  }
}

class _Cuadricula extends CustomPainter {
  const _Cuadricula(this.color);

  final Color color;
  static const double _paso = 26;

  @override
  void paint(Canvas canvas, Size size) {
    final pincel = Paint()
      ..color = color
      ..strokeWidth = 1;
    for (var x = 0.0; x <= size.width; x += _paso) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), pincel);
    }
    for (var y = 0.0; y <= size.height; y += _paso) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), pincel);
    }
  }

  @override
  bool shouldRepaint(_Cuadricula anterior) => anterior.color != color;
}
