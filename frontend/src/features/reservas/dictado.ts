/**
 * Entiende una frase dictada (o escrita) y saca los datos de una reserva.
 *
 * Son reglas, sin servicios externos: buscan el día ("mañana", "el viernes", "20 de
 * noviembre"), el horario ("de 8 a 10", "a las 3 de la tarde"), las aulas ("laboratorios
 * 41 y 42"), quién la pide ("solicita…", "para el…"), programas y apoyo de auxiliares.
 * Lo que queda al inicio de la frase se toma como título.
 *
 * Nunca guarda nada: solo propone valores para el formulario, que la persona revisa.
 */

export interface ContextoDictado {
  hoy: Date;
  laboratorios: { id: number; codigo: string; nombre: string }[];
  personas: { id: number; nombre_completo: string }[];
  programas: { id: number; nombre: string }[];
}

export interface ResultadoDictado {
  titulo?: string;
  /** Usuario del sistema que la solicita. */
  solicitante?: number;
  /** Si quien la pide no es usuario del sistema. */
  solicitante_externo?: string;
  contacto?: string;
  laboratorios?: number[];
  /** AAAA-MM-DD */
  fecha?: string;
  /** HH:MM */
  hora_inicio?: string;
  hora_fin?: string;
  descripcion?: string;
  programas?: number[];
  requiere_apoyo?: boolean;
  auxiliares_requeridos?: number;
  /** Lo que se entendió, en palabras, para mostrarlo. */
  entendido: string[];
  /** Datos importantes que no aparecieron en la frase. */
  faltantes: string[];
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const ALT_MESES = `${MESES.join("|")}|setiembre`;
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const NOMBRES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const UNIDADES: Record<string, number> = {
  cero: 0,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
};
const NUMEROS: Record<string, number> = {
  ...UNIDADES,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};
const DECENAS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50 };

