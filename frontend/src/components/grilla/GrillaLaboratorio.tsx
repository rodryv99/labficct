import { tokens } from "@fluentui/react-components";
import type { PointerEvent } from "react";

import type { Celda, TipoElemento } from "../../api/tipos";
import { TrazoElemento } from "../iconos/IconoElemento";

export const CELDA = 52;
export const ESPACIO = 6;
export const MARGEN = 22;

export const clave = (fila: number, columna: number) => `${fila},${columna}`;

export function tamanoGrilla(filas: number, columnas: number) {
  return {
    ancho: MARGEN + columnas * (CELDA + ESPACIO) + ESPACIO,
    alto: MARGEN + filas * (CELDA + ESPACIO) + ESPACIO,
  };
}

const COLOR_ESTADO: Record<string, string | undefined> = {
  con_falla: tokens.colorStatusDangerForeground1,
  mantenimiento: tokens.colorStatusWarningForeground1,
};

interface Props {
  filas: number;
  columnas: number;
  celdas: Record<string, Celda>;
  tipos: Map<number, TipoElemento>;
  zoom?: number;
  seleccion?: string | null;
  /** En modo edición las casillas vacías se ven con borde punteado. */
  editable?: boolean;
  cursor?: string;
  onCeldaAbajo?: (fila: number, columna: number, evento: PointerEvent<SVGElement>) => void;
  onDobleClic?: (fila: number, columna: number) => void;
  onPointerMove?: (evento: PointerEvent<SVGSVGElement>) => void;
  etiqueta?: string;
}

/**
 * Dibuja la grilla de un laboratorio en SVG: nítida en cualquier zoom.
 * Cada casilla lleva data-celda="fila,columna" para ubicarla bajo el dedo o el mouse.
 */
export function GrillaLaboratorio({
  filas,
  columnas,
  celdas,
  tipos,
  zoom = 1,
  seleccion,
  editable = false,
  cursor,
  onCeldaAbajo,
  onDobleClic,
  onPointerMove,
  etiqueta = "Distribución del laboratorio",
}: Props) {
  const { ancho, alto } = tamanoGrilla(filas, columnas);
  const posiciones: [number, number][] = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < columnas; c++) posiciones.push([f, c]);

  const x = (c: number) => MARGEN + ESPACIO + c * (CELDA + ESPACIO);
  const y = (f: number) => MARGEN + ESPACIO + f * (CELDA + ESPACIO);

  return (
    <svg
      role="img"
      aria-label={etiqueta}
      width={ancho * zoom}
      height={alto * zoom}
      viewBox={`0 0 ${ancho} ${alto}`}
      style={{ display: "block", touchAction: editable ? "none" : "auto", cursor, userSelect: "none" }}
      onPointerMove={onPointerMove}
    >
      {/* Números de columna y fila */}
      {Array.from({ length: columnas }, (_, c) => (
        <text
          key={`c${c}`}
          x={x(c) + CELDA / 2}
          y={MARGEN - 6}
          textAnchor="middle"
          fontSize={10}
          style={{ fill: tokens.colorNeutralForeground4 }}
        >
          {c + 1}
        </text>
      ))}
      {Array.from({ length: filas }, (_, f) => (
        <text
          key={`f${f}`}
          x={MARGEN - 6}
          y={y(f) + CELDA / 2 + 3}
          textAnchor="end"
          fontSize={10}
          style={{ fill: tokens.colorNeutralForeground4 }}
        >
          {f + 1}
        </text>
      ))}

      {posiciones.map(([f, c]) => {
        const k = clave(f, c);
        const celda = celdas[k];
        const tipo = celda ? tipos.get(celda.tipo) : undefined;
        const seleccionada = seleccion === k;
        const color = tipo?.color ?? "#6B7280";
        const deBaja = celda?.estado === "baja";
        const marcaEstado = celda ? COLOR_ESTADO[celda.estado] : undefined;

        return (
          <g key={k} opacity={deBaja ? 0.45 : 1}>
            <rect
              data-celda={k}
              x={x(c)}
              y={y(f)}
              width={CELDA}
              height={CELDA}
              rx={7}
              style={
                celda
                  ? { fill: color, fillOpacity: 0.1, stroke: color, strokeOpacity: 0.55, strokeWidth: 1.2 }
                  : {
                      fill: tokens.colorNeutralBackground1,
                      stroke: tokens.colorNeutralStroke2,
                      strokeWidth: 1,
                      strokeDasharray: editable ? "3 3" : undefined,
                    }
              }
              onPointerDown={onCeldaAbajo ? (e) => onCeldaAbajo(f, c, e) : undefined}
              onDoubleClick={onDobleClic ? () => onDobleClic(f, c) : undefined}
            />
            {celda && tipo && (
              <>
                {tipo.imagen ? (
                  <image
                    href={tipo.imagen}
                    x={x(c) + 13}
                    y={y(f) + 6}
                    width={26}
                    height={26}
                    preserveAspectRatio="xMidYMid meet"
                    pointerEvents="none"
                  />
                ) : (
                  <TrazoElemento icono={tipo.icono} x={x(c) + 14} y={y(f) + 7} tamano={24} color={color} />
                )}
                <text
                  x={x(c) + CELDA / 2}
                  y={y(f) + CELDA - 7}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontWeight={600}
                  pointerEvents="none"
                  style={{ fill: tokens.colorNeutralForeground2 }}
                >
                  {celda.etiqueta.length > 9 ? `${celda.etiqueta.slice(0, 8)}…` : celda.etiqueta}
                </text>
              </>
            )}
            {marcaEstado && (
              <circle
                cx={x(c) + CELDA - 7}
                cy={y(f) + 7}
                r={4}
                pointerEvents="none"
                style={{ fill: marcaEstado, stroke: tokens.colorNeutralBackground1, strokeWidth: 1.5 }}
              />
            )}
            {seleccionada && (
              <rect
                x={x(c) - 3}
                y={y(f) - 3}
                width={CELDA + 6}
                height={CELDA + 6}
                rx={9}
                pointerEvents="none"
                style={{ fill: "none", stroke: tokens.colorBrandStroke1, strokeWidth: 2.5 }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
