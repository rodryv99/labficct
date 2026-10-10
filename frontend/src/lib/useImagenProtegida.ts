import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useUrlObjeto } from "./useUrlObjeto";

/**
 * Descarga una imagen que exige sesión (p. ej. la foto del CI de una entrega) y
 * devuelve una URL local para <img>. Esas fotos no tienen URL pública.
 */
export function useImagenProtegida(ruta: string | null) {
  const consulta = useQuery({
    queryKey: ["imagen-protegida", ruta],
    queryFn: async () => {
      const { data } = await api.get<Blob>(ruta!, { responseType: "blob" });
      return data;
    },
    enabled: ruta !== null,
    // Una foto guardada nunca cambia: no hace falta volver a pedirla.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const url = useUrlObjeto(consulta.data);

  return { url, cargando: consulta.isLoading, error: consulta.error };
}
