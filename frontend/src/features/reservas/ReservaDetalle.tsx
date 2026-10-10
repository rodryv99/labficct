import {
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Tag,
  TagGroup,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { Reserva } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoError } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoCheck, IconoEditar } from "../../components/iconos/iconos";
import { desdeISO, fechaHora, fechaLarga } from "../../lib/fechas";
import { aprobarReserva, cancelarReserva, obtenerReserva } from "./api";
import { TONO_RESERVA } from "./utiles";

const useEstilos = makeStyles({
  seccion: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  titulo: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  bloque: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "2px 12px",
    padding: "10px 12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  horas: {
    fontVariantNumeric: "tabular-nums",
    fontWeight: tokens.fontWeightSemibold,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  texto: {
    whiteSpace: "pre-wrap",
  },
  lista: {
    margin: "4px 0 0",
    paddingLeft: "18px",
  },
});

interface Props {
  id: number | null;
  onCerrar: () => void;
  onEditar: (reserva: Reserva) => void;
}

export function ReservaDetalle({ id, onCerrar, onEditar }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede } = useSesion();
  const [cancelando, setCancelando] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const consulta = useQuery({
    queryKey: ["reservas", "detalle", id],
    queryFn: () => obtenerReserva(id!),
    enabled: id !== null,
  });
  const r = consulta.data;

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["reservas"] });
    void queryClient.invalidateQueries({ queryKey: ["agenda"] });
  };

  const porAprobar = r?.estado === "pendiente";

  const cancelar = useMutation({
    mutationFn: () => cancelarReserva(id!, motivo),
    onSuccess: (res) => {
      notificar.exito(
        porAprobar ? "Reserva rechazada" : "Reserva cancelada",
        porAprobar
          ? "Queda como cancelada, con el motivo que escribiste."
          : r?.clases_suspendidas.length
            ? "Las clases que se habían suspendido por esta reserva vuelven a la pizarra."
            : "El laboratorio quedó libre en esos horarios.",
      );
      setCancelando(false);
      setMotivo("");
      queryClient.setQueryData(["reservas", "detalle", id], res);
      refrescar();
    },
    onError: (e) => notificar.error(porAprobar ? "No se pudo rechazar" : "No se pudo cancelar", mensajeDeError(e)),
  });

  const aprobar = useMutation({
    mutationFn: () => aprobarReserva(id!),
    onSuccess: (res) => {
      const n = res.clases_suspendidas.length;
      notificar.exito(
        "Reserva aprobada",
        n ? `Se ${n === 1 ? "suspendió 1 clase" : `suspendieron ${n} clases`}: avisa a los docentes.` : undefined,
      );
      setAprobando(false);
      queryClient.setQueryData(["reservas", "detalle", id], res);
      refrescar();
    },
    onError: (e) => {
      setAprobando(false);
      notificar.error("No se pudo aprobar", mensajeDeError(e));
    },
  });

  const editable = puede("reservas.gestionar") && r && r.estado !== "cancelada";
  const puedeAprobar = porAprobar && puede("reservas.aprobar");

  return (
    <>
      <PanelFormulario
        abierto={id !== null}
        titulo={r?.titulo ?? "Reserva"}
        subtitulo={r ? `Solicitada por ${r.solicitante_nombre}` : undefined}
        onCerrar={onCerrar}
        pie={
          editable && r ? (
            <>
              {puedeAprobar && (
                <Button appearance="primary" icon={<IconoCheck />} onClick={() => setAprobando(true)}>
                  Aprobar
                </Button>
              )}
              <Button
                appearance={puedeAprobar ? "secondary" : "primary"}
                icon={<IconoEditar />}
                onClick={() => onEditar(r)}
              >
                Editar
              </Button>
              <Button onClick={() => setCancelando(true)}>{porAprobar ? "Rechazar" : "Cancelar reserva"}</Button>
            </>
          ) : undefined
        }
      >
        {consulta.isLoading && <Spinner label="Cargando…" />}
        {consulta.error && <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />}
        {r && (
          <>
            <div>
              <EtiquetaEstado tono={TONO_RESERVA[r.estado]}>{r.estado_nombre}</EtiquetaEstado>
            </div>
            {r.estado === "cancelada" && r.motivo_cancelacion && (
              <Body1 className={estilos.secundario}>Motivo: {r.motivo_cancelacion}</Body1>
            )}

            {porAprobar && (
              <MessageBar intent="warning" layout="multiline">
                <MessageBarBody>
                  <MessageBarTitle>{r.choques.length ? "Por aprobar: choca con otra actividad" : "Por aprobar"}</MessageBarTitle>
                  {r.choques.length ? (
                    <>
                      <ul className={estilos.lista}>
                        {r.choques.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                      {puede("reservas.aprobar")
                        ? "Si la apruebas, la reserva tiene prioridad: esas clases se suspenden solo esos días. Luego avisa a sus docentes."
                        : "Un administrador debe aprobarla. Mientras tanto no ocupa el laboratorio."}
                    </>
                  ) : (
                    "Ya no choca con nada: al aprobarla queda confirmada sin suspender clases."
                  )}
                </MessageBarBody>
              </MessageBar>
            )}

            {r.clases_suspendidas.length > 0 && r.estado === "confirmada" && (
              <div className={estilos.seccion}>
                <Caption1 className={estilos.titulo}>Clases suspendidas por esta reserva</Caption1>
                <ul className={estilos.lista}>
                  {r.clases_suspendidas.map((c) => (
                    <li key={c}>
                      <Body1>{c}</Body1>
                    </li>
                  ))}
                </ul>
                <Caption1 className={estilos.secundario}>
                  Avisa a los docentes. Si la reserva se cancela o cambia de horario, las clases vuelven solas.
                </Caption1>
              </div>
            )}

            <div className={estilos.seccion}>
              <Caption1 className={estilos.titulo}>Días y horarios</Caption1>
              {r.bloques.map((b) => (
                <div key={b.id ?? `${b.fecha}-${b.hora_inicio}`} className={estilos.bloque}>
                  <Body1Strong>{fechaLarga(desdeISO(b.fecha))}</Body1Strong>
                  <span className={estilos.horas}>
                    {b.hora_inicio}–{b.hora_fin}
                  </span>
                  <Caption1 className={estilos.secundario}>
                    {b.laboratorio_codigo} · {b.laboratorio_nombre}
                  </Caption1>
                </div>
              ))}
            </div>

            {r.descripcion && (
              <div className={estilos.seccion}>
                <Caption1 className={estilos.titulo}>Descripción</Caption1>
                <Body1 className={estilos.texto}>{r.descripcion}</Body1>
              </div>
            )}

            <div className={estilos.seccion}>
              <Caption1 className={estilos.titulo}>Programas requeridos</Caption1>
              {r.programas_detalle.length ? (
                <TagGroup aria-label="Programas">
                  {r.programas_detalle.map((p) => (
                    <Tag key={p.id} size="small" appearance="outline">
                      {p.nombre_completo}
                    </Tag>
                  ))}
                </TagGroup>
              ) : (
                <Caption1 className={estilos.secundario}>Ninguno</Caption1>
              )}
            </div>

            <div className={estilos.seccion}>
              <Caption1 className={estilos.titulo}>Apoyo de auxiliares</Caption1>
              {r.requiere_apoyo ? (
                <Body1>
                  Se necesitan {r.auxiliares_requeridos}.{" "}
                  {r.auxiliares_detalle.length
                    ? `Asignados: ${r.auxiliares_detalle.map((a) => a.nombre_completo).join(", ")}.`
                    : "Aún no hay nadie asignado."}
                </Body1>
              ) : (
                <Caption1 className={estilos.secundario}>No requiere</Caption1>
              )}
            </div>

            {r.contacto && (
              <div className={estilos.seccion}>
                <Caption1 className={estilos.titulo}>Contacto</Caption1>
                <Body1>{r.contacto}</Body1>
              </div>
            )}

            <Caption1 className={estilos.secundario}>
              Registrada por {r.creado_por_nombre || "—"} el {fechaHora(r.creado_en)}.
              {r.aprobada_en && ` Aprobada por ${r.aprobada_por_nombre || "—"} el ${fechaHora(r.aprobada_en)}.`}
            </Caption1>
          </>
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={aprobando}
        titulo={`¿Aprobar «${r?.titulo}»?`}
        mensaje={
          r?.choques.length
            ? "La reserva tendrá prioridad: las clases con las que choca se suspenden solo esos días. Después avisa a sus docentes."
            : "La reserva queda confirmada."
        }
        textoConfirmar="Aprobar"
        cargando={aprobar.isPending}
        onCancelar={() => setAprobando(false)}
        onConfirmar={() => aprobar.mutate()}
      />

      <ConfirmarDialogo
        abierto={cancelando}
        titulo={porAprobar ? `¿Rechazar «${r?.titulo}»?` : `¿Cancelar «${r?.titulo}»?`}
        mensaje={
          porAprobar
            ? "La reserva no se aprueba y queda como cancelada, con el motivo que escribas. No se borra."
            : "El laboratorio queda libre en todos los días de la reserva. La reserva no se borra: queda como cancelada."
        }
        textoConfirmar={porAprobar ? "Rechazar" : "Cancelar reserva"}
        peligroso
        cargando={cancelar.isPending}
        onCancelar={() => setCancelando(false)}
        onConfirmar={() => cancelar.mutate()}
      >
        <Field label="Motivo (opcional)">
          <Textarea value={motivo} onChange={(_, d) => setMotivo(d.value)} />
        </Field>
      </ConfirmarDialogo>
    </>
  );
}
