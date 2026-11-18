import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type {
  Activo,
  ActivoDetalle,
  EstadoActivo,
  Lugar,
  MovimientoActivo,
  Paginado,
  ResultadoVerificacion,
  TipoActivo,
  TipoLugar,
  TipoMovimiento,
  Verificacion,
  VerificacionDetalle,
} from "../../api/tipos";
import type { Tono } from "../../components/datos/Etiquetas";
import type { Opcion } from "../../lib/constantes";

// ── Textos y colores ──

export const ESTADOS_ACTIVO: Opcion<EstadoActivo>[] = [
  { valor: "operativo", etiqueta: "Operativo" },
  { valor: "danado", etiqueta: "Dañado" },
  { valor: "en_reparacion", etiqueta: "En reparación" },
  { valor: "baja", etiqueta: "De baja" },
];

export const TONO_ESTADO: Record<EstadoActivo, Tono> = {
  operativo: "exito",
  danado: "peligro",
  en_reparacion: "aviso",
  baja: "neutro",
};

export const TIPOS_LUGAR: Opcion<TipoLugar>[] = [
  { valor: "deposito", etiqueta: "Depósito" },
  { valor: "otro", etiqueta: "Otro lugar" },
];

export const TONO_MOVIMIENTO: Record<TipoMovimiento, Tono> = {
  alta: "exito",
  traslado: "marca",
  estado: "aviso",
  baja: "peligro",
};

/** En el orden en que se ofrecen al marcar. */
export const RESULTADOS: Opcion<ResultadoVerificacion>[] = [
  { valor: "esta", etiqueta: "Está" },
  { valor: "falta", etiqueta: "Falta" },
  { valor: "otro_lugar", etiqueta: "En otro lugar" },
  { valor: "danado", etiqueta: "Dañado" },
];

export const TONO_RESULTADO: Record<ResultadoVerificacion, Tono> = {
  pendiente: "neutro",
  esta: "exito",
  falta: "peligro",
  otro_lugar: "aviso",
  danado: "aviso",
};

// ── Catálogos ──

export async function listarTipos() {
  const { data } = await api.get<Paginado<TipoActivo>>(ENDPOINTS.inventario.tipos, { params: { page_size: 500 } });
  return data.results;
}

export async function guardarTipo(datos: { nombre: string; descripcion: string; activo: boolean }, id?: number) {
  const { data } = id
    ? await api.patch<TipoActivo>(ENDPOINTS.inventario.tipo(id), datos)
    : await api.post<TipoActivo>(ENDPOINTS.inventario.tipos, datos);
  return data;
}

export async function eliminarTipo(id: number) {
  await api.delete(ENDPOINTS.inventario.tipo(id));
}

export async function listarLugares() {
  const { data } = await api.get<Paginado<Lugar>>(ENDPOINTS.inventario.lugares, { params: { page_size: 500 } });
  return data.results;
}

export interface DatosLugar {
  nombre: string;
  tipo: TipoLugar;
  descripcion: string;
  activo: boolean;
}

export async function guardarLugar(datos: Partial<DatosLugar>, id?: number) {
  const { data } = id
    ? await api.patch<Lugar>(ENDPOINTS.inventario.lugar(id), datos)
    : await api.post<Lugar>(ENDPOINTS.inventario.lugares, datos);
  return data;
}

export async function eliminarLugar(id: number) {
  await api.delete(ENDPOINTS.inventario.lugar(id));
}

// ── Activos ──

export interface FiltrosActivos {
  page: number;
  page_size: number;
  search?: string;
  /** Ids separados por coma. */
  tipos?: string;
  lugares?: string;
  estado?: string;
  /** true = sin los dados de baja. */
  vigentes?: boolean;
  ordering?: string;
}

export interface DatosActivo {
  codigo: string;
  descripcion: string;
  tipo: number | null;
  marca: string;
  modelo: string;
  serie: string;
  fecha_adquisicion: string | null;
  observaciones: string;
}

