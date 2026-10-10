import { useQuery } from "@tanstack/react-query";

import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import type { Configuracion } from "../api/tipos";
import { aMinutos } from "./fechas";

/** Valores de respaldo mientras llega /configuracion/ (los mismos del .env de ejemplo). */
const POR_DEFECTO: Configuracion = {
  atencion_inicio: "07:00",
  atencion_fin: "22:45",
  franjas: [
    ["07:00", "09:15"],
    ["09:15", "11:30"],
    ["11:30", "13:45"],
    ["13:45", "16:00"],
    ["16:00", "18:15"],
    ["18:15", "20:30"],
    ["20:30", "22:45"],
  ],
};

async function obtenerConfiguracion() {
  const { data } = await api.get<Configuracion>(ENDPOINTS.configuracion);
  return data;
}

/** Horario de atención y franjas habituales, definidos en el .env del backend. */
export function useConfiguracion(): Configuracion {
  const consulta = useQuery({
    queryKey: ["configuracion"],
    queryFn: obtenerConfiguracion,
    staleTime: Infinity,
  });
  return consulta.data ?? POR_DEFECTO;
}

/** Agrupa las franjas por duración: "2 h 15 min" → [...], "1 h 30 min" → [...]. */
export function franjasPorDuracion(franjas: [string, string][]): { titulo: string; franjas: [string, string][] }[] {
  const grupos = new Map<number, [string, string][]>();
  for (const franja of franjas) {
    const duracion = aMinutos(franja[1]) - aMinutos(franja[0]);
    if (duracion <= 0) continue;
    grupos.set(duracion, [...(grupos.get(duracion) ?? []), franja]);
  }
  return [...grupos.entries()].map(([minutos, lista]) => {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    const titulo = h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
    return { titulo, franjas: lista };
  });
}
