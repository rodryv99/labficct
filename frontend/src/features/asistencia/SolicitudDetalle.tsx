import {
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Field,
  Link,
  Spinner,
  Textarea,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { SolicitudAsistencia } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoError } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoCheck, IconoEnviar } from "../../components/iconos/iconos";
import { fechaHora } from "../../lib/fechas";
import {
  TONO_ASISTENCIA,
  cancelarSolicitud,
  estaAbierta,
  obtenerSolicitud,
  resolverSolicitud,
  tomarSolicitud,
} from "./api";

const useEstilos = makeStyles({
  etiquetas: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  cuadro: {
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr)",
    gap: "8px 16px",
  },
  clave: {
    color: tokens.colorNeutralForeground3,
  },
  texto: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
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
  descripcion: {
    padding: "12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  linea: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    paddingLeft: "20px",
    marginLeft: "6px",
    borderLeft: `2px solid ${tokens.colorNeutralStroke2}`,
  },
  paso: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    "::before": {
      content: '""',
      position: "absolute",
      left: "-27px",
      top: "4px",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      backgroundColor: tokens.colorBrandForeground1,
      border: `2px solid ${tokens.colorNeutralBackground1}`,
    },
  },
  pasoEspera: {
    color: tokens.colorNeutralForeground3,
    "::before": {
      backgroundColor: tokens.colorNeutralBackground1,
      border: `2px solid ${tokens.colorNeutralStroke1}`,
    },
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
});

function Linea({ s }: { s: SolicitudAsistencia }) {
  const estilos = useEstilos();
  return (
    <div className={estilos.linea}>
      <div className={estilos.paso}>
        <Body1Strong>Pedida por {s.solicitante_nombre}</Body1Strong>
        <Caption1 className={estilos.secundario}>{fechaHora(s.creado_en)}</Caption1>
      </div>
      {s.atendida_por_nombre && (
        <div className={estilos.paso}>
          <Body1Strong>Tomada por {s.atendida_por_nombre}</Body1Strong>
          {s.atendida_en && <Caption1 className={estilos.secundario}>{fechaHora(s.atendida_en)}</Caption1>}
        </div>
      )}
      {s.estado === "resuelta" && (
        <div className={estilos.paso}>
          <Body1Strong>Resuelta</Body1Strong>
          {s.cerrada_en && <Caption1 className={estilos.secundario}>{fechaHora(s.cerrada_en)}</Caption1>}
        </div>
      )}
      {s.estado === "cancelada" && (
        <div className={estilos.paso}>
          <Body1Strong>Cancelada</Body1Strong>
          {s.cerrada_en && <Caption1 className={estilos.secundario}>{fechaHora(s.cerrada_en)}</Caption1>}
        </div>
      )}
      {s.estado === "pendiente" && (
        <div className={mergeClasses(estilos.paso, estilos.pasoEspera)}>
          <Body1>Esperando a que un auxiliar la tome</Body1>
        </div>
      )}
      {s.estado === "en_curso" && (
        <div className={mergeClasses(estilos.paso, estilos.pasoEspera)}>
          <Body1>En camino</Body1>
        </div>
      )}
    </div>
  );
}

interface Props {
  id: number | null;
  onCerrar: () => void;
}

