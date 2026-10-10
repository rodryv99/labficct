import type {
  CategoriaAsistencia,
  CategoriaElemento,
  CategoriaObjeto,
  EstadoAsistencia,
  EstadoElemento,
  EstadoLaboratorio,
  EstadoObjeto,
  EstadoReserva,
  EstadoTarea,
  IconoElemento,
  PrioridadTarea,
  Rol,
  TipoBitacora,
  UnidadFrecuencia,
} from "../api/tipos";

export interface Opcion<T extends string | number = string> {
  valor: T;
  etiqueta: string;
}

export const ROLES: Opcion<Rol>[] = [
  { valor: "superadmin", etiqueta: "Superadmin" },
  { valor: "admin", etiqueta: "Admin (jefe de laboratorio)" },
  { valor: "auxiliar", etiqueta: "Auxiliar" },
  { valor: "docente", etiqueta: "Docente" },
  { valor: "administrativo", etiqueta: "Administrativo" },
];

export const CATEGORIAS_ELEMENTO: Opcion<CategoriaElemento>[] = [
  { valor: "equipo", etiqueta: "Equipo de cómputo" },
  { valor: "audiovisual", etiqueta: "Audiovisual" },
  { valor: "red", etiqueta: "Red y conectividad" },
  { valor: "mobiliario", etiqueta: "Mobiliario" },
  { valor: "infraestructura", etiqueta: "Infraestructura" },
  { valor: "otro", etiqueta: "Otro" },
];

export const ICONOS_ELEMENTO: Opcion<IconoElemento>[] = [
  { valor: "pc", etiqueta: "Computadora" },
  { valor: "laptop", etiqueta: "Laptop" },
  { valor: "proyector", etiqueta: "Proyector" },
  { valor: "pantalla", etiqueta: "Pantalla" },
  { valor: "pizarra", etiqueta: "Pizarra" },
  { valor: "televisor", etiqueta: "Televisor" },
  { valor: "impresora", etiqueta: "Impresora" },
  { valor: "parlante", etiqueta: "Parlante" },
  { valor: "camara", etiqueta: "Cámara" },
  { valor: "router", etiqueta: "Router o switch" },
  { valor: "servidor", etiqueta: "Servidor" },
  { valor: "aire", etiqueta: "Aire acondicionado" },
  { valor: "enchufe", etiqueta: "Toma de corriente" },
  { valor: "puerta", etiqueta: "Puerta" },
  { valor: "ventana", etiqueta: "Ventana" },
  { valor: "mesa", etiqueta: "Mesa o escritorio" },
  { valor: "silla", etiqueta: "Silla" },
  { valor: "generico", etiqueta: "Genérico" },
];

/** Colores sugeridos para los elementos: sobrios y distinguibles entre sí. */
export const COLORES_ELEMENTO = [
  "#034481",
  "#0E7490",
  "#2E7D5B",
  "#7A3E9D",
  "#B45309",
  "#8A5A2B",
  "#BE123C",
  "#2563EB",
  "#4B5563",
  "#0F766E",
];

export const ESTADOS_LABORATORIO: Opcion<EstadoLaboratorio>[] = [
  { valor: "operativo", etiqueta: "Operativo" },
  { valor: "mantenimiento", etiqueta: "En mantenimiento" },
  { valor: "cerrado", etiqueta: "Cerrado" },
];

export const ESTADOS_ELEMENTO: Opcion<EstadoElemento>[] = [
  { valor: "operativo", etiqueta: "Operativo" },
  { valor: "con_falla", etiqueta: "Con falla" },
  { valor: "mantenimiento", etiqueta: "En mantenimiento" },
  { valor: "baja", etiqueta: "De baja" },
];

export const DIAS: Opcion<number>[] = [
  { valor: 1, etiqueta: "Lunes" },
  { valor: 2, etiqueta: "Martes" },
  { valor: 3, etiqueta: "Miércoles" },
  { valor: 4, etiqueta: "Jueves" },
  { valor: 5, etiqueta: "Viernes" },
  { valor: 6, etiqueta: "Sábado" },
  { valor: 7, etiqueta: "Domingo" },
];

