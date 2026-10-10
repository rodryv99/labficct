import type { ReactElement, SVGProps } from "react";

import type { IconoElemento as Icono } from "../../api/tipos";

/**
 * Íconos propios para los elementos de un laboratorio. Trazo de 1.5 px sobre
 * una grilla de 24, el mismo estilo de línea que los íconos de Fluent.
 */
const TRAZOS: Record<Icono, ReactElement> = {
  pc: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16v3M8 20h8" />
    </>
  ),
  laptop: (
    <>
      <rect x="5" y="5" width="14" height="10" rx="1.5" />
      <path d="M3 19l2-4h14l2 4z" />
    </>
  ),
  proyector: (
    <>
      <rect x="3" y="8" width="18" height="9" rx="2" />
      <circle cx="15.5" cy="12.5" r="2.5" />
      <path d="M6.5 12.5h3M6 17v2M18 17v2" />
    </>
  ),
  pantalla: (
    <>
      <path d="M3 4h18" />
      <rect x="4.5" y="4" width="15" height="10" rx="1" />
      <path d="M12 14v4M9 21l3-3 3 3" />
    </>
  ),
  pizarra: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M7 9h6M7 12h9M8 20l1.5-4M16 20l-1.5-4" />
    </>
  ),
  televisor: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M8.5 3.5L12 7l3.5-3.5" />
    </>
  ),
  impresora: (
    <>
      <path d="M7 8V3.5h10V8" />
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <rect x="7" y="13.5" width="10" height="7" rx="1" />
      <path d="M17 11h.01" />
    </>
  ),
  parlante: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <circle cx="12" cy="14" r="3.5" />
      <circle cx="12" cy="7.5" r="1.2" />
    </>
  ),
  camara: (
    <>
      <circle cx="12" cy="10" r="6" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M12 16v3M8.5 21h7" />
    </>
  ),
  router: (
    <>
      <rect x="3" y="12" width="18" height="7" rx="2" />
      <path d="M8 12V6M16 12V6M7 15.5h.01M10 15.5h.01M13 15.5h4" />
    </>
  ),
  servidor: (
    <>
      <rect x="4" y="3" width="16" height="5.5" rx="1.5" />
      <rect x="4" y="9.25" width="16" height="5.5" rx="1.5" />
      <rect x="4" y="15.5" width="16" height="5.5" rx="1.5" />
      <path d="M7.5 5.75h.01M7.5 12h.01M7.5 18.25h.01" />
    </>
  ),
  aire: (
    <>
      <rect x="2.5" y="5" width="19" height="8" rx="2" />
      <path d="M5.5 10h13M7.5 16v3M12 16v4M16.5 16v3" />
    </>
  ),
  enchufe: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M10 8.5v3M14 8.5v3M12 15.5h.01" />
    </>
  ),
  puerta: (
    <>
      <path d="M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17M3 21h18" />
      <path d="M14.5 12.5h.01" />
    </>
  ),
  ventana: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M12 4v16M4 12h16" />
    </>
  ),
  mesa: (
    <>
      <rect x="3" y="7" width="18" height="3.5" rx="1" />
      <path d="M5 10.5V20M19 10.5V20M12.5 10.5v4h6.5" />
    </>
  ),
  silla: (
    <>
      <path d="M8 3v10h8M8 13l-1 8M16 13l1 8M8 17h8" />
    </>
  ),
  generico: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </>
  ),
};

interface Props extends Omit<SVGProps<SVGSVGElement>, "color"> {
  icono: Icono;
  tamano?: number;
  color?: string;
}

export function IconoElemento({ icono, tamano = 20, color = "currentColor", ...resto }: Props) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...resto}
    >
      {TRAZOS[icono] ?? TRAZOS.generico}
    </svg>
  );
}

/** Versión para dibujar dentro de otro SVG (la grilla del laboratorio). */
export function TrazoElemento({
  icono,
  x,
  y,
  tamano,
  color,
}: {
  icono: Icono;
  x: number;
  y: number;
  tamano: number;
  color: string;
}) {
  const escala = tamano / 24;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${escala})`}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
    >
      {TRAZOS[icono] ?? TRAZOS.generico}
    </g>
  );
}
