import {
  Skeleton,
  SkeletonItem,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { KeyboardEvent, ReactNode } from "react";

import { EstadoError } from "../feedback/Estados";

const useEstilos = makeStyles({
  contenedor: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    overflowX: "auto",
  },
  tabla: {
    minWidth: "640px",
  },
  encabezado: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
  fila: {
    cursor: "pointer",
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "-2px",
    },
  },
})

export interface Columna<T> {
  clave: string;
  titulo: string;
  ancho?: string;
  /** Campo de ordenamiento en la API (?ordering=). */
  ordenar?: string;
  render: (fila: T) => ReactNode;
}

interface Props<T> {
  etiqueta: string;
  columnas: Columna<T>[];
  filas: T[] | undefined;
  claveFila: (fila: T) => string | number;
  cargando?: boolean;
  error?: unknown;
  onReintentar?: () => void;
  onFila?: (fila: T) => void;
  orden?: string;
  onOrden?: (orden: string) => void;
  vacio?: ReactNode;
}

export function TablaDatos<T>({
  etiqueta,
  columnas,
  filas,
  claveFila,
  cargando,
  error,
  onReintentar,
  onFila,
  orden,
  onOrden,
  vacio,
}: Props<T>) {
  const estilos = useEstilos();

  if (error && !filas) {
    return (
      <div className={estilos.contenedor}>
        <EstadoError error={error} onReintentar={onReintentar} />
      </div>
    );
  }

  const direccion = (c: Columna<T>) => {
    if (!c.ordenar || !orden) return undefined;
    if (orden === c.ordenar) return "ascending" as const;
    if (orden === `-${c.ordenar}`) return "descending" as const;
    return undefined;
  };

  const alternarOrden = (c: Columna<T>) => {
    if (!c.ordenar || !onOrden) return;
    onOrden(orden === c.ordenar ? `-${c.ordenar}` : c.ordenar);
  };

  const alTeclear = (evento: KeyboardEvent, fila: T) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      onFila?.(fila);
    }
  };

  return (
    <div className={estilos.contenedor}>
      <Table aria-label={etiqueta} className={estilos.tabla} sortable={Boolean(onOrden)}>
        <TableHeader className={estilos.encabezado}>
          <TableRow>
            {columnas.map((c) => (
              <TableHeaderCell
                key={c.clave}
                style={c.ancho ? { width: c.ancho } : undefined}
                sortDirection={direccion(c)}
                onClick={c.ordenar && onOrden ? () => alternarOrden(c) : undefined}
              >
                {c.titulo}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cargando && !filas
            ? Array.from({ length: 6 }, (_, i) => (
                <TableRow key={`esqueleto-${i}`}>
                  {columnas.map((c) => (
                    <TableCell key={c.clave}>
                      <Skeleton aria-label="Cargando">
                        <SkeletonItem size={16} />
                      </Skeleton>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : (filas ?? []).map((fila) => (
                <TableRow
                  key={claveFila(fila)}
                  className={onFila ? estilos.fila : undefined}
                  onClick={onFila ? () => onFila(fila) : undefined}
                  onKeyDown={onFila ? (e) => alTeclear(e, fila) : undefined}
                  tabIndex={onFila ? 0 : undefined}
                >
                  {columnas.map((c) => (
                    <TableCell key={c.clave}>{c.render(fila)}</TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {!cargando && filas && filas.length === 0 && vacio}
    </div>
  );
}
