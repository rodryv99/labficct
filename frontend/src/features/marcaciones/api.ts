import { format, parseISO } from "date-fns";

import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type {
  AuxiliarAsistencia,
  BloqueHorario,
  HorarioTrabajo,
  LugarAsistencia,
  Marcacion,
  Paginado,
  ResumenAsistencia,
  SituacionAuxiliar,
} from "../../api/tipos";
import type { Tono } from "../../components/datos/Etiquetas";

export const RADIO_MINIMO_M = 20;
export const RADIO_MAXIMO_M = 2000;
export const RADIO_POR_DEFECTO_M = 100;

export const SITUACIONES: Record<SituacionAuxiliar, { tono: Tono; texto: string }> = {
  presente: { tono: "exito", texto: "Presente" },
  salio: { tono: "info", texto: "Ya salió" },
  sin_marcar: { tono: "neutro", texto: "Sin marcar" },
};

/** Los filtros que comparten la lista, el resumen y la exportación. */
export interface FiltrosMarcaciones {
  desde?: string;
  hasta?: string;
  usuario?: number;
  lugar?: number;
  abiertas?: boolean;
  /** Solo las que llegaron tarde. */
  con_retraso?: boolean;
  /** Retraso de al menos estos minutos. */
  retraso_min?: number;
  /** Solo para el resumen: auxiliares con al menos esta cantidad de retrasos. */
  min_retrasos?: number;
}

export interface DatosLugar {
  nombre: string;
  referencia: string;
  latitud: number;
  longitud: number;
  radio_m: number;
  predeterminado: boolean;
  activo: boolean;
}

/** "2026-11-15T12:30:00Z" → "08:30" (hora local). */
export function horaDe(fechaIso: string): string {
  return format(parseISO(fechaIso), "HH:mm");
}

/** 125 → "2 h 05 min"; 40 → "40 min". */
export function duracion(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined) return "—";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export function metros(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "—" : `${Math.round(valor)} m`;
}

/** Enlace para ver un punto en Google Maps. */
export function enlaceMapa(latitud: number, longitud: number): string {
  return `https://www.google.com/maps?q=${latitud},${longitud}`;
}

const NUMERO = "(-?\\d+(?:\\.\\d+)?)";
const PATRONES_COORDENADAS = [
  // Enlaces de Google Maps: …!3d-17.77!4d-63.19, …?q=-17.77,-63.19, …@-17.77,-63.19,17z
  new RegExp(`!3d${NUMERO}!4d${NUMERO}`),
  new RegExp(`[?&](?:q|query|ll)=${NUMERO},\\s*${NUMERO}`),
  new RegExp(`@${NUMERO},${NUMERO}`),
  // Coordenadas sueltas: "-17.7762, -63.1950" (así las copia Google Maps con clic derecho).
  new RegExp(`^\\(?\\s*${NUMERO}\\s*[,;\\s]\\s*${NUMERO}\\s*\\)?$`),
];

/** Saca latitud y longitud de un texto pegado: coordenadas o un enlace de Google Maps. */
export function leerCoordenadas(texto: string): { latitud: number; longitud: number } | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  for (const patron of PATRONES_COORDENADAS) {
    const m = patron.exec(limpio);
    if (!m) continue;
    const latitud = Number(m[1]);
    const longitud = Number(m[2]);
    if (Number.isFinite(latitud) && Number.isFinite(longitud) && Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180) {
      return { latitud, longitud };
    }
  }
  return null;
}

export function textoCoordenadas(latitud: number, longitud: number): string {
  return `${latitud.toFixed(6)}, ${longitud.toFixed(6)}`;
}

// ── Lugares ──

export async function listarLugares() {
  const { data } = await api.get<LugarAsistencia[]>(ENDPOINTS.marcaciones.lugares);
  return data;
}

export async function crearLugar(datos: DatosLugar) {
  const { data } = await api.post<LugarAsistencia>(ENDPOINTS.marcaciones.lugares, datos);
  return data;
}

export async function editarLugar(id: number, datos: DatosLugar) {
  const { data } = await api.patch<LugarAsistencia>(ENDPOINTS.marcaciones.lugar(id), datos);
  return data;
}

export async function eliminarLugar(id: number) {
  await api.delete(ENDPOINTS.marcaciones.lugar(id));
}

// ── Auxiliares y su lugar ──

export async function listarAuxiliares() {
  const { data } = await api.get<AuxiliarAsistencia[]>(ENDPOINTS.marcaciones.auxiliares);
  return data;
}

