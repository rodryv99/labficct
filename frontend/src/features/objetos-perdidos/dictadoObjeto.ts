/**
 * Entiende una frase dictada (o escrita) y saca los datos de un objeto perdido.
 *
 * Ej.: "Un celular negro con funda roja, encontrado en el laboratorio 41 hoy, lo
 * entregó Juan". Nunca guarda nada: solo propone valores que la persona revisa.
 */
import type { CategoriaObjeto } from "../../api/tipos";
import {
  type LabCtx,
  Lienzo,
  type ResultadoBase,
  aISO,
  buscarAulas,
  buscarDia,
  buscarEtiqueta,
  limpiar,
  mayuscula,
  numerosEnCifras,
  plano,
  textosConClave,
} from "../dictado/nucleo";

export interface ContextoObjeto {
  hoy: Date;
  laboratorios: LabCtx[];
}

export interface ResultadoObjeto extends ResultadoBase {
  descripcion?: string;
  caracteristicas?: string;
  categoria?: CategoriaObjeto;
  encontrado_por?: string;
  fecha_hallazgo?: string;
  laboratorio?: number;
  lugar?: string;
}

const CATEGORIAS: { valor: CategoriaObjeto; sinonimos: string[] }[] = [
  {
    valor: "electronico",
    sinonimos: ["electronico", "celular", "telefono", "laptop", "computadora", "cargador", "audifonos", "auriculares", "mouse", "tablet", "dispositivo", "usb", "memoria"],
  },
  {
    valor: "documento",
    sinonimos: ["documento", "documentos", "carnet", "ci", "cedula", "libreta", "credencial", "certificado", "licencia"],
  },
  { valor: "llaves", sinonimos: ["llaves", "llave", "llavero"] },
  {
    valor: "ropa",
    sinonimos: ["ropa", "chamarra", "casaca", "chaqueta", "polera", "camisa", "gorra", "bufanda", "prenda", "chompa"],
  },
  {
    valor: "accesorio",
    sinonimos: ["accesorio", "reloj", "lentes", "gafas", "anillo", "pulsera", "mochila", "billetera", "cartera", "paraguas"],
  },
  {
    valor: "utiles",
    sinonimos: ["utiles", "cuaderno", "libro", "lapiz", "boligrafo", "calculadora", "estuche", "folder"],
  },
  { valor: "otro", sinonimos: ["otro", "otra cosa"] },
];

const NOMBRES_DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function interpretarDictadoObjeto(dictado: string, contexto: ContextoObjeto): ResultadoObjeto {
  const resultado: ResultadoObjeto = { entendido: [], faltantes: [] };
  const original = numerosEnCifras(dictado.replace(/\s+/g, " ").trim());
  if (!original) {
    resultado.faltantes = ["qué objeto es"];
    return resultado;
  }
  const L = new Lienzo(plano(original));

  // Día del hallazgo.
  const dia = buscarDia(L.texto, contexto.hoy);
  if (dia) {
    resultado.fecha_hallazgo = aISO(dia.fecha);
    L.ocupar(...dia.tramos);
    const f = dia.fecha;
    resultado.entendido.push(`Encontrado el: ${NOMBRES_DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`);
  }

  // Laboratorio.
  const aulas = buscarAulas(L.texto, contexto.laboratorios);
  if (aulas.ids.length) {
    resultado.laboratorio = aulas.ids[0];
    L.ocupar(...aulas.tramos);
    const codigo = contexto.laboratorios.find((l) => l.id === aulas.ids[0])?.codigo ?? "";
    resultado.entendido.push(`Laboratorio: ${codigo}`);
  }

  // Categoría (por el tipo de objeto que se nombra).
  const cat = buscarEtiqueta(L.texto, CATEGORIAS);
  if (cat) {
    resultado.categoria = cat.valor;
    // No se tapa: la palabra ("celular") suele ser también la descripción del objeto.
    resultado.entendido.push(`Categoría: ${cat.valor}`);
  }

  // Textos con palabra clave.
  const libres = textosConClave(L.texto, original, L, [
    ["caracteristicas", /\b(?:caracteristicas|color|marca|señas|senas|detalles?)\s+(?:es\s+|son\s+)?/],
    ["encontrado_por", /\b(?:encontrad[oa]\s+por|lo\s+encontro|la\s+encontro|entregad[oa]\s+por|lo\s+entrego|la\s+entrego|lo\s+trajo|la\s+trajo)\s+/],
    ["lugar", /\b(?:en\s+el\s+lugar|lugar|estaba\s+en|cerca\s+de)\s+/],
  ]);
  if (libres.caracteristicas) resultado.caracteristicas = mayuscula(libres.caracteristicas).slice(0, 500);
  if (libres.encontrado_por) resultado.encontrado_por = mayuscula(libres.encontrado_por).slice(0, 150);
  if (libres.lugar) resultado.lugar = mayuscula(libres.lugar).slice(0, 150);

  // Descripción: lo dicho al inicio (qué es el objeto).
  let inicial = original.slice(0, L.primera(original.length));
  const entrada =
    /^\s*(?:por\s+favor\s+)?(?:(?:quiero|quisiera|necesito|deseo)\s+)?(?:(?:registrar|anotar|agregar|guardar)\s+)*(?:(?:un|una|el|la|los|las)\s+)?(?:objeto\s+perdido|objeto)?\s*(?:perdid[oa]s?|encontrad[oa]s?)?\s*(?:es\s+|:\s*)?/.exec(
      plano(inicial),
    );
  if (entrada && entrada[0].trim()) inicial = inicial.slice(entrada[0].length);
  const descripcion = limpiar(inicial);
  if (descripcion) {
    resultado.descripcion = mayuscula(descripcion).slice(0, 200);
    resultado.entendido.unshift(`Objeto: ${resultado.descripcion}`);
  } else {
    resultado.faltantes.push("qué objeto es");
  }

  return resultado;
}
