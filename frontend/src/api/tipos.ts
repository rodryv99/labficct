/**
 * Tipos de los datos que devuelve la API. Reflejan los serializers de Django.
 * Cuando el backend esté corriendo, `npm run gen:api` genera schema.d.ts
 * desde OpenAPI para comparar y detectar diferencias.
 */

export type Rol = "superadmin" | "admin" | "auxiliar" | "docente" | "administrativo";

export interface Paginado<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ── Usuarios ──
export interface UsuarioMe {
  id: number;
  email: string;
  codigo: string | null;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  rol: Rol;
  rol_nombre: string;
  telefono: string;
  permisos: string[];
}

export interface Usuario {
  id: number;
  email: string;
  codigo: string | null;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  rol: Rol;
  rol_nombre: string;
  telefono: string;
  is_active: boolean;
  last_login: string | null;
  creado_en: string;
  /** Solo docentes: la ficha a la que está unido (sus clases salen de ahí). */
  ficha_docente: { id: number; nombre_completo: string } | null;
}

export interface UsuarioOpcion {
  id: number;
  nombre_completo: string;
  email: string;
  rol: Rol;
}

// ── Elementos y laboratorios ──
export type IconoElemento =
  | "pc"
  | "laptop"
  | "proyector"
  | "pantalla"
  | "pizarra"
  | "televisor"
  | "impresora"
  | "parlante"
  | "camara"
  | "router"
  | "servidor"
  | "aire"
  | "enchufe"
  | "puerta"
  | "ventana"
  | "mesa"
  | "silla"
  | "generico";

export type CategoriaElemento = "equipo" | "audiovisual" | "red" | "mobiliario" | "infraestructura" | "otro";

export interface TipoElemento {
  id: number;
  nombre: string;
  categoria: CategoriaElemento;
  categoria_nombre: string;
  icono: IconoElemento;
  imagen: string | null;
  color: string;
  prefijo_etiqueta: string;
  descripcion: string;
  activo: boolean;
  en_uso: number;
}

export interface Software {
  id: number;
  nombre: string;
  version: string;
  descripcion: string;
  nombre_completo: string;
  total_laboratorios: number;
}

export type EstadoLaboratorio = "operativo" | "mantenimiento" | "cerrado";

export interface Laboratorio {
  id: number;
  codigo: string;
  nombre: string;
  ubicacion: string;
  capacidad: number;
  filas: number;
  columnas: number;
  estado: EstadoLaboratorio;
  estado_nombre: string;
  notas: string;
  software: number[];
  software_detalle: Software[];
  activo: boolean;
  total_elementos: number;
  /** Casillas ocupadas como [fila, columna, id del tipo]. */
  mapa: [number, number, number][];
}

export type EstadoElemento = "operativo" | "con_falla" | "mantenimiento" | "baja";

export interface Celda {
  id?: number | null;
  fila: number;
  columna: number;
  tipo: number;
  etiqueta: string;
  ip: string | null;
  mac: string;
  codigo_activo: string;
  especificaciones: string;
  descripcion: string;
  estado: EstadoElemento;
}

export interface Distribucion {
  filas: number;
  columnas: number;
  celdas: Celda[];
}

export interface Credencial {
  id: number;
  laboratorio: number;
  descripcion: string;
  usuario: string;
  tiene_password: boolean;
  notas: string;
  ultima_revelacion: { usuario: string; fecha: string } | null;
  actualizado_en: string;
}

// ── Planificación ──
export interface Periodo {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  vigente: boolean;
  total_horarios: number;
}

/** Quien dicta clases. Puede no tener usuario todavía. */
export interface Docente {
  id: number;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  email: string;
  telefono: string;
  activo: boolean;
  tiene_usuario: boolean;
  usuario_email: string;
  total_horarios: number;
}

export interface ResultadoClonar {
  creados: number;
  omitidos: string[];
}

/** Datos del .env del backend que la web necesita. */
export interface Configuracion {
  atencion_inicio: string;
  atencion_fin: string;
  franjas: [string, string][];
}

export interface Materia {
  id: number;
  sigla: string;
  nombre: string;
}

export interface Horario {
  id: number;
  periodo: number;
  periodo_nombre: string;
  laboratorio: number;
  laboratorio_codigo: string;
  laboratorio_nombre: string;
  materia: number;
  materia_sigla: string;
  materia_nombre: string;
  grupo: string;
  docente: number | null;
  docente_nombre: string;
  dia_semana: number;
  dia_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  observaciones: string;
  activo: boolean;
}

