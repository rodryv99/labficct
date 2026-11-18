import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";

/** Clave de la preferencia: qué laboratorios muestra la pizarra "Por laboratorio" y en qué orden. */
const CLAVE_LABS = "pizarra.laboratorios";

interface ValorLabs {
  /** Ids de laboratorio en el orden en que el usuario los fue marcando. Vacío = mostrar todos. */
  orden: number[];
}

async function obtenerLabsPizarra(): Promise<number[]> {
  const { data } = await api.get<{ clave: string; valor: ValorLabs }>(ENDPOINTS.preferencias.interfaz(CLAVE_LABS));
  const orden = data.valor?.orden;
  return Array.isArray(orden) ? orden.filter((x) => typeof x === "number") : [];
}

async function guardarLabsPizarra(orden: number[]): Promise<void> {
  await api.put(ENDPOINTS.preferencias.interfaz(CLAVE_LABS), { valor: { orden } });
}

/**
 * Preferencia (por usuario, guardada en el servidor) de qué laboratorios se ven en la
 * pizarra y en qué orden. Se guarda sola en cuanto cambia; mientras tanto se ve al instante.
 */
export function usePizarraLabs() {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: ["pizarra", "labs"],
    queryFn: obtenerLabsPizarra,
    staleTime: 5 * 60_000,
  });

  const guardar = useMutation({
    mutationFn: guardarLabsPizarra,
    onMutate: (orden) => {
      // Optimista: la pizarra se reordena al instante, sin esperar al servidor.
      queryClient.setQueryData(["pizarra", "labs"], orden);
    },
  });

  return {
    orden: consulta.data ?? [],
    cargando: consulta.isLoading,
    guardarOrden: (orden: number[]) => guardar.mutate(orden),
  };
}
