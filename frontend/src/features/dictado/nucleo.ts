/**
 * Núcleo del dictado por voz: los ladrillos que comparten todos los formularios.
 *
 * Son reglas, sin servicios externos. Entienden lo que casi siempre se dice en una
 * frase: el día ("mañana", "el viernes", "20 de noviembre"), el horario ("de 8 a 10"),
 * los laboratorios ("laboratorios 41 y 42"), una persona del sistema, un ítem de un
 * catálogo (materia, tipo…) o una opción con sinónimos (prioridad, estado…).
 *
 * Es el mismo motor que usa reservas (features/reservas/dictado.ts), puesto aparte para
 * reutilizarlo en tareas, objetos perdidos, horarios e inventario.
 *
 * Nada de esto guarda: solo propone valores que la persona revisa antes de guardar.
 */

export interface Tramo {
  inicio: number;
  fin: number;
}

export interface ResultadoBase {
  /** Lo que se entendió, en palabras, para mostrarlo. */
  entendido: string[];
  /** Datos importantes que no aparecieron en la frase. */
  faltantes: string[];
}

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const ALT_MESES = `${MESES.join("|")}|setiembre`;
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
export const NOMBRES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** Nombre de cada día de la semana en la convención de horarios (1 = lunes … 7 = domingo). */
export const NOMBRE_DIA_SEMANA = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

const UNIDADES: Record<string, number> = {
  cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
};
const NUMEROS: Record<string, number> = {
  ...UNIDADES,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const DECENAS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50 };

const ACENTOS: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n" };

/**
 * Minúsculas, sin acentos y sin puntuación, **con el mismo largo** que el original:
 * así una posición en el texto plano es la misma posición en el texto dictado.
 */
export function plano(texto: string): string {
  let salida = "";
  for (const letra of texto) {
    const minuscula = letra.toLowerCase();
    const c = minuscula.length === letra.length ? minuscula : letra;
    if (c.length !== 1) salida += " ".repeat(c.length);
    else if (ACENTOS[c]) salida += ACENTOS[c];
    else if (/[a-z0-9:/\s-]/.test(c)) salida += c;
    else salida += " ";
  }
  return salida;
}

/** "ocho" → "8", "cuarenta y uno" → "41". Quien dicta dice números; el reconocedor no siempre los escribe con cifras. */
export function numerosEnCifras(texto: string): string {
  const partes = texto.split(/(\s+)/);
  const palabra = (i: number) => plano(partes[i] ?? "").trim();
  const salida: string[] = [];
  const cola = (i: number) => /[.,;:!?]+$/.exec(partes[i] ?? "")?.[0] ?? "";
  for (let i = 0; i < partes.length; i += 1) {
    const actual = palabra(i);
    if (actual in DECENAS) {
      const unidad = palabra(i + 4);
      if (!cola(i) && palabra(i + 2) === "y" && unidad in UNIDADES && UNIDADES[unidad] > 0) {
        salida.push(String(DECENAS[actual] + UNIDADES[unidad]) + cola(i + 4));
        i += 4;
        continue;
      }
      salida.push(String(DECENAS[actual]) + cola(i));
    } else if (actual in NUMEROS) {
      salida.push(String(NUMEROS[actual]) + cola(i));
    } else {
      salida.push(partes[i] ?? "");
    }
  }
  return salida.join("");
}

const dos = (n: number) => String(n).padStart(2, "0");
export const aHora = (minutos: number) => `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
export const aISO = (f: Date) => `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
export const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const mayuscula = (texto: string) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto);

export function sumarDias(fecha: Date, dias: number): Date {
  const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  f.setDate(f.getDate() + dias);
  return f;
}

/** Tapa con espacios lo ya entendido, para que no se lea dos veces (conserva las posiciones). */
export function tapar(texto: string, tramo: Tramo): string {
  return texto.slice(0, tramo.inicio) + " ".repeat(tramo.fin - tramo.inicio) + texto.slice(tramo.fin);
}

/** Orquestador: va tapando lo entendido y guarda los tramos ocupados (para cortar los textos libres). */
export class Lienzo {
  texto: string;
  readonly tramos: Tramo[] = [];
  constructor(plano: string) {
    this.texto = plano;
  }
  ocupar(...nuevos: Tramo[]) {
    for (const t of nuevos) {
      this.tramos.push(t);
      this.texto = tapar(this.texto, t);
    }
  }
  /** Primera posición ocupada a partir de `desde` (para saber dónde termina un texto libre). */
  hasta(desde: number, largoTotal: number): number {
    return Math.min(largoTotal, ...this.tramos.filter((t) => t.inicio >= desde).map((t) => t.inicio));
  }
  /** La primera posición ocupada de toda la frase (dónde deja de ser "título"). */
  primera(largoTotal: number): number {
    return Math.min(largoTotal, ...this.tramos.map((t) => t.inicio));
  }
}

