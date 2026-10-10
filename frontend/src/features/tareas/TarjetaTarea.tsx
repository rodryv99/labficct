import {
  Avatar,
  Button,
  Caption1,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  ProgressBar,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";

import type { EstadoTarea, Tarea } from "../../api/tipos";
import { Codigo, EtiquetaEstado } from "../../components/datos/Etiquetas";
import { IconoComentario, IconoMas, IconoReloj } from "../../components/iconos/iconos";
import { ESTADOS_TAREA } from "../../lib/constantes";
import { fechaCorta } from "../../lib/fechas";
import { textoAvance } from "./api";

const useEstilos = makeStyles({
  tarjeta: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px 10px 10px 12px",
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
    cursor: "pointer",
    ":hover": {
      boxShadow: tokens.shadow8,
    },
  },
  movible: {
    cursor: "grab",
  },
  alta: {
    borderLeft: `3px solid ${tokens.colorPaletteRedBorder2}`,
  },
  arrastrando: {
    opacity: 0.45,
  },
  cabecera: {
    display: "flex",
    alignItems: "flex-start",
    gap: "4px",
  },
  titulo: {
    flex: 1,
    minWidth: 0,
    padding: "2px 0",
    border: "none",
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground1,
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    fontWeight: tokens.fontWeightSemibold,
    textAlign: "left",
    cursor: "inherit",
    wordBreak: "break-word",
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      borderRadius: tokens.borderRadiusSmall,
    },
  },
  hecha: {
    color: tokens.colorNeutralForeground3,
    textDecorationLine: "line-through",
  },
  etiquetas: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },
  fecha: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    "& svg": {
      width: "14px",
      height: "14px",
    },
  },
  vencida: {
    color: tokens.colorPaletteRedForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  progreso: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  barra: {
    flex: 1,
  },
  pie: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    minHeight: "20px",
  },
  personas: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  contador: {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    "& svg": {
      width: "14px",
      height: "14px",
    },
  },
  ultimo: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});

interface Props {
  tarea: Tarea;
  /** Se puede arrastrar y mover (permiso tareas.gestionar). */
  movible: boolean;
  arrastrando: boolean;
  onAbrir: (tarea: Tarea) => void;
  onMover: (tarea: Tarea, estado: EstadoTarea) => void;
  onArrastrar: (id: number | null) => void;
}

export function TarjetaTarea({ tarea: t, movible, arrastrando, onAbrir, onMover, onArrastrar }: Props) {
  const estilos = useEstilos();
  const hecha = t.estado === "hecha";
  const vencida = t.vencida && !hecha;
  const conProgreso = t.progreso > 0 && t.progreso < 100 && !hecha;
  const visibles = t.responsables_detalle.slice(0, 3);
  const extra = t.responsables_detalle.length - visibles.length;
  const ultimo = t.ultimo_avance ? textoAvance(t.ultimo_avance) : "";
  const autor = t.ultimo_avance?.autor_nombre.split(" ")[0] ?? "";

  return (
    <div
      className={mergeClasses(
        estilos.tarjeta,
        movible && estilos.movible,
        t.prioridad === "alta" && !hecha && estilos.alta,
        arrastrando && estilos.arrastrando,
      )}
      draggable={movible}
      onDragStart={(e) => {
        // Arrastrar texto seleccionado también dispara dragstart: sin permiso no se mueve nada.
        if (!movible) return;
        e.dataTransfer.setData("text/plain", String(t.id));
        e.dataTransfer.effectAllowed = "move";
        onArrastrar(t.id);
      }}
      onDragEnd={() => onArrastrar(null)}
      onClick={() => onAbrir(t)}
    >
      <div className={estilos.cabecera}>
        {/* Sin manejador propio: el clic sube a la tarjeta. Así se abre también con el teclado. */}
        <button type="button" className={mergeClasses(estilos.titulo, hecha && estilos.hecha)}>
          {t.titulo}
        </button>
        {movible && (
          // El menú se monta en un portal, pero sus clics igual suben por React: se frenan aquí.
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button size="small" appearance="subtle" icon={<IconoMas />} aria-label={`Mover «${t.titulo}» a…`} />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {ESTADOS_TAREA.filter((e) => e.valor !== t.estado).map((e) => (
                    <MenuItem key={e.valor} onClick={() => onMover(t, e.valor)}>
                      Mover a {e.etiqueta}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        )}
      </div>

      {(t.prioridad !== "normal" || t.revision !== null || t.laboratorio_codigo || t.fecha_limite) && (
        <div className={estilos.etiquetas}>
          {t.prioridad === "alta" && <EtiquetaEstado tono="peligro">Alta</EtiquetaEstado>}
          {t.prioridad === "baja" && <EtiquetaEstado tono="neutro">Baja</EtiquetaEstado>}
          {t.revision !== null && <EtiquetaEstado tono="info">Revisión</EtiquetaEstado>}
          {t.laboratorio_codigo && <Codigo>{t.laboratorio_codigo}</Codigo>}
          {t.fecha_limite && (
            <span className={mergeClasses(estilos.fecha, vencida && estilos.vencida)}>
              <IconoReloj />
              {vencida ? "Venció el " : "Hasta el "}
              {fechaCorta(t.fecha_limite)}
            </span>
          )}
        </div>
      )}

      {conProgreso && (
        <div className={estilos.progreso}>
          <ProgressBar className={estilos.barra} value={t.progreso / 100} thickness="medium" aria-label="Progreso" />
          <Caption1 className={estilos.secundario}>{t.progreso}%</Caption1>
        </div>
      )}

      <div className={estilos.pie}>
        <div className={estilos.personas}>
          {visibles.length ? (
            <>
              {visibles.map((r) => (
                <Avatar key={r.id} name={r.nombre_completo} title={r.nombre_completo} size={20} color="colorful" />
              ))}
              {extra > 0 && <Caption1 className={estilos.secundario}>+{extra}</Caption1>}
            </>
          ) : (
            <Caption1 className={estilos.secundario}>Sin asignar</Caption1>
          )}
        </div>
        {t.total_avances > 0 && (
          <span className={estilos.contador} title={`${t.total_avances} avance${t.total_avances === 1 ? "" : "s"}`}>
            <IconoComentario />
            {t.total_avances}
          </span>
        )}
      </div>

      {ultimo && (
        <Caption1 className={estilos.ultimo} title={ultimo}>
          {autor ? `${autor}: ${ultimo}` : ultimo}
        </Caption1>
      )}
    </div>
  );
}
