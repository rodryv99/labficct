/**
 * Módulo de Reportes / BI (solo Admin). Llamadas a la API y tipos.
 * El backend arma los datos y los gráficos; aquí solo se piden y se descargan.
 */
import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";

export type Formato = "xlsx" | "csv" | "pdf" | "docx";

export const FORMATOS: { valor: Formato; etiqueta: string }[] = [
  { valor: "pdf", etiqueta: "PDF" },
  { valor: "xlsx", etiqueta: "Excel" },
  { valor: "csv", etiqueta: "CSV" },
  { valor: "docx", etiqueta: "Word" },
];

export type TipoGrafico = "barras" | "barras_apiladas" | "lineas" | "pastel" | "dona" | "heatmap";
export type TipoColumna = "texto" | "numero" | "porcentaje" | "fecha" | "duracion";

export interface SerieDTO {
  nombre: string;
  datos: number[];
  color: string | null;
}

export interface GraficoDTO {
  tipo: TipoGrafico;
  titulo: string;
  etiquetas: string[];
  series: SerieDTO[];
  filas: string[];
  columnas: string[];
  matriz: number[][];
  ancho: number;
}

export interface KpiDTO {
  etiqueta: string;
  valor: string;
  tono: "exito" | "aviso" | "peligro" | "info" | "marca" | "neutro";
  ayuda: string;
}

export interface ColumnaDTO {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
  ancho: number;
}

export type Celda = string | number | boolean | null;

export interface DatosReporte {
  kpis: KpiDTO[];
  graficos: GraficoDTO[];
  columnas: ColumnaDTO[];
  filas: Celda[][];
  total: number;
  reporte?: { id: string; nombre: string; descripcion: string };
}

export interface ReporteMeta {
  id: string;
  nombre: string;
  grupo: string;
  descripcion: string;
  filtros: string[];
  icono: string;
}

export interface GrupoReporte {
  clave: string;
  titulo: string;
  reportes: ReporteMeta[];
}

export interface OpcionLab {
  id: number;
  nombre: string;
}
export interface OpcionPeriodo {
  id: number;
  nombre: string;
  vigente: boolean;
}
export interface OpcionesFiltro {
  laboratorios: OpcionLab[];
  periodos: OpcionPeriodo[];
}

export interface Catalogo {
  grupos: GrupoReporte[];
  filtros: OpcionesFiltro;
}

export interface EntidadPivote {
  id: string;
  label: string;
  filtros: string[];
  dimensiones: { id: string; label: string }[];
  medidas: { id: string; label: string }[];
}

export interface PivoteMeta {
  entidades: EntidadPivote[];
  filtros: OpcionesFiltro;
}

export interface CuerpoPivote {
  entidad: string;
  filas: string;
  columnas?: string | null;
  medida: string;
  desde?: string;
  hasta?: string;
  laboratorio?: number | null;
}

/** Parámetros de filtro que se mandan como query string (solo los que tienen valor). */
export type Filtros = Record<string, string>;

export async function cargarCatalogo(): Promise<Catalogo> {
  const { data } = await api.get<Catalogo>(ENDPOINTS.reportes.catalogo);
  return data;
}

export async function cargarDashboard(): Promise<DatosReporte> {
  const { data } = await api.get<DatosReporte>(ENDPOINTS.reportes.dashboard);
  return data;
}

export async function cargarReporte(id: string, filtros: Filtros): Promise<DatosReporte> {
  const { data } = await api.get<DatosReporte>(ENDPOINTS.reportes.datos(id), { params: filtros });
  return data;
}

export async function cargarPivoteMeta(): Promise<PivoteMeta> {
  const { data } = await api.get<PivoteMeta>(ENDPOINTS.reportes.pivoteMeta);
  return data;
}

export async function construirPivote(cuerpo: CuerpoPivote): Promise<DatosReporte> {
  const { data } = await api.post<DatosReporte>(ENDPOINTS.reportes.pivote, cuerpo);
  return data;
}

export async function exportarReporte(id: string, formato: Formato, filtros: Filtros): Promise<void> {
  const respuesta = await api.get<Blob>(ENDPOINTS.reportes.exportar(id), {
    params: { formato, ...filtros },
    responseType: "blob",
  });
  descargar(respuesta.data, respuesta.headers["content-disposition"], `${id}.${formato}`);
}

export async function exportarPivote(cuerpo: CuerpoPivote, formato: Formato): Promise<void> {
  const respuesta = await api.post<Blob>(ENDPOINTS.reportes.pivoteExportar, cuerpo, {
    params: { formato },
    responseType: "blob",
  });
  descargar(respuesta.data, respuesta.headers["content-disposition"], `reporte-dinamico.${formato}`);
}

/** Dispara la descarga del archivo en el navegador. */
function descargar(blob: Blob, contentDisposition: unknown, porDefecto: string): void {
  const cabecera = String(contentDisposition ?? "");
  const nombre = /filename="([^"]+)"/.exec(cabecera)?.[1] ?? porDefecto;
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
