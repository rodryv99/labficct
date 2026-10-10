import {
  Button,
  Caption1,
  Field,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Select,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { Rol, Usuario } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { SelectorBuscable } from "../../components/formularios/SelectorBuscable";
import { IconoCopiar, IconoEliminar, IconoMas, IconoPassword, IconoPersona } from "../../components/iconos/iconos";
import type { Opcion } from "../../lib/constantes";
import { fechaHora, relativo } from "../../lib/fechas";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { copiar, generarPassword } from "../../lib/utiles";
import { listarDocentes } from "../horarios/api";
import {
  type DatosUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  crearUsuario,
  eliminarUsuario,
  restablecerPassword,
} from "./api";

const useEstilos = makeStyles({
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  seccion: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginTop: "4px",
  },
  meta: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: "4px 16px",
    padding: "12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
  },
  espacio: {
    flex: 1,
  },
});

const vacio = (rol: Rol): DatosUsuario => ({
  email: "",
  codigo: "",
  nombres: "",
  apellidos: "",
  rol,
  telefono: "",
  password: "",
  vincular_docente: null,
});

const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

interface Props {
  abierto: boolean;
  usuario: Usuario | null;
  rolesPermitidos: Opcion<Rol>[];
  onCerrar: () => void;
}

export function UsuarioPanel({ abierto, usuario, rolesPermitidos, onCerrar }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const { usuario: yo } = useSesion();
  const f = useFormulario<DatosUsuario>(vacio("auxiliar"));
  const [confirmar, setConfirmar] = useState<"eliminar" | "desactivar" | null>(null);
  const [restablecer, setRestablecer] = useState(false);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const esNuevo = usuario === null;
  const esYo = usuario?.id === yo?.id;

  useEffect(() => {
    if (!abierto) return;
    f.reiniciar(
      usuario
        ? {
            email: usuario.email,
            codigo: usuario.codigo ?? "",
            nombres: usuario.nombres,
            apellidos: usuario.apellidos,
            rol: usuario.rol,
            telefono: usuario.telefono,
            vincular_docente: usuario.ficha_docente?.id ?? null,
          }
        : vacio(rolesPermitidos.find((r) => r.valor === "auxiliar")?.valor ?? rolesPermitidos[0].valor),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, usuario]);

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    // Crear o editar un docente también cambia las fichas de docentes (vínculo con el usuario).
    return queryClient.invalidateQueries({ queryKey: ["docentes"] });
  };

  const esDocente = f.valores.rol === "docente";
  const fichasLibres = useQuery({
    queryKey: ["docentes", "sin-usuario"],
    queryFn: () => listarDocentes({ sin_usuario: true }),
    enabled: abierto && esDocente,
  });
  const opcionesFichas = useMemo(() => {
    const libres = (fichasLibres.data ?? []).map((d) => ({
      id: d.id,
      etiqueta: d.nombre_completo,
      secundaria: [d.email, `${d.total_horarios} clases`].filter(Boolean).join(" · "),
    }));
    const actual = usuario?.ficha_docente;
    return actual && !libres.some((l) => l.id === actual.id)
      ? [{ id: actual.id, etiqueta: actual.nombre_completo, secundaria: "Vinculada ahora" }, ...libres]
      : libres;
  }, [fichasLibres.data, usuario]);
  // Sugerencia: una ficha sin usuario con el mismo nombre o correo que se está escribiendo.
  const sugerida = useMemo(() => {
    if (!esDocente || f.valores.vincular_docente) return null;
    const nombre = normalizar(`${f.valores.nombres} ${f.valores.apellidos}`);
    const correo = normalizar(f.valores.email);
    return (
      (fichasLibres.data ?? []).find(
        (d) => (correo && normalizar(d.email) === correo) || (nombre.length > 3 && normalizar(d.nombre_completo) === nombre),
      ) ?? null
    );
  }, [esDocente, f.valores, fichasLibres.data]);

  const guardar = useMutation({
    mutationFn: () => {
      const datos = { ...f.valores };
      if (!esNuevo) delete datos.password;
      const sinCambioDeFicha = !esNuevo && datos.vincular_docente === (usuario?.ficha_docente?.id ?? null);
      if (datos.rol !== "docente" || datos.vincular_docente == null || sinCambioDeFicha) delete datos.vincular_docente;
      return esNuevo ? crearUsuario(datos) : actualizarUsuario(usuario.id, datos);
    },
    onSuccess: (u) => {
      notificar.exito(esNuevo ? "Usuario creado" : "Cambios guardados", u.nombre_completo);
      void refrescar();
      onCerrar();
    },
    onError: f.tomarErroresDelServidor,
  });

  const cambiarEstado = useMutation({
    mutationFn: (activo: boolean) => cambiarEstadoUsuario(usuario!.id, activo),
    onSuccess: (u) => {
      notificar.exito(u.is_active ? "Usuario activado" : "Usuario desactivado", u.nombre_completo);
      setConfirmar(null);
      void refrescar();
      onCerrar();
    },
    onError: (e) => notificar.error("No se pudo cambiar el estado", mensajeDeError(e)),
  });

  const eliminar = useMutation({
    mutationFn: () => eliminarUsuario(usuario!.id),
    onSuccess: () => {
      notificar.exito("Usuario eliminado");
      setConfirmar(null);
      void refrescar();
      onCerrar();
    },
    onError: (e) => {
      setConfirmar(null);
      notificar.error("No se pudo eliminar", mensajeDeError(e));
    },
  });

  const restablecerMut = useMutation({
    mutationFn: () => restablecerPassword(usuario!.id, nuevaPassword),
    onSuccess: () => {
      notificar.exito("Contraseña restablecida", "Compártela con la persona por un medio seguro.");
      setRestablecer(false);
    },
    onError: (e) => notificar.error("No se pudo restablecer", mensajeDeError(e)),
  });

  const { valores: v, errores: e } = f;
  const completo = v.nombres.trim() && v.apellidos.trim() && v.email.trim() && (!esNuevo || (v.password ?? "").length >= 8);

  return (
    <>
      <PanelFormulario
        abierto={abierto}
        titulo={esNuevo ? "Nuevo usuario" : usuario.nombre_completo}
        subtitulo={esNuevo ? "La persona podrá entrar con su correo o su código." : usuario.email}
        onCerrar={onCerrar}
        hayCambios={f.cambiado && !guardar.isPending}
        pie={
          <>
            <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
              {guardar.isPending ? "Guardando…" : esNuevo ? "Crear usuario" : "Guardar cambios"}
            </Button>
            <Button onClick={onCerrar}>Cancelar</Button>
            <span className={estilos.espacio} />
            {!esNuevo && (
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Tooltip content="Más acciones" relationship="label">
                    <Button appearance="subtle" icon={<IconoMas />} />
                  </Tooltip>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem
                      icon={<IconoPassword />}
                      onClick={() => {
                        setNuevaPassword(generarPassword());
                        setRestablecer(true);
                      }}
                    >
                      Restablecer contraseña
                    </MenuItem>
                    <MenuItem
                      icon={<IconoPersona />}
                      disabled={esYo}
                      onClick={() =>
                        usuario.is_active ? setConfirmar("desactivar") : cambiarEstado.mutate(true)
                      }
                    >
                      {usuario.is_active ? "Desactivar" : "Activar"}
                    </MenuItem>
                    <MenuItem icon={<IconoEliminar />} disabled={esYo} onClick={() => setConfirmar("eliminar")}>
                      Eliminar
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            )}
          </>
        }
      >
        {e.general && Object.keys(e).length === 1 && (
          <MessageBar intent="error">
            <MessageBarBody>{e.general}</MessageBarBody>
          </MessageBar>
        )}

        <div className={estilos.fila}>
          <Field label="Nombres" required {...estadoCampo(e.nombres)}>
            <Input value={v.nombres} onChange={(_, d) => f.set("nombres", d.value)} />
          </Field>
          <Field label="Apellidos" required {...estadoCampo(e.apellidos)}>
            <Input value={v.apellidos} onChange={(_, d) => f.set("apellidos", d.value)} />
          </Field>
        </div>
        <Field label="Correo" required {...estadoCampo(e.email)}>
          <Input type="email" value={v.email} onChange={(_, d) => f.set("email", d.value)} />
        </Field>
        <div className={estilos.fila}>
          <Field label="Código institucional" hint="Opcional. También sirve para iniciar sesión." {...estadoCampo(e.codigo)}>
            <Input value={v.codigo} onChange={(_, d) => f.set("codigo", d.value)} />
          </Field>
          <Field label="Teléfono" {...estadoCampo(e.telefono)}>
            <Input type="tel" value={v.telefono} onChange={(_, d) => f.set("telefono", d.value)} />
          </Field>
        </div>
        <Field
          label="Rol"
          required
          hint={esYo ? "No puedes cambiar tu propio rol." : undefined}
          {...estadoCampo(e.rol)}
        >
          <Select value={v.rol} disabled={esYo} onChange={(_, d) => f.set("rol", d.value as Rol)}>
            {rolesPermitidos.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </Select>
        </Field>

        {esDocente && (
          <Field
            label="Ficha de docente"
            hint={
              v.vincular_docente
                ? "Las clases asignadas a esta ficha aparecerán en «Mis clases» de este usuario."
                : "Si ya registraste a este docente en Horarios → Docentes, elígelo. Si no, se crea una ficha con estos datos."
            }
            {...estadoCampo(e.vincular_docente)}
          >
            <SelectorBuscable
              opciones={opcionesFichas}
              valor={v.vincular_docente ?? null}
              onCambio={(id) => f.set("vincular_docente", id)}
              permitirVacio
              textoVacio={usuario?.ficha_docente ? "Mantener la ficha actual" : "Crear una ficha nueva con estos datos"}
              placeholder="Buscar docente registrado sin usuario"
            />
          </Field>
        )}
        {sugerida && (
          <MessageBar intent="info" layout="multiline">
            <MessageBarBody>
              {sugerida.nombre_completo} ya está registrado como docente sin usuario
              {sugerida.total_horarios ? ` y tiene ${sugerida.total_horarios} clases` : ""}. ¿Es la misma persona?{" "}
              <Button size="small" appearance="primary" onClick={() => f.set("vincular_docente", sugerida.id)}>
                Vincular
              </Button>
            </MessageBarBody>
          </MessageBar>
        )}

        {esNuevo && (
          <Field
            label="Contraseña inicial"
            required
            hint="Mínimo 8 caracteres. Compártela con la persona; podrá cambiarla después."
            {...estadoCampo(e.password)}
          >
            <Input
              value={v.password ?? ""}
              onChange={(_, d) => f.set("password", d.value)}
              contentAfter={
                <Button size="small" appearance="transparent" onClick={() => f.set("password", generarPassword())}>
                  Generar
                </Button>
              }
            />
          </Field>
        )}

        {!esNuevo && (
          <div className={estilos.meta}>
            <Caption1>Estado</Caption1>
            <Caption1>{usuario.is_active ? "Activo" : "Inactivo"}</Caption1>
            <Caption1>Último acceso</Caption1>
            <Caption1>{usuario.last_login ? relativo(usuario.last_login) : "Nunca"}</Caption1>
            <Caption1>Creado</Caption1>
            <Caption1>{fechaHora(usuario.creado_en)}</Caption1>
          </div>
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={confirmar === "desactivar"}
        titulo={`¿Desactivar a ${usuario?.nombre_completo}?`}
        mensaje="No podrá iniciar sesión. Su historial se conserva y puedes volver a activarlo cuando quieras."
        textoConfirmar="Desactivar"
        cargando={cambiarEstado.isPending}
        onCancelar={() => setConfirmar(null)}
        onConfirmar={() => cambiarEstado.mutate(false)}
      />
      <ConfirmarDialogo
        abierto={confirmar === "eliminar"}
        titulo={`¿Eliminar a ${usuario?.nombre_completo}?`}
        mensaje="Esta acción no se puede deshacer. Si la persona tiene horarios, reservas u otros registros, no se podrá eliminar: desactívala."
        textoConfirmar="Eliminar"
        peligroso
        cargando={eliminar.isPending}
        onCancelar={() => setConfirmar(null)}
        onConfirmar={() => eliminar.mutate()}
      />
      <ConfirmarDialogo
        abierto={restablecer}
        titulo={`Nueva contraseña para ${usuario?.nombres ?? ""}`}
        mensaje="Se cerrarán sus sesiones abiertas. Copia la contraseña antes de confirmar."
        textoConfirmar="Restablecer"
        cargando={restablecerMut.isPending}
        deshabilitado={nuevaPassword.length < 8}
        onCancelar={() => setRestablecer(false)}
        onConfirmar={() => restablecerMut.mutate()}
      >
        <Field label="Contraseña nueva">
          <Input
            value={nuevaPassword}
            onChange={(_, d) => setNuevaPassword(d.value)}
            contentAfter={
              <Button
                size="small"
                appearance="transparent"
                icon={<IconoCopiar />}
                aria-label="Copiar"
                onClick={async () => {
                  if (await copiar(nuevaPassword)) notificar.info("Contraseña copiada");
                }}
              />
            }
          />
        </Field>
      </ConfirmarDialogo>
    </>
  );
}
