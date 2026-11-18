import { Body1, Caption1, Title3, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactNode } from "react";

const ANGOSTO = "@media (max-width: 720px)";

// El encabezado es el "cajetín" del plano: un bloque con el nombre de la
// pantalla a la izquierda y, separadas por una línea, sus acciones.
const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    alignItems: "stretch",
    marginBottom: "20px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1.5px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    [ANGOSTO]: {
      flexDirection: "column",
    },
  },
  textos: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    padding: "14px 20px 16px",
  },
  migas: {
    color: tokens.colorNeutralForeground3,
  },
  descripcion: {
    color: tokens.colorNeutralForeground3,
    maxWidth: "70ch",
  },
  acciones: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
    padding: "14px 20px",
    borderLeft: `1.5px solid ${tokens.colorNeutralStroke2}`,
    [ANGOSTO]: {
      justifyContent: "flex-start",
      borderLeft: "none",
      borderTop: `1.5px solid ${tokens.colorNeutralStroke2}`,
    },
  },
});

interface Props {
  titulo: ReactNode;
  descripcion?: ReactNode;
  seccion?: string;
  acciones?: ReactNode;
}

/** Título de la página y, a la derecha, su única acción principal. */
export function EncabezadoPagina({ titulo, descripcion, seccion, acciones }: Props) {
  const estilos = useEstilos();
  return (
    <header className={estilos.raiz}>
      <div className={estilos.textos}>
        {seccion && <Caption1 className={estilos.migas}>{seccion}</Caption1>}
        <Title3 as="h1">{titulo}</Title3>
        {descripcion && <Body1 className={estilos.descripcion}>{descripcion}</Body1>}
      </div>
      {acciones && <div className={estilos.acciones}>{acciones}</div>}
    </header>
  );
}

const useEstilosBarra = makeStyles({
  barra: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
});

/** Fila de búsqueda y filtros sobre una tabla. */
export function BarraFiltros({ children }: { children: ReactNode }) {
  const estilos = useEstilosBarra();
  return <div className={estilos.barra}>{children}</div>;
}
