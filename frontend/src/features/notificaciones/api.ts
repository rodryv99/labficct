import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { Notificacion, Paginado, ResumenNotificaciones } from "../../api/tipos";

/** Cuántas se muestran en la campana. */
export const TAMANO_CAMPANA = 20;

export async function obtenerResumen() {
  const { data } = await api.get<ResumenNotificaciones>(ENDPOINTS.notificaciones.resumen);
  return data;
}

export async function listarNotificaciones(filtros: { page_size: number; no_leidas?: boolean }) {
  const { data } = await api.get<Paginado<Notificacion>>(ENDPOINTS.notificaciones.lista, {
    params: { page_size: filtros.page_size, no_leidas: filtros.no_leidas ? 1 : undefined },
  });
  return data;
}

export async function marcarLeida(id: number) {
  const { data } = await api.post<Notificacion>(ENDPOINTS.notificaciones.leer(id));
  return data;
}

export async function marcarTodasLeidas() {
  const { data } = await api.post<{ marcadas: number }>(ENDPOINTS.notificaciones.leerTodas);
  return data;
}

/** Aviso manual a los auxiliares desde la pizarra: alistar o cerrar el aula de una actividad. */
export async function avisarAula(datos: { tipo: "alistar" | "cerrar"; evento: string; fecha: string; nota: string }) {
  const { data } = await api.post<{ enviadas: number }>(ENDPOINTS.avisos.aula, datos);
  return data;
}
