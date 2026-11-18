/**
 * Entiende una frase dictada (o escrita) y saca los datos de un horario de clase.
 *
 * Ej.: "Programación I grupo A con el ingeniero Justiniano, los lunes y miércoles de
 * 8 a 10 en el laboratorio 41". Nunca guarda nada: solo propone valores que la
 * persona revisa.
 */
import {
  type ItemCatalogo,
  type LabCtx,
  Lienzo,
  type PersonaCtx,
  type ResultadoBase,
  aHora,
  buscarAulas,
  buscarDiasSemana,
  buscarEnCatalogo,
  buscarHorario,
  buscarPersonaEnFrase,
  limpiar,
  mayuscula,
  numerosEnCifras,
  plano,
  textosConClave,
} from "../dictado/nucleo";

export interface MateriaCtx {
  id: number;
  sigla: string;
  nombre: string;
}

export interface ContextoHorario {
  materias: MateriaCtx[];
  docentes: PersonaCtx[];
  laboratorios: LabCtx[];
  periodos: ItemCatalogo[];
}

export interface ResultadoHorario extends ResultadoBase {
  materia?: number;
  docente?: number;
  dias?: number[];
  grupo?: string;
  hora_inicio?: string;
  hora_fin?: string;
  laboratorio?: number;
  periodo?: number;
  observaciones?: string;
}

const NOMBRE_DIA = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function interpretarDictadoHorario(dictado: string, contexto: ContextoHorario): ResultadoHorario {
  const resultado: ResultadoHorario = { entendido: [], faltantes: [] };
  const original = numerosEnCifras(dictado.replace(/\s+/g, " ").trim());
  if (!original) {
    resultado.faltantes = ["materia", "días", "horario"];
    return resultado;
  }
  const L = new Lienzo(plano(original));

  // Horario (de 8 a 10).
  const horario = buscarHorario(L.texto);
  if (horario) {
    resultado.hora_inicio = aHora(horario.inicio);
    resultado.hora_fin = aHora(horario.fin);
    L.ocupar(horario.tramo);
    resultado.entendido.push(
      `Horario: ${resultado.hora_inicio} a ${resultado.hora_fin}${horario.supuesto ? " (lo supuse; ajústalo)" : ""}`,
    );
  }

  // Días de la semana (se repite).
  const dias = buscarDiasSemana(L.texto);
  if (dias) {
    resultado.dias = dias.dias;
    L.ocupar(...dias.tramos);
    resultado.entendido.push(`Días: ${dias.dias.map((d) => NOMBRE_DIA[d]).join(", ")}`);
  }

  // Laboratorio.
  const aulas = buscarAulas(L.texto, contexto.laboratorios);
  if (aulas.ids.length) {
    resultado.laboratorio = aulas.ids[0];
    L.ocupar(...aulas.tramos);
    const codigo = contexto.laboratorios.find((l) => l.id === aulas.ids[0])?.codigo ?? "";
    resultado.entendido.push(`Laboratorio: ${codigo}`);
  }

  // Docente (una persona del catálogo).
  const docente = buscarPersonaEnFrase(L.texto, contexto.docentes);
  if (docente) {
    resultado.docente = docente.id;
    L.ocupar(docente.tramo);
    const nombre = contexto.docentes.find((d) => d.id === docente.id)?.nombre ?? "";
    resultado.entendido.push(`Docente: ${nombre}`);
  }

  // Periodo.
  const periodo = buscarEnCatalogo(L.texto, contexto.periodos);
  if (periodo) {
    resultado.periodo = periodo.id;
    L.ocupar(periodo.tramo);
    const nombre = contexto.periodos.find((p) => p.id === periodo.id)?.nombre ?? "";
    resultado.entendido.push(`Periodo: ${nombre}`);
  }

  // Materia: por sigla o por nombre (el texto más largo que calce).
  const comoCatalogo: ItemCatalogo[] = [];
  for (const m of contexto.materias) {
    comoCatalogo.push({ id: m.id, nombre: m.nombre });
    if (m.sigla.trim().length >= 3) comoCatalogo.push({ id: m.id, nombre: m.sigla });
  }
  const materia = buscarEnCatalogo(L.texto, comoCatalogo);
  if (materia) {
    resultado.materia = materia.id;
    L.ocupar(materia.tramo);
    const m = contexto.materias.find((x) => x.id === materia.id);
    resultado.entendido.push(`Materia: ${m ? `${m.sigla} · ${m.nombre}` : ""}`);
  }

  // Grupo y observaciones.
  const grupo = /\bgrupo\s+([a-z0-9]{1,4})\b/.exec(L.texto);
  if (grupo) {
    resultado.grupo = grupo[1].toUpperCase();
    L.ocupar({ inicio: grupo.index, fin: grupo.index + grupo[0].length });
    resultado.entendido.push(`Grupo: ${resultado.grupo}`);
  }
  const libres = textosConClave(L.texto, original, L, [
    ["observaciones", /\b(?:observacion(?:es)?|nota|detalles?|comentario)\s+(?:es\s+)?/],
  ]);
  if (libres.observaciones) resultado.observaciones = mayuscula(libres.observaciones).slice(0, 500);

  if (resultado.materia === undefined) resultado.faltantes.push("materia");
  if (!resultado.dias) resultado.faltantes.push("días");
  if (!resultado.hora_inicio) resultado.faltantes.push("horario");

  // Si no se nombró la materia pero quedó texto al inicio, se avisa como posible materia.
  if (resultado.materia === undefined) {
    const inicial = limpiar(original.slice(0, L.primera(original.length)));
    if (inicial) resultado.entendido.push(`No reconocí la materia «${mayuscula(inicial)}»; elígela abajo.`);
  }

  return resultado;
}
