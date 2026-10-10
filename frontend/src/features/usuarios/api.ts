import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { Paginado, Rol, Usuario, UsuarioOpcion } from "../../api/tipos";

export interface FiltrosUsuarios {
  page: number;
  page_size: number;
  search?: string;
  rol?: string;
  is_active?: string;
  ordering?: string;
}

export interface DatosUsuario {
  email: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  rol: Rol;
  telefono: string;
  password?: string;
  /** Solo rol docente: ficha de docente (registrada sin usuario) a la que se une. */
  vincular_docente?: number | null;
}

export async function listarUsuarios(filtros: FiltrosUsuarios) {
  const { data } = await api.get<Paginado<Usuario>>(ENDPOINTS.usuarios.lista, { params: filtros });
  return data;
}

export async function crearUsuario(datos: DatosUsuario) {
  const { data } = await api.post<Usuario>(ENDPOINTS.usuarios.lista, datos);
  return data;
}

export async function actualizarUsuario(id: number, datos: Partial<DatosUsuario>) {
  const { data } = await api.patch<Usuario>(ENDPOINTS.usuarios.detalle(id), datos);
  return data;
}

export async function eliminarUsuario(id: number) {
  await api.delete(ENDPOINTS.usuarios.detalle(id));
}

export async function cambiarEstadoUsuario(id: number, activo: boolean) {
  const url = activo ? ENDPOINTS.usuarios.activar(id) : ENDPOINTS.usuarios.desactivar(id);
  const { data } = await api.post<Usuario>(url);
  return data;
}

export async function restablecerPassword(id: number, password: string) {
  await api.post(ENDPOINTS.usuarios.restablecerPassword(id), { password });
}

/** Lista corta para desplegables. `roles` separados por coma. */
export async function opcionesUsuarios(roles: string) {
  const { data } = await api.get<UsuarioOpcion[]>(ENDPOINTS.usuarios.opciones, { params: { rol: roles } });
  return data;
}
