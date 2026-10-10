import { Body1Strong, Caption1, Caption1Strong, makeStyles, tokens } from "@fluentui/react-components";

import type { EventoAgenda } from "../../api/tipos";
import { Codigo, EtiquetaEstado } from "../../components/datos/Etiquetas";
import { EstadoVacio } from "../../components/feedback/Estados";
import { IconoReloj } from "../../components/iconos/iconos";
import { aMinutos } from "../../lib/fechas";

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: "920px",
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
  fila: {
    display: "grid",
    gridTemplateColumns: "112px 84px 1fr auto",
    alignItems: "center",
    gap: "16px",
    padding: "12px 16px",
    textAlign: "left",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontFamily: "inherit",
    cursor: "pointer",
    ":hover": {
      borderColor: tokens.colorNeutralStroke1Hover,
      boxShadow: tokens.shadow4,
    },
    "@media (max-width: 640px)": {
      gridTemplateColumns: "1fr",
      gap: "4px",
    },
  },
  horas: {
    fontVariantNumeric: "tabular-nums",
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  textos: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  etiquetas: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
});

interface Props {
  eventos: EventoAgenda[];
  ahora: number;
  onEvento: (evento: EventoAgenda) => void;
}

/** Lo que el auxiliar tiene que alistar o cerrar ahora mismo. */
export function VistaProximas({ eventos, ahora, onEvento }: Props) {
  const estilos = useEstilos();
  const activos = eventos.filter((e) => e.estado !== "suspendida");
  const enCurso = activos.filter((e) => aMinutos(e.hora_inicio) <= ahora && ahora < aMinutos(e.hora_fin));
  const pronto = activos.filter((e) => aMinutos(e.hora_inicio) > ahora && aMinutos(e.hora_inicio) <= ahora + 120);
  const despues = activos.filter((e) => aMinutos(e.hora_inicio) > ahora + 120);

  if (!enCurso.length && !pronto.length && !despues.length) {
    return (
      <EstadoVacio
        icono={<IconoReloj />}
        titulo="No queda nada por hoy"
        descripcion="No hay clases ni reservas en lo que resta del día."
      />
    );
  }

  const fila = (e: EventoAgenda) => {
    const faltan = aMinutos(e.hora_inicio) - ahora;
    return (
      <button key={e.id} type="button" className={estilos.fila} onClick={() => onEvento(e)}>
        <span className={estilos.horas}>
          {e.hora_inicio}–{e.hora_fin}
        </span>
        <Codigo>{e.laboratorio_codigo}</Codigo>
        <span className={estilos.textos}>
          <Body1Strong>{e.titulo}</Body1Strong>
          <Caption1 className={estilos.secundario}>
            {[e.detalle, e.responsable].filter(Boolean).join(" · ")}
          </Caption1>
          {e.programas.length > 0 && (
            <Caption1 className={estilos.secundario}>Programas: {e.programas.join(", ")}</Caption1>
          )}
        </span>
        <span className={estilos.etiquetas}>
          <EtiquetaEstado tono={e.tipo === "clase" ? "marca" : "aviso"}>{e.tipo === "clase" ? "Clase" : "Reserva"}</EtiquetaEstado>
          {e.requiere_apoyo && <EtiquetaEstado tono="peligro">Requiere apoyo</EtiquetaEstado>}
          {faltan > 0 && faltan <= 120 && <EtiquetaEstado tono="info">en {faltan} min</EtiquetaEstado>}
        </span>
      </button>
    );
  };

  return (
    <div className={estilos.raiz}>
      {enCurso.length > 0 && (
        <section className={estilos.seccion}>
          <Caption1Strong className={estilos.tituloSeccion}>En curso · por cerrar al terminar</Caption1Strong>
          {enCurso.map(fila)}
        </section>
      )}
      {pronto.length > 0 && (
        <section className={estilos.seccion}>
          <Caption1Strong className={estilos.tituloSeccion}>En las próximas 2 horas · por alistar</Caption1Strong>
          {pronto.map(fila)}
        </section>
      )}
      {despues.length > 0 && (
        <section className={estilos.seccion}>
          <Caption1Strong className={estilos.tituloSeccion}>Más tarde</Caption1Strong>
          {despues.map(fila)}
        </section>
      )}
    </div>
  );
}
