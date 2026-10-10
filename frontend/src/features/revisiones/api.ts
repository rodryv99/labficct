import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { Paginado, Revision, UnidadFrecuencia } from "../../api/tipos";
import type { Tono } from "../../components/datos/Etiquetas";
import { diasHasta } from "../../lib/fechas";

export interface FiltrosRevisiones {
  page: number;
  page_size: number;
  laboratorio?: number;
  activa?: boolean;
}

export interface DatosRevision {
  laboratorio: number;
  titulo: string;
  instrucciones: string;
  cada: number;
  unidad: UnidadFrecuencia;
  proxima_fecha: string;
  /** null = se avisa a todos los auxiliares. */
  responsable: number | null;
  activa: boolean;
}

/** Etiqueta según qué tan cerca está la próxima fecha (null si está al día). */
export function situacionDe(r: Revision): { tono: Tono; texto: string } | null {
  switch (r.situacion) {
    case "vencida":
      return { tono: "peligro", texto: "Vencida" };
    case "hoy":
      return { tono: "aviso", texto: "Hoy" };
    case "pronto": {
      const dias = Math.max(1, diasHasta(r.proxima_fecha));
      return { tono: "aviso", texto: dias === 1 ? "Mañana" : `En ${dias} días` };
    }
    default:
      return null;
  }
}

export async function listarRevisiones(filtros: FiltrosRevisiones) {
  const { data } = await api.get<Paginado<Revision>>(ENDPOINTS.revisiones.lista, { params: filtros });
  return data;
}

export async function obtenerRevision(id: number | string) {
  const { data } = await api.get<Revision>(ENDPOINTS.revisiones.detalle(id));
  return data;
}

export async function crearRevision(datos: DatosRevision) {
  const { data } = await api.post<Revision>(ENDPOINTS.revisiones.lista, datos);
  return data;
}

export async function editarRevision(id: number, datos: DatosRevision) {
  const { data } = await api.patch<Revision>(ENDPOINTS.revisiones.detalle(id), datos);
  return data;
}

export async function eliminarRevision(id: number) {
  await api.delete(ENDPOINTS.revisiones.detalle(id));
}

/** Registra que se hizo hoy: deja una entrada en la bitácora y calcula la próxima fecha. */
export async function realizarRevision(id: number, nota: string) {
  const { data } = await api.post<Revision>(ENDPOINTS.revisiones.realizar(id), { nota });
  return data;
}
