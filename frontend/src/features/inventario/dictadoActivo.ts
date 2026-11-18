/**
 * Entiende una frase dictada (o escrita) y saca los datos de un activo de inventario.
 *
 * Ej.: "Proyector Epson modelo X500, código INV-120, en el depósito, operativo,
 * comprado el 10 de marzo". Nunca guarda nada: solo propone valores que la persona
 * revisa.
 */
import type { EstadoActivo } from "../../api/tipos";
import {
  type ItemCatalogo,
  Lienzo,
  type ResultadoBase,
  aISO,
  buscarDia,
  buscarEnCatalogo,
  buscarEtiqueta,
  limpiar,
  mayuscula,
  numerosEnCifras,
  plano,
  textosConClave,
} from "../dictado/nucleo";

export interface ContextoActivo {
  hoy: Date;
  tipos: ItemCatalogo[];
  lugares: ItemCatalogo[];
}

export interface ResultadoActivo extends ResultadoBase {
  descripcion?: string;
  codigo?: string;
  tipo?: number;
  lugar?: number;
  estado?: EstadoActivo;
  marca?: string;
  modelo?: string;
  serie?: string;
  fecha_adquisicion?: string;
  observaciones?: string;
}

const ESTADOS: { valor: EstadoActivo; sinonimos: string[] }[] = [
  { valor: "operativo", sinonimos: ["operativo", "funcionando", "funciona", "bueno", "en buen estado", "nuevo"] },
  { valor: "danado", sinonimos: ["danado", "malogrado", "roto", "no funciona", "descompuesto", "quemado"] },
  { valor: "en_reparacion", sinonimos: ["en reparacion", "reparacion", "reparandose", "en arreglo", "en el taller", "en mantenimiento"] },
  { valor: "baja", sinonimos: ["de baja", "dado de baja", "baja", "obsoleto"] },
];

const NOMBRES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function interpretarDictadoActivo(dictado: string, contexto: ContextoActivo): ResultadoActivo {
  const resultado: ResultadoActivo = { entendido: [], faltantes: [] };
  const original = numerosEnCifras(dictado.replace(/\s+/g, " ").trim());
  if (!original) {
    resultado.faltantes = ["qué activo es"];
    return resultado;
  }
  const L = new Lienzo(plano(original));

  // Código: "código INV-120", "código 45".
  const codigo = /\b(?:codigo|cod)\s+(?:es\s+)?([a-z0-9][a-z0-9-]{0,19})\b/.exec(L.texto);
  if (codigo) {
    // Se toma del original (por si llevara mayúsculas) en la misma posición.
    const bruto = original.slice(codigo.index + codigo[0].length - codigo[1].length, codigo.index + codigo[0].length);
    resultado.codigo = bruto.toUpperCase();
    L.ocupar({ inicio: codigo.index, fin: codigo.index + codigo[0].length });
    resultado.entendido.push(`Código: ${resultado.codigo}`);
  }

  // Fecha de adquisición.
  const dia = buscarDia(L.texto, contexto.hoy);
  if (dia) {
    resultado.fecha_adquisicion = aISO(dia.fecha);
    L.ocupar(...dia.tramos);
    const f = dia.fecha;
    resultado.entendido.push(`Adquirido el: ${NOMBRES_DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`);
  }

  // Estado.
  const estado = buscarEtiqueta(L.texto, ESTADOS);
  if (estado) {
    resultado.estado = estado.valor;
    L.ocupar(estado.tramo);
    resultado.entendido.push(`Estado: ${estado.valor.replace("_", " ")}`);
  }

  // Lugar y tipo (catálogos).
  const lugar = buscarEnCatalogo(L.texto, contexto.lugares);
  if (lugar) {
    resultado.lugar = lugar.id;
    L.ocupar(lugar.tramo);
    resultado.entendido.push(`Lugar: ${contexto.lugares.find((l) => l.id === lugar.id)?.nombre ?? ""}`);
  }
  const tipo = buscarEnCatalogo(L.texto, contexto.tipos);
  if (tipo) {
    resultado.tipo = tipo.id;
    // No se tapa: el nombre del tipo ("proyector") suele ser también la descripción.
    resultado.entendido.push(`Tipo: ${contexto.tipos.find((t) => t.id === tipo.id)?.nombre ?? ""}`);
  }

  // Textos con palabra clave.
  const libres = textosConClave(L.texto, original, L, [
    ["marca", /\b(?:marca)\s+(?:es\s+)?/],
    ["modelo", /\b(?:modelo)\s+(?:es\s+)?/],
    ["serie", /\b(?:numero\s+de\s+serie|serie|serial)\s+(?:es\s+)?/],
    ["observaciones", /\b(?:observacion(?:es)?|nota|detalles?)\s+(?:es\s+)?/],
  ]);
  if (libres.marca) resultado.marca = mayuscula(libres.marca).slice(0, 80);
  if (libres.modelo) resultado.modelo = mayuscula(libres.modelo).slice(0, 80);
  if (libres.serie) resultado.serie = libres.serie.toUpperCase().slice(0, 80);
  if (libres.observaciones) resultado.observaciones = mayuscula(libres.observaciones).slice(0, 500);

  // Descripción: lo dicho al inicio (qué es el activo).
  let inicial = original.slice(0, L.primera(original.length));
  const entrada =
    /^\s*(?:por\s+favor\s+)?(?:(?:quiero|quisiera|necesito|deseo)\s+)?(?:(?:registrar|anotar|agregar|dar\s+de\s+alta)\s+)*(?:(?:un|una|el|la)\s+)?(?:activo|equipo)?\s*(?:es\s+|:\s*)?/.exec(
      plano(inicial),
    );
  if (entrada && entrada[0].trim()) inicial = inicial.slice(entrada[0].length);
  const descripcion = libres.marca && resultado.tipo ? "" : limpiar(inicial);
  if (descripcion) {
    resultado.descripcion = mayuscula(descripcion).slice(0, 200);
    resultado.entendido.unshift(`Activo: ${resultado.descripcion}`);
  }
  if (resultado.descripcion === undefined && resultado.tipo === undefined) {
    resultado.faltantes.push("qué activo es");
  }

  return resultado;
}
