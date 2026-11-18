import 'package:flutter/material.dart';

import '../../core/modelos/modelos.dart';

/// Colores que se asignan solos a los atributos (iguales a los de la web y el servidor).
const paletaMapa = ['#22A34A', '#E5383B', '#F2A900', '#2F7DE1', '#8E44AD', '#16A6A6', '#E86A17', '#7F8C8D'];
const maxAtributos = 8;
const atributosIniciales = [
  AtributoMapa(nombre: 'Funciona', color: '#22A34A'),
  AtributoMapa(nombre: 'Con falla', color: '#E5383B'),
];

/// "#RRGGBB" → Color. Si no se entiende, gris.
Color colorHex(String hex) {
  final limpio = hex.replaceFirst('#', '');
  final valor = limpio.length == 6 ? int.tryParse(limpio, radix: 16) : null;
  return valor == null ? const Color(0xFF9CA3AF) : Color(0xFF000000 | valor);
}

/// Texto oscuro o claro según el fondo, para que se lea la etiqueta.
Color tintaSobre(Color fondo) => fondo.computeLuminance() > 0.45 ? const Color(0xFF111827) : Colors.white;

enum HerramientaMapa { pintar, borrar, mover }

const _estados = {
  'operativo': 'Operativo',
  'con_falla': 'Con falla',
  'mantenimiento': 'En mantenimiento',
  'baja': 'De baja',
};

const double _lado = 58;
const double _espacio = 6;

/// La grilla del laboratorio con los elementos pintados según su atributo (como en OrganiLab).
///
/// Sin [onCambiar] es de solo lectura: se mueve, se hace zoom y al tocar un elemento se ve
/// su ficha. Con [onCambiar], según la [herramienta] se pinta con el [atributoActivo], se
/// borra el color o se mueve el mapa. El doble toque siempre muestra la ficha.
class MapaBitacoraVista extends StatefulWidget {
  const MapaBitacoraVista({
    super.key,
    required this.mapa,
    required this.atributos,
    required this.marcas,
    this.onCambiar,
    this.herramienta = HerramientaMapa.mover,
    this.atributoActivo = 0,
    this.alto = 380,
  });

  /// De aquí salen la grilla y los elementos.
  final MapaBitacora mapa;
  final List<AtributoMapa> atributos;
  final Map<(int, int), int> marcas;
  final ValueChanged<Map<(int, int), int>>? onCambiar;
  final HerramientaMapa herramienta;
  final int atributoActivo;

  /// Alto fijo del recuadro. Si es null, el mapa llena el espacio que le dé su
  /// contenedor (se usa para verlo a pantalla completa).
  final double? alto;

  @override
  State<MapaBitacoraVista> createState() => _MapaBitacoraVistaState();
}

class _MapaBitacoraVistaState extends State<MapaBitacoraVista> {
  late Map<(int, int), CeldaMapa> _celdas = _indexar();
  // Lo más reciente, para pintar varias casillas en un mismo arrastre antes de redibujar.
  Map<(int, int), int>? _enCurso;
  // Dedos sobre la grilla: solo se pinta con uno; con dos es zoom.
  final _dedos = <int>{};

  Map<(int, int), CeldaMapa> _indexar() => {for (final c in widget.mapa.celdas) (c.fila, c.columna): c};

