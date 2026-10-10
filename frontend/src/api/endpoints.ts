/**
 * El único lugar con rutas de la API. La dirección base sale del .env
 * (VITE_API_BASE_URL) y se aplica en api/client.ts; aquí solo van las rutas.
 */

type Id = number | string;

export const ENDPOINTS = {
  salud: "/salud/",
  auth: {
    login: "/auth/login/",
    refresh: "/auth/refresh/",
    logout: "/auth/logout/",
    me: "/auth/me/",
    cambiarPassword: "/auth/cambiar-password/",
  },
  usuarios: {
    lista: "/usuarios/",
    detalle: (id: Id) => `/usuarios/${id}/`,
    activar: (id: Id) => `/usuarios/${id}/activar/`,
    desactivar: (id: Id) => `/usuarios/${id}/desactivar/`,
    restablecerPassword: (id: Id) => `/usuarios/${id}/restablecer-password/`,
    opciones: "/usuarios/opciones/",
  },
  elementos: {
    lista: "/elementos/",
    detalle: (id: Id) => `/elementos/${id}/`,
  },
  software: {
    lista: "/software/",
    detalle: (id: Id) => `/software/${id}/`,
  },
  laboratorios: {
    lista: "/laboratorios/",
    detalle: (id: Id) => `/laboratorios/${id}/`,
    distribucion: (id: Id) => `/laboratorios/${id}/distribucion/`,
    software: (id: Id) => `/laboratorios/${id}/software/`,
  },
  credenciales: {
    lista: "/credenciales/",
    detalle: (id: Id) => `/credenciales/${id}/`,
    revelar: (id: Id) => `/credenciales/${id}/revelar/`,
  },
  configuracion: "/configuracion/",
  periodos: {
    lista: "/periodos/",
    detalle: (id: Id) => `/periodos/${id}/`,
    clonarHorarios: (id: Id) => `/periodos/${id}/clonar-horarios/`,
  },
  docentes: {
    lista: "/docentes/",
    detalle: (id: Id) => `/docentes/${id}/`,
  },
  materias: {
    lista: "/materias/",
    detalle: (id: Id) => `/materias/${id}/`,
  },
  horarios: {
    lista: "/horarios/",
    lote: "/horarios/lote/",
    loteEditar: "/horarios/lote/editar/",
    detalle: (id: Id) => `/horarios/${id}/`,
    suspender: (id: Id) => `/horarios/${id}/suspender/`,
    reanudar: (id: Id) => `/horarios/${id}/reanudar/`,
  },
  reservas: {
    lista: "/reservas/",
    detalle: (id: Id) => `/reservas/${id}/`,
    cancelar: (id: Id) => `/reservas/${id}/cancelar/`,
    aprobar: (id: Id) => `/reservas/${id}/aprobar/`,
  },
  agenda: "/agenda/",
  disponibilidad: "/disponibilidad/",
  objetosPerdidos: {
    lista: "/objetos-perdidos/",
    detalle: (id: Id) => `/objetos-perdidos/${id}/`,
    entregar: (id: Id) => `/objetos-perdidos/${id}/entregar/`,
    fotoEntrega: (id: Id, nombre: string) => `/objetos-perdidos/${id}/entrega/${nombre}/`,
    anular: (id: Id) => `/objetos-perdidos/${id}/anular/`,
  },
  notificaciones: {
    lista: "/notificaciones/",
    resumen: "/notificaciones/resumen/",
    leer: (id: Id) => `/notificaciones/${id}/leer/`,
    leerTodas: "/notificaciones/leer-todas/",
  },
  avisos: {
    aula: "/avisos/aula/",
  },
  preferencias: {
    opciones: "/preferencias/opciones/",
    opcion: (id: Id) => `/preferencias/opciones/${id}/`,
    mias: "/preferencias/mias/",
    docentes: "/preferencias/docentes/",
    docente: (id: Id) => `/preferencias/docentes/${id}/`,
  },
  asistencia: {
    lista: "/asistencia/",
    detalle: (id: Id) => `/asistencia/${id}/`,
    tomar: (id: Id) => `/asistencia/${id}/tomar/`,
    resolver: (id: Id) => `/asistencia/${id}/resolver/`,
    cancelar: (id: Id) => `/asistencia/${id}/cancelar/`,
  },
  bitacora: {
    lista: "/bitacora/",
    detalle: (id: Id) => `/bitacora/${id}/`,
  },
  revisiones: {
    lista: "/revisiones/",
    detalle: (id: Id) => `/revisiones/${id}/`,
    realizar: (id: Id) => `/revisiones/${id}/realizar/`,
  },
  tareas: {
    lista: "/tareas/",
    detalle: (id: Id) => `/tareas/${id}/`,
    estado: (id: Id) => `/tareas/${id}/estado/`,
    avances: (id: Id) => `/tareas/${id}/avances/`,
  },
} as const;

/** Rutas de WebSocket (se usarán en la fase de notificaciones), sobre VITE_WS_BASE_URL. */
export const WS = {
  notificaciones: "/notificaciones/",
  tablero: "/tablero/",
  agenda: "/agenda/",
} as const;
