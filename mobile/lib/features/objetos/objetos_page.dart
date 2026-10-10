import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../shared/widgets/comunes.dart';
import '../notificaciones/notificaciones_page.dart';
import '../perfil/perfil_sheet.dart';

/// Mismas categorías que el backend (CategoriaObjeto).
const categoriasObjeto = <String, (String, IconData)>{
  'electronico': ('Electrónico', Icons.devices_other_outlined),
  'documento': ('Documento o carnet', Icons.badge_outlined),
  'llaves': ('Llaves', Icons.key_outlined),
  'ropa': ('Ropa', Icons.checkroom_outlined),
  'accesorio': ('Accesorio', Icons.watch_outlined),
  'utiles': ('Útiles', Icons.edit_outlined),
  'otro': ('Otro', Icons.category_outlined),
};

Tono tonoDeObjeto(String estado) => switch (estado) {
      'en_custodia' => Tono.aviso,
      'entregado' => Tono.exito,
      _ => Tono.neutro,
    };

const _filtros = <(String?, String)>[
  ('en_custodia', 'En custodia'),
  ('entregado', 'Entregados'),
  ('anulado', 'Anulados'),
  (null, 'Todos'),
];

/// 7. Objetos perdidos: registro y control. Los registros nunca se borran.
class ObjetosPage extends ConsumerStatefulWidget {
  const ObjetosPage({super.key});

  @override
  ConsumerState<ObjetosPage> createState() => _ObjetosPageState();
}

class _ObjetosPageState extends ConsumerState<ObjetosPage> {
  String? _estado = 'en_custodia';
  String _buscar = '';
  Timer? _espera;

  @override
  void dispose() {
    _espera?.cancel();
    super.dispose();
  }

  void _alEscribir(String texto) {
    _espera?.cancel();
    _espera = Timer(const Duration(milliseconds: 350), () {
      if (mounted) setState(() => _buscar = texto.trim());
    });
  }

  @override
  Widget build(BuildContext context) {
    final puedeRegistrar = ref.watch(sesionProvider).usuario?.puede('objetos.registrar') ?? false;
    final filtro = (estado: _estado, buscar: _buscar);
    final objetos = ref.watch(objetosProvider(filtro));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Objetos perdidos'),
        actions: const [BotonNotificaciones(), BotonPerfil()],
      ),
      floatingActionButton: puedeRegistrar
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/objeto/nuevo'),
              icon: const Icon(Icons.add_a_photo_outlined),
              label: const Text('Registrar'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
            child: TextField(
              onChanged: _alEscribir,
              decoration: const InputDecoration(
                hintText: 'Buscar por descripción, lugar o código (OP-…)',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              children: [
                for (final (valor, etiqueta) in _filtros)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(etiqueta),
                      selected: _estado == valor,
                      onSelected: (_) => setState(() => _estado = valor),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(objetosProvider(filtro).future),
              child: objetos.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [
                  const SizedBox(height: 80),
                  EstadoError(error: e, onReintentar: () => ref.invalidate(objetosProvider(filtro))),
                ]),
                data: (lista) {
                  if (lista.isEmpty) {
                    return ListView(children: [
                      const SizedBox(height: 80),
                      EstadoVacio(
                        icono: Icons.inventory_2_outlined,
                        titulo: _buscar.isNotEmpty
                            ? 'Sin resultados'
                            : _estado == 'en_custodia'
                                ? 'No hay objetos en custodia'
                                : 'No hay registros',
                        descripcion: puedeRegistrar && _estado == 'en_custodia' && _buscar.isEmpty
                            ? 'Cuando alguien deje algo olvidado, regístralo con una foto.'
                            : null,
                      ),
                    ]);
                  }
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                    itemCount: lista.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _TarjetaObjeto(objeto: lista[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TarjetaObjeto extends StatelessWidget {
  const _TarjetaObjeto({required this.objeto});
  final ObjetoPerdido objeto;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final o = objeto;
    final donde = [
      if (o.laboratorioCodigo.isNotEmpty) o.laboratorioCodigo,
      if (o.lugar.isNotEmpty) o.lugar,
    ].join(' · ');

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/objeto/${o.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              MiniaturaObjeto(objeto: o, lado: 64),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(o.codigo, style: tema.textTheme.labelMedium?.copyWith(color: esquema.primary)),
                        const Spacer(),
                        Etiqueta(o.estadoNombre, tono: tonoDeObjeto(o.estado)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      o.descripcion,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [if (donde.isNotEmpty) donde, relativo(o.fechaHallazgo)].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tema.textTheme.bodySmall?.copyWith(color: esquema.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Foto del objeto o, si no tiene, el ícono de su categoría.
class MiniaturaObjeto extends StatelessWidget {
  const MiniaturaObjeto({super.key, required this.objeto, required this.lado});
  final ObjetoPerdido objeto;
  final double lado;

  @override
  Widget build(BuildContext context) {
    final esquema = Theme.of(context).colorScheme;
    final icono = Icon(
      categoriasObjeto[objeto.categoria]?.$2 ?? Icons.category_outlined,
      color: esquema.onSurfaceVariant,
      size: lado * 0.42,
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: lado,
        height: lado,
        color: esquema.surfaceContainerHigh,
        child: objeto.foto == null
            ? icono
            : Image.network(
                objeto.foto!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => icono,
              ),
      ),
    );
  }
}
