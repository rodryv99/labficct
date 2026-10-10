import { isAxiosError } from "axios";

/** Forma única de los errores del backend (ver apps/core/errores.py). */
export interface ErrorApi {
  codigo: string;
  mensaje: string;
  campos: Record<string, unknown>;
  choques?: string[];
}

export function datosDeError(error: unknown): ErrorApi | null {
  if (isAxiosError(error) && error.response?.data && typeof error.response.data === "object") {
    return error.response.data as ErrorApi;
  }
  return null;
}

export function mensajeDeError(error: unknown, porDefecto = "No se pudo completar la acción."): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return "No hay conexión con el servidor. Revisa que el backend esté encendido.";
    }
    const datos = datosDeError(error);
    if (datos?.mensaje) return datos.mensaje;
    if (error.response.status >= 500) return "El servidor tuvo un problema. Intenta de nuevo en un momento.";
  }
  return porDefecto;
}

/** Aplana los errores por campo: {"bloques": [{"hora_fin": ["..."]}]} → {"bloques.0.hora_fin": "..."} */
export function erroresDeCampos(error: unknown): Record<string, string> {
  const resultado: Record<string, string> = {};
  const campos = datosDeError(error)?.campos;
  if (!campos) return resultado;

  const recorrer = (valor: unknown, ruta: string) => {
    if (typeof valor === "string") {
      if (!resultado[ruta]) resultado[ruta] = valor;
    } else if (Array.isArray(valor)) {
      if (valor.every((v) => typeof v === "string")) {
        if (valor.length && !resultado[ruta]) resultado[ruta] = valor[0] as string;
      } else {
        valor.forEach((v, i) => recorrer(v, ruta ? `${ruta}.${i}` : String(i)));
      }
    } else if (valor && typeof valor === "object") {
      Object.entries(valor).forEach(([k, v]) => recorrer(v, ruta ? `${ruta}.${k}` : k));
    }
  };
  recorrer(campos, "");
  return resultado;
}

export function choquesDeError(error: unknown): string[] {
  return datosDeError(error)?.choques ?? [];
}
