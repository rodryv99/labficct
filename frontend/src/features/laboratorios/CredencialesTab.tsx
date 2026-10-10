import {
  Body1Strong,
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Textarea,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { Credencial } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoError, EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import {
  IconoAgregar,
  IconoCopiar,
  IconoEditar,
  IconoEliminar,
  IconoLlave,
  IconoOcultar,
  IconoVer,
} from "../../components/iconos/iconos";
import { relativo } from "../../lib/fechas";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { copiar } from "../../lib/utiles";
import {
  type DatosCredencial,
  actualizarCredencial,
  crearCredencial,
  eliminarCredencial,
  listarCredenciales,
  revelarCredencial,
} from "./api";

const SEGUNDOS_VISIBLE = 30;

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "880px",
  },
  cabecera: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  espacio: {
    flex: 1,
  },
  lista: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
    gap: "12px",
  },
  tarjeta: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  titulo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  dato: {
    display: "grid",
    gridTemplateColumns: "88px 1fr auto",
    alignItems: "center",
    gap: "8px",
    minHeight: "32px",
  },
  etiqueta: {
    color: tokens.colorNeutralForeground3,
  },
  valor: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    wordBreak: "break-all",
  },
  acciones: {
    display: "flex",
    gap: "2px",
  },
  notas: {
    color: tokens.colorNeutralForeground2,
    whiteSpace: "pre-wrap",
  },
  pie: {
    color: tokens.colorNeutralForeground3,
  },
});

const VACIO = { descripcion: "", usuario: "", password: "", notas: "" };