export interface Bloque {
  id?: number;
  laboratorio: number;
  laboratorio_codigo?: string;
  laboratorio_nombre?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  inicio?: string;
  fin?: string;
}

export type EstadoReserva = "pendiente" | "confirmada" | "cancelada";

export interface Reserva {
  id: number;
  titulo: string;
  descripcion: string;
  solicitante: number | null;
  solicitante_externo: string;
  solicitante_nombre: string;
  contacto: string;
  programas: number[];
  programas_detalle: Software[];
  requiere_apoyo: boolean;
  auxiliares_requeridos: number;
  auxiliares: number[];
  auxiliares_detalle: { id: number; nombre_completo: string }[];
  estado: EstadoReserva;
  estado_nombre: string;
  motivo_cancelacion: string;
  bloques: Bloque[];
  creado_por_nombre: string;
  creado_en: string;
  aprobada_por_nombre: string;
  aprobada_en: string | null;
  advertencias: string[];
  /** Solo si está por aprobar: con qué choca ahora. */
  choques: string[];
  /** Clases que se suspendieron porque la reserva se aprobó con prioridad. */
  clases_suspendidas: string[];
}

export interface EventoAgenda {
  id: string;
  tipo: "clase" | "reserva";
  titulo: string;
  detalle: string;
  responsable: string;
  laboratorio: number;
  laboratorio_codigo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: "programada" | "suspendida" | EstadoReserva;
  nota: string;
  horario_id: number | null;
  reserva_id: number | null;
  requiere_apoyo: boolean;
  programas: string[];
  /** Ficha del docente de la clase (o de quien reservó, si es docente). */
  docente_id: number | null;
  /** Frases listas para mostrar a los auxiliares; vacío si no marcó nada. */
  preferencias: string[];
}

export interface Disponibilidad {
  disponible: boolean;
  choques: string[];
  /** Choca con una clase u otra reserva: se puede guardar, pero queda por aprobar. */
  requiere_aprobacion: boolean;
}

// ── Objetos perdidos ──
export type CategoriaObjeto = "electronico" | "documento" | "llaves" | "ropa" | "accesorio" | "utiles" | "otro";
export type EstadoObjeto = "en_custodia" | "entregado" | "anulado";

export interface EventoObjeto {
  id: number;
  tipo: "registrado" | "editado" | "entregado" | "anulado";
  tipo_nombre: string;
  detalle: string;
  usuario_nombre: string;
  fecha: string;
}

export interface ObjetoPerdido {
  id: number;
  codigo: string;
  descripcion: string;
  categoria: CategoriaObjeto;
  categoria_nombre: string;
  caracteristicas: string;
  foto: string | null;
  laboratorio: number | null;
  laboratorio_codigo: string;
  lugar: string;
  fecha_hallazgo: string;
  encontrado_por: string;
  estado: EstadoObjeto;
  estado_nombre: string;
  entregado_a: string;
  entregado_ci: string;
  entregado_en: string | null;
  entregado_por_nombre: string;
  motivo_anulacion: string;
  registrado_por_nombre: string;
  creado_en: string;
  eventos: EventoObjeto[];
  /** Fotos de la entrega que existen. Se descargan con sesión, no tienen URL pública. */
  fotos_entrega: FotoEntrega[];
}

export type FotoEntrega = "ci-anverso" | "ci-reverso" | "persona";

// ── Notificaciones ──
export type TipoNotificacion =
  | "alistar"
  | "cerrar"
  | "asistencia"
  | "reserva"
  | "clase"
  | "revision"
  | "tarea"
  | "general";

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  tipo_nombre: string;
  titulo: string;
  /** Puede traer saltos de línea. */
  mensaje: string;
  /** Ruta de la web a la que lleva (p. ej. /tareas?id=9). Puede venir vacía. */
  enlace: string;
  datos: Record<string, unknown>;
  creado_en: string;
  leida: boolean;
  leida_en: string | null;
}

export interface ResumenNotificaciones {
  no_leidas: number;
  /** La no leída más reciente: si aumenta, llegó algo nuevo. */
  ultima_id: number | null;
}

