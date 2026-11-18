/**
 * Entiende una frase dictada (o escrita) y saca los datos de una tarea.
 *
 * Ej.: "Instalar Office en el laboratorio 41, prioridad alta, responsables Ana y Mario,
 * para el viernes". Nunca guarda nada: solo propone valores que la persona revisa.
 */
import type { PrioridadTarea } from "../../api/tipos";
import {
  type LabCtx,
  Lienzo,
  type PersonaCtx,
  type ResultadoBase,
  aISO,
  buscarAulas,
  buscarDia,
  buscarEtiqueta,
  buscarPersona,
  limpiar,
  mayuscula,
  numerosEnCifras,
  plano,
  textosConClave,
} from "../dictado/nucleo";

export interface ContextoTarea {
  hoy: Date;
  laboratorios: LabCtx[];
  personas: PersonaCtx[];
}

export interface ResultadoTarea extends ResultadoBase {
  titulo?: string;
  descripcion?: string;
  prioridad?: PrioridadTarea;
  laboratorio?: number;
  responsables?: number[];
  fecha_limite?: string;
}

const PRIORIDADES: { valor: PrioridadTarea; sinonimos: string[] }[] = [
  { valor: "alta", sinonimos: ["alta", "urgente", "prioritaria", "prioritario", "importante"] },
  { valor: "baja", sinonimos: ["baja", "poco urgente", "sin apuro"] },
  { valor: "normal", sinonimos: ["normal", "media"] },
];

const NOMBRES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function interpretarDictadoTarea(dictado: string, contexto: ContextoTarea): ResultadoTarea {
  const resultado: ResultadoTarea = { entendido: [], faltantes: [] };
  const original = numerosEnCifras(dictado.replace(/\s+/g, " ").trim());
  if (!original) {
    resultado.faltantes = ["título"];
    return resultado;
  }
  const L = new Lienzo(plano(original));

  // Fecha límite.
  const dia = buscarDia(L.texto, contexto.hoy);
  if (dia) {
    resultado.fecha_limite = aISO(dia.fecha);
    L.ocupar(...dia.tramos);
    const f = dia.fecha;
    resultado.entendido.push(`Fecha límite: ${NOMBRES_DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`);
  }

  // Laboratorio (uno).
  const aulas = buscarAulas(L.texto, contexto.laboratorios);
  if (aulas.ids.length) {
    resultado.laboratorio = aulas.ids[0];
    L.ocupar(...aulas.tramos);
    const codigo = contexto.laboratorios.find((l) => l.id === aulas.ids[0])?.codigo ?? "";
    resultado.entendido.push(`Laboratorio: ${codigo}`);
  }

  // Prioridad.
  const prio = buscarEtiqueta(L.texto, PRIORIDADES);
  if (prio) {
    resultado.prioridad = prio.valor;
    L.ocupar(prio.tramo);
    resultado.entendido.push(`Prioridad: ${prio.valor}`);
  }

  // Responsables (con palabra clave; nunca se adivinan del título).
  const clave = /\b(?:responsables?|encargad[oa]s?|asignad[oa]s?\s+a|asignar\s+a|asignale\s+a|a\s+cargo\s+de)\s+/.exec(
    L.texto,
  );
  if (clave) {
    const desde = clave.index + clave[0].length;
    const hasta = L.hasta(desde, original.length);
    const trozo = original.slice(desde, hasta);
    const ids: number[] = [];
    const nombres: string[] = [];
    for (const parte of trozo.split(/\s+(?:y|e)\s+|,/)) {
      const id = buscarPersona(parte, contexto.personas);
      if (id !== undefined && !ids.includes(id)) {
        ids.push(id);
        nombres.push(contexto.personas.find((p) => p.id === id)?.nombre ?? "");
      }
    }
    L.ocupar({ inicio: clave.index, fin: hasta });
    if (ids.length) {
      resultado.responsables = ids;
      resultado.entendido.push(`${ids.length === 1 ? "Responsable" : "Responsables"}: ${nombres.join(", ")}`);
    }
  }

  // Textos con palabra clave (descripción, o un título explícito).
  const libres = textosConClave(L.texto, original, L, [
    ["titulo", /\b(?:titulo|titulada|titulado|llamada|llamado|se\s+llama)\s+(?:es\s+)?/],
    ["descripcion", /\b(?:descripcion|detalles?|detalle|nota|observacion(?:es)?)\s+(?:es\s+)?/],
  ]);
  if (libres.descripcion) resultado.descripcion = mayuscula(libres.descripcion).slice(0, 2000);

  // Título: lo dicho al inicio, antes de cualquier otro dato.
  let inicial = original.slice(0, L.primera(original.length));
  const entrada =
    /^\s*(?:por\s+favor\s+)?(?:(?:quiero|quisiera|necesito|deseo)\s+)?(?:(?:crear|registrar|agregar|anotar|hacer|nueva|nuevo)\s+)*(?:(?:la|una|el|un)\s+)?(?:tarea|pendiente)?\s*(?:de|para|que\s+diga)?\s*/.exec(
      plano(inicial),
    );
  if (entrada && entrada[0].trim()) inicial = inicial.slice(entrada[0].length);
  const titulo = libres.titulo || limpiar(inicial);
  if (titulo) {
    resultado.titulo = mayuscula(titulo).slice(0, 150);
    resultado.entendido.unshift(`Título: ${resultado.titulo}`);
  } else {
    resultado.faltantes.push("título");
  }

  return resultado;
}