// ── Horario ─────────────────────────────────────────────

type Periodo = "am" | "pm" | null;

const HORA =
  "(\\d{1,2}|una|mediodia)(?::(\\d{2}))?(?:\\s+y\\s+(media|cuarto))?(?:\\s*(?:horas|hora|hrs|hs|h)\\b)?" +
  "(?:\\s*(a\\s*m|p\\s*m)\\b)?(?:\\s+(?:de|por|en)\\s+la\\s+(manana|tarde|noche))?";

interface HoraLeida {
  hora: number;
  minuto: number;
  periodo: Periodo;
  explicita: boolean;
}

function leerHora(grupos: (string | undefined)[]): HoraLeida | null {
  const [numero, minutos, fraccion, ampm, parte] = grupos;
  if (numero === undefined) return null;
  let hora = numero === "una" ? 1 : numero === "mediodia" ? 12 : Number(numero);
  const minuto = minutos ? Number(minutos) : fraccion === "media" ? 30 : fraccion === "cuarto" ? 15 : 0;
  if (hora > 24 || minuto > 59) return null;
  if (hora === 24) hora = 0;
  let periodo: Periodo = null;
  if (ampm) periodo = ampm.startsWith("a") ? "am" : "pm";
  else if (parte) periodo = parte === "manana" ? "am" : "pm";
  else if (numero === "mediodia") periodo = "pm";
  return { hora, minuto, periodo, explicita: Boolean(minutos || fraccion || ampm || parte || numero === "mediodia") };
}

function enMinutos(h: HoraLeida, periodo: Periodo): number {
  let hora = h.hora;
  if (periodo === "pm" && hora < 12) hora += 12;
  if (periodo === "am" && hora === 12) hora = 0;
  return hora * 60 + h.minuto;
}

function resolverRango(a: HoraLeida, b: HoraLeida): [number, number] | null {
  let inicio: number;
  let fin: number;
  if (a.periodo || b.periodo) {
    fin = enMinutos(b, b.periodo ?? a.periodo);
    if (a.periodo) inicio = enMinutos(a, a.periodo);
    else {
      const igual = enMinutos(a, b.periodo);
      inicio = igual < fin ? igual : enMinutos(a, "am");
    }
    if (!b.periodo && fin <= inicio && fin + 720 < 1440) fin += 720;
  } else {
    inicio = enMinutos(a, a.hora < 7 ? "pm" : null);
    fin = enMinutos(b, b.hora < 7 ? "pm" : null);
    if (fin <= inicio && fin + 720 < 1440) fin += 720;
  }
  return inicio < fin && fin < 1440 ? [inicio, fin] : null;
}

export interface HorarioLeido {
  inicio: number;
  fin: number;
  tramo: Tramo;
  supuesto?: boolean;
}

export function buscarHorario(texto: string): HorarioLeido | null {
  const rangos = [
    new RegExp(`\\b(?:de|desde|entre)\\s+(?:las?\\s+|el\\s+)?${HORA}\\s+(?:a|al|hasta|y)\\s+(?:las?\\s+|el\\s+)?${HORA}`),
    new RegExp(`\\b${HORA}\\s*(?:a|al|hasta|-)\\s*(?:las?\\s+|el\\s+)?${HORA}`),
  ];
  for (const [indice, patron] of rangos.entries()) {
    const m = patron.exec(texto);
    if (!m) continue;
    const a = leerHora(m.slice(1, 6));
    const b = leerHora(m.slice(6, 11));
    if (!a || !b) continue;
    if (indice === 1 && !a.explicita && !b.explicita) continue;
    const rango = resolverRango(a, b);
    if (rango) return { inicio: rango[0], fin: rango[1], tramo: { inicio: m.index, fin: m.index + m[0].length } };
  }

  const una = new RegExp(`\\b(?:a|desde)\\s+(?:las?|el)\\s+${HORA}`).exec(texto);
  if (una) {
    const a = leerHora(una.slice(1, 6));
    if (a) {
      const inicio = enMinutos(a, a.periodo ?? (a.hora < 7 ? "pm" : null));
      let tramo: Tramo = { inicio: una.index, fin: una.index + una[0].length };
      let duracion = 120;
      const d = /\b(?:por|durante)\s+(\d{1,2}|una)\s+horas?(\s+y\s+media)?/.exec(texto);
      if (d) {
        duracion = (d[1] === "una" ? 1 : Number(d[1])) * 60 + (d[2] ? 30 : 0);
        tramo = { inicio: Math.min(tramo.inicio, d.index), fin: Math.max(tramo.fin, d.index + d[0].length) };
      }
      const fin = Math.min(inicio + duracion, 23 * 60 + 59);
      if (inicio < fin) return { inicio, fin, tramo };
    }
  }

  const parte = /\b(?:en|por|durante)\s+la\s+(manana|tarde|noche)\b/.exec(texto);
  if (parte) {
    const [inicio, fin] = parte[1] === "manana" ? [480, 600] : parte[1] === "tarde" ? [840, 960] : [1140, 1260];
    return { inicio, fin, supuesto: true, tramo: { inicio: parte.index, fin: parte.index + parte[0].length } };
  }
  return null;
}

