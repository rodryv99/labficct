import {
  Body1,
  Button,
  Caption1,
  Field,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { mensajeDeError } from "../../api/errores";
import type { Revision } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoError } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoCheck, IconoEditar, IconoEliminar } from "../../components/iconos/iconos";
import { desdeISO, fechaLarga, fechaNumerica } from "../../lib/fechas";
import { eliminarRevision, obtenerRevision, realizarRevision, situacionDe } from "./api";

const useEstilos = makeStyles({
  etiquetas: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  cuadro: {
    display: "grid",
    gridTemplateColumns: "120px minmax(0, 1fr)",
    gap: "8px 16px",
  },
  clave: {
    color: tokens.colorNeutralForeground3,
  },
  seccion: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  tituloSeccion: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
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

interface Props {
  id: number | null;
  onCerrar: () => void;
  onEditar: (revision: Revision) => void;
}

export function RevisionDetalle({ id, onCerrar, onEditar }: Props) {
  const estilos = useEstilos();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede } = useSesion();
  const gestionar = puede("revisiones.gestionar");
  const realizar = puede("revisiones.realizar");
  const [dialogo, setDialogo] = useState<"realizar" | "eliminar" | null>(null);
  const [nota, setNota] = useState("");

  const consulta = useQuery({
    queryKey: ["revisiones", "detalle", id],
    queryFn: () => obtenerRevision(id!),
    enabled: id !== null,
  });
  const r: Revision | undefined = consulta.data;

  const registrar = useMutation({
    mutationFn: () => realizarRevision(id!, nota.trim()),
    onSuccess: (res) => {
      notificar.exito("Revisión registrada en la bitácora", `Próxima: ${fechaNumerica(res.proxima_fecha)}`);
      queryClient.setQueryData(["revisiones", "detalle", id], res);
      void queryClient.invalidateQueries({ queryKey: ["revisiones"] });
      void queryClient.invalidateQueries({ queryKey: ["bitacora"] });
      void queryClient.invalidateQueries({ queryKey: ["tareas"] });
      setDialogo(null);
      setNota("");
    },
    onError: (e) => notificar.error("No se pudo registrar", mensajeDeError(e)),
  });

  const borrar = useMutation({
    mutationFn: () => eliminarRevision(id!),
    onSuccess: () => {
      notificar.exito("Revisión eliminada");
      setDialogo(null);
      void queryClient.invalidateQueries({ queryKey: ["revisiones"] });
      onCerrar();
    },
    onError: (e) => {
      setDialogo(null);
      notificar.error("No se pudo eliminar", mensajeDeError(e));
    },
  });

  const situacion = r && r.activa ? situacionDe(r) : null;

  return (
    <>
      <PanelFormulario
        abierto={id !== null}
        titulo={r?.titulo ?? "Revisión"}
        subtitulo={r ? `${r.laboratorio_codigo} · ${r.frecuencia}` : undefined}
        onCerrar={onCerrar}
        pie={
          r && (realizar || gestionar) ? (
            <>
              {realizar && (
                <Button appearance="primary" icon={<IconoCheck />} onClick={() => setDialogo("realizar")}>
                  Registrar revisión
                </Button>
              )}
              {gestionar && (
                <>
                  <Button icon={<IconoEditar />} onClick={() => onEditar(r)}>
                    Editar
                  </Button>
                  <span className={estilos.espacio} />
                  <Button appearance="subtle" icon={<IconoEliminar />} onClick={() => setDialogo("eliminar")}>
                    Eliminar
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {consulta.isLoading && <Spinner label="Cargando…" />}
        {consulta.error && !r && <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />}
        {r && (
          <>
            <div className={estilos.etiquetas}>
              {!r.activa && <EtiquetaEstado tono="neutro">Pausada</EtiquetaEstado>}
              {situacion && <EtiquetaEstado tono={situacion.tono}>{situacion.texto}</EtiquetaEstado>}
              {r.activa && !situacion && <EtiquetaEstado tono="exito">Al día</EtiquetaEstado>}
            </div>

            {r.tarea_abierta !== null && puede("tareas.ver") && (
              <MessageBar intent="info" layout="multiline">
                <MessageBarBody>Hay una tarea abierta en el pizarrón para esta revisión.</MessageBarBody>
                <MessageBarActions>
                  <Button size="small" onClick={() => navegar(`/tareas?id=${r.tarea_abierta}`)}>
                    Ver en el pizarrón
                  </Button>
                </MessageBarActions>
              </MessageBar>
            )}

            <div className={estilos.cuadro}>
              <Caption1 className={estilos.clave}>Laboratorio</Caption1>
              <Body1>
                {r.laboratorio_codigo} · {r.laboratorio_nombre}
              </Body1>
              <Caption1 className={estilos.clave}>Frecuencia</Caption1>
              <Body1>{r.frecuencia}</Body1>
              <Caption1 className={estilos.clave}>Próxima</Caption1>
              <Body1>{fechaLarga(desdeISO(r.proxima_fecha))}</Body1>
              <Caption1 className={estilos.clave}>Última vez</Caption1>
              <Body1>{r.ultima_fecha ? fechaLarga(desdeISO(r.ultima_fecha)) : "Nunca"}</Body1>
              <Caption1 className={estilos.clave}>Responsable</Caption1>
              <Body1>{r.responsable_nombre || "Todos los auxiliares"}</Body1>
            </div>

            <div className={estilos.seccion}>
              <Caption1 className={estilos.tituloSeccion}>Instrucciones</Caption1>
              {r.instrucciones ? (
                <Body1 className={estilos.texto}>{r.instrucciones}</Body1>
              ) : (
                <Caption1 className={estilos.secundario}>Sin instrucciones.</Caption1>
              )}
            </div>
          </>
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={dialogo === "realizar"}
        titulo={`¿Registrar «${r?.titulo ?? ""}» como hecha hoy?`}
        mensaje="Queda en la bitácora del laboratorio y se calcula la próxima fecha. Si había una tarea abierta en el pizarrón, se cierra."
        textoConfirmar="Registrar"
        cargando={registrar.isPending}
        onCancelar={() => {
          setDialogo(null);
          setNota("");
        }}
        onConfirmar={() => registrar.mutate()}
      >
        <Field label="Qué se revisó" hint="Opcional. Ej.: todo en orden; la PC-07 no enciende.">
          <Textarea value={nota} resize="vertical" rows={3} onChange={(_, d) => setNota(d.value)} />
        </Field>
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={dialogo === "eliminar"}
        titulo={`¿Eliminar «${r?.titulo ?? ""}»?`}
        mensaje="Ya no se programará. Lo que dejó en la bitácora se conserva."
        textoConfirmar="Eliminar"
        peligroso
        cargando={borrar.isPending}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => borrar.mutate()}
      />
    </>
  );
}
