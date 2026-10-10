import { Caption1, Caption1Strong, Tooltip, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import type { MouseEvent } from "react";

import type { EventoAgenda } from "../../api/tipos";
import { identidad } from "../../app/tema";
import { IconoPersona } from "../../components/iconos/iconos";
import { aHora, aMinutos } from "../../lib/fechas";

/** Píxeles por minuto: una hora mide 66 px. */
export const PX = 1.1;

const useEstilos = makeStyles({
  marco: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: "auto",
    maxHeight: "calc(100vh - 250px)",
    minHeight: "420px",
  },
  rejilla: {
    display: "grid",
    position: "relative",
    minWidth: "fit-content",
  },
  esquina: {
    position: "sticky",
    top: "0",
    left: "0",
    zIndex: 4,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  cabecera: {
    position: "sticky",
    top: "0",
    zIndex: 3,
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    padding: "10px 12px",
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRight: `1px solid ${tokens.colorNeutralStroke3}`,
    minWidth: "0",
  },
  cabeceraDestacada: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  subtitulo: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  horas: {
    position: "sticky",
    left: "0",
    zIndex: 2,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  hora: {
    position: "absolute",
    right: "8px",
    transform: "translateY(-50%)",
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    fontVariantNumeric: "tabular-nums",
  },
  columna: {
    position: "relative",
    borderRight: `1px solid ${tokens.colorNeutralStroke3}`,
    cursor: "copy",
  },
  columnaSoloLectura: {
    cursor: "default",
  },
  evento: {
    position: "absolute",
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    padding: "4px 6px 4px 8px",
    borderRadius: tokens.borderRadiusMedium,
    borderLeftWidth: "3px",
    borderLeftStyle: "solid",
    overflow: "hidden",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase200,
    lineHeight: "16px",
    color: tokens.colorNeutralForeground1,
    boxShadow: tokens.shadow2,
    transitionProperty: "box-shadow",
    transitionDuration: tokens.durationFaster,
    ":hover": {
      boxShadow: tokens.shadow8,
      zIndex: 1,
    },
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
    },
  },
  clase: {
    backgroundColor: tokens.colorBrandBackground2,
    borderLeftColor: tokens.colorBrandForeground1,
    borderTop: "none",
    borderRight: "none",
    borderBottom: "none",
  },
  reserva: {
    backgroundColor: tokens.colorPaletteMarigoldBackground1,
    borderLeftColor: tokens.colorPaletteMarigoldBorderActive,
    borderTop: "none",
    borderRight: "none",
    borderBottom: "none",
  },
  pendiente: {
    backgroundImage: `repeating-linear-gradient(135deg, transparent 0 6px, rgba(0, 0, 0, 0.06) 6px 12px)`,
  },
  suspendida: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderLeftColor: tokens.colorNeutralStroke1,
    color: tokens.colorNeutralForeground3,
    textDecorationLine: "line-through",
    boxShadow: "none",
    borderTop: "none",
    borderRight: "none",
    borderBottom: "none",
  },
  tituloEvento: {
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  lineaEvento: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: tokens.colorNeutralForeground2,
  },
  apoyo: {
    marginLeft: "auto",
    flexShrink: 0,
    display: "flex",
    "& svg": {
      width: "14px",
      height: "14px",
    },
  },
  ahora: {
    position: "absolute",
    left: "0",
    right: "0",
    height: "2px",
    backgroundColor: identidad.oro,
    zIndex: 1,
    pointerEvents: "none",
    "::before": {
      content: '""',
      position: "absolute",
      left: "-5px",
      top: "-4px",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      backgroundColor: identidad.oro,
    },
  },
  etiquetaAhora: {
    position: "absolute",
    right: "4px",
    transform: "translateY(-50%)",
    padding: "1px 5px",
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: identidad.oro,
    color: "#1a1a1a",
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    zIndex: 3,
    fontVariantNumeric: "tabular-nums",
  },
});

export interface ColumnaRejilla {
  clave: string;
  titulo: string;
  subtitulo?: string;
  destacada?: boolean;
  mostrarAhora?: boolean;
  eventos: EventoAgenda[];
}

interface Props {
  columnas: ColumnaRejilla[];
  inicio: number;
  fin: number;
  ahora: number | null;
  anchoMinimo?: number;
  onEvento: (evento: EventoAgenda) => void;
  onEspacioLibre?: (columna: ColumnaRejilla, minutos: number) => void;
}

/**
 * Las etiquetas de hora se centran sobre su línea, salvo en los bordes: la primera
 * (p. ej. 07:00) quedaría medio tapada por la cabecera y la última cortada abajo.
 */
function ajusteEtiqueta(y: number, alto: number): string | undefined {
  if (y < 8) return "translateY(2px)";
  if (y > alto - 8) return "translateY(calc(-100% - 2px))";
  return undefined;
}

/** Reparte eventos que se solapan en carriles, para que ninguno tape a otro. */
function carriles(eventos: EventoAgenda[]) {
  const resultado = new Map<string, { carril: number; total: number }>();
  const ordenados = [...eventos].sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio));
  let grupo: { id: string; carril: number }[] = [];
  let finGrupo = -1;
  let finesCarril: number[] = [];

  const cerrar = () => {
    grupo.forEach((g) => resultado.set(g.id, { carril: g.carril, total: finesCarril.length }));
    grupo = [];
    finesCarril = [];
  };

  ordenados.forEach((e) => {
    const ini = aMinutos(e.hora_inicio);
    const fin = aMinutos(e.hora_fin);
    if (ini >= finGrupo) cerrar();
    let carril = finesCarril.findIndex((f) => f <= ini);
    if (carril === -1) {
      carril = finesCarril.length;
      finesCarril.push(fin);
    } else {
      finesCarril[carril] = fin;
    }
    grupo.push({ id: e.id, carril });
    finGrupo = Math.max(finGrupo, fin);
  });
  cerrar();
  return resultado;
}