// ── Laboratorios ────────────────────────────────────────

const PALABRA_AULA = "(?:laboratorios?|labs?|aulas?|salas?)";

export interface LabCtx {
  id: number;
  codigo: string;
  nombre: string;
}

export interface AulasLeidas {
  ids: number[];
  tramos: Tramo[];
  desconocidas: string[];
}

export function buscarAulas(texto: string, laboratorios: LabCtx[]): AulasLeidas {
  const ids: number[] = [];
  const tramos: Tramo[] = [];
  const desconocidas: string[] = [];
  const agregar = (id: number) => {
    if (!ids.includes(id)) ids.push(id);
  };

  const todas = new RegExp(`\\b(?:en\\s+)?tod[oa]s\\s+l[oa]s\\s+${PALABRA_AULA}\\b`).exec(texto);
  if (todas) {
    laboratorios.forEach((l) => agregar(l.id));
    tramos.push({ inicio: todas.index, fin: todas.index + todas[0].length });
    return { ids, tramos, desconocidas };
  }

  const porNumero = new Map<number, number>();
  for (const campo of ["codigo", "nombre"] as const) {
    for (const lab of laboratorios) {
      for (const n of lab[campo].match(/\d+/g) ?? []) {
        if (!porNumero.has(Number(n))) porNumero.set(Number(n), lab.id);
      }
    }
  }

  const lista = new RegExp(
    `\\b(?:en\\s+)?(?:(?:el|la|los|las)\\s+)?${PALABRA_AULA}\\s+(?:numeros?\\s+)?(\\d{1,3}(?:(?:\\s+(?:y|e)\\s+|\\s+)(?:(?:el|la)\\s+)?\\d{1,3})*)`,
    "g",
  );
  for (const m of texto.matchAll(lista)) {
    const inicioNumeros = m.index + m[0].length - m[1].length;
    let fin = inicioNumeros;
    for (const n of m[1].matchAll(/\d{1,3}/g)) {
      const posicion = inicioNumeros + n.index;
      const despues = texto.slice(posicion + n[0].length);
      if (new RegExp(`^(?:\\s+de\\s+(?:${ALT_MESES})\\b|:)`).test(despues)) break;
      const id = porNumero.get(Number(n[0]));
      if (id === undefined) {
        if (fin === inicioNumeros) {
          desconocidas.push(n[0]);
          fin = posicion + n[0].length;
        }
        break;
      }
      agregar(id);
      fin = posicion + n[0].length;
    }
    if (fin > inicioNumeros) tramos.push({ inicio: m.index, fin });
  }

  for (const lab of laboratorios) {
    const nombre = plano(lab.nombre)
      .replace(new RegExp(`^\\s*${PALABRA_AULA}\\s+(?:de\\s+)?`), "")
      .trim();
    if (nombre.length < 3 || /^\d+$/.test(nombre)) continue;
    const m = new RegExp(`\\b(?:en\\s+)?(?:(?:el|la)\\s+)?${PALABRA_AULA}\\s+(?:de\\s+)?${escapar(nombre)}(?![a-z0-9])`).exec(
      texto,
    );
    if (m) {
      agregar(lab.id);
      tramos.push({ inicio: m.index, fin: m.index + m[0].length });
    }
  }
  return { ids, tramos, desconocidas };
}

// ── Día (fecha concreta) ────────────────────────────────

export interface DiaLeido {
  fecha: Date;
  tramos: Tramo[];
}

