import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router";

import { alTerminarSesion, api, guardarTokenAcceso, renovarToken } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import type { UsuarioMe } from "../api/tipos";
import { PantallaCarga } from "../components/feedback/PantallaCarga";
import { SinPermisoPage } from "../features/sistema/SinPermisoPage";

type Estado = "cargando" | "anonimo" | "autenticado";

interface ContextoSesion {
  estado: Estado;
  usuario: UsuarioMe | null;
  puede: (permiso: string) => boolean;
  iniciarSesion: (usuario: string, password: string, recordar: boolean) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  recargarUsuario: () => Promise<void>;
  sesionExpirada: boolean;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [usuario, setUsuario] = useState<UsuarioMe | null>(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);

  const recargarUsuario = useCallback(async () => {
    const { data } = await api.get<UsuarioMe>(ENDPOINTS.auth.me);
    setUsuario(data);
    setEstado("autenticado");
  }, []);

  // Al abrir la web: si la cookie de renovación sigue vigente, la sesión continúa.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const token = await renovarToken();
      if (cancelado) return;
      if (!token) {
        setEstado("anonimo");
        return;
      }
      try {
        await recargarUsuario();
      } catch {
        if (!cancelado) setEstado("anonimo");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [recargarUsuario]);

  useEffect(() => {
    alTerminarSesion(() => {
      guardarTokenAcceso(null);
      setUsuario(null);
      setSesionExpirada(true);
      setEstado("anonimo");
      queryClient.clear();
    });
  }, [queryClient]);

  const iniciarSesion = useCallback(async (identificador: string, password: string, recordar: boolean) => {
    const { data } = await api.post<{ access: string; usuario: UsuarioMe }>(ENDPOINTS.auth.login, {
      usuario: identificador,
      password,
      recordar,
    });
    guardarTokenAcceso(data.access);
    setUsuario(data.usuario);
    setSesionExpirada(false);
    setEstado("autenticado");
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await api.post(ENDPOINTS.auth.logout);
    } finally {
      guardarTokenAcceso(null);
      setUsuario(null);
      setEstado("anonimo");
      queryClient.clear();
    }
  }, [queryClient]);

  const valor = useMemo<ContextoSesion>(
    () => ({
      estado,
      usuario,
      puede: (permiso) => Boolean(usuario?.permisos.includes(permiso)),
      iniciarSesion,
      cerrarSesion,
      recargarUsuario,
      sesionExpirada,
    }),
    [estado, usuario, iniciarSesion, cerrarSesion, recargarUsuario, sesionExpirada],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useSesion debe usarse dentro de SesionProvider");
  return contexto;
}

/** Solo deja pasar con sesión iniciada; si no, manda al login y recuerda a dónde iba. */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const { estado } = useSesion();
  const ubicacion = useLocation();
  if (estado === "cargando") return <PantallaCarga />;
  if (estado === "anonimo") return <Navigate to="/login" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  return <>{children}</>;
}

/** Muestra la página solo si el rol tiene el permiso. */
export function ConPermiso({ permiso, children }: { permiso: string; children: ReactNode }) {
  const { puede } = useSesion();
  if (!puede(permiso)) return <SinPermisoPage />;
  return <>{children}</>;
}
