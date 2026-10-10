import { Body1, Caption1, Title3, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactNode } from "react";

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },
  textos: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  migas: {
    color: tokens.colorNeutralForeground3,
  },
  descripcion: {
    color: tokens.colorNeutralForeground3,
  },
  acciones: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
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
