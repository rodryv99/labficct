import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { CategoriaObjeto, ObjetoPerdido, Paginado } from "../../api/tipos";
import { aFormData } from "../../lib/utiles";

export interface FiltrosObjetos {
  page: number;
  page_size: number;
  search?: string;
  estado?: string;
  categoria?: string;
  laboratorio?: number;
}

export interface DatosObjeto {
  descripcion: string;
  categoria: CategoriaObjeto;
  caracteristicas: string;
  laboratorio: number | null;
  lugar: string;
  fecha_hallazgo: string;
  encontrado_por: string;
  foto?: File | null;
  quitar_foto?: boolean;
}

export async function listarObjetos(filtros: FiltrosObjetos) {
  const { data } = await api.get<Paginado<ObjetoPerdido>>(ENDPOINTS.objetosPerdidos.lista, { params: filtros });
  return data;
}

export async function obtenerObjeto(id: number | string) {
  const { data } = await api.get<ObjetoPerdido>(ENDPOINTS.objetosPerdidos.detalle(id));
  return data;
}

/** Subir fotos desde un celular puede tardar: se da más tiempo que al resto de pedidos. */
const CON_ARCHIVOS = { timeout: 120_000 };

function cuerpo(datos: DatosObjeto) {
  if (datos.foto instanceof File) return aFormData({ ...datos });
  const { foto: _foto, ...resto } = datos;
  return resto;
}

export async function registrarObjeto(datos: DatosObjeto) {
  const { data } = await api.post<ObjetoPerdido>(ENDPOINTS.objetosPerdidos.lista, cuerpo(datos), CON_ARCHIVOS);
  return data;
}

export async function editarObjeto(id: number, datos: DatosObjeto) {
  const { data } = await api.patch<ObjetoPerdido>(ENDPOINTS.objetosPerdidos.detalle(id), cuerpo(datos), CON_ARCHIVOS);
  return data;
}

export interface DatosEntrega {
  entregado_a: string;
  entregado_ci: string;
  observacion: string;
  /** Opcionales: fotos del CI (ambos lados) y de quien recibe. */
  ci_anverso?: File | null;
  ci_reverso?: File | null;
  foto_persona?: File | null;
}

export async function entregarObjeto(id: number, datos: DatosEntrega) {
  const { ci_anverso, ci_reverso, foto_persona, ...texto } = datos;
  const fotos = { ci_anverso, ci_reverso, foto_persona };
  const conFotos = Object.values(fotos).some((f) => f instanceof File);
  const cuerpo = conFotos
    ? aFormData({ ...texto, ...Object.fromEntries(Object.entries(fotos).filter(([, f]) => f instanceof File)) })
    : texto;
  const { data } = await api.post<ObjetoPerdido>(
    ENDPOINTS.objetosPerdidos.entregar(id),
    cuerpo,
    conFotos ? CON_ARCHIVOS : undefined,
  );
  return data;
}

export async function anularObjeto(id: number, motivo: string) {
  const { data } = await api.post<ObjetoPerdido>(ENDPOINTS.objetosPerdidos.anular(id), { motivo });
  return data;
}
