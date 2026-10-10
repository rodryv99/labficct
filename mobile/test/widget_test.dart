// Pruebas de lógica pura de la app (no necesitan emulador): `flutter test`.
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:labficct/core/modelos/modelos.dart';
import 'package:labficct/core/network/api_cliente.dart';
import 'package:labficct/core/router/router.dart';

Usuario _usuario(String rol, List<String> permisos) => Usuario(
      id: 1,
      email: 'x@ficct.edu.bo',
      nombres: 'Ana',
      apellidos: 'Rojas',
      nombreCompleto: 'Ana Rojas',
      rol: rol,
      rolNombre: rol,
      permisos: permisos,
    );

void main() {
  group('Pestañas por rol', () {
    test('el auxiliar empieza en Hoy y ve objetos perdidos', () {
      final rutas = pestanasDe(_usuario('auxiliar', [
        'pizarra.ver',
        'laboratorios.ver',
        'reservas.ver',
        'reservas.gestionar',
        'objetos.ver',
        'horarios.ver',
      ])).map((p) => p.ruta);
      expect(rutas, ['/hoy', '/laboratorios', '/reservas', '/objetos']);
    });

    test('el docente ve sus clases y sus reservas, sin pizarra', () {
      final pestanas = pestanasDe(_usuario('docente', ['laboratorios.ver', 'reservas.ver', 'horarios.ver']));
      expect(pestanas.map((p) => p.ruta), ['/clases', '/laboratorios', '/reservas']);
      expect(pestanas.first.etiqueta, 'Mis clases');
      expect(pestanas.last.etiqueta, 'Mis reservas');
    });
  });

  test('una reserva sabe cuándo termina su último día', () {
    final r = Reserva.fromJson({
      'id': 1,
      'titulo': 'Taller',
      'estado': 'confirmada',
      'bloques': [
        {'laboratorio': 1, 'laboratorio_codigo': 'LAB-1', 'fecha': '2026-10-03', 'hora_inicio': '08:00', 'hora_fin': '12:00'},
        {'laboratorio': 1, 'laboratorio_codigo': 'LAB-1', 'fecha': '2026-10-04', 'hora_inicio': '09:00', 'hora_fin': '11:30'},
      ],
    });
    expect(r.fin, DateTime(2026, 10, 4, 11, 30));
  });

  test('los errores por campo del backend se aplanan', () {
    final error = DioException(
      requestOptions: RequestOptions(path: '/reservas/'),
      response: Response(
        requestOptions: RequestOptions(path: '/reservas/'),
        statusCode: 400,
        data: {
          'codigo': 'validacion',
          'mensaje': 'Revisa los datos marcados.',
          'campos': {
            'titulo': ['Este campo es obligatorio.'],
            'bloques': [
              {},
              {'hora_fin': ['La hora de fin debe ser posterior a la de inicio.']},
            ],
          },
        },
      ),
    );
    expect(mensajeDeError(error), 'Revisa los datos marcados.');
    expect(erroresDeCampos(error), {
      'titulo': 'Este campo es obligatorio.',
      'bloques.1.hora_fin': 'La hora de fin debe ser posterior a la de inicio.',
    });
  });
}
