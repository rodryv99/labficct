import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { Disponibilidad, EventoAgenda, Paginado, Reserva } from "../../api/tipos";

export interface FiltrosReservas {
  page: number;
  page_size: number;
  search?: string;
  estado?: string;
  laboratorio?: number;
  cuando?: string;
  ordering?: string;
}

export interface BloqueFormulario {
  laboratorio: number | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

/** El estado no se envía: si el laboratorio está libre queda confirmada; si choca, por aprobar. */
export interface DatosReserva {
  titulo: string;
  descripcion: string;
  solicitante: number | null;
  solicitante_externo: string;
  contacto: string;
  programas: number[];
  requiere_apoyo: boolean;
  auxiliares_requeridos: number;
  auxiliares: number[];
  bloques: BloqueFormulario[];
}

export async function listarReservas(filtros: FiltrosReservas) {
  const { data } = await api.get<Paginado<Reserva>>(ENDPOINTS.reservas.lista, { params: filtros });
  return data;
}

export async function obtenerReserva(id: number | string) {
  const { data } = await api.get<Reserva>(ENDPOINTS.reservas.detalle(id));
  return data;
}

export async function crearReserva(datos: DatosReserva) {
  const { data } = await api.post<Reserva>(ENDPOINTS.reservas.lista, datos);
  return data;
}

export async function actualizarReserva(id: number, datos: DatosReserva) {
  const { data } = await api.put<Reserva>(ENDPOINTS.reservas.detalle(id), datos);
  return data;
}

export async function cancelarReserva(id: number, motivo: string) {
  const { data } = await api.post<Reserva>(ENDPOINTS.reservas.cancelar(id), { motivo });
  return data;
}

/** Aprueba una reserva que choca: tiene prioridad y las clases de esos días se suspenden. */
export async function aprobarReserva(id: number) {
  const { data } = await api.post<Reserva>(ENDPOINTS.reservas.aprobar(id));
  return data;
}

export async function consultarDisponibilidad(bloque: BloqueFormulario, excluirReserva?: number) {
  const { data } = await api.post<Disponibilidad>(ENDPOINTS.disponibilidad, {
    ...bloque,
    excluir_reserva: excluirReserva ?? null,
  });
  return data;
}

export async function obtenerAgenda(desde: string, hasta: string, laboratorios?: number[]) {
  const { data } = await api.get<EventoAgenda[]>(ENDPOINTS.agenda, {
    params: { desde, hasta, laboratorio: laboratorios?.length ? laboratorios.join(",") : undefined },
  });
  return data;
}
