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
  /** Mapa pintado estilo OrganiLab (opcional). */
  mapa: MapaBitacora | null;
  creado_en: string;
  actualizado_en: string;
}

/** Un elemento del laboratorio tal como estaba cuando se hizo el mapa (es una copia). */
export interface CeldaMapa {
  fila: number;
  columna: number;
  tipo: number | null;
  tipo_nombre: string;
  icono: string;
  color: string;
  etiqueta: string;
  ip: string;
  mac: string;
  codigo_activo: string;
  especificaciones: string;
  descripcion: string;
  estado: string;
}

/** Un "color" con nombre para pintar: p. ej. Funciona (verde) o Con falla (rojo). */
export interface AtributoMapa {
  nombre: string;
  color: string;
}

/** Casilla pintada: `atributo` es la posición en la lista de atributos. */
export interface MarcaMapa {
  fila: number;
  columna: number;
  atributo: number;
}

/** Solo el rectángulo que usan los elementos; `origen` dice dónde empieza en la grilla. */
export interface MapaBitacora {
  version: number;
  filas: number;
  columnas: number;
  origen: { fila: number; columna: number };
  celdas: CeldaMapa[];
  atributos: AtributoMapa[];
  marcas: MarcaMapa[];
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
  /** Id de la verificación de inventario que creó la tarea (su avance se calcula solo). */
  verificacion: number | null;
  total_avances: number;
  ultimo_avance: AvanceTarea | null;
}

export interface TareaDetalle extends Tarea {
  /** Del más viejo al más nuevo. */
  avances: AvanceTarea[];
}

// ── Inventario de activos ──
export interface TipoActivo {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
  /** Sin contar los dados de baja. */
  total_activos: number;
}

export type TipoLugar = "laboratorio" | "deposito" | "otro";

export interface Lugar {
  id: number;
  nombre: string;
  tipo: TipoLugar;
  tipo_nombre: string;
  /** Si es el lugar de un laboratorio (se crea y se renombra solo). */
  laboratorio: number | null;
  descripcion: string;
  activo: boolean;
  total_activos: number;
}

export type EstadoActivo = "operativo" | "danado" | "en_reparacion" | "baja";
export type TipoMovimiento = "alta" | "traslado" | "estado" | "baja";

export interface CambioDato {
  campo: string;
  antes: string;
  despues: string;
}

/** Una corrección: quién cambió qué dato del activo (o de uno de sus movimientos). */
export interface CambioInventario {
  id: number;
  movimiento: number | null;
  usuario_nombre: string;
  cambios: CambioDato[];
  creado_en: string;
}

export interface MovimientoActivo {
  id: number;
  activo: number;
  activo_codigo: string;
  activo_descripcion: string;
  tipo: TipoMovimiento;
  tipo_nombre: string;
  fecha: string;
  lugar_origen: number | null;
  lugar_origen_nombre: string;
  lugar_destino: number | null;
  lugar_destino_nombre: string;
  estado_anterior: EstadoActivo | "";
  estado_anterior_nombre: string;
  estado_nuevo: EstadoActivo | "";
  estado_nuevo_nombre: string;
  motivo: string;
  documento: string;
  registrado_por: string;
  corregido: boolean;
  creado_en: string;
}

export interface Activo {
  id: number;
  codigo: string;
  descripcion: string;
  tipo: number;
  tipo_nombre: string;
  marca: string;
  modelo: string;
  serie: string;
  fecha_adquisicion: string | null;
  estado: EstadoActivo;
  estado_nombre: string;
  lugar: number;
  lugar_nombre: string;
  /** Responsable (custodio) del bien, como en el acta de patrimonio. */
  responsable: string;
  observaciones: string;
  creado_en: string;
  actualizado_en: string;
}

export interface ActivoDetalle extends Activo {
  creado_por_nombre: string;
  /** Casillas de laboratorios que llevan este mismo código de activo. */
  en_mapa: { laboratorio: number; laboratorio_codigo: string; etiqueta: string }[];
  /** Del más nuevo al más viejo. */
  movimientos: MovimientoActivo[];
  cambios: CambioInventario[];
}

export type EstadoVerificacion = "abierta" | "cerrada" | "cancelada";
export type ResultadoVerificacion = "pendiente" | "esta" | "falta" | "otro_lugar" | "danado";

export interface ConteoVerificacion {
  total: number;
  revisados: number;
  pendientes: number;
  esta: number;
  falta: number;
  otro_lugar: number;
  danado: number;
}