export function buscarDia(texto: string, hoy: Date): DiaLeido | null {
  const tramos: Tramo[] = [];
  const hallado: { fecha: Date | null } = { fecha: null };
  const tomar = (m: RegExpExecArray, valor: Date | null) => {
    tramos.push({ inicio: m.index, fin: m.index + m[0].length });
    if (!hallado.fecha && valor) hallado.fecha = valor;
  };
  const hoySinHora = sumarDias(hoy, 0);

  const conMes = new RegExp(
    `\\b(?:el\\s+)?(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(${ALT_MESES})(?:\\s+(?:de|del)\\s+(\\d{4}))?`,
  ).exec(texto);
  if (conMes) {
    const mes = conMes[2] === "setiembre" ? 8 : MESES.indexOf(conMes[2]);
    let f = new Date(conMes[3] ? Number(conMes[3]) : hoy.getFullYear(), mes, Number(conMes[1]));
    if (!conMes[3] && f < hoySinHora) f = new Date(hoy.getFullYear() + 1, mes, Number(conMes[1]));
    tomar(conMes, f.getDate() === Number(conMes[1]) ? f : null);
  }

  const conBarras = /\b(?:el\s+)?(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(texto);
  if (conBarras) {
    const anio = conBarras[3] ? Number(conBarras[3].length === 2 ? `20${conBarras[3]}` : conBarras[3]) : hoy.getFullYear();
    const f = new Date(anio, Number(conBarras[2]) - 1, Number(conBarras[1]));
    tomar(conBarras, f.getDate() === Number(conBarras[1]) ? f : null);
  }

  const pasado = /\bpasado\s+manana\b/.exec(texto);
  if (pasado) tomar(pasado, sumarDias(hoy, 2));
  const manana = /(?<!\bla\s)(?<!\besta\s)(?<!\bpasado\s)\bmanana\b/.exec(texto);
  if (manana) tomar(manana, sumarDias(hoy, 1));
  const esHoy = /\bhoy\b/.exec(texto);
  if (esHoy) tomar(esHoy, hoySinHora);

  const semana = new RegExp(`\\b(?:el\\s+|este\\s+)?(?:proximo\\s+)?(${DIAS.join("|")})\\b`).exec(texto);
  if (semana) {
    const falta = (DIAS.indexOf(semana[1]) - hoy.getDay() + 7) % 7 || 7;
    tomar(semana, sumarDias(hoy, falta));
  }

  if (!hallado.fecha) {
    const soloDia = /\bel\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(?::|horas?\b|y\s+media|y\s+cuarto|de\s+la\b|a\s?m\b|p\s?m\b))/.exec(texto);
    if (soloDia && Number(soloDia[1]) >= 1 && Number(soloDia[1]) <= 31) {
      const dia = Number(soloDia[1]);
      let f = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
      if (f < hoySinHora || f.getDate() !== dia) f = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia);
      tomar(soloDia, f.getDate() === dia ? f : null);
    }
  }
  return hallado.fecha ? { fecha: hallado.fecha, tramos } : null;
}

// ── Días de la semana (clases que se repiten) ───────────

export interface DiasSemanaLeidos {
  dias: number[];
  tramos: Tramo[];
}

/**
 * "los lunes y miércoles", "lunes, miércoles y viernes", "cada martes".
 * Devuelve los días en la convención de horarios (1 = lunes … 7 = domingo).
 */
export function buscarDiasSemana(texto: string): DiasSemanaLeidos | null {
  const mapa: Record<string, number> = {
    lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 7,
  };
  const dias: number[] = [];
  const tramos: Tramo[] = [];
  const re = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/g;
  for (const m of texto.matchAll(re)) {
    const valor = mapa[m[1]];
    if (!dias.includes(valor)) dias.push(valor);
    tramos.push({ inicio: m.index, fin: m.index + m[0].length });
  }
  if (!dias.length) return null;
  dias.sort((a, b) => a - b);
  return { dias, tramos };
}

// ── Persona del sistema ─────────────────────────────────

const TITULOS_DE_PERSONA = new Set([
  "el", "la", "don", "dona", "lic", "licenciado", "licenciada", "ing", "ingeniero", "ingeniera",
  "dr", "dra", "doctor", "doctora", "docente", "profesor", "profesora", "auxiliar", "msc",
]);

export interface PersonaCtx {
  id: number;
  nombre: string;
}

/** Busca una persona por su nombre dentro de un trozo de texto (ya recortado a "quién"). */
export function buscarPersona(texto: string, personas: PersonaCtx[]): number | undefined {
  const palabras = plano(texto)
    .split(/\s+/)
    .filter((p) => p && !TITULOS_DE_PERSONA.has(p));
  if (!palabras.length) return undefined;
  const candidatas = personas.filter((p) => {
    const nombre = plano(p.nombre).split(/\s+/);
    return palabras.every((palabra) => nombre.includes(palabra));
  });
  return candidatas.length === 1 ? candidatas[0].id : undefined;
}

