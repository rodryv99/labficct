import {
  Avatar,
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Select,
  Slider,
  Spinner,
  Textarea,
  ToggleButton,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { EstadoTarea, PrioridadTarea, TareaDetalle } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoError } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { ListaSeleccion } from "../../components/formularios/ListaSeleccion";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoEliminar, IconoEnviar } from "../../components/iconos/iconos";
import { ESTADOS_TAREA, PRIORIDADES_TAREA, ROLES, etiquetaDe } from "../../lib/constantes";
import { relativo } from "../../lib/fechas";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { opcionesUsuarios } from "../usuarios/api";
import {
  type DatosTarea,
  agregarAvance,
  cambiarEstadoTarea,
  crearTarea,
  editarTarea,
  eliminarTarea,
  obtenerTarea,
} from "./api";

const useEstilos = makeStyles({
  rejilla: {
    display: "grid",
    // Dos columnas en pantallas anchas (datos | avances); una sola en el celular.
    gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))",
    gap: "24px",
    alignItems: "start",
  },
  columna: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    minWidth: 0,
  },
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    "@media (max-width: 480px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  seccion: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  tituloSeccion: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  estados: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  progreso: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  barra: {
    flex: 1,
  },
  anotar: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  anotarPie: {
    display: "flex",
    justifyContent: "flex-end",
  },
  avances: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    margin: "0",
    padding: "0",
    listStyleType: "none",
  },
  avance: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  avanceTextos: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    flex: 1,
  },
  avanceCabecera: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    flexWrap: "wrap",
  },
  texto: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  espacio: {
    flex: 1,
  },
});

interface Formulario {
  titulo: string;
  descripcion: string;
  prioridad: PrioridadTarea;
  laboratorio: number | null;
  responsables: number[];
  fecha_limite: string;
}

const vacio = (): Formulario => ({
  titulo: "",
  descripcion: "",
  prioridad: "normal",
  laboratorio: null,
  responsables: [],
  fecha_limite: "",
});

const desdeTarea = (t: TareaDetalle): Formulario => ({
  titulo: t.titulo,
  descripcion: t.descripcion,
  prioridad: t.prioridad,
  laboratorio: t.laboratorio,
  responsables: t.responsables,
  fecha_limite: t.fecha_limite ?? "",
});

interface Props {
  abierto: boolean;
  /** null = tarea nueva. */
  id: number | null;
  onCerrar: () => void;
}

