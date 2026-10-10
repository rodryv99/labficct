import { useEffect, useState } from "react";

/** Devuelve el valor después de que deja de cambiar por `ms` milisegundos. */
export function useDebounce<T>(valor: T, ms = 300): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setRetrasado(valor), ms);
    return () => window.clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}

/** localStorage que nunca rompe la app (modo privado, almacenamiento bloqueado). */
export const almacen = {
  leer(clave: string): string | null {
    try {
      return window.localStorage.getItem(clave);
    } catch {
      return null;
    }
  },
  guardar(clave: string, valor: string) {
    try {
      window.localStorage.setItem(clave, valor);
    } catch {
      /* sin almacenamiento: se ignora */
    }
  },
};

export function generarPassword(largo = 12): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const numeros = "23456789";
  const simbolos = "!@#$%*-_";
  const todos = letras + numeros + simbolos;
  const aleatorio = (texto: string) => {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return texto[buffer[0] % texto.length];
  };
  const base = [aleatorio(letras), aleatorio(numeros), aleatorio(simbolos)];
  while (base.length < largo) base.push(aleatorio(todos));
  return base.sort(() => (aleatorio("01") === "0" ? -1 : 1)).join("");
}

export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Convierte un objeto en FormData (para enviar archivos). null → cadena vacía. */
export function aFormData(datos: Record<string, unknown>): FormData {
  const fd = new FormData();
  Object.entries(datos).forEach(([clave, valor]) => {
    if (valor === undefined) return;
    if (valor instanceof File) fd.append(clave, valor);
    else if (valor === null) fd.append(clave, "");
    else if (typeof valor === "boolean") fd.append(clave, valor ? "true" : "false");
    else fd.append(clave, String(valor));
  });
  return fd;
}
