import { type BrandVariants, type Theme, createDarkTheme, createLightTheme } from "@fluentui/react-components";

/**
 * Escala de marca generada desde el azul del logo de la FICCT (#034481).
 * Fluent usa el tono 80 para botones principales y enlaces en modo claro,
 * y los tonos 100–120 en modo oscuro.
 */
export const marcaFicct: BrandVariants = {
  10: "#010d19",
  20: "#011528",
  30: "#011d37",
  40: "#022546",
  50: "#022d55",
  60: "#023564",
  70: "#033c73",
  80: "#034481",
  90: "#0969c3",
  100: "#3194f1",
  110: "#5ba8f0",
  120: "#7fb9f0",
  130: "#a1cbf2",
  140: "#bddaf4",
  150: "#d9e9f8",
  160: "#eef5fb",
};

export const temaClaro: Theme = {
  ...createLightTheme(marcaFicct),
};

export const temaOscuro: Theme = {
  ...createDarkTheme(marcaFicct),
  colorBrandForeground1: marcaFicct[110],
  colorBrandForeground2: marcaFicct[120],
};

/** Colores de identidad fuera de la escala de Fluent. */
export const identidad = {
  azulFicct: "#013972",
  rojoFicct: "#E3001B",
  /** Oro de las estrellas del logo: solo para la línea de "ahora" y detalles del login. */
  oro: "#F89000",
};