// La ñ también se aplana ("mañana" → "manana") para que los patrones sean simples.
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
function numerosEnCifras(texto: string): string {
  const partes = texto.split(/(\s+)/);
  const palabra = (i: number) => plano(partes[i] ?? "").trim();
  const salida: string[] = [];
  // La puntuación pegada a la palabra ("ocho,") se conserva.
  const cola = (i: number) => /[.,;:!?]+$/.exec(partes[i] ?? "")?.[0] ?? "";
  for (let i = 0; i < partes.length; i += 1) {
    const actual = palabra(i);
    if (actual in DECENAS) {
      // "cuarenta y uno": decena + "y" + unidad (con los espacios entre medio).
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

interface Tramo {
  inicio: number;
  fin: number;
}

const dos = (n: number) => String(n).padStart(2, "0");
const aHora = (minutos: number) => `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
const aISO = (f: Date) => `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function sumarDias(fecha: Date, dias: number): Date {
  const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  f.setDate(f.getDate() + dias);
  return f;
}

/** Tapa con espacios lo ya entendido, para que no se lea dos veces (conserva las posiciones). */
function tapar(texto: string, tramo: Tramo): string {
  return texto.slice(0, tramo.inicio) + " ".repeat(tramo.fin - tramo.inicio) + texto.slice(tramo.fin);
}

// ── Horario ─────────────────────────────────────────────

type Periodo = "am" | "pm" | null;

// Una hora: "8", "8:30", "8 y media", "14 horas", "3 pm", "3 de la tarde", "una", "mediodia".
const HORA =
  "(\\d{1,2}|una|mediodia)(?::(\\d{2}))?(?:\\s+y\\s+(media|cuarto))?(?:\\s*(?:horas|hora|hrs|hs|h)\\b)?" +
  "(?:\\s*(a\\s*m|p\\s*m)\\b)?(?:\\s+(?:de|por|en)\\s+la\\s+(manana|tarde|noche))?";

interface HoraLeida {
  hora: number;
  minuto: number;
  periodo: Periodo;
  /** Dijo los minutos o el periodo: es claramente una hora y no otro número. */
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

/** Decide mañana o tarde cuando no se dijo: nadie reserva un laboratorio a las 2 de la madrugada. */
function resolverRango(a: HoraLeida, b: HoraLeida): [number, number] | null {
  let inicio: number;
  let fin: number;
  if (a.periodo || b.periodo) {
    fin = enMinutos(b, b.periodo ?? a.periodo);
    if (a.periodo) inicio = enMinutos(a, a.periodo);
    else {
      // "de 2 a 4 de la tarde" (las dos son de la tarde) frente a "de 10 a 2 de la tarde".
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

interface HorarioLeido {
  inicio: number;
  fin: number;
  tramo: Tramo;
  /** El horario no se dijo con horas: se supuso por "en la tarde", etc. */
  supuesto?: boolean;
}

function buscarHorario(texto: string): HorarioLeido | null {
  const rangos = [
    // "de 8 a 10", "desde las 14 hasta las 16", "entre las 8 y las 10"
    new RegExp(`\\b(?:de|desde|entre)\\s+(?:las?\\s+|el\\s+)?${HORA}\\s+(?:a|al|hasta|y)\\s+(?:las?\\s+|el\\s+)?${HORA}`),
    // "8:00 a 10:00", "8:30-10"
    new RegExp(`\\b${HORA}\\s*(?:a|al|hasta|-)\\s*(?:las?\\s+|el\\s+)?${HORA}`),
  ];
  for (const [indice, patron] of rangos.entries()) {
    const m = patron.exec(texto);
    if (!m) continue;
    const a = leerHora(m.slice(1, 6));
    const b = leerHora(m.slice(6, 11));
    if (!a || !b) continue;
    // Sin "de… a…", dos números sueltos solo son un horario si alguno es claramente una hora.
    if (indice === 1 && !a.explicita && !b.explicita) continue;
    const rango = resolverRango(a, b);
    if (rango) return { inicio: rango[0], fin: rango[1], tramo: { inicio: m.index, fin: m.index + m[0].length } };
  }

  // "a las 9" (dura 2 horas, o lo que diga "por 3 horas")
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

  // Sin horas: "en la tarde", "por la mañana"
  const parte = /\b(?:en|por|durante)\s+la\s+(manana|tarde|noche)\b/.exec(texto);
  if (parte) {
    const [inicio, fin] = parte[1] === "manana" ? [480, 600] : parte[1] === "tarde" ? [840, 960] : [1140, 1260];
    return { inicio, fin, supuesto: true, tramo: { inicio: parte.index, fin: parte.index + parte[0].length } };
  }
  return null;
}

// ── Aulas ───────────────────────────────────────────────

const PALABRA_AULA = "(?:laboratorios?|labs?|aulas?|salas?)";

interface AulasLeidas {
  ids: number[];
  tramos: Tramo[];
  desconocidas: string[];
}

function buscarAulas(texto: string, laboratorios: ContextoDictado["laboratorios"]): AulasLeidas {
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

  // El número de cada laboratorio: primero el de su código (LAB-41 → 41), después el del nombre.
  const porNumero = new Map<number, number>();
  for (const campo of ["codigo", "nombre"] as const) {
    for (const lab of laboratorios) {
      for (const n of lab[campo].match(/\d+/g) ?? []) {
        if (!porNumero.has(Number(n))) porNumero.set(Number(n), lab.id);
      }
    }
  }

  // "laboratorio 41", "en los laboratorios 41, 42 y 43", "aulas 12 y 14"
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
      // Ese número ya no es un aula: es una fecha ("20 de noviembre") o una hora ("8:30").
      if (new RegExp(`^(?:\\s+de\\s+(?:${ALT_MESES})\\b|:)`).test(despues)) break;
      const id = porNumero.get(Number(n[0]));
      if (id === undefined) {
        // El primero que no existe se avisa; los siguientes ya pueden ser otra cosa.
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

  // Por nombre: "laboratorio de redes", "sala de servidores"
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

// ── Día ─────────────────────────────────────────────────

interface DiaLeido {
  fecha: Date;
  tramos: Tramo[];
}

function buscarDia(texto: string, hoy: Date): DiaLeido | null {
  const tramos: Tramo[] = [];
  // Manda la primera fecha que se entienda (en el orden de abajo: la más precisa primero).
  const hallado: { fecha: Date | null } = { fecha: null };
  const tomar = (m: RegExpExecArray, valor: Date | null) => {
    tramos.push({ inicio: m.index, fin: m.index + m[0].length });
    if (!hallado.fecha && valor) hallado.fecha = valor;
  };
  const hoySinHora = sumarDias(hoy, 0);

  // "20 de noviembre", "el día 20 de noviembre de 2026"
  const conMes = new RegExp(
    `\\b(?:el\\s+)?(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(${ALT_MESES})(?:\\s+(?:de|del)\\s+(\\d{4}))?`,
  ).exec(texto);
  if (conMes) {
    const mes = conMes[2] === "setiembre" ? 8 : MESES.indexOf(conMes[2]);
    let f = new Date(conMes[3] ? Number(conMes[3]) : hoy.getFullYear(), mes, Number(conMes[1]));
    // Sin año, una fecha que ya pasó es del año que viene.
    if (!conMes[3] && f < hoySinHora) f = new Date(hoy.getFullYear() + 1, mes, Number(conMes[1]));
    tomar(conMes, f.getDate() === Number(conMes[1]) ? f : null);
  }

  // "20/11", "20/11/2026"
  const conBarras = /\b(?:el\s+)?(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(texto);
  if (conBarras) {
    const anio = conBarras[3] ? Number(conBarras[3].length === 2 ? `20${conBarras[3]}` : conBarras[3]) : hoy.getFullYear();
    const f = new Date(anio, Number(conBarras[2]) - 1, Number(conBarras[1]));
    tomar(conBarras, f.getDate() === Number(conBarras[1]) ? f : null);
  }

  const pasado = /\bpasado\s+manana\b/.exec(texto);
  if (pasado) tomar(pasado, sumarDias(hoy, 2));
  // "mañana", pero no "de la mañana" ni "esta mañana" (eso es la hora del día).
  const manana = /(?<!\bla\s)(?<!\besta\s)(?<!\bpasado\s)\bmanana\b/.exec(texto);
  if (manana) tomar(manana, sumarDias(hoy, 1));
  const esHoy = /\bhoy\b/.exec(texto);
  if (esHoy) tomar(esHoy, hoySinHora);

  // "el viernes", "este lunes", "el próximo martes": el que viene (nunca hoy mismo).
  const semana = new RegExp(`\\b(?:el\\s+|este\\s+)?(?:proximo\\s+)?(${DIAS.join("|")})\\b`).exec(texto);
  if (semana) {
    const falta = (DIAS.indexOf(semana[1]) - hoy.getDay() + 7) % 7 || 7;
    tomar(semana, sumarDias(hoy, falta));
  }

  // "el 20", "el día 20": el próximo día 20.
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

// ── Textos libres ───────────────────────────────────────

const CONECTORES = /(?:^|\s)(?:en|el|la|los|las|de|del|para|con|y|e|a|al|que|es|sera|dia|por|un|una)$/;

/** Quita espacios, puntuación y palabras sueltas del final ("Taller de Git en el" → "Taller de Git"). */
function limpiar(texto: string): string {
  let t = texto.replace(/^[\s,.;:¡!¿?-]+|[\s,.;:¡!¿?-]+$/g, "");
  for (;;) {
    const m = CONECTORES.exec(plano(t));
    if (!m) break;
    t = t.slice(0, m.index).replace(/[\s,.;:-]+$/g, "");
    if (!t) break;
  }
  return t;
}

const mayuscula = (texto: string) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto);

const TITULOS_DE_PERSONA = new Set([
  "el",
  "la",
  "don",
  "dona",
  "lic",
  "licenciado",
  "licenciada",
  "ing",
  "ingeniero",
  "ingeniera",
  "dr",
  "dra",
  "doctor",
  "doctora",
  "docente",
  "profesor",
  "profesora",
  "auxiliar",
  "msc",
]);

function buscarPersona(texto: string, personas: ContextoDictado["personas"]): number | undefined {
  const palabras = plano(texto)
    .split(/\s+/)
    .filter((p) => p && !TITULOS_DE_PERSONA.has(p));
  if (!palabras.length) return undefined;
  const candidatas = personas.filter((p) => {
    const nombre = plano(p.nombre_completo).split(/\s+/);
    return palabras.every((palabra) => nombre.includes(palabra));
  });
  // Con un solo nombre ("Ana") solo vale si no hay dos personas que se llamen así.
  return candidatas.length === 1 ? candidatas[0].id : undefined;
}

const ES_ACTIVIDAD =
  /^(?:taller|curso|cursillo|clase|examen|capacitacion|reunion|defensa|practica|evento|seminario|charla|conferencia|olimpiada|hackathon|hackaton|prueba|evaluacion|presentacion|concurso|feria|induccion|laboratorio de)\b/;

// ── Todo junto ──────────────────────────────────────────

export function interpretarDictado(dictado: string, contexto: ContextoDictado): ResultadoDictado {
  const resultado: ResultadoDictado = { entendido: [], faltantes: [] };
  const original = numerosEnCifras(dictado.replace(/\s+/g, " ").trim());
  if (!original) {
    resultado.faltantes = ["título", "aulas", "día", "horario"];
    return resultado;
  }
  const completo = plano(original);
  let texto = completo;
  const tramos: Tramo[] = [];
  const ocupar = (...nuevos: Tramo[]) => {
    for (const t of nuevos) {
      tramos.push(t);
      texto = tapar(texto, t);
    }
  };

  // 1. Horario, aulas y día (en ese orden: cada uno tapa lo suyo para no confundir al siguiente).
  const horario = buscarHorario(texto);
  if (horario) {
    resultado.hora_inicio = aHora(horario.inicio);
    resultado.hora_fin = aHora(horario.fin);
    ocupar(horario.tramo);
    resultado.entendido.push(
      `Horario: ${resultado.hora_inicio} a ${resultado.hora_fin}${horario.supuesto ? " (lo supuse; ajústalo)" : ""}`,
    );
  }

  const aulas = buscarAulas(texto, contexto.laboratorios);
  ocupar(...aulas.tramos);
  if (aulas.ids.length) {
    resultado.laboratorios = aulas.ids;
    const codigos = aulas.ids.map((id) => contexto.laboratorios.find((l) => l.id === id)?.codigo ?? "");
    resultado.entendido.push(`${aulas.ids.length === 1 ? "Aula" : "Aulas"}: ${codigos.join(", ")}`);
  }
  if (aulas.desconocidas.length) {
    resultado.entendido.push(`No encontré el laboratorio ${aulas.desconocidas.join(", ")}`);
  }

  const dia = buscarDia(texto, contexto.hoy);
  if (dia) {
    resultado.fecha = aISO(dia.fecha);
    ocupar(...dia.tramos);
    const f = dia.fecha;
    resultado.entendido.push(`Día: ${NOMBRES_DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`);
  }

  // 2. Apoyo de auxiliares.
  const sinApoyo = /\bsin\s+(?:el\s+)?apoyo(?:\s+de\s+auxiliares)?\b/.exec(texto);
  const conAuxiliares = /\b(?:con|y|requiere|necesita)\s+(?:el\s+)?(?:apoyo\s+de\s+)?(\d{1,2}|un)\s+auxiliar(?:es)?\b/.exec(texto);
  const conApoyo = /\b(?:con|y|requiere|necesita)\s+(?:el\s+)?apoyo(?:\s+de\s+(?:los\s+)?auxiliar(?:es)?)?\b/.exec(texto);
  if (sinApoyo) {
    resultado.requiere_apoyo = false;
    ocupar({ inicio: sinApoyo.index, fin: sinApoyo.index + sinApoyo[0].length });
  } else if (conAuxiliares) {
    resultado.requiere_apoyo = true;
    resultado.auxiliares_requeridos = Math.min(10, Math.max(1, conAuxiliares[1] === "un" ? 1 : Number(conAuxiliares[1])));
    ocupar({ inicio: conAuxiliares.index, fin: conAuxiliares.index + conAuxiliares[0].length });
  } else if (conApoyo) {
    resultado.requiere_apoyo = true;
    resultado.auxiliares_requeridos = 1;
    ocupar({ inicio: conApoyo.index, fin: conApoyo.index + conApoyo[0].length });
  }
  if (resultado.requiere_apoyo) {
    const n = resultado.auxiliares_requeridos ?? 1;
    resultado.entendido.push(`Apoyo: ${n} ${n === 1 ? "auxiliar" : "auxiliares"}`);
  }

  // 3. Programas: los del catálogo que se nombran en la frase.
  const vistos = new Set<string>();
  const programas: number[] = [];
  const nombresProgramas: string[] = [];
  for (const p of contexto.programas) {
    const nombre = plano(p.nombre).trim().replace(/\s+/g, " ");
    if (nombre.length < 3 || vistos.has(nombre)) continue;
    if (new RegExp(`(?<![a-z0-9])${escapar(nombre)}(?![a-z0-9])`).test(completo)) {
      vistos.add(nombre);
      programas.push(p.id);
      nombresProgramas.push(p.nombre);
    }
  }
  if (programas.length) {
    resultado.programas = programas;
    resultado.entendido.push(`Programas: ${nombresProgramas.join(", ")}`);
  }

  // 4. Textos con palabra clave: van desde la palabra hasta el siguiente dato entendido.
  type Clave = "titulo" | "solicitante" | "descripcion" | "contacto";
  const patrones: [Clave, RegExp][] = [
    ["titulo", /\b(?:titulo|titulada|titulado|llamada|llamado|se\s+llama|actividad|evento)\s+(?:es\s+)?/],
    [
      "solicitante",
      /\b(?:(?:lo|la)\s+)?(?:solicitad[oa]\s+por|solicitante(?:\s+es)?|solicita|a\s+nombre\s+de|pedid[oa]\s+por|pide|de\s+parte\s+de)\s+/,
    ],
    ["descripcion", /\b(?:descripcion|detalles?|nota|observacion(?:es)?)\s+(?:es\s+)?/],
    ["contacto", /\b(?:contacto|telefono|celular|correo)\s+(?:es\s+)?/],
  ];
  const marcas: { clave: Clave; tramo: Tramo }[] = [];
  for (const [clave, patron] of patrones) {
    const m = patron.exec(texto);
    if (m) marcas.push({ clave, tramo: { inicio: m.index, fin: m.index + m[0].length } });
  }
  // "para el Centro de Estudiantes": solo si no se dijo "solicita…".
  let debil: Tramo | null = null;
  if (!marcas.some((m) => m.clave === "solicitante")) {
    const m = /\bpara\s+(?:el|la|los|las)\s+/.exec(texto);
    if (m) {
      debil = { inicio: m.index, fin: m.index + m[0].length };
      marcas.push({ clave: "solicitante", tramo: debil });
    }
  }
  ocupar(...marcas.map((m) => m.tramo));

  const hasta = (desde: number) =>
    Math.min(original.length, ...tramos.filter((t) => t.inicio >= desde).map((t) => t.inicio));
  const libres: Partial<Record<Clave, string>> = {};
  for (const m of marcas) libres[m.clave] = limpiar(original.slice(m.tramo.fin, hasta(m.tramo.fin)));

  // 5. El título: lo que se dijo al inicio, antes de cualquier otro dato.
  const primero = Math.min(original.length, ...tramos.map((t) => t.inicio));
  let inicial = original.slice(0, primero);
  const entrada =
    /^\s*(?:por\s+favor\s+)?(?:(?:quiero|quisiera|necesito|deseo)\s+)?(?:(?:hacer|crear|registrar|agendar|programar)\s+)?(?:(?:una|la)\s+)?(?:nueva\s+)?(reservar|reserva)?\s*/.exec(
      plano(inicial),
    );
  if (entrada && entrada[0].trim()) {
    inicial = inicial.slice(entrada[0].length);
    if (entrada[1]) inicial = inicial.replace(/^\s*(?:de|del|para)\s+(?:(?:el|la|un|una)\s+)?/i, "");
  }
  let titulo = libres.titulo || limpiar(inicial);
  let solicitante = libres.solicitante ?? "";
  // "…para el taller de Git": si no hay título, eso no es quien la pide: es la actividad.
  if (!titulo && debil && solicitante && ES_ACTIVIDAD.test(plano(solicitante))) {
    titulo = solicitante;
    solicitante = "";
  }
  if (titulo) {
    resultado.titulo = mayuscula(titulo).slice(0, 150);
    resultado.entendido.unshift(`Título: ${resultado.titulo}`);
  }
  if (solicitante) {
    const persona = buscarPersona(solicitante, contexto.personas);
    if (persona !== undefined) {
      resultado.solicitante = persona;
      const nombre = contexto.personas.find((p) => p.id === persona)?.nombre_completo ?? solicitante;
      resultado.entendido.push(`Solicita: ${nombre} (usuario del sistema)`);
    } else {
      resultado.solicitante_externo = mayuscula(solicitante).slice(0, 150);
      resultado.entendido.push(`Solicita: ${resultado.solicitante_externo}`);
    }
  }
  if (libres.contacto) {
    // Un teléfono dictado llega con espacios: "7 123 4567".
    const contacto = /^[\d\s+-]+$/.test(libres.contacto) ? libres.contacto.replace(/\s+/g, "") : libres.contacto;
    resultado.contacto = contacto.slice(0, 100);
    resultado.entendido.push(`Contacto: ${resultado.contacto}`);
  }
  if (libres.descripcion) {
    resultado.descripcion = mayuscula(libres.descripcion);
    resultado.entendido.push(`Descripción: ${resultado.descripcion}`);
  }

  if (!resultado.titulo) resultado.faltantes.push("título");
  if (!resultado.laboratorios) resultado.faltantes.push("aulas");
  if (!resultado.fecha) resultado.faltantes.push("día");
  if (!resultado.hora_inicio) resultado.faltantes.push("horario");
  return resultado;
}
