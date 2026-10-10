import {
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Field,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { mensajeDeError } from "../../api/errores";
import type { EventoAgenda } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoAvisar } from "../../components/iconos/iconos";
import { desdeISO, fechaLarga } from "../../lib/fechas";
import { reanudarClase, suspenderClase } from "../horarios/api";
import { avisarAula } from "../notificaciones/api";
import { cancelarReserva } from "../reservas/api";

type TipoAviso = "alistar" | "cerrar";

const useEstilos = makeStyles({
  cuadro: {
    display: "grid",
    gridTemplateColumns: "120px minmax(0, 1fr)",
    gap: "8px 16px",
  },
  clave: {
    color: tokens.colorNeutralForeground3,
  },
  etiquetas: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
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
  lista: {
    margin: "0",
    paddingLeft: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

interface Props {
  evento: EventoAgenda | null;
  onCerrar: () => void;
}

export function EventoPanel({ evento, onCerrar }: Props) {
  const estilos = useEstilos();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede } = useSesion();
  const [dialogo, setDialogo] = useState<"suspender" | "cancelar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<TipoAviso | null>(null);
  const [nota, setNota] = useState("");

  const terminar = (titulo: string) => {
    notificar.exito(titulo);
    setDialogo(null);
    setMotivo("");
    void queryClient.invalidateQueries({ queryKey: ["agenda"] });
    void queryClient.invalidateQueries({ queryKey: ["reservas"] });
    onCerrar();
  };

  const suspender = useMutation({
    mutationFn: () => suspenderClase(evento!.horario_id!, evento!.fecha, motivo),
    onSuccess: () => terminar("Clase suspendida solo ese día"),
    onError: (e) => notificar.error("No se pudo suspender", mensajeDeError(e)),
  });
  const reanudar = useMutation({
    mutationFn: () => reanudarClase(evento!.horario_id!, evento!.fecha),
    onSuccess: () => terminar("Clase reanudada"),
    onError: (e) => notificar.error("No se pudo reanudar", mensajeDeError(e)),
  });
  const cancelar = useMutation({
    mutationFn: () => cancelarReserva(evento!.reserva_id!, motivo),
    onSuccess: () => terminar("Reserva cancelada"),
    onError: (e) => notificar.error("No se pudo cancelar", mensajeDeError(e)),
  });

  const avisar = useMutation({
    mutationFn: (tipo: TipoAviso) =>
      avisarAula({ tipo, evento: evento!.id, fecha: evento!.fecha, nota: nota.trim() }),
    onSuccess: ({ enviadas }) => {
      if (enviadas === 0) notificar.aviso("No hay otros auxiliares activos para avisar");
      else notificar.exito(enviadas === 1 ? "Aviso enviado a 1 auxiliar" : `Aviso enviado a ${enviadas} auxiliares`);
      setAviso(null);
      setNota("");
    },
    onError: (err) => notificar.error("No se pudo enviar el aviso", mensajeDeError(err)),
  });

  const e = evento;
  const esClase = e?.tipo === "clase";
  const suspendida = e?.estado === "suspendida";
  const puedeAvisar = Boolean(e && puede("avisos.enviar") && !suspendida && e.estado !== "cancelada");

  let acciones = null;
  if (e && esClase && puede("horarios.gestionar")) {
    acciones = suspendida ? (
      <Button appearance="primary" disabled={reanudar.isPending} onClick={() => reanudar.mutate()}>
        Reanudar la clase
      </Button>
    ) : (
      <Button onClick={() => setDialogo("suspender")}>Suspender solo este día</Button>
    );
  } else if (e && !esClase) {
    acciones = (
      <>
        <Button appearance="primary" onClick={() => navegar(`/reservas?id=${e.reserva_id}`)}>
          Ver reserva
        </Button>
        {puede("reservas.gestionar") && <Button onClick={() => setDialogo("cancelar")}>Cancelar reserva</Button>}
      </>
    );
  }

  return (
    <>
      <PanelFormulario
        abierto={e !== null}
        tamano="small"
        titulo={e?.titulo ?? ""}
        subtitulo={e ? `${fechaLarga(desdeISO(e.fecha))} · ${e.hora_inicio}–${e.hora_fin}` : undefined}
        onCerrar={onCerrar}
        pie={
          acciones || puedeAvisar ? (
            <>
              {acciones}
              {puedeAvisar && (
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <MenuButton icon={<IconoAvisar />}>Avisar a auxiliares</MenuButton>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={() => setAviso("alistar")}>Alistar aula</MenuItem>
                      <MenuItem onClick={() => setAviso("cerrar")}>Cerrar aula</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
              )}
            </>
          ) : undefined
        }
      >
        {e && (
          <>
            <div className={estilos.etiquetas}>
              <EtiquetaEstado tono={esClase ? "marca" : "aviso"}>{esClase ? "Clase" : "Reserva"}</EtiquetaEstado>
              {suspendida && <EtiquetaEstado tono="neutro">Suspendida</EtiquetaEstado>}
              {e.estado === "pendiente" && <EtiquetaEstado tono="aviso">Pendiente de confirmar</EtiquetaEstado>}
              {e.requiere_apoyo && <EtiquetaEstado tono="peligro">Requiere apoyo de auxiliares</EtiquetaEstado>}
            </div>
            <div className={estilos.cuadro}>
              <Caption1 className={estilos.clave}>Laboratorio</Caption1>
              <Body1Strong>{e.laboratorio_codigo}</Body1Strong>
              {e.detalle && (
                <>
                  <Caption1 className={estilos.clave}>{esClase ? "Materia" : "Descripción"}</Caption1>
                  <Body1>{e.detalle}</Body1>
                </>
              )}
              {e.responsable && (
                <>
                  <Caption1 className={estilos.clave}>{esClase ? "Docente" : "Solicitante"}</Caption1>
                  <Body1>{e.responsable}</Body1>
                </>
              )}
              {e.programas.length > 0 && (
                <>
                  <Caption1 className={estilos.clave}>Programas</Caption1>
                  <Body1>{e.programas.join(", ")}</Body1>
                </>
              )}
              {suspendida && e.nota && (
                <>
                  <Caption1 className={estilos.clave}>Motivo</Caption1>
                  <Body1>{e.nota}</Body1>
                </>
              )}
            </div>
            {e.preferencias.length > 0 && (
              <div className={estilos.seccion}>
                <Caption1 className={estilos.tituloSeccion}>Preferencias del docente</Caption1>
                <ul className={estilos.lista}>
                  {e.preferencias.map((p) => (
                    <li key={p}>
                      <Body1>{p}</Body1>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={aviso !== null}
        titulo={aviso === "cerrar" ? `¿Avisar que cierren ${e?.laboratorio_codigo}?` : `¿Avisar que alisten ${e?.laboratorio_codigo}?`}
        mensaje={
          aviso === "alistar" && e?.preferencias.length
            ? "Les llega una notificación a los demás auxiliares activos, con los datos de la actividad y las preferencias del docente."
            : "Les llega una notificación a los demás auxiliares activos, con los datos de la actividad."
        }
        textoConfirmar="Enviar aviso"
        cargando={avisar.isPending}
        onCancelar={() => {
          setAviso(null);
          setNota("");
        }}
        onConfirmar={() => aviso && avisar.mutate(aviso)}
      >
        <Field label="Nota" hint="Opcional. Ej.: llevar el cable HDMI.">
          <Textarea value={nota} maxLength={300} resize="vertical" onChange={(_, d) => setNota(d.value)} />
        </Field>
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={dialogo === "suspender"}
        titulo={`¿Suspender ${e?.titulo} solo este día?`}
        mensaje="La clase sigue igual las demás semanas. El laboratorio queda libre ese día para reservas."
        textoConfirmar="Suspender"
        cargando={suspender.isPending}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => suspender.mutate()}
      >
        <Field label="Motivo" hint="Ej.: feriado, actividad de la facultad">
          <Textarea value={motivo} onChange={(_, d) => setMotivo(d.value)} />
        </Field>
      </ConfirmarDialogo>
      <ConfirmarDialogo
        abierto={dialogo === "cancelar"}
        titulo={`¿Cancelar «${e?.titulo}»?`}
        mensaje="Se cancelan todos los días de la reserva y el laboratorio queda libre."
        textoConfirmar="Cancelar reserva"
        peligroso
        cargando={cancelar.isPending}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => cancelar.mutate()}
      >
        <Field label="Motivo (opcional)">
          <Textarea value={motivo} onChange={(_, d) => setMotivo(d.value)} />
        </Field>
      </ConfirmarDialogo>
    </>
  );
}
