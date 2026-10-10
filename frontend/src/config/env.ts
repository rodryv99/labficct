/**
 * Variables de entorno de la web (frontend/.env).
 * Si falta alguna, la app no arranca y muestra cuál falta (ver main.tsx).
 */

const faltantes: string[] = [];

function url(nombre: "VITE_API_BASE_URL" | "VITE_WS_BASE_URL"): string {
  const valor = (import.meta.env[nombre] ?? "").trim();
  if (!valor) {
    faltantes.push(nombre);
    return "";
  }
  try {
    new URL(valor);
  } catch {
    faltantes.push(`${nombre} (no es una URL válida: ${valor})`);
    return "";
  }
  return valor.replace(/\/+$/, "");
}

export const env = {
  appName: import.meta.env.VITE_APP_NAME?.trim() || "Laboratorios FICCT",
  apiBaseUrl: url("VITE_API_BASE_URL"),
  wsBaseUrl: url("VITE_WS_BASE_URL"),
} as const;

export const errorDeConfiguracion: string | null = faltantes.length
  ? `Revisa frontend/.env (cópialo desde .env.example). Falta o es incorrecto: ${faltantes.join(", ")}.`
  : null;
