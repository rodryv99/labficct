import { useCallback, useReducer } from "react";

import type { Celda, Distribucion, TipoElemento } from "../../../api/tipos";
import { clave } from "../../../components/grilla/GrillaLaboratorio";

export interface EstadoGrilla {
  filas: number;
  columnas: number;
  celdas: Record<string, Celda>;
}

export function desdeDistribucion(d: Distribucion): EstadoGrilla {
  const celdas: Record<string, Celda> = {};
  d.celdas.forEach((c) => {
    celdas[clave(c.fila, c.columna)] = c;
  });
  return { filas: d.filas, columnas: d.columnas, celdas };
}

export function aDistribucion(e: EstadoGrilla): Distribucion {
  return {
    filas: e.filas,
    columnas: e.columnas,
    celdas: Object.values(e.celdas).map((c) => ({ ...c, ip: c.ip?.trim() ? c.ip.trim() : null })),
  };
}

/** Firma estable del estado, para saber si hay cambios sin guardar. */
export function firma(e: EstadoGrilla): string {
  const celdas = Object.keys(e.celdas)
    .sort()
    .map((k) => {
      const c = e.celdas[k];
      return [k, c.id ?? "", c.tipo, c.etiqueta, c.ip ?? "", c.mac, c.codigo_activo, c.especificaciones, c.descripcion, c.estado];
    });
  return JSON.stringify([e.filas, e.columnas, celdas]);
}

export function nuevaCelda(fila: number, columna: number, tipo: number, etiqueta: string): Celda {
  return {
    id: null,
    fila,
    columna,
    tipo,
    etiqueta,
    ip: null,
    mac: "",
    codigo_activo: "",
    especificaciones: "",
    descripcion: "",
    estado: "operativo",
  };
}

/** Siguiente etiqueta libre para un tipo: PC-01, PC-02… (vacía si el tipo no tiene prefijo). */
export function siguienteEtiqueta(tipo: TipoElemento | undefined, celdas: Record<string, Celda>): string {
  const prefijo = tipo?.prefijo_etiqueta?.trim();
  if (!tipo || !prefijo) return "";
  const patron = new RegExp(`^${prefijo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`, "i");
  let mayor = 0;
  Object.values(celdas).forEach((c) => {
    const m = patron.exec(c.etiqueta);
    if (m) mayor = Math.max(mayor, Number(m[1]));
  });
  return `${prefijo}-${String(mayor + 1).padStart(2, "0")}`;
}

/** Renumera las casillas de un tipo en orden de lectura (o por columnas). */
export function numerar(
  e: EstadoGrilla,
  tipo: number,
  opciones: { prefijo: string; inicio: number; digitos: number; porColumnas: boolean },
): EstadoGrilla {
  const lista = Object.values(e.celdas)
    .filter((c) => c.tipo === tipo)
    .sort((a, b) =>
      opciones.porColumnas ? a.columna - b.columna || a.fila - b.fila : a.fila - b.fila || a.columna - b.columna,
    );
  const celdas = { ...e.celdas };
  lista.forEach((c, i) => {
    const numero = String(opciones.inicio + i).padStart(opciones.digitos, "0");
    celdas[clave(c.fila, c.columna)] = { ...c, etiqueta: opciones.prefijo ? `${opciones.prefijo}-${numero}` : numero };
  });
  return { ...e, celdas };
}

export function redimensionar(e: EstadoGrilla, filas: number, columnas: number): { estado: EstadoGrilla; quitadas: number } {
  const celdas: Record<string, Celda> = {};
  let quitadas = 0;
  Object.entries(e.celdas).forEach(([k, c]) => {
    if (c.fila < filas && c.columna < columnas) celdas[k] = c;
    else quitadas++;
  });
  return { estado: { filas, columnas, celdas }, quitadas };
}

// ── Historial para deshacer y rehacer ──

interface Historial<T> {
  pasado: T[];
  presente: T;
  futuro: T[];
  grupo: string | null;
  inicioTrazo: T | null;
}

type Accion<T> =
  | { tipo: "registrar"; valor: T; grupo?: string }
  | { tipo: "aplicar"; valor: T }
  | { tipo: "iniciarTrazo" }
  | { tipo: "terminarTrazo" }
  | { tipo: "deshacer" }
  | { tipo: "rehacer" }
  | { tipo: "reiniciar"; valor: T };

const LIMITE = 100;

function reductor<T>(s: Historial<T>, a: Accion<T>): Historial<T> {
  switch (a.tipo) {
    case "registrar":
      // Cambios seguidos del mismo grupo (p. ej., escribir una etiqueta) son un solo paso.
      if (a.grupo && a.grupo === s.grupo) return { ...s, presente: a.valor };
      return {
        pasado: [...s.pasado, s.presente].slice(-LIMITE),
        presente: a.valor,
        futuro: [],
        grupo: a.grupo ?? null,
        inicioTrazo: null,
      };
    case "aplicar":
      return { ...s, presente: a.valor };
    case "iniciarTrazo":
      return { ...s, inicioTrazo: s.presente, grupo: null };
    case "terminarTrazo":
      if (!s.inicioTrazo || s.inicioTrazo === s.presente) return { ...s, inicioTrazo: null };
      return {
        pasado: [...s.pasado, s.inicioTrazo].slice(-LIMITE),
        presente: s.presente,
        futuro: [],
        grupo: null,
        inicioTrazo: null,
      };
    case "deshacer": {
      if (!s.pasado.length) return s;
      const anterior = s.pasado[s.pasado.length - 1];
      return { pasado: s.pasado.slice(0, -1), presente: anterior, futuro: [s.presente, ...s.futuro], grupo: null, inicioTrazo: null };
    }
    case "rehacer": {
      if (!s.futuro.length) return s;
      const [siguiente, ...resto] = s.futuro;
      return { pasado: [...s.pasado, s.presente], presente: siguiente, futuro: resto, grupo: null, inicioTrazo: null };
    }
    case "reiniciar":
      return { pasado: [], presente: a.valor, futuro: [], grupo: null, inicioTrazo: null };
  }
}

export function useHistorial<T>(inicial: T) {
  const [s, despachar] = useReducer(reductor<T>, {
    pasado: [],
    presente: inicial,
    futuro: [],
    grupo: null,
    inicioTrazo: null,
  } as Historial<T>);

  return {
    presente: s.presente,
    puedeDeshacer: s.pasado.length > 0,
    puedeRehacer: s.futuro.length > 0,
    registrar: useCallback((valor: T, grupo?: string) => despachar({ tipo: "registrar", valor, grupo }), []),
    aplicar: useCallback((valor: T) => despachar({ tipo: "aplicar", valor }), []),
    iniciarTrazo: useCallback(() => despachar({ tipo: "iniciarTrazo" }), []),
    terminarTrazo: useCallback(() => despachar({ tipo: "terminarTrazo" }), []),
    deshacer: useCallback(() => despachar({ tipo: "deshacer" }), []),
    rehacer: useCallback(() => despachar({ tipo: "rehacer" }), []),
    reiniciar: useCallback((valor: T) => despachar({ tipo: "reiniciar", valor }), []),
  };
}