/** `lugar` null = el auxiliar vuelve a usar el lugar predeterminado. */
export async function asignarLugar(auxiliar: number, lugar: number | null) {
  const { data } = await api.put<AuxiliarAsistencia>(ENDPOINTS.marcaciones.auxiliar(auxiliar), { lugar });
  return data;
}

/** `horario` null = el auxiliar queda sin horario de trabajo. */
export async function asignarHorario(auxiliar: number, horario: number | null) {
  const { data } = await api.put<AuxiliarAsistencia>(ENDPOINTS.marcaciones.auxiliarHorario(auxiliar), { horario });
  return data;
}

// ── Horarios de trabajo ──

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export interface DatosHorario {
  nombre: string;
  descripcion: string;
  activo: boolean;
  bloques: BloqueHorario[];
}

/** "08:00:00" → "08:00". */
export function hhmm(hora: string): string {
  return hora.slice(0, 5);
}

/** Resume los bloques en texto corto: "Lun, Mié 08:00–12:00 · Vie 14:00–18:00". */
export function resumenHorario(bloques: BloqueHorario[]): string {
  if (bloques.length === 0) return "Sin bloques";
  // Agrupa por tramo igual (inicio–fin) para no repetir las horas en cada día.
  const grupos = new Map<string, number[]>();
  for (const b of [...bloques].sort((a, z) => a.dia - z.dia || a.inicio.localeCompare(z.inicio))) {
    const clave = `${hhmm(b.inicio)}–${hhmm(b.fin)}`;
    const dias = grupos.get(clave) ?? [];
    dias.push(b.dia);
    grupos.set(clave, dias);
  }
  return [...grupos.entries()]
    .map(([tramo, dias]) => `${dias.map((d) => DIAS_CORTOS[d]).join(", ")} ${tramo}`)
    .join(" · ");
}

/** Minutos semanales que suman los bloques. */
export function minutosSemana(bloques: BloqueHorario[]): number {
  return bloques.reduce((suma, b) => {
    const [hi, mi] = hhmm(b.inicio).split(":").map(Number);
    const [hf, mf] = hhmm(b.fin).split(":").map(Number);
    return suma + Math.max(0, hf * 60 + mf - (hi * 60 + mi));
  }, 0);
}

export async function listarHorarios() {
  const { data } = await api.get<HorarioTrabajo[]>(ENDPOINTS.marcaciones.horarios);
  return data;
}

export async function crearHorario(datos: DatosHorario) {
  const { data } = await api.post<HorarioTrabajo>(ENDPOINTS.marcaciones.horarios, datos);
  return data;
}

export async function editarHorario(id: number, datos: DatosHorario) {
  const { data } = await api.put<HorarioTrabajo>(ENDPOINTS.marcaciones.horario(id), datos);
  return data;
}

export async function eliminarHorario(id: number) {
  await api.delete(ENDPOINTS.marcaciones.horario(id));
}

// ── Marcaciones ──

export async function listarMarcaciones(filtros: FiltrosMarcaciones & { page: number; page_size: number }) {
  const { data } = await api.get<Paginado<Marcacion>>(ENDPOINTS.marcaciones.lista, { params: filtros });
  return data;
}

export async function obtenerMarcacion(id: number) {
  const { data } = await api.get<Marcacion>(ENDPOINTS.marcaciones.detalle(id));
  return data;
}

/** El Admin pone la salida que el auxiliar olvidó marcar. `salidaEn` va en ISO 8601. */
export async function cerrarMarcacion(id: number, salidaEn: string, nota: string) {
  const { data } = await api.post<Marcacion>(ENDPOINTS.marcaciones.cerrar(id), { salida_en: salidaEn, nota });
  return data;
}

export async function resumenMarcaciones(filtros: FiltrosMarcaciones) {
  const { data } = await api.get<ResumenAsistencia[]>(ENDPOINTS.marcaciones.resumen, { params: filtros });
  return data;
}

export type FormatoExport = "xlsx" | "csv" | "pdf";

/** Descarga las marcaciones que cumplen los filtros. */
export async function exportarMarcaciones(formato: FormatoExport, filtros: FiltrosMarcaciones) {
  const respuesta = await api.get<Blob>(ENDPOINTS.marcaciones.exportar, {
    params: { formato, ...filtros },
    responseType: "blob",
  });
  const cabecera = String(respuesta.headers["content-disposition"] ?? "");
  const nombre = /filename="([^"]+)"/.exec(cabecera)?.[1] ?? `asistencia.${formato}`;
  const url = URL.createObjectURL(respuesta.data);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
