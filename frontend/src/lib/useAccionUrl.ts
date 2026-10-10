import { useEffect } from "react";
import { useSearchParams } from "react-router";

/**
 * Ejecuta una acción cuando la URL trae ciertos parámetros (por ejemplo
 * ?nuevo=1 desde la búsqueda rápida o desde la pizarra) y luego los quita.
 */
export function useAccionUrl(claves: string[], accion: (valores: Record<string, string>) => void) {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const valores: Record<string, string> = {};
    claves.forEach((c) => {
      const v = params.get(c);
      if (v !== null) valores[c] = v;
    });
    if (!Object.keys(valores).length) return;
    accion(valores);
    const nuevos = new URLSearchParams(params);
    claves.forEach((c) => nuevos.delete(c));
    setParams(nuevos, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
}