export function RejillaTiempo({ columnas, inicio, fin, ahora, anchoMinimo = 150, onEvento, onEspacioLibre }: Props) {
  const estilos = useEstilos();
  const alto = (fin - inicio) * PX;
  const horas: number[] = [];
  for (let m = Math.ceil(inicio / 60) * 60; m <= fin; m += 60) horas.push(m);

  const fondo = {
    backgroundImage: `repeating-linear-gradient(to bottom, ${tokens.colorNeutralStroke2} 0, ${tokens.colorNeutralStroke2} 1px, transparent 1px, transparent ${60 * PX}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${30 * PX}px, ${tokens.colorNeutralStroke3} ${30 * PX}px, ${tokens.colorNeutralStroke3} ${30 * PX + 1}px, transparent ${30 * PX + 1}px, transparent ${60 * PX}px)`,
    backgroundPositionY: `${((Math.ceil(inicio / 60) * 60 - inicio) * PX) % (60 * PX)}px`,
  };

  const alPresionar = (columna: ColumnaRejilla) => (evento: MouseEvent<HTMLDivElement>) => {
    if (!onEspacioLibre || evento.target !== evento.currentTarget) return;
    const y = evento.clientY - evento.currentTarget.getBoundingClientRect().top;
    const minutos = Math.floor((inicio + y / PX) / 30) * 30;
    onEspacioLibre(columna, minutos);
  };

  return (
    <div className={estilos.marco}>
      <div
        className={estilos.rejilla}
        style={{ gridTemplateColumns: `56px repeat(${columnas.length}, minmax(${anchoMinimo}px, 1fr))` }}
      >
        <div className={estilos.esquina} />
        {columnas.map((c) => (
          <div key={c.clave} className={mergeClasses(estilos.cabecera, c.destacada && estilos.cabeceraDestacada)}>
            <Caption1Strong>{c.titulo}</Caption1Strong>
            {c.subtitulo && <Caption1 className={estilos.subtitulo}>{c.subtitulo}</Caption1>}
          </div>
        ))}

        <div className={estilos.horas} style={{ height: alto, position: "sticky" }}>
          {horas.map((m) => (
            <span
              key={m}
              className={estilos.hora}
              style={{ top: (m - inicio) * PX, transform: ajusteEtiqueta((m - inicio) * PX, alto) }}
            >
              {aHora(m)}
            </span>
          ))}
          {ahora !== null && ahora >= inicio && ahora <= fin && (
            <span
              className={estilos.etiquetaAhora}
              style={{ top: (ahora - inicio) * PX, transform: ajusteEtiqueta((ahora - inicio) * PX, alto) }}
            >
              {aHora(ahora)}
            </span>
          )}
        </div>

        {columnas.map((c) => {
          const distribucion = carriles(c.eventos);
          return (
            <div
              key={c.clave}
              className={mergeClasses(estilos.columna, !onEspacioLibre && estilos.columnaSoloLectura)}
              style={{ height: alto, ...fondo }}
              onClick={alPresionar(c)}
              title={onEspacioLibre ? "Clic en un espacio libre para reservar" : undefined}
            >
              {c.mostrarAhora && ahora !== null && ahora >= inicio && ahora <= fin && (
                <div className={estilos.ahora} style={{ top: (ahora - inicio) * PX }} />
              )}
              {c.eventos.map((e) => {
                const ini = aMinutos(e.hora_inicio);
                const fi = aMinutos(e.hora_fin);
                const lugar = distribucion.get(e.id) ?? { carril: 0, total: 1 };
                const ancho = 100 / lugar.total;
                const altoEvento = Math.max((fi - ini) * PX - 2, 22);
                const suspendida = e.estado === "suspendida";
                return (
                  <Tooltip
                    key={e.id}
                    relationship="description"
                    withArrow
                    content={
                      <div>
                        <strong>{e.titulo}</strong>
                        <div>
                          {e.hora_inicio}–{e.hora_fin} · {e.laboratorio_codigo}
                        </div>
                        {e.detalle && <div>{e.detalle}</div>}
                        {e.responsable && <div>{e.responsable}</div>}
                        {suspendida && <div>Suspendida: {e.nota}</div>}
                        {e.requiere_apoyo && <div>Requiere apoyo de auxiliares</div>}
                      </div>
                    }
                  >
                    <button
                      type="button"
                      className={mergeClasses(
                        estilos.evento,
                        e.tipo === "clase" ? estilos.clase : estilos.reserva,
                        e.estado === "pendiente" && estilos.pendiente,
                        suspendida && estilos.suspendida,
                      )}
                      style={{
                        top: (ini - inicio) * PX + 1,
                        height: altoEvento,
                        left: `calc(${lugar.carril * ancho}% + 3px)`,
                        width: `calc(${ancho}% - 6px)`,
                      }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEvento(e);
                      }}
                    >
                      <span className={estilos.tituloEvento}>
                        {e.titulo}
                        {e.requiere_apoyo && (
                          <span className={estilos.apoyo} aria-label="Requiere apoyo">
                            <IconoPersona />
                          </span>
                        )}
                      </span>
                      {altoEvento > 36 && (
                        <span className={estilos.lineaEvento}>
                          {e.hora_inicio}–{e.hora_fin}
                          {e.responsable ? ` · ${e.responsable}` : ""}
                        </span>
                      )}
                      {altoEvento > 56 && e.detalle && <span className={estilos.lineaEvento}>{e.detalle}</span>}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
