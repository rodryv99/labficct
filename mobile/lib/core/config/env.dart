/// Variables de entorno de la app. Se leen al compilar con
/// `flutter run --dart-define-from-file=env/dev.env`.
abstract final class Env {
  static const appName = String.fromEnvironment('APP_NAME', defaultValue: 'Laboratorios FICCT');
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const wsBaseUrl = String.fromEnvironment('WS_BASE_URL');

  /// Mensaje de error si falta configuración; null si todo está bien.
  static String? get problema {
    if (apiBaseUrl.isEmpty) {
      return 'Falta API_BASE_URL. Ejecuta la app con --dart-define-from-file=env/dev.env '
          '(copia env/dev.env.example como env/dev.env).';
    }
    return null;
  }
}
