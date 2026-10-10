import {
  addDays,
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

/** Fecha local en formato AAAA-MM-DD (lo que espera la API). */
export function aISO(fecha: Date): string {
  return format(fecha, "yyyy-MM-dd");
}

/** "2026-09-28" → Date a medianoche local (sin corrimientos de zona horaria). */
export function desdeISO(fecha: string): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function fechaLarga(fecha: Date): string {
  const texto = format(fecha, "EEEE d 'de' MMMM", { locale: es });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function fechaCorta(fecha: string | Date): string {
  const f = typeof fecha === "string" ? (fecha.length === 10 ? desdeISO(fecha) : parseISO(fecha)) : fecha;
  return format(f, "d MMM yyyy", { locale: es });
}

export function fechaHora(fecha: string): string {
  return format(parseISO(fecha), "d MMM yyyy, HH:mm", { locale: es });
}

export function diaCorto(fecha: Date): string {
  return format(fecha, "EEE d", { locale: es });
}

export function relativo(fecha: string): string {
  const f = parseISO(fecha);
  if (isToday(f)) return `hoy, ${format(f, "HH:mm")}`;
  if (isYesterday(f)) return `ayer, ${format(f, "HH:mm")}`;
  return formatDistanceToNow(f, { addSuffix: true, locale: es });
}

export function lunesDe(fecha: Date): Date {
  return startOfWeek(fecha, { weekStartsOn: 1 });
}

export function sumarDias(fecha: Date, dias: number): Date {
  return addDays(fecha, dias);
}

/** "07:30" → 450 */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 450 → "07:30" */
export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function minutosAhora(): number {
  const ahora = new Date();
  return ahora.getHours() * 60 + ahora.getMinutes();
}

/** Valor para <input type="datetime-local"> con la hora local actual. */
export function ahoraLocalInput(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

export function aInputLocal(fechaIso: string): string {
  return format(parseISO(fechaIso), "yyyy-MM-dd'T'HH:mm");
}

/** "2026-09-28" → "28/09/2026" */
export function fechaNumerica(fecha: string): string {
  return format(desdeISO(fecha), "dd/MM/yyyy");
}

/** Días de calendario desde hoy hasta la fecha (negativo si ya pasó). */
export function diasHasta(fecha: string): number {
  return differenceInCalendarDays(desdeISO(fecha), new Date());
}

/** Valor de <input type="datetime-local"> (hora local) → ISO 8601 con zona, para la API. */
export function localAIso(valor: string): string {
  return new Date(valor).toISOString();
}