/** Al dar de alta también se elige dónde queda y en qué estado. */
export interface DatosAlta extends DatosActivo {
  lugar: number;
  estado: EstadoActivo;
}

export async function listarActivos(filtros: FiltrosActivos) {
  const { data } = await api.get<Paginado<Activo>>(ENDPOINTS.inventario.activos, { params: filtros });
  return data;
}

export async function obtenerActivo(id: number | string) {
  const { data } = await api.get<ActivoDetalle>(ENDPOINTS.inventario.activo(id));
  return data;
}

export async function crearActivo(datos: DatosAlta) {
  const { data } = await api.post<ActivoDetalle>(ENDPOINTS.inventario.activos, datos);
  return data;
}

export async function editarActivo(id: number, datos: DatosActivo) {
  const { data } = await api.patch<ActivoDetalle>(ENDPOINTS.inventario.activo(id), datos);
  return data;
}

/** Lo común a los tres movimientos. La fecha vacía es hoy. */
export interface DatosMovimiento {
  fecha: string | null;
  motivo: string;
  documento: string;
}

export async function trasladarActivo(id: number, datos: DatosMovimiento & { lugar: number }) {
  const { data } = await api.post<ActivoDetalle>(ENDPOINTS.inventario.trasladar(id), datos);
  return data;
}

export async function cambiarEstadoActivo(id: number, datos: DatosMovimiento & { estado: EstadoActivo }) {
  const { data } = await api.post<ActivoDetalle>(ENDPOINTS.inventario.estado(id), datos);
  return data;
}

export async function darDeBaja(id: number, datos: DatosMovimiento) {
  const { data } = await api.post<ActivoDetalle>(ENDPOINTS.inventario.baja(id), datos);
  return data;
}

/** Corrige un movimiento ya registrado. La corrección queda en el historial. */
export async function corregirMovimiento(id: number, datos: { fecha: string; motivo: string; documento: string }) {
  const { data } = await api.patch<MovimientoActivo>(ENDPOINTS.inventario.movimiento(id), datos);
  return data;
}

// ── Verificaciones ──

export interface FiltrosVerificaciones {
  page: number;
  page_size: number;
  estado?: string;
  mias?: boolean;
}

/** Con `activos` se verifica esa selección; si no, lo que cumpla los filtros (sin filtros = todo). */
export interface DatosVerificacion {
  titulo: string;
  instrucciones: string;
  fecha_limite: string | null;
  responsables: number[];
  tipos: number[];
  lugares: number[];
  activos: number[];
}

export async function listarVerificaciones(filtros: FiltrosVerificaciones) {
  const { data } = await api.get<Paginado<Verificacion>>(ENDPOINTS.inventario.verificaciones, { params: filtros });
  return data;
}

export async function obtenerVerificacion(id: number | string) {
  const { data } = await api.get<VerificacionDetalle>(ENDPOINTS.inventario.verificacion(id));
  return data;
}

export async function crearVerificacion(datos: DatosVerificacion) {
  const { data } = await api.post<VerificacionDetalle>(ENDPOINTS.inventario.verificaciones, datos);
  return data;
}

export interface DatosMarcar {
  items: number[];
  resultado: ResultadoVerificacion;
  lugar_encontrado: number | null;
  nota: string;
}

export async function marcarItems(id: number, datos: DatosMarcar) {
  const { data } = await api.post<VerificacionDetalle>(ENDPOINTS.inventario.marcar(id), datos);
  return data;
}

export async function cerrarVerificacion(id: number, conclusion: string) {
  const { data } = await api.post<VerificacionDetalle>(ENDPOINTS.inventario.cerrar(id), { conclusion });
  return data;
}

export async function cancelarVerificacion(id: number) {
  const { data } = await api.post<VerificacionDetalle>(ENDPOINTS.inventario.cancelar(id));
  return data;
}