// ── Preferencias de los docentes ──
export interface OpcionPreferencia {
  id: number;
  /** Lo que ve el docente. */
  pregunta: string;
  /** Lo que leen los auxiliares según la respuesta. */
  texto_si: string;
  texto_no: string;
  orden: number;
  activa: boolean;
}

/** {"<id de la opción>": true | false | null}; null o ausente = sin preferencia. */
export type ValoresPreferencias = Record<string, boolean | null>;

export interface Preferencias {
  docente: number;
  docente_nombre: string;
  tiene_usuario: boolean;
  valores: ValoresPreferencias;
  nota: string;
  resumen: string[];
  actualizado_en: string | null;
}

// ── Asistencia ──
export type CategoriaAsistencia = "equipo" | "proyector" | "red" | "software" | "acceso" | "otro";
export type EstadoAsistencia = "pendiente" | "en_curso" | "resuelta" | "cancelada";

export interface SolicitudAsistencia {
  id: number;
  solicitante: number;
  solicitante_nombre: string;
  solicitante_telefono: string;
  laboratorio: number | null;
  laboratorio_codigo: string;
  lugar: string;
  /** Laboratorio y/o lugar, listo para mostrar. */
  donde: string;
  categoria: CategoriaAsistencia;
  categoria_nombre: string;
  descripcion: string;
  urgente: boolean;
  estado: EstadoAsistencia;
  estado_nombre: string;
  atendida_por: number | null;
  atendida_por_nombre: string;
  atendida_en: string | null;
  cerrada_en: string | null;
  respuesta: string;
  creado_en: string;
}

// ── Bitácora y revisiones ──
export type TipoBitacora = "instalacion" | "revision" | "mantenimiento" | "incidencia" | "limpieza" | "otro";

export interface EntradaBitacora {
  id: number;
  laboratorio: number;
  laboratorio_codigo: string;
  tipo: TipoBitacora;
  tipo_nombre: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  elementos: string;
  revision: number | null;
  revision_titulo: string;
  autor: number | null;
  autor_nombre: string;
  /** Si quien tiene la sesión puede editarla o borrarla. */
  editable: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type UnidadFrecuencia = "dias" | "semanas" | "meses";
export type SituacionRevision = "vencida" | "hoy" | "pronto" | "al_dia";

export interface Revision {
  id: number;
  laboratorio: number;
  laboratorio_codigo: string;
  laboratorio_nombre: string;
  titulo: string;
  instrucciones: string;
  cada: number;
  unidad: UnidadFrecuencia;
  unidad_nombre: string;
  frecuencia: string;
  proxima_fecha: string;
  ultima_fecha: string | null;
  /** null = se avisa a todos los auxiliares. */
  responsable: number | null;
  responsable_nombre: string;
  activa: boolean;
  situacion: SituacionRevision;
  /** Tarea del pizarrón que sigue abierta para esta revisión. */
  tarea_abierta: number | null;
}

// ── Pizarrón de tareas ──
export type EstadoTarea = "pendiente" | "en_progreso" | "hecha";
export type PrioridadTarea = "baja" | "normal" | "alta";

export interface AvanceTarea {
  id: number;
  autor: number | null;
  autor_nombre: string;
  texto: string;
  progreso: number | null;
  /** Si estado_nuevo no está vacío, el avance registra un cambio de columna. */
  estado_anterior: EstadoTarea | "";
  estado_nuevo: EstadoTarea | "";
  estado_nuevo_nombre: string;
  creado_en: string;
}

export interface Tarea {
  id: number;
  titulo: string;
  descripcion: string;
  estado: EstadoTarea;
  estado_nombre: string;
  prioridad: PrioridadTarea;
  prioridad_nombre: string;
  laboratorio: number | null;
  laboratorio_codigo: string;
  responsables: number[];
  responsables_detalle: { id: number; nombre_completo: string }[];
  fecha_limite: string | null;
  vencida: boolean;
  progreso: number;
  creado_por: number | null;
  /** "Sistema" si la creó una revisión periódica. */
  creado_por_nombre: string;
  creado_en: string;
  actualizado_en: string;
  completada_en: string | null;
  completada_por_nombre: string;
  revision: number | null;
  revision_titulo: string;
  total_avances: number;
  ultimo_avance: AvanceTarea | null;
}

export interface TareaDetalle extends Tarea {
  /** Del más viejo al más nuevo. */
  avances: AvanceTarea[];
}