export function SolicitudDetalle({ id, onCerrar }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede, usuario } = useSesion();
  const atender = puede("asistencia.atender");
  const [dialogo, setDialogo] = useState<"resolver" | "cancelar" | null>(null);
  const [respuesta, setRespuesta] = useState("");

  const consulta = useQuery({
    queryKey: ["asistencia", "detalle", id],
    queryFn: () => obtenerSolicitud(id!),
    enabled: id !== null,
    refetchInterval: 20_000,
  });
  const s: SolicitudAsistencia | undefined = consulta.data;

  const listo = (res: SolicitudAsistencia) => {
    queryClient.setQueryData(["asistencia", "detalle", id], res);
    void queryClient.invalidateQueries({ queryKey: ["asistencia"] });
    setDialogo(null);
    setRespuesta("");
  };
  const fallo = (titulo: string, error: unknown) => {
    notificar.error(titulo, mensajeDeError(error));
    // Puede que otro auxiliar ya la haya tomado o cerrado: se muestra lo último.
    void queryClient.invalidateQueries({ queryKey: ["asistencia"] });
  };

  const tomar = useMutation({
    mutationFn: () => tomarSolicitud(id!),
    onSuccess: (res) => {
      notificar.exito(
        "Avisamos que vas en camino",
        res.solicitante_telefono ? `Teléfono de ${res.solicitante_nombre}: ${res.solicitante_telefono}` : undefined,
      );
      listo(res);
    },
    onError: (e) => fallo("No se pudo tomar la solicitud", e),
  });
  const resolver = useMutation({
    mutationFn: () => resolverSolicitud(id!, respuesta.trim()),
    onSuccess: (res) => {
      notificar.exito("Solicitud resuelta", "Le avisamos a quien la pidió.");
      listo(res);
    },
    onError: (e) => fallo("No se pudo marcar como resuelta", e),
  });
  const cancelar = useMutation({
    mutationFn: () => cancelarSolicitud(id!),
    onSuccess: (res) => {
      notificar.exito("Solicitud cancelada");
      listo(res);
    },
    onError: (e) => fallo("No se pudo cancelar", e),
  });

  const abierta = s ? estaAbierta(s) : false;
  const esMia = Boolean(s && usuario?.id === s.solicitante);
  const ocupado = tomar.isPending || resolver.isPending || cancelar.isPending;

  return (
    <>
      <PanelFormulario
        abierto={id !== null}
        titulo={s ? `${s.categoria_nombre} · ${s.donde}` : "Solicitud de asistencia"}
        subtitulo={s ? `Pedida por ${s.solicitante_nombre}, ${fechaHora(s.creado_en)}` : undefined}
        onCerrar={onCerrar}
        pie={
          s && abierta && (atender || esMia) ? (
            <>
              {atender && s.estado === "pendiente" && (
                <Button appearance="primary" icon={<IconoEnviar />} disabled={ocupado} onClick={() => tomar.mutate()}>
                  {tomar.isPending ? "Avisando…" : "Voy en camino"}
                </Button>
              )}
              {atender && (
                <Button
                  appearance={s.estado === "en_curso" ? "primary" : "secondary"}
                  icon={<IconoCheck />}
                  disabled={ocupado}
                  onClick={() => setDialogo("resolver")}
                >
                  Marcar resuelta
                </Button>
              )}
              {esMia && (
                <Button disabled={ocupado} onClick={() => setDialogo("cancelar")}>
                  Cancelar solicitud
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {consulta.isLoading && <Spinner label="Cargando…" />}
        {consulta.error && !s && <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />}
        {s && (
          <>
            <div className={estilos.etiquetas}>
              <EtiquetaEstado tono={TONO_ASISTENCIA[s.estado]}>{s.estado_nombre}</EtiquetaEstado>
              {s.urgente && <EtiquetaEstado tono="peligro">Urgente</EtiquetaEstado>}
            </div>

            <div className={estilos.descripcion}>
              <Body1>{s.descripcion}</Body1>
            </div>

            <div className={estilos.cuadro}>
              <Caption1 className={estilos.clave}>Dónde</Caption1>
              <Body1>{s.donde || "—"}</Body1>
              <Caption1 className={estilos.clave}>Categoría</Caption1>
              <Body1>{s.categoria_nombre}</Body1>
              <Caption1 className={estilos.clave}>Solicita</Caption1>
              <Body1>{s.solicitante_nombre}</Body1>
              {s.solicitante_telefono && (
                <>
                  <Caption1 className={estilos.clave}>Teléfono</Caption1>
                  <Body1>
                    <Link href={`tel:${s.solicitante_telefono}`}>{s.solicitante_telefono}</Link>
                  </Body1>
                </>
              )}
              <Caption1 className={estilos.clave}>Atiende</Caption1>
              <Body1>{s.atendida_por_nombre || "Nadie todavía"}</Body1>
            </div>

            <div className={estilos.seccion}>
              <Caption1 className={estilos.tituloSeccion}>Seguimiento</Caption1>
              <Linea s={s} />
            </div>

            {s.respuesta && (
              <div className={estilos.seccion}>
                <Caption1 className={estilos.tituloSeccion}>Qué se hizo</Caption1>
                <Body1 className={estilos.texto}>{s.respuesta}</Body1>
              </div>
            )}
          </>
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={dialogo === "resolver"}
        titulo="¿Marcar como resuelta?"
        mensaje="Le avisamos a quien la pidió. La solicitud se cierra."
        textoConfirmar="Marcar resuelta"
        cargando={resolver.isPending}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => resolver.mutate()}
      >
        <Field label="Qué se hizo" hint="Opcional. Ej.: se cambió el cable HDMI.">
          <Textarea value={respuesta} maxLength={500} resize="vertical" onChange={(_, d) => setRespuesta(d.value)} />
        </Field>
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={dialogo === "cancelar"}
        titulo="¿Cancelar la solicitud?"
        mensaje={
          s?.estado === "en_curso"
            ? `${s.atendida_por_nombre || "Un auxiliar"} ya va en camino. Cancélala solo si ya no necesitas ayuda.`
            : "Los auxiliares ya no la verán como pendiente."
        }
        textoConfirmar="Cancelar solicitud"
        peligroso
        cargando={cancelar.isPending}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => cancelar.mutate()}
      />
    </>
  );
}
