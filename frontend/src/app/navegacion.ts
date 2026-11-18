import type { FluentIcon } from "@fluentui/react-icons";

import {
  IconoAsistencia,
  IconoBitacora,
  IconoElementos,
  IconoHorarios,
  IconoInventario,
  IconoLaboratorios,
  IconoMarcaciones,
  IconoObjetos,
  IconoPizarra,
  IconoPreferencias,
  IconoReportes,
  IconoReservas,
  IconoRespaldos,
  IconoRevisiones,
  IconoTareas,
  IconoUsuarios,
} from "../components/iconos/iconos";

export interface ItemNavegacion {
  ruta: string;
  etiqueta: string;
  icono: FluentIcon;
  permiso: string;
  /** Palabras extra para la búsqueda rápida (Ctrl+K). */
  claves?: string;
}

export interface GrupoNavegacion {
  titulo: string;
  items: ItemNavegacion[];
}

export const NAVEGACION: GrupoNavegacion[] = [
  {
    titulo: "Operación",
    items: [
      { ruta: "/pizarra", etiqueta: "Pizarra", icono: IconoPizarra, permiso: "pizarra.ver", claves: "dashboard calendario hoy" },
      { ruta: "/tareas", etiqueta: "Tareas", icono: IconoTareas, permiso: "tareas.ver", claves: "kanban pendientes progreso pizarrón" },
      { ruta: "/reservas", etiqueta: "Reservas", icono: IconoReservas, permiso: "reservas.ver", claves: "eventos cursos" },
      {
        ruta: "/asistencia",
        etiqueta: "Asistencia técnica",
        icono: IconoAsistencia,
        permiso: "asistencia.ver",
        claves: "ayuda soporte apoyo tecnica auxiliares",
      },
      {
        ruta: "/objetos-perdidos",
        etiqueta: "Objetos perdidos",
        icono: IconoObjetos,
        permiso: "objetos.ver",
        claves: "hallazgos custodia",
      },
    ],
  },
  {
    titulo: "Planificación",
    items: [
      { ruta: "/horarios", etiqueta: "Horarios", icono: IconoHorarios, permiso: "horarios.ver", claves: "clases materias periodos" },
      // Misma pantalla con dos nombres: se muestra solo el primero que el rol puede ver.
      {
        ruta: "/preferencias",
        etiqueta: "Preferencias docentes",
        icono: IconoPreferencias,
        permiso: "preferencias.ver",
        claves: "docente pizarra estudiantes",
      },
      {
        ruta: "/preferencias",
        etiqueta: "Mis preferencias",
        icono: IconoPreferencias,
        permiso: "preferencias.propias",
        claves: "docente pizarra estudiantes",
      },
    ],
  },
  {
    titulo: "Recursos",
    items: [
      { ruta: "/laboratorios", etiqueta: "Laboratorios", icono: IconoLaboratorios, permiso: "laboratorios.ver", claves: "salas grilla distribución" },
      { ruta: "/bitacora", etiqueta: "Bitácora", icono: IconoBitacora, permiso: "bitacora.ver", claves: "historial mantenimiento instalación" },
      {
        ruta: "/revisiones",
        etiqueta: "Revisiones",
        icono: IconoRevisiones,
        permiso: "revisiones.ver",
        claves: "periódicas programadas mantenimiento",
      },
      { ruta: "/elementos", etiqueta: "Elementos", icono: IconoElementos, permiso: "elementos.catalogo", claves: "pc proyector íconos" },
      {
        ruta: "/inventario",
        etiqueta: "Inventario",
        icono: IconoInventario,
        permiso: "inventario.ver",
        claves: "activos traslados bajas verificación sillas mesas",
      },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { ruta: "/usuarios", etiqueta: "Usuarios", icono: IconoUsuarios, permiso: "usuarios.gestionar", claves: "cuentas roles" },
      {
        ruta: "/control-asistencia",
        etiqueta: "Control de asistencia",
        icono: IconoMarcaciones,
        permiso: "marcaciones.gestionar",
        claves: "marcaciones entrada salida gps huella auxiliares horas lugares horarios turnos",
      },
      {
        ruta: "/respaldos",
        etiqueta: "Respaldos",
        icono: IconoRespaldos,
        permiso: "respaldos.ver",
        claves: "backup copia seguridad base datos pg_dump",
      },
    ],
  },
  {
    titulo: "Análisis",
    items: [
      {
        ruta: "/reportes",
        etiqueta: "Reportes",
        icono: IconoReportes,
        permiso: "reportes.ver",
        claves: "bi tablero dashboard gráficos estadísticas exportar pdf excel word csv constructor",
      },
    ],
  },
];

/** Lo que el rol puede ver. Si dos entradas llevan a la misma ruta, queda solo la primera. */
export function navegacionPermitida(puede: (permiso: string) => boolean): GrupoNavegacion[] {
  const rutas = new Set<string>();
  return NAVEGACION.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (!puede(i.permiso) || rutas.has(i.ruta)) return false;
      rutas.add(i.ruta);
      return true;
    }),
  })).filter((g) => g.items.length > 0);
}

export function primeraRuta(puede: (permiso: string) => boolean): string {
  return navegacionPermitida(puede)[0]?.items[0]?.ruta ?? "/sin-acceso";
}