// ── Importar y exportar ──

/** Los campos de un activo que puede traer una planilla, en el orden en que se muestran. */
export const CAMPOS_IMPORTABLES: { valor: string; etiqueta: string }[] = [
  { valor: "codigo", etiqueta: "Código" },
  { valor: "descripcion", etiqueta: "Descripción" },
  { valor: "lugar", etiqueta: "Lugar" },
  { valor: "tipo", etiqueta: "Tipo" },
  { valor: "marca", etiqueta: "Marca" },
  { valor: "modelo", etiqueta: "Modelo" },
  { valor: "serie", etiqueta: "Número de serie" },
  { valor: "estado", etiqueta: "Estado" },
  { valor: "fecha_adquisicion", etiqueta: "Fecha de adquisición" },
  { valor: "observaciones", etiqueta: "Observaciones" },
];
export const ETIQUETA_CAMPO: Record<string, string> = Object.fromEntries(
  CAMPOS_IMPORTABLES.map((c) => [c.valor, c.etiqueta]),
);
export const OBLIGATORIOS_IMPORT = ["codigo", "descripcion", "lugar"];

export interface ColumnaDetectada {
  indice: number;
  /** Título de la columna en el archivo (vacío si no hay fila de títulos). */
  titulo: string;
  /** Campo al que va, o "" si se ignora. */
  campo: string;
  muestra: string[];
}

/** Una fila de ejemplo, ya interpretada (cómo quedaría el activo). */
export interface EjemploActivo {
  codigo: string;
  descripcion: string;
  lugar: string;
  tipo: string;
  marca: string;
  modelo: string;
  serie: string;
  estado: string;
  fecha_adquisicion: string;
  observaciones: string;
}

export interface ResultadoImportacion {
  archivo: string;
  con_titulos: boolean;
  columnas: ColumnaDetectada[];
  total: number;
  /** Cuántas filas se importarían. */
  validas: number;
  /** Cuántas ya están en el sistema (se omiten). */
  existentes: number;
  con_error: number;
  errores: string[];
  avisos: string[];
  /** Campos obligatorios que no se encontraron (sus etiquetas). */
  faltan: string[];
  ejemplo: EjemploActivo[];
  /** Cuántos se crearon (solo al confirmar). */
  creados: number;
}

export interface OpcionesImportar {
  confirmar: boolean;
  titulos: "auto" | "si" | "no";
  /** Qué campo es cada columna (o "" para ignorarla). Sin esto, el servidor lo detecta. */
  mapeo?: string[] | null;
  lugar_por_defecto?: number | null;
}

export async function importarActivos(archivo: File, opciones: OpcionesImportar) {
  const form = new FormData();
  form.append("archivo", archivo);
  form.append("confirmar", String(opciones.confirmar));
  form.append("titulos", opciones.titulos);
  if (opciones.mapeo) form.append("mapeo", JSON.stringify(opciones.mapeo));
  if (opciones.lugar_por_defecto != null) {
    form.append("lugar_por_defecto", String(opciones.lugar_por_defecto));
  }
  const { data } = await api.post<ResultadoImportacion>(ENDPOINTS.inventario.importar, form);
  return data;
}

export type FormatoExport = "xlsx" | "csv" | "pdf";

/** Descarga los activos de la búsqueda actual. `filtros` son los mismos parámetros de la lista. */
export async function exportarActivos(formato: FormatoExport, filtros: Record<string, string> = {}) {
  const respuesta = await api.get<Blob>(ENDPOINTS.inventario.exportar, {
    params: { formato, ...filtros },
    responseType: "blob",
  });
  const cabecera = String(respuesta.headers["content-disposition"] ?? "");
  const nombre = /filename="([^"]+)"/.exec(cabecera)?.[1] ?? `inventario.${formato}`;
  const url = URL.createObjectURL(respuesta.data);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
