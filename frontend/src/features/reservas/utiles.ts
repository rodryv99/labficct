import type { Bloque, EstadoReserva } from "../../api/tipos";
import type { Tono } from "../../components/datos/Etiquetas";
import { desdeISO, diaCorto } from "../../lib/fechas";

export const TONO_RESERVA: Record<EstadoReserva, Tono> = {
  confirmada: "exito",
  pendiente: "aviso",
  cancelada: "neutro",
};

export function resumenBloque(b: Bloque): string {
  return `${diaCorto(desdeISO(b.fecha))} · ${b.hora_inicio}–${b.hora_fin}`;
}
