import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { TipoElemento } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { listarElementos } from "./api";

/** Catálogo de elementos como mapa id → elemento (para dibujar grillas). */
export function useTiposElemento() {
  const { puede } = useSesion();
  // Docentes y administrativos no ven el catálogo, pero sí la grilla: se dibuja con ícono genérico.
  const consulta = useQuery({
    queryKey: ["elementos", "todos"],
    queryFn: () => listarElementos(),
    staleTime: 5 * 60_000,
    enabled: puede("elementos.ver"),
  });
  const mapa = useMemo(() => new Map<number, TipoElemento>((consulta.data ?? []).map((t) => [t.id, t])), [consulta.data]);
  return { tipos: consulta.data ?? [], mapa, cargando: consulta.isLoading };
}
