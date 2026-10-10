import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { AvanceTarea, EstadoTarea, Paginado, PrioridadTarea, Tarea, TareaDetalle } from "../../api/tipos";

export interface FiltrosTareas {
  page_size: number;
  search?: string;
  laboratorio?: number;
  /** Solo las asignadas a quien tiene la sesión. */
  mias?: boolean;
  /** Incluye las hechas hace más de 14 días. */
  archivadas?: boolean;
}

export interface DatosTarea {
  titulo: string;
  descripcion: string;
  prioridad: PrioridadTarea;
  laboratorio: number | null;
  responsables: number[];
  fecha_limite: string | null;
}

export interface DatosAvance {
  texto: string;
  progreso: number | null;
  /** Mover de columna junto con el avance (null = no cambia). */
  estado: EstadoTarea | null;
}

export async function listarTareas(filtros: FiltrosTareas) {
  const { data } = await api.get<Paginado<Tarea>>(ENDPOINTS.tareas.lista, { params: filtros });
  return data;
}

export async function obtenerTarea(id: number | string) {
  const { data } = await api.get<TareaDetalle>(ENDPOINTS.tareas.detalle(id));
  return data;
}

export async function crearTarea(datos: DatosTarea) {
  const { data } = await api.post<TareaDetalle>(ENDPOINTS.tareas.lista, datos);
  return data;
}

export async function editarTarea(id: number, datos: DatosTarea) {
  const { data } = await api.patch<TareaDetalle>(ENDPOINTS.tareas.detalle(id), datos);
  return data;
}

export async function eliminarTarea(id: number) {
  await api.delete(ENDPOINTS.tareas.detalle(id));
}

/** Mueve la tarjeta de columna. */
export async function cambiarEstadoTarea(id: number, estado: EstadoTarea) {
  const { data } = await api.post<TareaDetalle>(ENDPOINTS.tareas.estado(id), { estado });
  return data;
}

export async function agregarAvance(id: number, datos: DatosAvance) {
  const { data } = await api.post<TareaDetalle>(ENDPOINTS.tareas.avances(id), datos);
  return data;
}

/** Orden dentro de una columna: alta primero, luego vencidas, luego por fecha límite (sin fecha al final), luego lo más reciente. */
export function ordenarTareas(tareas: Tarea[]): Tarea[] {
  return [...tareas].sort((a, b) => {
    const alta = Number(b.prioridad === "alta") - Number(a.prioridad === "alta");
    if (alta) return alta;
    const vencida = Number(b.vencida) - Number(a.vencida);
    if (vencida) return vencida;
    if (a.fecha_limite !== b.fecha_limite) {
      if (!a.fecha_limite) return 1;
      if (!b.fecha_limite) return -1;
      return a.fecha_limite < b.fecha_limite ? -1 : 1;
    }
    return Date.parse(b.actualizado_en) - Date.parse(a.actualizado_en);
  });
}

/** Una línea para mostrar un avance: su texto, o el cambio que registró. */
export function textoAvance(a: AvanceTarea): string {
  if (a.texto.trim()) return a.texto.trim();
  if (a.estado_nuevo) return `movió a ${a.estado_nuevo_nombre}`;
  if (a.progreso !== null) return `progreso al ${a.progreso}%`;
  return "";
}
