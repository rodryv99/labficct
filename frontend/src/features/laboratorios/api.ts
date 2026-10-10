import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type {
  Credencial,
  Distribucion,
  EstadoLaboratorio,
  Laboratorio,
  Paginado,
  Software,
} from "../../api/tipos";

export interface DatosLaboratorio {
  codigo: string;
  nombre: string;
  ubicacion: string;
  capacidad: number;
  estado: EstadoLaboratorio;
  notas: string;
  activo: boolean;
  filas?: number;
  columnas?: number;
  software?: number[];
}

export async function listarLaboratoriosTodos() {
  const { data } = await api.get<Paginado<Laboratorio>>(ENDPOINTS.laboratorios.lista, {
    params: { page_size: 500 },
  });
  return data.results;
}

export async function obtenerLaboratorio(id: number | string) {
  const { data } = await api.get<Laboratorio>(ENDPOINTS.laboratorios.detalle(id));
  return data;
}

export async function crearLaboratorio(datos: DatosLaboratorio) {
  const { data } = await api.post<Laboratorio>(ENDPOINTS.laboratorios.lista, datos);
  return data;
}

export async function actualizarLaboratorio(id: number, datos: Partial<DatosLaboratorio>) {
  const { data } = await api.patch<Laboratorio>(ENDPOINTS.laboratorios.detalle(id), datos);
  return data;
}

export async function eliminarLaboratorio(id: number) {
  await api.delete(ENDPOINTS.laboratorios.detalle(id));
}

export async function obtenerDistribucion(id: number | string) {
  const { data } = await api.get<Distribucion>(ENDPOINTS.laboratorios.distribucion(id));
  return data;
}

export async function guardarDistribucion(id: number | string, distribucion: Distribucion) {
  const { data } = await api.put<Distribucion>(ENDPOINTS.laboratorios.distribucion(id), distribucion);
  return data;
}

// ── Credenciales ──
export interface DatosCredencial {
  laboratorio: number;
  descripcion: string;
  usuario: string;
  notas: string;
  password?: string;
}

export async function listarCredenciales(laboratorio: number | string) {
  const { data } = await api.get<Credencial[]>(ENDPOINTS.credenciales.lista, { params: { laboratorio } });
  return data;
}

export async function crearCredencial(datos: DatosCredencial) {
  const { data } = await api.post<Credencial>(ENDPOINTS.credenciales.lista, datos);
  return data;
}

export async function actualizarCredencial(id: number, datos: Partial<DatosCredencial>) {
  const { data } = await api.patch<Credencial>(ENDPOINTS.credenciales.detalle(id), datos);
  return data;
}

export async function eliminarCredencial(id: number) {
  await api.delete(ENDPOINTS.credenciales.detalle(id));
}

export async function revelarCredencial(id: number) {
  const { data } = await api.post<{ password: string }>(ENDPOINTS.credenciales.revelar(id));
  return data.password;
}

// ── Software ──
/** Solo los programas instalados (lo puede hacer también el auxiliar, sin tocar el resto de la ficha). */
export async function guardarSoftwareLaboratorio(id: number, software: number[]) {
  const { data } = await api.put<Laboratorio>(ENDPOINTS.laboratorios.software(id), { software });
  return data;
}

export async function listarSoftware() {
  const { data } = await api.get<Paginado<Software>>(ENDPOINTS.software.lista, { params: { page_size: 500 } });
  return data.results;
}

export async function crearSoftware(datos: { nombre: string; version: string }) {
  const { data } = await api.post<Software>(ENDPOINTS.software.lista, datos);
  return data;
}