/** Franjas habituales para llenar un horario con un clic. */
export const FRANJAS_COMUNES: [string, string][] = [
  ["07:00", "08:30"],
  ["08:30", "10:00"],
  ["10:00", "11:30"],
  ["11:30", "13:00"],
  ["14:00", "15:30"],
  ["15:30", "17:00"],
  ["18:15", "19:45"],
  ["19:45", "21:15"],
];

export const ESTADOS_RESERVA: Opcion<EstadoReserva>[] = [
  { valor: "confirmada", etiqueta: "Confirmada" },
  { valor: "pendiente", etiqueta: "Por aprobar" },
  { valor: "cancelada", etiqueta: "Cancelada" },
];

export const CATEGORIAS_OBJETO: Opcion<CategoriaObjeto>[] = [
  { valor: "electronico", etiqueta: "Electrónico" },
  { valor: "documento", etiqueta: "Documento o carnet" },
  { valor: "llaves", etiqueta: "Llaves" },
  { valor: "ropa", etiqueta: "Ropa" },
  { valor: "accesorio", etiqueta: "Accesorio" },
  { valor: "utiles", etiqueta: "Útiles" },
  { valor: "otro", etiqueta: "Otro" },
];

export const ESTADOS_OBJETO: Opcion<EstadoObjeto>[] = [
  { valor: "en_custodia", etiqueta: "En custodia" },
  { valor: "entregado", etiqueta: "Entregado" },
  { valor: "anulado", etiqueta: "Anulado" },
];

export const CATEGORIAS_ASISTENCIA: Opcion<CategoriaAsistencia>[] = [
  { valor: "equipo", etiqueta: "Computadora o equipo" },
  { valor: "proyector", etiqueta: "Proyector o audio" },
  { valor: "red", etiqueta: "Internet o red" },
  { valor: "software", etiqueta: "Programas" },
  { valor: "acceso", etiqueta: "Abrir o cerrar el aula" },
  { valor: "otro", etiqueta: "Otro" },
];

export const ESTADOS_ASISTENCIA: Opcion<EstadoAsistencia>[] = [
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "en_curso", etiqueta: "En camino" },
  { valor: "resuelta", etiqueta: "Resuelta" },
  { valor: "cancelada", etiqueta: "Cancelada" },
];

export const TIPOS_BITACORA: Opcion<TipoBitacora>[] = [
  { valor: "instalacion", etiqueta: "Instalación de programas" },
  { valor: "revision", etiqueta: "Revisión de equipos" },
  { valor: "mantenimiento", etiqueta: "Mantenimiento" },
  { valor: "incidencia", etiqueta: "Falla o incidencia" },
  { valor: "limpieza", etiqueta: "Limpieza" },
  { valor: "otro", etiqueta: "Otro" },
];

export const UNIDADES_FRECUENCIA: Opcion<UnidadFrecuencia>[] = [
  { valor: "dias", etiqueta: "días" },
  { valor: "semanas", etiqueta: "semanas" },
  { valor: "meses", etiqueta: "meses" },
];

/** En el orden de las columnas del pizarrón. */
export const ESTADOS_TAREA: Opcion<EstadoTarea>[] = [
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "en_progreso", etiqueta: "En progreso" },
  { valor: "hecha", etiqueta: "Hecha" },
];

export const PRIORIDADES_TAREA: Opcion<PrioridadTarea>[] = [
  { valor: "alta", etiqueta: "Alta" },
  { valor: "normal", etiqueta: "Normal" },
  { valor: "baja", etiqueta: "Baja" },
];

export function etiquetaDe<T extends string | number>(opciones: Opcion<T>[], valor: T): string {
  return opciones.find((o) => o.valor === valor)?.etiqueta ?? String(valor);
}
