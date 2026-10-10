import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { Docente, Horario, Materia, Paginado, Periodo, ResultadoClonar } from "../../api/tipos";
import { DIAS } from "../../lib/constantes";
import { aMinutos } from "../../lib/fechas";

export interface FiltrosHorarios {
  periodo?: number;
  laboratorio?: number;
  dia_semana?: number;
  search?: string;
}

export interface DatosHorario {
  periodo: number;
  laboratorio: number;
  materia: number;
  grupo: string;
  docente: number | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  observaciones: string;
  activo: boolean;
}

export async function listarHorarios(filtros: FiltrosHorarios) {
  const { data } = await api.get<Paginado<Horario>>(ENDPOINTS.horarios.lista, {
    params: { page_size: 500, ...filtros },
  });
  return data;
}

export async function crearHorario(datos: DatosHorario) {
  const { data } = await api.post<Horario>(ENDPOINTS.horarios.lista, datos);
  return data;
}

/** La misma clase en varios días a la vez. Si un día choca, no se crea ninguno. */
export async function crearHorariosEnDias(datos: Omit<DatosHorario, "dia_semana">, dias: number[]) {
  const { data } = await api.post<Horario[]>(ENDPOINTS.horarios.lote, { ...datos, dias });
  return data;
}

/**
 * Edita de una vez una clase de varios días (una fila de la tabla). Los días que se
 * quitan se borran y los nuevos se crean. Si un día choca, no se guarda nada.
 */
export async function editarHorariosEnDias(ids: number[], datos: Omit<DatosHorario, "dia_semana">, dias: number[]) {
  const { data } = await api.post<Horario[]>(ENDPOINTS.horarios.loteEditar, { ...datos, ids, dias });
  return data;
}

export async function actualizarHorario(id: number, datos: Partial<DatosHorario>) {
  const { data } = await api.patch<Horario>(ENDPOINTS.horarios.detalle(id), datos);
  return data;
}

export async function eliminarHorario(id: number) {
  await api.delete(ENDPOINTS.horarios.detalle(id));
}

export async function suspenderClase(id: number, fecha: string, motivo: string) {
  await api.post(ENDPOINTS.horarios.suspender(id), { fecha, motivo });
}

export async function reanudarClase(id: number, fecha: string) {
  await api.post(ENDPOINTS.horarios.reanudar(id), { fecha });
}

// ── Periodos ──
export async function listarPeriodos() {
  const { data } = await api.get<Periodo[]>(ENDPOINTS.periodos.lista);
  return data;
}

export async function guardarPeriodo(datos: Omit<Periodo, "id" | "total_horarios">, id?: number) {
  const { data } = id
    ? await api.patch<Periodo>(ENDPOINTS.periodos.detalle(id), datos)
    : await api.post<Periodo>(ENDPOINTS.periodos.lista, datos);
  return data;
}

export async function eliminarPeriodo(id: number) {
  await api.delete(ENDPOINTS.periodos.detalle(id));
}

/** Copia las clases activas de un periodo a otro; las que chocan se saltan y se informan. */
export async function clonarHorarios(origen: number, destino: number) {
  const { data } = await api.post<ResultadoClonar>(ENDPOINTS.periodos.clonarHorarios(origen), { destino });
  return data;
}

// ── Docentes ──
export type DatosDocente = Pick<Docente, "nombres" | "apellidos" | "email" | "telefono" | "activo">;

export async function listarDocentes(params?: { sin_usuario?: boolean }) {
  const { data } = await api.get<Docente[]>(ENDPOINTS.docentes.lista, {
    params: params?.sin_usuario ? { sin_usuario: "true" } : undefined,
  });
  return data;
}

export async function guardarDocente(datos: DatosDocente, id?: number) {
  const { data } = id
    ? await api.patch<Docente>(ENDPOINTS.docentes.detalle(id), datos)
    : await api.post<Docente>(ENDPOINTS.docentes.lista, datos);
  return data;
}

export async function eliminarDocente(id: number) {
  await api.delete(ENDPOINTS.docentes.detalle(id));
}

// ── Materias ──
export async function listarMaterias() {
  const { data } = await api.get<Materia[]>(ENDPOINTS.materias.lista);
  return data;
}

export async function guardarMateria(datos: Omit<Materia, "id">, id?: number) {
  const { data } = id
    ? await api.patch<Materia>(ENDPOINTS.materias.detalle(id), datos)
    : await api.post<Materia>(ENDPOINTS.materias.lista, datos);
  return data;
}

export async function eliminarMateria(id: number) {
  await api.delete(ENDPOINTS.materias.detalle(id));
}

// ── Agrupar: una fila por clase ──

/**
 * Una clase tal como se muestra en la tabla: el mismo horario (materia, grupo, docente,
 * laboratorio y horas) que se da en uno o varios días. En la base de datos hay un
 * horario por día; aquí se juntan.
 */
export interface GrupoHorario {
  clave: string;
  /** El primero de la semana: de él salen materia, grupo, docente, horas… */
  base: Horario;
  /** Un horario por día, de lunes a domingo. */
  horarios: Horario[];
  dias: number[];
}

export function agruparHorarios(horarios: Horario[]): GrupoHorario[] {
  const grupos = new Map<string, Horario[]>();
  for (const h of horarios) {
    const clave = [
      h.periodo,
      h.laboratorio,
      h.materia,
      h.grupo,
      h.docente ?? "",
      h.hora_inicio,
      h.hora_fin,
      h.activo,
      h.observaciones,
    ].join("|");
    grupos.set(clave, [...(grupos.get(clave) ?? []), h]);
  }
  return [...grupos.entries()]
    .map(([clave, lista]) => {
      const ordenados = [...lista].sort((a, b) => a.dia_semana - b.dia_semana);
      return { clave, base: ordenados[0], horarios: ordenados, dias: ordenados.map((h) => h.dia_semana) };
    })
    .sort(
      (a, b) =>
        a.dias[0] - b.dias[0] ||
        aMinutos(a.base.hora_inicio) - aMinutos(b.base.hora_inicio) ||
        a.base.materia_sigla.localeCompare(b.base.materia_sigla),
    );
}

const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** [3] → "Miércoles"; [1, 3, 5] → "Lun · Mié · Vie". */
export function nombreDias(dias: number[]): string {
  if (dias.length === 1) return DIAS.find((d) => d.valor === dias[0])?.etiqueta ?? "";
  return dias.map((d) => DIAS_CORTOS[d - 1]).join(" · ");
}
