import { Badge, makeStyles, tokens } from "@fluentui/react-components";
import type { ReactNode } from "react";

export type Tono = "exito" | "aviso" | "peligro" | "info" | "neutro" | "marca";

const COLOR: Record<Tono, "success" | "warning" | "danger" | "informative" | "subtle" | "brand"> = {
  exito: "success",
  aviso: "warning",
  peligro: "danger",
  info: "informative",
  neutro: "informative",
  marca: "brand",
};

/** Etiqueta de estado. Siempre texto + color: el color solo nunca basta. */
export function EtiquetaEstado({ tono, children }: { tono: Tono; children: ReactNode }) {
  return (
    <Badge appearance="tint" color={COLOR[tono]} shape="rounded" size="medium">
      {children}
    </Badge>
  );
}

const useEstilos = makeStyles({
  codigo: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
    padding: "1px 6px",
    whiteSpace: "nowrap",
  },
});

export function Codigo({ children }: { children: ReactNode }) {
  const estilos = useEstilos();
  return <span className={estilos.codigo}>{children}</span>;
}
