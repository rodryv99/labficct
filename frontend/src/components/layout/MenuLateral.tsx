import { Caption1Strong, Tooltip, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { NavLink } from "react-router";

import { navegacionPermitida } from "../../app/navegacion";
import { useSesion } from "../../app/sesion";
import { IconoMenu } from "../iconos/iconos";

const useEstilos = makeStyles({
  raiz: {
    width: "232px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    transitionProperty: "width",
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: tokens.curveEasyEase,
    overflowX: "hidden",
    overflowY: "auto",
  },
  colapsado: {
    width: "56px",
  },
  grupos: {
    flex: 1,
    padding: "12px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  grupo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  tituloGrupo: {
    padding: "0 12px 4px",
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
  },
  enlace: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    height: "36px",
    padding: "0 12px",
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground2,
    textDecorationLine: "none",
    fontSize: tokens.fontSizeBase300,
    whiteSpace: "nowrap",
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
      color: tokens.colorNeutralForeground1,
    },
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "-2px",
    },
  },
  activo: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    ":hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
      color: tokens.colorBrandForeground1,
    },
    "::before": {
      content: '""',
      position: "absolute",
      left: "0",
      top: "8px",
      bottom: "8px",
      width: "3px",
      borderRadius: "2px",
      backgroundColor: tokens.colorBrandForeground1,
    },
  },
  icono: {
    flexShrink: 0,
    display: "flex",
    fontSize: "20px",
  },
  pie: {
    padding: "8px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  botonColapsar: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    height: "36px",
    padding: "0 12px",
    border: "none",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground3,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase200,
    whiteSpace: "nowrap",
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
    },
  },
});

interface Props {
  colapsado: boolean;
  onAlternar: () => void;
  onNavegar?: () => void;
  className?: string;
}

export function MenuLateral({ colapsado, onAlternar, onNavegar, className }: Props) {
  const estilos = useEstilos();
  const { puede } = useSesion();
  const grupos = navegacionPermitida(puede);

  return (
    <nav aria-label="Navegación principal" className={mergeClasses(estilos.raiz, colapsado && estilos.colapsado, className)}>
      <div className={estilos.grupos}>
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className={estilos.grupo}>
            {!colapsado && <Caption1Strong className={estilos.tituloGrupo}>{grupo.titulo}</Caption1Strong>}
            {grupo.items.map((item) => {
              const Icono = item.icono;
              const enlace = (
                <NavLink
                  key={item.ruta}
                  to={item.ruta}
                  onClick={onNavegar}
                  className={({ isActive }) => mergeClasses(estilos.enlace, isActive && estilos.activo)}
                >
                  {({ isActive }) => (
                    <>
                      <span className={estilos.icono}>
                        <Icono filled={isActive} />
                      </span>
                      {!colapsado && item.etiqueta}
                    </>
                  )}
                </NavLink>
              );
              return colapsado ? (
                <Tooltip key={item.ruta} content={item.etiqueta} relationship="label" positioning="after">
                  {enlace}
                </Tooltip>
              ) : (
                enlace
              );
            })}
          </div>
        ))}
      </div>
      <div className={estilos.pie}>
        <button type="button" className={estilos.botonColapsar} onClick={onAlternar} aria-expanded={!colapsado}>
          <span className={estilos.icono}>
            <IconoMenu />
          </span>
          {!colapsado && "Contraer menú"}
        </button>
      </div>
    </nav>
  );
}