  @override
  void didUpdateWidget(covariant MapaBitacoraVista oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mapa != widget.mapa) _celdas = _indexar();
    _enCurso = null;
  }

  bool get _pinta => widget.onCambiar != null && widget.herramienta != HerramientaMapa.mover;

  (int, int)? _casilla(Offset p) {
    final paso = _lado + _espacio;
    final columna = (p.dx / paso).floor();
    final fila = (p.dy / paso).floor();
    if (fila < 0 || columna < 0 || fila >= widget.mapa.filas || columna >= widget.mapa.columnas) return null;
    // En el espacio entre casillas no se pinta.
    if (p.dx - columna * paso > _lado || p.dy - fila * paso > _lado) return null;
    return (fila, columna);
  }

  void _aplicar(Offset p) {
    final k = _casilla(p);
    if (k == null || !_celdas.containsKey(k)) return;
    final actuales = _enCurso ?? widget.marcas;
    final nuevo = Map<(int, int), int>.of(actuales);
    if (widget.herramienta == HerramientaMapa.borrar) {
      if (!nuevo.containsKey(k)) return;
      nuevo.remove(k);
    } else {
      if (nuevo[k] == widget.atributoActivo) return;
      nuevo[k] = widget.atributoActivo;
    }
    _enCurso = nuevo;
    widget.onCambiar!(nuevo);
  }

  void _verFicha(Offset p) {
    final k = _casilla(p);
    final c = k == null ? null : _celdas[k];
    if (c == null) return;
    final atributo = widget.marcas[k];
    final nombreAtributo =
        atributo != null && atributo < widget.atributos.length ? widget.atributos[atributo].nombre : 'Sin marcar';
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (contexto) => _Ficha(celda: c, enElMapa: nombreAtributo),
    );
  }

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    final ancho = widget.mapa.columnas * (_lado + _espacio) - _espacio;
    final alto = widget.mapa.filas * (_lado + _espacio) - _espacio;

    final grilla = SizedBox(
      width: ancho,
      height: alto,
      child: Stack(
        children: [
          for (var f = 0; f < widget.mapa.filas; f++)
            for (var c = 0; c < widget.mapa.columnas; c++)
              Positioned(
                left: c * (_lado + _espacio),
                top: f * (_lado + _espacio),
                width: _lado,
                height: _lado,
                child: _Casilla(
                  celda: _celdas[(f, c)],
                  color: _colorDe(widget.marcas[(f, c)]),
                  vacia: esquema.outlineVariant,
                  fondo: esquema.surface,
                ),
              ),
        ],
      ),
    );

    return Container(
      height: widget.alto,
      decoration: BoxDecoration(
        color: esquema.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: esquema.outlineVariant),
      ),
      clipBehavior: Clip.antiAlias,
      child: InteractiveViewer(
        constrained: false,
        minScale: 0.4,
        maxScale: 3,
        boundaryMargin: const EdgeInsets.all(120),
        // Con pincel o borrador, un dedo pinta; con dos se hace zoom.
        panEnabled: !_pinta,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onDoubleTapDown: (d) => _verFicha(d.localPosition),
            onDoubleTap: () {},
            onTapUp: widget.onCambiar == null ? (d) => _verFicha(d.localPosition) : null,
            child: Listener(
              onPointerDown: (e) {
                _dedos.add(e.pointer);
                if (_pinta && _dedos.length == 1) _aplicar(e.localPosition);
              },
              onPointerMove: (e) {
                if (_pinta && _dedos.length == 1) _aplicar(e.localPosition);
              },
              onPointerUp: (e) {
                _dedos.remove(e.pointer);
                _enCurso = null;
              },
              onPointerCancel: (e) {
                _dedos.remove(e.pointer);
                _enCurso = null;
              },
              child: grilla,
            ),
          ),
        ),
      ),
    );
  }

  Color? _colorDe(int? atributo) =>
      atributo != null && atributo < widget.atributos.length ? colorHex(widget.atributos[atributo].color) : null;
}

class _Casilla extends StatelessWidget {
  const _Casilla({required this.celda, required this.color, required this.vacia, required this.fondo});

  final CeldaMapa? celda;
  final Color? color;
  final Color vacia;
  final Color fondo;

