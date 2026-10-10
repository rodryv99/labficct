import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Guarda los tokens: el de acceso en memoria y el de renovación cifrado
/// en el almacenamiento seguro del teléfono.
class AlmacenTokens {
  AlmacenTokens([FlutterSecureStorage? almacen]) : _almacen = almacen ?? const FlutterSecureStorage();

  static const _claveRefresh = 'labficct_refresh';
  final FlutterSecureStorage _almacen;
  String? acceso;

  Future<String?> leerRefresh() => _almacen.read(key: _claveRefresh);

  Future<void> guardar({required String acceso, String? refresh}) async {
    this.acceso = acceso;
    if (refresh != null) await _almacen.write(key: _claveRefresh, value: refresh);
  }

  Future<void> borrar() async {
    acceso = null;
    await _almacen.delete(key: _claveRefresh);
  }
}