export interface ItemVerificacion {
  id: number;
  activo: number;
  codigo: string;
  descripcion: string;
  tipo_nombre: string;
  lugar: number | null;
  lugar_nombre: string;
  resultado: ResultadoVerificacion;
  resultado_nombre: string;
  lugar_encontrado: number | null;
  lugar_encontrado_nombre: string;
  nota: string;
  verificado_por_nombre: string;
  verificado_en: string | null;
}

export interface Verificacion {
  id: number;
  titulo: string;
  instrucciones: string;
  /** Qué se pidió verificar, en palabras: "Todos los activos", "Lugar: LAB-41"… */
  alcance: string;
  estado: EstadoVerificacion;
  estado_nombre: string;
  responsables: number[];
  responsables_detalle: { id: number; nombre_completo: string }[];
  fecha_limite: string | null;
  tarea: number | null;
  conclusion: string;
  creado_por_nombre: string;
  creado_en: string;
  cerrada_por_nombre: string;
  cerrada_en: string | null;
  conteo: ConteoVerificacion;
  /** Porcentaje de activos ya revisados. */
  progreso: number;
  /** Si quien tiene la sesión puede marcar los activos. */
  puede_marcar: boolean;
}

export interface VerificacionDetalle extends Verificacion {
  items: ItemVerificacion[];
}

// ── Control de asistencia de auxiliares ──
export interface LugarAsistencia {
  id: number;
  nombre: string;
  referencia: string;
  latitud: number;
  longitud: number;
  /** Radio (en metros) dentro del cual vale la marcación. */
  radio_m: number;
  /** El lugar de quienes no tienen uno propio. */
  predeterminado: boolean;
  activo: boolean;
  /** Cuántos auxiliares lo tienen como lugar propio. */
  asignados: number;
}

export type SituacionAuxiliar = "sin_marcar" | "presente" | "salio";

export interface AuxiliarAsistencia {
  id: number;
  nombre_completo: string;
  email: string;
  /** Su lugar propio; null = usa el predeterminado. */
  lugar: number | null;
  /** Nombre del lugar donde marca (el propio o el predeterminado); vacío si no hay ninguno. */
  lugar_nombre: string;
  lugar_efectivo: number | null;
  usa_predeterminado: boolean;
  /** Su horario de trabajo propio; null = sin horario. */
  horario: number | null;
  horario_nombre: string;
  situacion: SituacionAuxiliar;
  entrada_en: string | null;
  salida_en: string | null;
  minutos_hoy: number;
}

/** Un tramo de un día dentro de un horario de trabajo. Hora en "HH:MM" o "HH:MM:SS". */
export interface BloqueHorario {
  /** 0 = lunes … 6 = domingo. */
  dia: number;
  inicio: string;
  fin: string;
}

export interface HorarioTrabajo {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
  bloques: BloqueHorario[];
  /** Cuántos auxiliares lo tienen asignado. */
  asignados: number;
}

export interface Marcacion {
  id: number;
  usuario: number;
  usuario_nombre: string;
  lugar: number;
  lugar_nombre: string;
  lugar_latitud: number;
  lugar_longitud: number;
  radio_m: number;
  fecha: string;
  entrada_en: string;
  entrada_latitud: number;
  entrada_longitud: number;
  entrada_precision_m: number | null;
  entrada_distancia_m: number;
  salida_en: string | null;
  salida_latitud: number | null;
  salida_longitud: number | null;
  salida_precision_m: number | null;
  salida_distancia_m: number | null;
  /** La salida la puso el Admin (sin GPS ni huella). */
  salida_manual: boolean;
  nota: string;
  /** Turno esperado ese día ("HH:MM:SS") o null si marcó sin horario. */
  turno_inicio: string | null;
  turno_fin: string | null;
  /** Minutos de retraso en la entrada (0 = puntual). */
  retraso_min: number;
  /** Minutos que salió antes del fin del turno. */
  salida_temprana_min: number;
  abierta: boolean;
  minutos: number | null;
}

export interface ResumenAsistencia {
  usuario: number;
  usuario_nombre: string;
  dias: number;
  marcaciones: number;
  minutos: number;
  horas: string;
  sin_salida: number;
  salidas_manuales: number;
  retrasos: number;
  retraso_total_min: number;
  retraso_max_min: number;
  retraso_promedio_min: number;
}

export interface Respaldo {
  id: number;
  archivo: string;
  tamano_bytes: number;
  /** Tamaño legible, p. ej. "2.4 MB". */
  tamano: string;
  origen: "manual" | "automatico";
  base_datos: string;
  nota: string;
  creado_en: string;
  creado_por_nombre: string;
}

export interface EstadoRespaldos {
  /** Si el servidor puede crear respaldos (si tiene pg_dump). */
  pg_dump_disponible: boolean;
  maximos: number;
  total: number;
}
