import { type BrandVariants, type Theme, createDarkTheme, createLightTheme } from "@fluentui/react-components";

/**
 * Identidad «Plano de laboratorio».
 *
 * La idea: la app se ve como el plano técnico de un laboratorio. Papel azulado
 * con cuadrícula, tinta azul marino, líneas finas y la tipografía Barlow (la de
 * los rótulos de planos y señales). El azul del escudo de la FICCT es el color
 * principal; el oro se usa solo para marcar lo seleccionado o "lo de ahora".
 *
 * Hay dos temas: Plano (claro) y Nocturno (oscuro).
 */

/** Escala de marca generada desde el azul del logo de la FICCT (#034481). */
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

/** Tipografías: Barlow para el texto y Barlow Condensed para títulos y cifras. */
export const fuentes = {
  texto: "'Barlow', 'Segoe UI', system-ui, -apple-system, sans-serif",
  titulos: "'Barlow Condensed', 'Arial Narrow', 'Segoe UI', sans-serif",
};

const comunes = {
  fontFamilyBase: fuentes.texto,
  borderRadiusSmall: "2px",
  borderRadiusMedium: "4px",
  borderRadiusLarge: "6px",
  borderRadiusXLarge: "8px",
};

/** Plano: papel azulado, superficies blancas, tinta azul marino. */
export const temaClaro: Theme = {
  ...createLightTheme(marcaFicct),
  ...comunes,
  colorNeutralBackground1: "#ffffff",
  colorNeutralBackground1Hover: "#f3f7fb",
  colorNeutralBackground1Pressed: "#e3eaf3",
  colorNeutralBackground1Selected: "#e8eff7",
  colorNeutralBackground2: "#edf2f8",
  colorNeutralBackground3: "#e3eaf3",
  colorNeutralBackground4: "#dae3ee",
  colorNeutralForeground1: "#0b2545",
  colorNeutralForeground2: "#2a4163",
  colorNeutralForeground3: "#4f6583",
  colorNeutralForeground4: "#6b7f99",
  colorNeutralStroke1: "#b4c5da",
  colorNeutralStroke2: "#cbd7e6",
  colorNeutralStroke3: "#dfe7f1",
  colorNeutralStrokeAccessible: "#4f6583",
  colorSubtleBackgroundHover: "#e8eff7",
  colorSubtleBackgroundPressed: "#dae3ee",
  colorSubtleBackgroundSelected: "#e3eaf3",
  colorBrandBackground2: "#e3edf8",
};

/** Nocturno: el mismo plano, de noche. */
export const temaOscuro: Theme = {
  ...createDarkTheme(marcaFicct),
  ...comunes,
  colorBrandForeground1: marcaFicct[110],
  colorBrandForeground2: marcaFicct[120],
  colorNeutralBackground1: "#131f33",
  colorNeutralBackground1Hover: "#1a2a44",
  colorNeutralBackground1Pressed: "#0f1a2b",
  colorNeutralBackground1Selected: "#1d2f4c",
  colorNeutralBackground2: "#0c1524",
  colorNeutralBackground3: "#0f1a2b",
  colorNeutralBackground4: "#0a1220",
  colorNeutralForeground1: "#e3ecf7",
  colorNeutralForeground2: "#c9d6e6",
  colorNeutralForeground3: "#a6b8d0",
  colorNeutralForeground4: "#8194ad",
  colorNeutralStroke1: "#3a506e",
  colorNeutralStroke2: "#2b3e58",
  colorNeutralStroke3: "#22324a",
  colorNeutralStrokeAccessible: "#a6b8d0",
  colorSubtleBackgroundHover: "#1a2a44",
  colorSubtleBackgroundPressed: "#0f1a2b",
  colorSubtleBackgroundSelected: "#1d2f4c",
  colorBrandBackground2: "#12294a",
};

/**
 * Colores de identidad fuera de la escala de Fluent.
 *
 * `acento`, `rejilla` y `barra` cambian con el tema: están definidos como
 * variables CSS en `styles/global.css` (según `data-tema` en <html>).
 */
export const identidad = {
  azulFicct: "#013972",
  rojoFicct: "#E3001B",
  /** Oro de las estrellas del logo: la línea de "ahora" y lo seleccionado. */
  oro: "#F89000",
  /** Marca de selección (oro), según el tema. */
  acento: "var(--lab-acento)",
  /** Líneas de la cuadrícula de fondo, según el tema. */
  rejilla: "var(--lab-rejilla)",
  /** Fondo de la barra superior, según el tema. */
  barra: "var(--lab-barra)",
};

/** Fondo de cuadrícula tipo plano, para usar dentro de makeStyles. */
export const fondoPlano = {
  backgroundImage:
    "linear-gradient(var(--lab-rejilla) 1px, transparent 1px), linear-gradient(90deg, var(--lab-rejilla) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};
