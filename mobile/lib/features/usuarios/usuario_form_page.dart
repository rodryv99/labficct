import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sesion.dart';
import '../../core/datos/proveedores.dart';
import '../../core/modelos/modelos.dart';
import '../../core/network/api_cliente.dart';
import '../../core/network/repositorio.dart';
import '../../shared/widgets/comunes.dart';
import '../../shared/widgets/seleccion.dart';
import 'usuarios_comun.dart';

/// Alta de un usuario o edición de sus datos, con sus acciones (restablecer
/// contraseña, activar/desactivar, eliminar).
class UsuarioFormPage extends ConsumerStatefulWidget {
  const UsuarioFormPage({super.key, this.inicial});

  /// null = alta de un usuario nuevo.
  final UsuarioAdmin? inicial;

  @override
  ConsumerState<UsuarioFormPage> createState() => _UsuarioFormPageState();
}

class _UsuarioFormPageState extends ConsumerState<UsuarioFormPage> {
  final _form = GlobalKey<FormState>();
  final _nombres = TextEditingController();
  final _apellidos = TextEditingController();
  final _email = TextEditingController();
  final _codigo = TextEditingController();
  final _telefono = TextEditingController();
  final _password = TextEditingController();

  String _rol = 'auxiliar';
  int? _vincularDocente;
  String _vincularNombre = '';
  bool _guardando = false;
  String? _error;
  Map<String, String> _errores = {};

  bool get _esNuevo => widget.inicial == null;

  @override
  void initState() {
    super.initState();
    final u = widget.inicial;
    if (u != null) {
      _nombres.text = u.nombres;
      _apellidos.text = u.apellidos;
      _email.text = u.email;
      _codigo.text = u.codigo;
      _telefono.text = u.telefono;
      _rol = u.rol;
      _vincularDocente = u.fichaDocenteId;
      _vincularNombre = u.fichaDocenteNombre;
    }
  }