  @override
  Widget build(BuildContext context) {
    final c = celda;
    if (c == null) {
      return DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: vacia.withValues(alpha: 0.5)),
        ),
      );
    }
    final relleno = color ?? fondo;
    final tinta = color == null ? Theme.of(context).colorScheme.onSurface : tintaSobre(relleno);
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 3),
      decoration: BoxDecoration(
        color: relleno,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: c.color.isEmpty ? vacia : colorHex(c.color), width: 2.5),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            c.nombre,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: tinta, fontSize: 11, fontWeight: FontWeight.w700),
          ),
          Text(
            c.tipoNombre,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: tinta.withValues(alpha: 0.85), fontSize: 8.5),
          ),
        ],
      ),
    );
  }
}

/// Ficha del elemento (solo lectura), con los datos de cuando se hizo el mapa.
class _Ficha extends StatelessWidget {
  const _Ficha({required this.celda, required this.enElMapa});

  final CeldaMapa celda;
  final String enElMapa;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final datos = [
      ('Elemento', celda.tipoNombre),
      ('Estado', _estados[celda.estado] ?? celda.estado),
      ('En el mapa', enElMapa),
      ('IP', celda.ip),
      ('MAC', celda.mac),
      ('Código de activo', celda.codigoActivo),
      ('Especificaciones', celda.especificaciones),
      ('Descripción', celda.descripcion),
    ];
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(celda.nombre, style: tema.textTheme.titleLarge),
            const SizedBox(height: 12),
            for (final (nombre, valor) in datos)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 130,
                      child: Text(nombre, style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant)),
                    ),
                    Expanded(
                      child: valor.isEmpty
                          ? Text(
                              'Sin registrar',
                              style: tema.textTheme.bodyMedium?.copyWith(
                                color: tema.colorScheme.outline,
                                fontStyle: FontStyle.italic,
                              ),
                            )
                          : Text(valor, style: tema.textTheme.bodyMedium),
                    ),
                  ],
                ),
              ),
            Text(
              'Datos del elemento cuando se hizo este mapa.',
              style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

/// Leyenda de colores con cuántos elementos tiene cada atributo.
class LeyendaMapa extends StatelessWidget {
  const LeyendaMapa({super.key, required this.mapa, required this.atributos, required this.marcas});

  final MapaBitacora mapa;
  final List<AtributoMapa> atributos;
  final Map<(int, int), int> marcas;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    final conteo = List.filled(atributos.length, 0);
    var marcadas = 0;
    final ocupadas = {for (final c in mapa.celdas) (c.fila, c.columna)};
    marcas.forEach((k, a) {
      if (ocupadas.contains(k) && a < conteo.length) {
        conteo[a]++;
        marcadas++;
      }
    });
    final sinMarcar = mapa.celdas.length - marcadas;
    Widget item(Color color, String texto, {bool borde = false}) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(4),
                border: borde ? Border.all(color: esquema.outline) : null,
              ),
            ),
            const SizedBox(width: 6),
            Text(texto),
          ],
        );
    return Wrap(
      spacing: 14,
      runSpacing: 6,
      children: [
        for (var i = 0; i < atributos.length; i++) item(colorHex(atributos[i].color), '${atributos[i].nombre} (${conteo[i]})'),
        if (sinMarcar > 0) item(esquema.surfaceContainerHigh, 'Sin marcar ($sinMarcar)', borde: true),
      ],
    );
  }
}

/// Ver el mapa de una entrada a pantalla completa, con zoom (dos dedos).
class VerMapaPage extends StatelessWidget {
  const VerMapaPage({
    super.key,
    required this.mapa,
    required this.atributos,
    required this.marcas,
    this.titulo,
  });

  final MapaBitacora mapa;
  final List<AtributoMapa> atributos;
  final Map<(int, int), int> marcas;
  final String? titulo;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(titulo ?? 'Mapa del laboratorio')),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: LeyendaMapa(mapa: mapa, atributos: atributos, marcas: marcas),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                // alto: null → el mapa llena el espacio del Expanded.
                child: MapaBitacoraVista(mapa: mapa, atributos: atributos, marcas: marcas, alto: null),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Text(
                'Junta o separa dos dedos para acercar o alejar. Toca un elemento para ver su ficha.',
                style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
