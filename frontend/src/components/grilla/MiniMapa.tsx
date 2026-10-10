import { tokens } from "@fluentui/react-components";

import type { TipoElemento } from "../../api/tipos";

interface Props {
  filas: number;
  columnas: number;
  mapa: [number, number, number][];
  tipos: Map<number, TipoElemento>;
  alto?: number;
}

/** Vista previa diminuta de la grilla, para las tarjetas de laboratorio. */
export function MiniMapa({ filas, columnas, mapa, tipos, alto = 88 }: Props) {
  const lado = 8;
  const espacio = 2;
  const ancho = columnas * (lado + espacio) - espacio;
  const altura = filas * (lado + espacio) - espacio;
  const ocupadas = new Map(mapa.map(([f, c, t]) => [`${f},${c}`, t]));

  const celdas = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const tipo = ocupadas.get(`${f},${c}`);
      const color = tipo !== undefined ? tipos.get(tipo)?.color ?? "#6B7280" : undefined;
      celdas.push(
        <rect
          key={`${f},${c}`}
          x={c * (lado + espacio)}
          y={f * (lado + espacio)}
          width={lado}
          height={lado}
          rx={1.5}
          style={color ? { fill: color, fillOpacity: 0.85 } : { fill: tokens.colorNeutralBackground3 }}
        />,
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${Math.max(ancho, 1)} ${Math.max(altura, 1)}`}
      width="100%"
      height={alto}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {celdas}
    </svg>
  );
}