  @override
  void dispose() {
    _nombres.dispose();
    _apellidos.dispose();
    _email.dispose();
    _codigo.dispose();
    _telefono.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _esYo => widget.inicial?.id == ref.read(sesionProvider).usuario?.id;

  Future<void> _elegirFicha() async {
    final fichas = await ref.read(docentesSinUsuarioProvider.future);
    if (!mounted) return;
    final opciones = <OpcionSeleccion>[
      const OpcionSeleccion(0, 'Crear ficha nueva con estos datos'),
      // La ficha actual (si edito un docente que ya tenía una) no viene en "sin usuario".
      if (!_esNuevo && widget.inicial!.fichaDocenteId != null)
        OpcionSeleccion(widget.inicial!.fichaDocenteId!, widget.inicial!.fichaDocenteNombre, 'Vinculada ahora'),
      for (final d in fichas)
        OpcionSeleccion(d.id, d.nombreCompleto, [d.email, '${d.totalHorarios} clases'].where((x) => x.isNotEmpty).join(' · ')),
    ];
    final elegido = await seleccionar(
      context,
      titulo: 'Vincular ficha de docente',
      multiple: false,
      seleccion: _vincularDocente == null ? {0} : {_vincularDocente!},
      opciones: Future.value(opciones),
    );
    if (elegido == null || elegido.isEmpty) return;
    final id = elegido.first == 0 ? null : elegido.first;
    setState(() {
      _vincularDocente = id;
      _vincularNombre = id == null
          ? ''
          : opciones.firstWhere((o) => o.id == id, orElse: () => const OpcionSeleccion(0, '')).etiqueta;
    });
  }

  Future<void> _guardar() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _errores = {};
    });
    if (!_form.currentState!.validate()) return;

    final datos = <String, dynamic>{
      'email': _email.text.trim(),
      'codigo': _codigo.text.trim(),
      'nombres': _nombres.text.trim(),
      'apellidos': _apellidos.text.trim(),
      'rol': _rol,
      'telefono': _telefono.text.trim(),
    };
    if (_esNuevo) datos['password'] = _password.text;
    // vincular_docente solo si es docente y cambió respecto a la ficha actual.
    final fichaActual = widget.inicial?.fichaDocenteId;
    if (_rol == 'docente' && _vincularDocente != null && _vincularDocente != fichaActual) {
      datos['vincular_docente'] = _vincularDocente;
    }

    final contenedor = ProviderScope.containerOf(context, listen: false);
    setState(() => _guardando = true);
    try {
      final repo = ref.read(repositorioProvider);
      final u = _esNuevo ? await repo.crearUsuario(datos) : await repo.actualizarUsuario(widget.inicial!.id, datos);
      refrescarUsuarios(contenedor);
      if (!mounted) return;
      avisar(context, _esNuevo ? 'Usuario creado: ${u.nombreCompleto}.' : 'Cambios guardados.');
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errores = erroresDeCampos(e);
        _error = _errores.isEmpty ? mensajeDeError(e) : null;
      });
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  Future<void> _restablecer() async {
    var password = generarPassword();
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (dialogo) => StatefulBuilder(
        builder: (dialogo, estado) => AlertDialog(
          title: Text('Nueva contraseña para ${widget.inicial!.nombres}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Se cerrarán sus sesiones abiertas. Copia la contraseña antes de confirmar.'),
              const SizedBox(height: 12),
              InputDecorator(
                decoration: InputDecoration(
                  labelText: 'Contraseña nueva',
                  suffixIcon: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        tooltip: 'Generar otra',
                        icon: const Icon(Icons.refresh),
                        onPressed: () => estado(() => password = generarPassword()),
                      ),
                      IconButton(
                        tooltip: 'Copiar',
                        icon: const Icon(Icons.copy_outlined),
                        onPressed: () async {
                          await Clipboard.setData(ClipboardData(text: password));
                          if (dialogo.mounted) avisar(dialogo, 'Contraseña copiada.');
                        },
                      ),
                    ],
                  ),
                ),
                child: SelectableText(password, style: const TextStyle(fontFamily: 'monospace', fontSize: 16)),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Cancelar')),
            FilledButton(onPressed: () => Navigator.pop(dialogo, true), child: const Text('Restablecer')),
          ],
        ),
      ),
    );
    if (confirmado != true || !mounted) return;
    try {
      await ref.read(repositorioProvider).restablecerPasswordUsuario(widget.inicial!.id, password);
      if (mounted) avisar(context, 'Contraseña restablecida. Compártela por un medio seguro.');
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<void> _cambiarEstado(bool activar) async {
    if (!activar) {
      final ok = await _confirmar(
        titulo: '¿Desactivar a ${widget.inicial!.nombreCompleto}?',
        mensaje: 'No podrá iniciar sesión. Su historial se conserva y puedes reactivarlo cuando quieras.',
        boton: 'Desactivar',
      );
      if (ok != true) return;
    }
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).cambiarEstadoUsuario(widget.inicial!.id, activar);
      refrescarUsuarios(contenedor);
      if (!mounted) return;
      avisar(context, activar ? 'Usuario activado.' : 'Usuario desactivado.');
      context.pop();
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<void> _eliminar() async {
    final ok = await _confirmar(
      titulo: '¿Eliminar a ${widget.inicial!.nombreCompleto}?',
      mensaje: 'No se puede deshacer. Si tiene horarios, reservas u otros registros, no se podrá eliminar: desactívalo.',
      boton: 'Eliminar',
      peligro: true,
    );
    if (ok != true || !mounted) return;
    final contenedor = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(repositorioProvider).eliminarUsuario(widget.inicial!.id);
      refrescarUsuarios(contenedor);
      if (!mounted) return;
      avisar(context, 'Usuario eliminado.');
      context.pop();
    } catch (e) {
      if (mounted) avisar(context, mensajeDeError(e), error: true);
    }
  }

  Future<bool?> _confirmar({
    required String titulo,
    required String mensaje,
    required String boton,
    bool peligro = false,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (dialogo) => AlertDialog(
        title: Text(titulo),
        content: Text(mensaje),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogo, false), child: const Text('Volver')),
          FilledButton(
            style: peligro ? FilledButton.styleFrom(backgroundColor: Theme.of(dialogo).colorScheme.error) : null,
            onPressed: () => Navigator.pop(dialogo, true),
            child: Text(boton),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final esquema = tema.colorScheme;
    final yo = ref.watch(sesionProvider).usuario;
    final permitidos = rolesPermitidosPara(yo?.rol ?? 'admin');
    final esYo = _esYo;
    // El rol del usuario que edito siempre debe estar en la lista.
    final rolesLista = permitidos.any((r) => r.$1 == _rol) ? permitidos : [(_rol, etiquetaRol(_rol)), ...permitidos];

    return Scaffold(
      appBar: AppBar(
        title: Text(_esNuevo ? 'Nuevo usuario' : widget.inicial!.nombreCompleto),
        actions: [
          if (!_esNuevo)
            PopupMenuButton<String>(
              tooltip: 'Más acciones',
              onSelected: (valor) {
                switch (valor) {
                  case 'password':
                    _restablecer();
                  case 'estado':
                    _cambiarEstado(!widget.inicial!.activo);
                  case 'eliminar':
                    _eliminar();
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'password', child: _ItemMenu(Icons.password, 'Restablecer contraseña')),
                PopupMenuItem(
                  value: 'estado',
                  enabled: !esYo,
                  child: _ItemMenu(
                    widget.inicial!.activo ? Icons.person_off_outlined : Icons.person_outline,
                    widget.inicial!.activo ? 'Desactivar' : 'Activar',
                  ),
                ),
                PopupMenuItem(value: 'eliminar', enabled: !esYo, child: const _ItemMenu(Icons.delete_outline, 'Eliminar')),
              ],
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _guardando ? null : _guardar,
            child: _guardando
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                : Text(_esNuevo ? 'Crear usuario' : 'Guardar cambios'),
          ),
        ),
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: esquema.errorContainer, borderRadius: BorderRadius.circular(10)),
                child: Text(_error!, style: TextStyle(color: esquema.onErrorContainer)),
              ),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _nombres,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(labelText: 'Nombres', errorText: _errores['nombres']),
                    validator: (v) => (v ?? '').trim().isEmpty ? 'Obligatorio.' : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _apellidos,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(labelText: 'Apellidos', errorText: _errores['apellidos']),
                    validator: (v) => (v ?? '').trim().isEmpty ? 'Obligatorio.' : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: InputDecoration(
                labelText: 'Correo',
                hintText: 'Sirve para iniciar sesión.',
                errorText: _errores['email'],
              ),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Escribe el correo.' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _codigo,
                    decoration: InputDecoration(
                      labelText: 'Código (opcional)',
                      hintText: 'También sirve para entrar',
                      errorText: _errores['codigo'],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _telefono,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(labelText: 'Teléfono', errorText: _errores['telefono']),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _rol,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'Rol',
                errorText: _errores['rol'],
                helperText: esYo ? 'No puedes cambiar tu propio rol.' : null,
              ),
              items: [for (final (v, n) in rolesLista) DropdownMenuItem(value: v, child: Text(n, overflow: TextOverflow.ellipsis))],
              onChanged: esYo ? null : (v) => setState(() => _rol = v ?? 'auxiliar'),
            ),
            if (_rol == 'docente') ...[
              const SizedBox(height: 12),
              InkWell(
                onTap: _elegirFicha,
                borderRadius: BorderRadius.circular(10),
                child: InputDecorator(
                  decoration: InputDecoration(
                    labelText: 'Ficha de docente',
                    prefixIcon: const Icon(Icons.badge_outlined),
                    helperText: _vincularDocente == null
                        ? 'Si no eliges una, se crea una ficha nueva con estos datos.'
                        : 'Sus clases aparecerán en «Mis clases» de este usuario.',
                  ),
                  child: Row(
                    children: [
                      Expanded(child: Text(_vincularDocente == null ? 'Crear ficha nueva' : _vincularNombre)),
                      Icon(Icons.chevron_right, color: esquema.onSurfaceVariant),
                    ],
                  ),
                ),
              ),
            ],
            if (_esNuevo) ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _password,
                decoration: InputDecoration(
                  labelText: 'Contraseña inicial',
                  helperText: 'Mínimo 8 caracteres. Compártela con la persona.',
                  errorText: _errores['password'],
                  suffixIcon: TextButton(
                    onPressed: () => setState(() => _password.text = generarPassword()),
                    child: const Text('Generar'),
                  ),
                ),
                validator: (v) => (v ?? '').length < 8 ? 'Usa al menos 8 caracteres.' : null,
              ),
            ],
            if (!_esNuevo) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: esquema.surfaceContainerHigh, borderRadius: BorderRadius.circular(10)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _MetaFila('Estado', widget.inicial!.activo ? 'Activo' : 'Inactivo'),
                    _MetaFila(
                      'Último acceso',
                      widget.inicial!.ultimoAcceso == null ? 'Nunca' : relativo(widget.inicial!.ultimoAcceso!),
                    ),
                    if (widget.inicial!.creadoEn != null) _MetaFila('Creado', fechaHora(widget.inicial!.creadoEn!)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ItemMenu extends StatelessWidget {
  const _ItemMenu(this.icono, this.texto);
  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) =>
      Row(children: [Icon(icono, size: 20), const SizedBox(width: 12), Text(texto)]);
}

class _MetaFila extends StatelessWidget {
  const _MetaFila(this.clave, this.valor);
  final String clave;
  final String valor;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(clave, style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.onSurfaceVariant)),
          ),
          Expanded(child: Text(valor, style: tema.textTheme.bodySmall)),
        ],
      ),
    );
  }
}
