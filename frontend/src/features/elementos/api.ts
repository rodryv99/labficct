import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { CategoriaElemento, IconoElemento, Paginado, TipoElemento } from "../../api/tipos";
import { aFormData } from "../../lib/utiles";

export interface DatosElemento {
  nombre: string;
  categoria: CategoriaElemento;
  icono: IconoElemento;
  color: string;
  prefijo_etiqueta: string;
  descripcion: string;
  activo: boolean;
  imagen?: File | null;
  quitar_imagen?: boolean;
}

export async function listarElementos(params: { search?: string; categoria?: string } = {}) {
  const { data } = await api.get<Paginado<TipoElemento>>(ENDPOINTS.elementos.lista, {
    params: { page_size: 500, ...params },
  });
  return data.results;
}

function cuerpo(datos: DatosElemento) {
  // Con imagen nueva se envía como formulario (multipart); sin ella, como JSON.
  if (datos.imagen instanceof File) return aFormData({ ...datos });
  const { imagen: _imagen, ...resto } = datos;
  return resto;
}

export async function crearElemento(datos: DatosElemento) {
  const { data } = await api.post<TipoElemento>(ENDPOINTS.elementos.lista, cuerpo(datos));
  return data;
}

export async function actualizarElemento(id: number, datos: DatosElemento) {
  const { data } = await api.patch<TipoElemento>(ENDPOINTS.elementos.detalle(id), cuerpo(datos));
  return data;
}

export async function eliminarElemento(id: number) {
  await api.delete(ENDPOINTS.elementos.detalle(id));
}
