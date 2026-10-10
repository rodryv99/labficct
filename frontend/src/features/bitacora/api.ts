import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { EntradaBitacora, Paginado, TipoBitacora } from "../../api/tipos";
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
}

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
