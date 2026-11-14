import { isAxiosError } from "axios";

import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";

/** Cómo se formatea cada columna (igual en la web, el Excel y el PDF). */
export type TipoColumna = "texto" | "entero" | "decimal" | "porcentaje" | "horas" | "minutos" | "fecha" | "fechahora";

export type TipoFiltro = "fecha" | "laboratorio" | "opcion" | "tipo_elemento" | "usuario";

export interface OpcionFiltro {
  valor: string | number;
  etiqueta: string;
}

export interface DefinicionFiltro {
  clave: string;
  etiqueta: string;
  tipo: TipoFiltro;
  multiple: boolean;
  por_defecto: string[];
  opciones: OpcionFiltro[];
}

export interface DefinicionReporte {
  codigo: string;
  titulo: string;
  descripcion: string;
  con_fechas: boolean;
  filtros: DefinicionFiltro[];
}

export interface ColumnaReporte {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
}

export type FilaReporte = Record<string, string | number | null>;

export interface SeccionReporte {
  titulo: string;
  columnas: ColumnaReporte[];
  filas: FilaReporte[];
  totales: FilaReporte | null;
}

export interface Reporte {
  codigo: string;
  titulo: string;
  filtros: { clave: string; etiqueta: string; valor: unknown; texto: string }[];
  generado_en: string;
  generado_por: string;
  secciones: SeccionReporte[];
  notas: string[];
}

export type Formato = "xlsx" | "pdf";

/** Valores de los filtros tal como los tiene el formulario. */
export type ValoresFiltros = Record<string, string | string[]>;

/** Las listas viajan separadas por coma (?categoria=equipo,red); los vacíos no se envían. */
function aParametros(valores: ValoresFiltros): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(valores)) {
    const texto = Array.isArray(valor) ? valor.join(",") : valor;
    if (texto) salida[clave] = texto;
  }
  return salida;
}

export async function listarReportes() {
  const { data } = await api.get<DefinicionReporte[]>(ENDPOINTS.reportes.lista);
  return data;
}

export async function obtenerReporte(codigo: string, valores: ValoresFiltros) {
  const { data } = await api.get<Reporte>(ENDPOINTS.reportes.detalle(codigo), { params: aParametros(valores) });
  return data;
}

/**
 * Descarga el archivo con el token de la sesión (como useImagenProtegida) y lo
 * guarda con el nombre que manda el servidor.
 */
export async function descargarReporte(codigo: string, valores: ValoresFiltros, formato: Formato) {
  try {
    const respuesta = await api.get<Blob>(ENDPOINTS.reportes.exportar(codigo), {
      params: { ...aParametros(valores), formato },
      responseType: "blob",
      // Un reporte grande puede tardar más que una consulta normal.
      timeout: 120000,
    });
    const disposicion = String(respuesta.headers["content-disposition"] ?? "");
    const nombre = /filename="?([^";]+)"?/.exec(disposicion)?.[1] ?? `reporte-${codigo}.${formato}`;
    guardarArchivo(respuesta.data, nombre);
  } catch (error) {
    // Con responseType "blob" el error también llega como Blob: se convierte a JSON
    // para que mensajeDeError muestre el mensaje del backend.
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        // No era JSON: queda el mensaje genérico.
      }
    }
    throw error;
  }
}

function guardarArchivo(datos: Blob, nombre: string) {
  const url = URL.createObjectURL(datos);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se libera después de que el navegador empiece la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