export function CredencialesTab({ laboratorioId }: { laboratorioId: number }) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede } = useSesion();
  const gestionar = puede("laboratorios.gestionar");
  const [visibles, setVisibles] = useState<Record<number, string>>({});
  const [panel, setPanel] = useState<{ credencial: Credencial | null } | null>(null);
  const [eliminar, setEliminar] = useState<Credencial | null>(null);
  const f = useFormulario(VACIO);

  const consulta = useQuery({
    queryKey: ["credenciales", laboratorioId],
    queryFn: () => listarCredenciales(laboratorioId),
  });

  useEffect(() => {
    if (!panel) return;
    const c = panel.credencial;
    f.reiniciar(c ? { descripcion: c.descripcion, usuario: c.usuario, password: "", notas: c.notas } : VACIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["credenciales", laboratorioId] });

  const revelar = useMutation({
    mutationFn: (id: number) => revelarCredencial(id),
    onSuccess: (password, id) => {
      setVisibles((v) => ({ ...v, [id]: password }));
      void refrescar();
      // Se oculta sola: una contraseña a la vista no debe quedarse en pantalla.
      window.setTimeout(() => {
        setVisibles((v) => {
          const { [id]: _oculta, ...resto } = v;
          return resto;
        });
      }, SEGUNDOS_VISIBLE * 1000);
    },
    onError: (e) => notificar.error("No se pudo mostrar la contraseña", mensajeDeError(e)),
  });

  const guardar = useMutation({
    mutationFn: () => {
      const datos: DatosCredencial = {
        laboratorio: laboratorioId,
        descripcion: f.valores.descripcion,
        usuario: f.valores.usuario,
        notas: f.valores.notas,
      };
      if (f.valores.password) datos.password = f.valores.password;
      const actual = panel?.credencial;
      return actual ? actualizarCredencial(actual.id, datos) : crearCredencial(datos);
    },
    onSuccess: () => {
      notificar.exito(panel?.credencial ? "Credencial actualizada" : "Credencial guardada");
      setPanel(null);
      void refrescar();
    },
    onError: f.tomarErroresDelServidor,
  });

  const borrar = useMutation({
    mutationFn: (id: number) => eliminarCredencial(id),
    onSuccess: () => {
      notificar.exito("Credencial eliminada");
      setEliminar(null);
      void refrescar();
    },
    onError: (e) => notificar.error("No se pudo eliminar", mensajeDeError(e)),
  });

  const copiarTexto = async (texto: string, que: string) => {
    if (await copiar(texto)) notificar.info(`${que} copiado`);
  };

  return (
    <div className={estilos.raiz}>
      <div className={estilos.cabecera}>
        <MessageBar intent="info" style={{ flex: 1 }}>
          <MessageBarBody>
            Las contraseñas se guardan cifradas. Cada vez que alguien muestra una, queda registrado quién y cuándo.
          </MessageBarBody>
        </MessageBar>
        {gestionar && (
          <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setPanel({ credencial: null })}>
            Agregar credencial
          </Button>
        )}
      </div>

      {consulta.error && !consulta.data ? (
        <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />
      ) : consulta.isLoading ? (
        <Skeleton aria-label="Cargando">
          <SkeletonItem style={{ height: 140, borderRadius: 8 }} />
        </Skeleton>
      ) : consulta.data?.length === 0 ? (
        <EstadoVacio
          icono={<IconoLlave />}
          titulo="Sin credenciales"
          descripcion={
            gestionar
              ? "Guarda aquí las cuentas de administrador, Wi-Fi u otros accesos del laboratorio."
              : "El administrador todavía no registró credenciales para este laboratorio."
          }
        />
      ) : (
        <div className={estilos.lista}>
          {consulta.data?.map((c) => {
            const visible = visibles[c.id];
            return (
              <div key={c.id} className={estilos.tarjeta}>
                <div className={estilos.titulo}>
                  <IconoLlave />
                  <Body1Strong>{c.descripcion}</Body1Strong>
                  <span className={estilos.espacio} />
                  {gestionar && (
                    <div className={estilos.acciones}>
                      <Tooltip content="Editar" relationship="label">
                        <Button size="small" appearance="subtle" icon={<IconoEditar />} onClick={() => setPanel({ credencial: c })} />
                      </Tooltip>
                      <Tooltip content="Eliminar" relationship="label">
                        <Button size="small" appearance="subtle" icon={<IconoEliminar />} onClick={() => setEliminar(c)} />
                      </Tooltip>
                    </div>
                  )}
                </div>

                {c.usuario && (
                  <div className={estilos.dato}>
                    <Caption1 className={estilos.etiqueta}>Usuario</Caption1>
                    <span className={estilos.valor}>{c.usuario}</span>
                    <Tooltip content="Copiar usuario" relationship="label">
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<IconoCopiar />}
                        onClick={() => void copiarTexto(c.usuario, "Usuario")}
                      />
                    </Tooltip>
                  </div>
                )}

                {c.tiene_password && (
                  <div className={estilos.dato}>
                    <Caption1 className={estilos.etiqueta}>Contraseña</Caption1>
                    <span className={estilos.valor}>{visible ?? "••••••••••"}</span>
                    <div className={estilos.acciones}>
                      {visible ? (
                        <>
                          <Tooltip content="Copiar contraseña" relationship="label">
                            <Button
                              size="small"
                              appearance="subtle"
                              icon={<IconoCopiar />}
                              onClick={() => void copiarTexto(visible, "Contraseña")}
                            />
                          </Tooltip>
                          <Tooltip content="Ocultar" relationship="label">
                            <Button
                              size="small"
                              appearance="subtle"
                              icon={<IconoOcultar />}
                              onClick={() =>
                                setVisibles((v) => {
                                  const { [c.id]: _oculta, ...resto } = v;
                                  return resto;
                                })
                              }
                            />
                          </Tooltip>
                        </>
                      ) : (
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<IconoVer />}
                          disabled={revelar.isPending && revelar.variables === c.id}
                          onClick={() => revelar.mutate(c.id)}
                        >
                          Mostrar
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {c.notas && <Caption1 className={estilos.notas}>{c.notas}</Caption1>}
                {c.ultima_revelacion && (
                  <Caption1 className={estilos.pie}>
                    Última vez mostrada por {c.ultima_revelacion.usuario}, {relativo(c.ultima_revelacion.fecha)}.
                  </Caption1>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PanelFormulario
        abierto={panel !== null}
        tamano="small"
        titulo={panel?.credencial ? "Editar credencial" : "Nueva credencial"}
        onCerrar={() => setPanel(null)}
        hayCambios={f.cambiado && !guardar.isPending}
        pie={
          <>
            <Button
              appearance="primary"
              disabled={!f.valores.descripcion.trim() || guardar.isPending}
              onClick={() => guardar.mutate()}
            >
              {guardar.isPending ? "Guardando…" : "Guardar"}
            </Button>
            <Button onClick={() => setPanel(null)}>Cancelar</Button>
          </>
        }
      >
        <Field label="Descripción" required hint="Ej.: Administrador de Windows, Wi-Fi docente" {...estadoCampo(f.errores.descripcion)}>
          <Input value={f.valores.descripcion} onChange={(_, d) => f.set("descripcion", d.value)} />
        </Field>
        <Field label="Usuario" {...estadoCampo(f.errores.usuario)}>
          <Input value={f.valores.usuario} autoComplete="off" onChange={(_, d) => f.set("usuario", d.value)} />
        </Field>
        <Field
          label="Contraseña"
          hint={panel?.credencial?.tiene_password ? "Déjala vacía para conservar la actual." : undefined}
          {...estadoCampo(f.errores.password)}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={f.valores.password}
            onChange={(_, d) => f.set("password", d.value)}
          />
        </Field>
        <Field label="Notas" {...estadoCampo(f.errores.notas)}>
          <Textarea value={f.valores.notas} resize="vertical" onChange={(_, d) => f.set("notas", d.value)} />
        </Field>
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={eliminar !== null}
        titulo={`¿Eliminar «${eliminar?.descripcion}»?`}
        mensaje="La contraseña guardada se perderá."
        textoConfirmar="Eliminar"
        peligroso
        cargando={borrar.isPending}
        onCancelar={() => setEliminar(null)}
        onConfirmar={() => eliminar && borrar.mutate(eliminar.id)}
      />
    </div>
  );
}
