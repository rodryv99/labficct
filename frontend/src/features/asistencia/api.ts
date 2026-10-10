import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { CategoriaAsistencia, EstadoAsistencia, Paginado, SolicitudAsistencia } from "../../api/tipos";
import type { Tono } from "../../components/datos/Etiquetas";

export const TONO_ASISTENCIA: Record<EstadoAsistencia, Tono> = {
  pendiente: "aviso",
  en_curso: "info",
  resuelta: "exito",
  cancelada: "neutro",
};

export function estaAbierta(s: SolicitudAsistencia): boolean {
  return s.estado === "pendiente" || s.estado === "en_curso";
}

export interface FiltrosAsistencia {
  page: number;
  page_size: number;
  /** true: pendientes y en camino; false: resueltas y canceladas; sin valor: todas. */
  abiertas?: boolean;
  search?: string;
}

export interface DatosSolicitud {
  laboratorio: number | null;
  lugar: string;
  categoria: CategoriaAsistencia;
  descripcion: string;
  urgente: boolean;
}

export async function listarSolicitudes(filtros: FiltrosAsistencia) {
  const { data } = await api.get<Paginado<SolicitudAsistencia>>(ENDPOINTS.asistencia.lista, { params: filtros });
  return data;
}

export async function obtenerSolicitud(id: number | string) {
  const { data } = await api.get<SolicitudAsistencia>(ENDPOINTS.asistencia.detalle(id));
  return data;
}

export async function crearSolicitud(datos: DatosSolicitud) {
  const { data } = await api.post<SolicitudAsistencia>(ENDPOINTS.asistencia.lista, datos);
  return data;
}

/** El auxiliar avisa que va en camino. */
export async function tomarSolicitud(id: number) {
  const { data } = await api.post<SolicitudAsistencia>(ENDPOINTS.asistencia.tomar(id));
  return data;
}

export async function resolverSolicitud(id: number, respuesta: string) {
  const { data } = await api.post<SolicitudAsistencia>(ENDPOINTS.asistencia.resolver(id), { respuesta });
  return data;
}

export async function cancelarSolicitud(id: number) {
  const { data } = await api.post<SolicitudAsistencia>(ENDPOINTS.asistencia.cancelar(id));
  return data;
}