/** Como `buscarPersona`, pero sobre toda la frase: devuelve la persona nombrada y su tramo. */
export function buscarPersonaEnFrase(
  texto: string,
  personas: PersonaCtx[],
): { id: number; tramo: Tramo } | null {
  let mejor: { id: number; tramo: Tramo; largo: number } | null = null;
  for (const p of personas) {
    const partes = plano(p.nombre)
      .split(/\s+/)
      .filter((x) => x.length > 2);
    for (const parte of partes) {
      const m = new RegExp(`\\b${escapar(parte)}\\b`).exec(texto);
      if (m && (!mejor || parte.length > mejor.largo)) {
        mejor = { id: p.id, tramo: { inicio: m.index, fin: m.index + m[0].length }, largo: parte.length };
      }
    }
  }
  return mejor ? { id: mejor.id, tramo: mejor.tramo } : null;
}

// ── Catálogos y opciones ────────────────────────────────

export interface ItemCatalogo {
  id: number;
  nombre: string;
}

/** Encuentra el ítem del catálogo cuyo nombre aparezca en la frase (el más largo gana). */
export function buscarEnCatalogo(texto: string, items: ItemCatalogo[]): { id: number; tramo: Tramo } | null {
  let mejor: { id: number; tramo: Tramo; largo: number } | null = null;
  for (const item of items) {
    const nombre = plano(item.nombre).trim().replace(/\s+/g, " ");
    if (nombre.length < 3) continue;
    const m = new RegExp(`(?<![a-z0-9])${escapar(nombre)}(?![a-z0-9])`).exec(texto);
    if (m && (!mejor || nombre.length > mejor.largo)) {
      mejor = { id: item.id, tramo: { inicio: m.index, fin: m.index + m[0].length }, largo: nombre.length };
    }
  }
  return mejor ? { id: mejor.id, tramo: mejor.tramo } : null;
}

export interface OpcionEtiqueta<T> {
  valor: T;
  /** Palabras o frases (sin acentos) que apuntan a esta opción. */
  sinonimos: string[];
}

/** Elige una opción (prioridad, estado, categoría…) por las palabras clave que la nombran. */
export function buscarEtiqueta<T>(texto: string, opciones: OpcionEtiqueta<T>[]): { valor: T; tramo: Tramo } | null {
  let mejor: { valor: T; tramo: Tramo; largo: number } | null = null;
  for (const opcion of opciones) {
    for (const sinonimo of opcion.sinonimos) {
      const m = new RegExp(`(?<![a-z0-9])${escapar(sinonimo)}(?![a-z0-9])`).exec(texto);
      if (m && (!mejor || sinonimo.length > mejor.largo)) {
        mejor = { valor: opcion.valor, tramo: { inicio: m.index, fin: m.index + m[0].length }, largo: sinonimo.length };
      }
    }
  }
  return mejor ? { valor: mejor.valor, tramo: mejor.tramo } : null;
}

// ── Textos libres ───────────────────────────────────────

const CONECTORES = /(?:^|\s)(?:en|el|la|los|las|de|del|para|con|y|e|a|al|que|es|sera|dia|por|un|una)$/;

/** Quita espacios, puntuación y palabras sueltas del final ("Taller de Git en el" → "Taller de Git"). */
export function limpiar(texto: string): string {
  let t = texto.replace(/^[\s,.;:¡!¿?-]+|[\s,.;:¡!¿?-]+$/g, "");
  for (;;) {
    const m = CONECTORES.exec(plano(t));
    if (!m) break;
    t = t.slice(0, m.index).replace(/[\s,.;:-]+$/g, "");
    if (!t) break;
  }
  return t;
}

/**
 * Saca los textos libres marcados por palabras clave ("descripción …", "para …").
 * Devuelve, por cada clave encontrada, el texto que va desde la palabra hasta el
 * siguiente dato ya entendido. `original` es la frase sin aplanar (para conservar tildes).
 */
export function textosConClave<C extends string>(
  textoPlano: string,
  original: string,
  lienzo: Lienzo,
  patrones: [C, RegExp][],
): Partial<Record<C, string>> {
  const marcas: { clave: C; tramo: Tramo }[] = [];
  for (const [clave, patron] of patrones) {
    const m = patron.exec(textoPlano);
    if (m) marcas.push({ clave, tramo: { inicio: m.index, fin: m.index + m[0].length } });
  }
  lienzo.ocupar(...marcas.map((m) => m.tramo));
  const libres: Partial<Record<C, string>> = {};
  for (const m of marcas) {
    libres[m.clave] = limpiar(original.slice(m.tramo.fin, lienzo.hasta(m.tramo.fin, original.length)));
  }
  return libres;
}
