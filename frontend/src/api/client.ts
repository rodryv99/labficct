import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { env } from "../config/env";
import { ENDPOINTS } from "./endpoints";

/**
 * Cliente HTTP único. El token de acceso vive solo en memoria; el de
 * renovación lo guarda el navegador en una cookie httpOnly que JavaScript
 * no puede leer (la envía sola gracias a withCredentials).
 */
export const api = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 20000,
});

let tokenAcceso: string | null = null;
let alExpirarSesion: (() => void) | null = null;
let renovacionEnCurso: Promise<string | null> | null = null;

export function guardarTokenAcceso(token: string | null) {
  tokenAcceso = token;
}

export function alTerminarSesion(callback: () => void) {
  alExpirarSesion = callback;
}

/** Pide un token de acceso nuevo usando la cookie. Varias llamadas a la vez comparten la misma petición. */
export function renovarToken(): Promise<string | null> {
  if (renovacionEnCurso) return renovacionEnCurso;
  const promesa: Promise<string | null> = axios
    .post<{ access: string }>(`${env.apiBaseUrl}${ENDPOINTS.auth.refresh}`, {}, { withCredentials: true })
    .then((r) => {
      guardarTokenAcceso(r.data.access);
      return r.data.access;
    })
    .catch(() => {
      guardarTokenAcceso(null);
      return null;
    })
    .finally(() => {
      renovacionEnCurso = null;
    });
  renovacionEnCurso = promesa;
  return promesa;
}

api.interceptors.request.use((config) => {
  if (tokenAcceso) {
    config.headers.Authorization = `Bearer ${tokenAcceso}`;
  }
  return config;
});

type ConfigConReintento = InternalAxiosRequestConfig & { _reintentado?: boolean };

api.interceptors.response.use(
  (respuesta) => respuesta,
  async (error: AxiosError) => {
    const original = error.config as ConfigConReintento | undefined;
    const esAuth = original?.url?.startsWith("/auth/login") || original?.url?.startsWith("/auth/refresh");
    if (error.response?.status === 401 && original && !original._reintentado && !esAuth) {
      original._reintentado = true;
      const token = await renovarToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      alExpirarSesion?.();
    }
    return Promise.reject(error);
  },
);
