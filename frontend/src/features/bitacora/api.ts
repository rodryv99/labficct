import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { AtributoMapa, EntradaBitacora, MapaBitacora, MarcaMapa, Paginado, TipoBitacora } from "../../api/tipos";
import type { Tono } from "../../components/datos/Etiquetas";

export const TONO_BITACORA: Record<TipoBitacora, Tono> = {
  instalacion: "marca",
  revision: "info",
  mantenimiento: "aviso",
  incidencia: "peligro",
  limpieza: "exito",
  otro: "neutro",
};

export interface FiltrosBitacora {
  page: number;
  page_size: number;
  laboratorio?: number;
  tipo?: string;
  desde?: string;
  hasta?: string;
  search?: string;
}

export interface DatosEntrada {
  laboratorio: number;
  tipo: TipoBitacora;
  titulo: string;
  descripcion: string;
  /** ISO 8601; no puede ser futura. */
  fecha: string;
  elementos: string;
  /** Lo pintado; null quita el mapa. La copia de la grilla la pone el servidor. */
  mapa: { atributos: AtributoMapa[]; marcas: MarcaMapa[] } | null;
}

/** Colores que se asignan solos a los atributos (iguales a los del servidor). */
export const PALETA_MAPA = ["#22A34A", "#E5383B", "#F2A900", "#2F7DE1", "#8E44AD", "#16A6A6", "#E86A17", "#7F8C8D"];
export const MAX_ATRIBUTOS = 8;
export const ATRIBUTOS_INICIALES: AtributoMapa[] = [
  { nombre: "Funciona", color: "#22A34A" },
  { nombre: "Con falla", color: "#E5383B" },
];

export type FormatoExportar = "jpg" | "pdf" | "json";

export async function listarBitacora(filtros: FiltrosBitacora) {
  const { data } = await api.get<Paginado<EntradaBitacora>>(ENDPOINTS.bitacora.lista, { params: filtros });
  return data;
}

export async function crearEntrada(datos: DatosEntrada) {
  const { data } = await api.post<EntradaBitacora>(ENDPOINTS.bitacora.lista, datos);
  return data;
}

export async function editarEntrada(id: number, datos: DatosEntrada) {
  const { data } = await api.patch<EntradaBitacora>(ENDPOINTS.bitacora.detalle(id), datos);
  return data;
}

export async function eliminarEntrada(id: number) {
  await api.delete(ENDPOINTS.bitacora.detalle(id));
}

/** Mapa vacío con la grilla actual del laboratorio, para empezar a pintar. */
export async function obtenerPlantilla(laboratorio: number) {
  const { data } = await api.get<MapaBitacora>(ENDPOINTS.bitacora.plantilla, { params: { laboratorio } });
  return data;
}

/** Descarga la entrada como JPG, PDF o archivo de bitácora (.bitacora.json, para importarlo en otro lado). */
export async function descargarEntrada(entrada: EntradaBitacora, formato: FormatoExportar) {
  const respuesta = await api.get<Blob>(ENDPOINTS.bitacora.exportar(entrada.id), {
    params: { formato },
    responseType: "blob",
  });
  const cabecera = String(respuesta.headers["content-disposition"] ?? "");
  const nombre =
    /filename="([^"]+)"/.exec(cabecera)?.[1] ??
    `bitacora-${entrada.laboratorio_codigo}-${entrada.id}.${formato === "json" ? "bitacora.json" : formato}`;
  const url = URL.createObjectURL(respuesta.data);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Crea una entrada a partir de un archivo exportado. Sin laboratorio, el servidor lo busca por código. */
export async function importarEntrada(archivo: unknown, laboratorio?: number) {
  const { data } = await api.post<EntradaBitacora>(ENDPOINTS.bitacora.importar, {
    archivo,
    laboratorio: laboratorio ?? null,
  });
  return data;
}
