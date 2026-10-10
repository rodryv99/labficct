import 'package:flutter/material.dart';

import '../../core/modelos/modelos.dart';

/// Mismo catálogo de íconos que la web, con equivalentes de Material.
const iconosElemento = <String, IconData>{
  'pc': Icons.desktop_windows_outlined,
  'laptop': Icons.laptop_outlined,
  'proyector': Icons.videocam_outlined,
  'pantalla': Icons.slideshow_outlined,
  'pizarra': Icons.co_present_outlined,
  'televisor': Icons.tv_outlined,
  'impresora': Icons.print_outlined,
  'parlante': Icons.speaker_outlined,
  'camara': Icons.photo_camera_outlined,
  'router': Icons.router_outlined,
  'servidor': Icons.dns_outlined,
  'aire': Icons.ac_unit_outlined,
  'enchufe': Icons.power_outlined,
  'puerta': Icons.door_front_door_outlined,
  'ventana': Icons.window_outlined,
  'mesa': Icons.table_restaurant_outlined,
  'silla': Icons.chair_outlined,
  'generico': Icons.category_outlined,
};

Color colorDesdeHex(String hex, [Color porDefecto = const Color(0xFF6B7280)]) {
  final limpio = hex.replaceFirst('#', '');
  if (limpio.length != 6) return porDefecto;
  final valor = int.tryParse(limpio, radix: 16);
  return valor == null ? porDefecto : Color(0xFF000000 | valor);
}

const colorFalla = Color(0xFFC50F1F);
const colorMantenimiento = Color(0xFFBC4B09);

/// Grilla del laboratorio: se mueve con un dedo y se acerca con dos.
/// Mantener presionada (o tocar) una casilla abre la ficha del elemento.
class GrillaLaboratorio extends StatelessWidget {
  const GrillaLaboratorio({
    super.key,
    required this.distribucion,
    required this.tipos,
    required this.onCelda,
  });

  final Distribucion distribucion;
  final Map<int, TipoElemento> tipos;
  final void Function(Celda celda) onCelda;

  static const lado = 58.0;
  static const espacio = 6.0;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    final porPosicion = {for (final c in distribucion.celdas) '${c.fila},${c.columna}': c};

    return InteractiveViewer(
      constrained: false,
      minScale: 0.4,
      maxScale: 3,
      boundaryMargin: const EdgeInsets.all(120),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            for (var f = 0; f < distribucion.filas; f++)
              Padding(
                padding: const EdgeInsets.only(bottom: espacio),
                child: Row(
                  children: [
                    for (var c = 0; c < distribucion.columnas; c++)
                      Padding(
                        padding: const EdgeInsets.only(right: espacio),
                        child: _Casilla(
                          celda: porPosicion['$f,$c'],
                          tipos: tipos,
                          esquema: esquema,
                          onTap: onCelda,
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Casilla extends StatelessWidget {
  const _Casilla({required this.celda, required this.tipos, required this.esquema, required this.onTap});

  final Celda? celda;
  final Map<int, TipoElemento> tipos;
  final ColorScheme esquema;
  final void Function(Celda celda) onTap;

  @override
  Widget build(BuildContext context) {
    const lado = GrillaLaboratorio.lado;
    final c = celda;
    if (c == null) {
      return Container(
        width: lado,
        height: lado,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: esquema.outlineVariant.withValues(alpha: 0.6)),
        ),
      );
    }
    final tipo = tipos[c.tipo];
    final color = colorDesdeHex(tipo?.color ?? '');
    final marca = c.estado == 'con_falla'
        ? colorFalla
        : c.estado == 'mantenimiento'
            ? colorMantenimiento
            : null;

    return Opacity(
      opacity: c.estado == 'baja' ? 0.45 : 1,
      child: Material(
        color: color.withValues(alpha: 0.1),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: color.withValues(alpha: 0.55), width: 1.2),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => onTap(c),
          child: SizedBox(
            width: lado,
            height: lado,
            child: Stack(
              children: [
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    tipo?.imagen != null
                        ? Image.network(tipo!.imagen!, width: 24, height: 24, fit: BoxFit.contain)
                        : Icon(iconosElemento[tipo?.icono] ?? Icons.category_outlined, color: color, size: 24),
                    const SizedBox(height: 3),
                    Text(
                      c.etiqueta,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: esquema.onSurfaceVariant),
                    ),
                  ],
                ),
                if (marca != null)
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(color: marca, shape: BoxShape.circle),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
