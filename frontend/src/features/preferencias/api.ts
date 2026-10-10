import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { OpcionPreferencia, Preferencias, ValoresPreferencias } from "../../api/tipos";

export interface DatosPreferencias {
  /** Reemplaza todo: null o ausente = sin preferencia. */
  valores: ValoresPreferencias;
  nota: string;
}

export type DatosOpcion = Omit<OpcionPreferencia, "id">;

// ── Opciones (la lista de preguntas) ──
export async function listarOpciones(soloActivas = false) {
  const { data } = await api.get<OpcionPreferencia[]>(ENDPOINTS.preferencias.opciones, {
    params: soloActivas ? { activa: true } : undefined,
  });
  return data;
}

export async function crearOpcion(datos: DatosOpcion) {
  const { data } = await api.post<OpcionPreferencia>(ENDPOINTS.preferencias.opciones, datos);
  return data;
}

export async function actualizarOpcion(id: number, datos: DatosOpcion) {
  const { data } = await api.put<OpcionPreferencia>(ENDPOINTS.preferencias.opcion(id), datos);
  return data;
}

export async function eliminarOpcion(id: number) {
  await api.delete(ENDPOINTS.preferencias.opcion(id));
}

// ── Las del docente con sesión ──
export async function obtenerMisPreferencias() {
  const { data } = await api.get<Preferencias>(ENDPOINTS.preferencias.mias);
  return data;
}

export async function guardarMisPreferencias(datos: DatosPreferencias) {
  const { data } = await api.put<Preferencias>(ENDPOINTS.preferencias.mias, datos);
  return data;
}

// ── Las de cualquier docente (Admin y auxiliares) ──
export async function listarPreferenciasDocentes(search?: string) {
  const { data } = await api.get<Preferencias[]>(ENDPOINTS.preferencias.docentes, {
    params: { search: search || undefined },
  });
  return data;
}

export async function guardarPreferenciasDocente(docente: number, datos: DatosPreferencias) {
  const { data } = await api.put<Preferencias>(ENDPOINTS.preferencias.docente(docente), datos);
  return data;
}