/** Detalle de una tarjeta del pizarrón: datos editables, estado y avances. También crea tareas nuevas. */
export function TareaPanel({ abierto, id, onCerrar }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede, usuario } = useSesion();
  const gestionar = puede("tareas.gestionar");
  const esNueva = id === null;
  const f = useFormulario<Formulario>(vacio());
  // Qué tarea está cargada en el formulario (para no pisar lo que se está escribiendo).
  const cargada = useRef<number | null | undefined>(undefined);
  const [texto, setTexto] = useState("");
  const [progreso, setProgreso] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const consulta = useQuery({
    queryKey: ["tareas", "detalle", id],
    queryFn: () => obtenerTarea(id!),
    enabled: abierto && id !== null,
  });
  const t: TareaDetalle | undefined = esNueva ? undefined : consulta.data;

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos, enabled: abierto });
  const personas = useQuery({
    queryKey: ["usuarios", "opciones", "auxiliar,admin"],
    queryFn: () => opcionesUsuarios("auxiliar,admin"),
    enabled: abierto && gestionar,
  });

  useEffect(() => {
    if (!abierto) {
      cargada.current = undefined;
      return;
    }
    if (esNueva) {
      if (cargada.current !== null) {
        f.reiniciar(vacio());
        cargada.current = null;
      }
      return;
    }
    if (t && cargada.current !== t.id) {
      f.reiniciar(desdeTarea(t));
      cargada.current = t.id;
      setTexto("");
      setProgreso(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, esNueva, t]);

  const actualizar = (res: TareaDetalle) => {
    queryClient.setQueryData(["tareas", "detalle", res.id], res);
    void queryClient.invalidateQueries({ queryKey: ["tareas"] });
    if (res.revision !== null && res.estado === "hecha") {
      void queryClient.invalidateQueries({ queryKey: ["revisiones"] });
      void queryClient.invalidateQueries({ queryKey: ["bitacora"] });
    }
  };

  const cuerpo = (): DatosTarea => ({
    titulo: f.valores.titulo.trim(),
    descripcion: f.valores.descripcion.trim(),
    prioridad: f.valores.prioridad,
    laboratorio: f.valores.laboratorio,
    responsables: f.valores.responsables,
    fecha_limite: f.valores.fecha_limite || null,
  });

  const guardar = useMutation({
    mutationFn: () => (esNueva ? crearTarea(cuerpo()) : editarTarea(id, cuerpo())),
    onSuccess: (res) => {
      actualizar(res);
      if (esNueva) {
        notificar.exito("Tarea creada", res.responsables.length ? "Avisamos a los responsables." : res.titulo);
        onCerrar();
      } else {
        notificar.exito("Cambios guardados", res.titulo);
        f.reiniciar(desdeTarea(res));
      }
    },
    onError: f.tomarErroresDelServidor,
  });

  const mover = useMutation({
    mutationFn: (estado: EstadoTarea) => cambiarEstadoTarea(id!, estado),
    onSuccess: (res) => {
      actualizar(res);
      if (res.estado === "hecha" && res.revision !== null) {
        notificar.exito("Tarea hecha", "La revisión quedó registrada en la bitácora.");
      }
    },
    onError: (e) => notificar.error("No se pudo cambiar el estado", mensajeDeError(e)),
  });

  const anotar = useMutation({
    mutationFn: () =>
      agregarAvance(id!, {
        texto: texto.trim(),
        progreso: progreso !== null && progreso !== t?.progreso ? progreso : null,
        estado: null,
      }),
    onSuccess: (res) => {
      actualizar(res);
      setTexto("");
      setProgreso(null);
      notificar.exito("Avance anotado");
    },
    onError: (e) => notificar.error("No se pudo anotar el avance", mensajeDeError(e)),
  });

  const borrar = useMutation({
    mutationFn: () => eliminarTarea(id!),
    onSuccess: () => {
      notificar.exito("Tarea eliminada");
      setEliminando(false);
      queryClient.removeQueries({ queryKey: ["tareas", "detalle", id] });
      void queryClient.invalidateQueries({ queryKey: ["tareas"] });
      onCerrar();
    },
    onError: (e) => {
      setEliminando(false);
      notificar.error("No se pudo eliminar", mensajeDeError(e));
    },
  });

  const { valores: v, errores: e } = f;
  const labs = (laboratorios.data ?? []).filter((l) => l.activo || l.id === v.laboratorio);
  // Quien ya no está activo sigue apareciendo si estaba asignado.
  const opcionesPersonas = [
    ...(personas.data ?? []).map((p) => ({ id: p.id, etiqueta: p.nombre_completo, secundaria: etiquetaDe(ROLES, p.rol) })),
    ...(t?.responsables_detalle ?? [])
      .filter((r) => !(personas.data ?? []).some((p) => p.id === r.id))
      .map((r) => ({ id: r.id, etiqueta: r.nombre_completo })),
  ];
  const puedeEliminar = Boolean(t && (t.creado_por === usuario?.id || puede("tareas.eliminar_todas")));
  const valorProgreso = progreso ?? t?.progreso ?? 0;
  const hayAvance = Boolean(texto.trim()) || (progreso !== null && progreso !== t?.progreso);
  const ocupado = guardar.isPending || mover.isPending || anotar.isPending;
  const deshabilitado = !gestionar || guardar.isPending;

  const campos = (
    <div className={estilos.columna}>
      {e.general && Object.keys(e).length <= 2 && (
        <MessageBar intent="error">
          <MessageBarBody>{e.general}</MessageBarBody>
        </MessageBar>
      )}
      <Field label="Título" required {...estadoCampo(e.titulo)}>
        <Input
          value={v.titulo}
          maxLength={150}
          disabled={deshabilitado}
          placeholder="Ej.: Instalar Docker Desktop en LAB-3"
          onChange={(_, d) => f.set("titulo", d.value)}
        />
      </Field>
      <Field label="Descripción" {...estadoCampo(e.descripcion)}>
        <Textarea
          value={v.descripcion}
          resize="vertical"
          rows={4}
          disabled={deshabilitado}
          placeholder="Qué hay que hacer y cómo saber que está listo."
          onChange={(_, d) => f.set("descripcion", d.value)}
        />
      </Field>
      <div className={estilos.fila}>
        <Field label="Prioridad" {...estadoCampo(e.prioridad)}>
          <Select
            value={v.prioridad}
            disabled={deshabilitado}
            onChange={(_, d) => f.set("prioridad", d.value as PrioridadTarea)}
          >
            {PRIORIDADES_TAREA.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha límite" hint="Opcional." {...estadoCampo(e.fecha_limite)}>
          <Input
            type="date"
            value={v.fecha_limite}
            disabled={deshabilitado}
            onChange={(_, d) => f.set("fecha_limite", d.value)}
          />
        </Field>
      </div>
      <Field label="Laboratorio" {...estadoCampo(e.laboratorio)}>
        <Select
          value={v.laboratorio ? String(v.laboratorio) : ""}
          disabled={deshabilitado}
          onChange={(_, d) => f.set("laboratorio", d.value ? Number(d.value) : null)}
        >
          <option value="">Sin laboratorio</option>
          {labs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} · {l.nombre}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Responsables" hint="Les llega un aviso cuando los asignas." {...estadoCampo(e.responsables)}>
        <ListaSeleccion
          opciones={opcionesPersonas}
          seleccionados={v.responsables}
          onCambio={(ids) => f.set("responsables", ids)}
          placeholder="Buscar auxiliar"
          alto={180}
          deshabilitado={deshabilitado}
        />
      </Field>
    </div>
  );

  return (
    <>
      <PanelFormulario
        abierto={abierto}
        tamano="large"
        titulo={esNueva ? "Nueva tarea" : (t?.titulo ?? "Tarea")}
        subtitulo={
          esNueva
            ? "Aparece en la columna Pendiente del pizarrón."
            : t
              ? `Creada por ${t.creado_por_nombre || "—"}, ${relativo(t.creado_en)}`
              : undefined
        }
        onCerrar={onCerrar}
        hayCambios={gestionar && f.cambiado && !guardar.isPending}
        pie={
          esNueva ? (
            <>
              <Button
                appearance="primary"
                disabled={!v.titulo.trim() || guardar.isPending}
                onClick={() => guardar.mutate()}
              >
                {guardar.isPending ? "Creando…" : "Crear tarea"}
              </Button>
              <Button onClick={onCerrar}>Cancelar</Button>
            </>
          ) : t && gestionar ? (
            <>
              <Button
                appearance="primary"
                disabled={!f.cambiado || !v.titulo.trim() || guardar.isPending}
                onClick={() => guardar.mutate()}
              >
                {guardar.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
              <Button onClick={onCerrar}>Cerrar</Button>
              {puedeEliminar && (
                <>
                  <span className={estilos.espacio} />
                  <Button appearance="subtle" icon={<IconoEliminar />} onClick={() => setEliminando(true)}>
                    Eliminar
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {esNueva ? (
          campos
        ) : consulta.isLoading ? (
          <Spinner label="Cargando…" />
        ) : consulta.error && !t ? (
          <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />
        ) : t ? (
          <div className={estilos.rejilla}>
            {campos}

            <div className={estilos.columna}>
              {t.revision !== null && (
                <MessageBar intent="info" layout="multiline">
                  <MessageBarBody>
                    Viene de la revisión periódica «{t.revision_titulo || "Revisión"}». Al marcarla como hecha, la
                    revisión queda registrada en la bitácora.
                  </MessageBarBody>
                </MessageBar>
              )}

              <div className={estilos.seccion}>
                <Caption1 className={estilos.tituloSeccion}>Estado</Caption1>
                <div className={estilos.estados} role="group" aria-label="Estado de la tarea">
                  {ESTADOS_TAREA.map((estado) => (
                    <ToggleButton
                      key={estado.valor}
                      size="small"
                      checked={t.estado === estado.valor}
                      disabled={!gestionar || ocupado}
                      onClick={() => t.estado !== estado.valor && mover.mutate(estado.valor)}
                    >
                      {estado.etiqueta}
                    </ToggleButton>
                  ))}
                </div>
                <div className={estilos.progreso}>
                  <ProgressBar
                    className={estilos.barra}
                    value={t.progreso / 100}
                    thickness="large"
                    color={t.estado === "hecha" ? "success" : "brand"}
                    aria-label="Progreso"
                  />
                  <Caption1>{t.progreso}%</Caption1>
                </div>
                {t.completada_en && (
                  <Caption1 className={estilos.secundario}>
                    Hecha por {t.completada_por_nombre || "—"}, {relativo(t.completada_en)}.
                  </Caption1>
                )}
              </div>

              {gestionar && (
                <div className={estilos.anotar}>
                  <Field label="Anotar avance">
                    <Textarea
                      value={texto}
                      resize="vertical"
                      placeholder="Qué hiciste, qué falta…"
                      disabled={anotar.isPending}
                      onChange={(_, d) => setTexto(d.value)}
                    />
                  </Field>
                  <Field label={`Progreso: ${valorProgreso}%`}>
                    <Slider
                      min={0}
                      max={100}
                      step={10}
                      value={valorProgreso}
                      disabled={anotar.isPending}
                      onChange={(_, d) => setProgreso(d.value)}
                    />
                  </Field>
                  <div className={estilos.anotarPie}>
                    <Button icon={<IconoEnviar />} disabled={!hayAvance || ocupado} onClick={() => anotar.mutate()}>
                      {anotar.isPending ? "Anotando…" : "Anotar"}
                    </Button>
                  </div>
                </div>
              )}

              <div className={estilos.seccion}>
                <Caption1 className={estilos.tituloSeccion}>Avances</Caption1>
                {t.avances.length === 0 ? (
                  <Caption1 className={estilos.secundario}>Todavía no hay avances.</Caption1>
                ) : (
                  <ul className={estilos.avances}>
                    {[...t.avances].reverse().map((a) => (
                      <li key={a.id} className={estilos.avance}>
                        <Avatar name={a.autor_nombre || "Sistema"} size={24} color="colorful" />
                        <div className={estilos.avanceTextos}>
                          <div className={estilos.avanceCabecera}>
                            <Body1Strong>{a.autor_nombre || "Sistema"}</Body1Strong>
                            {a.estado_nuevo && (
                              <Body1>
                                movió a <strong>{a.estado_nuevo_nombre}</strong>
                              </Body1>
                            )}
                            <Caption1 className={estilos.secundario}>{relativo(a.creado_en)}</Caption1>
                          </div>
                          {a.texto && <Body1 className={estilos.texto}>{a.texto}</Body1>}
                          {a.progreso !== null && (
                            <Caption1 className={estilos.secundario}>Progreso: {a.progreso}%</Caption1>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={eliminando}
        titulo={`¿Eliminar «${t?.titulo ?? ""}»?`}
        mensaje="La tarea y sus avances se borran del pizarrón. No se puede deshacer."
        textoConfirmar="Eliminar"
        peligroso
        cargando={borrar.isPending}
        onCancelar={() => setEliminando(false)}
        onConfirmar={() => borrar.mutate()}
      />
    </>
  );
}
