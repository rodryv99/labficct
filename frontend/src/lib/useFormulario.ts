import { useCallback, useMemo, useRef, useState } from "react";

import { erroresDeCampos, mensajeDeError } from "../api/errores";

type Errores<T> = Partial<Record<keyof T | "general", string>> & Record<string, string | undefined>;

/**
 * Estado de un formulario con tipos: valores, errores por campo y
 * aplicación directa de los errores que devuelve el backend.
 */
export function useFormulario<T extends object>(inicial: T) {
  const [valores, setValores] = useState<T>(inicial);
  const [errores, setErrores] = useState<Errores<T>>({} as Errores<T>);
  const base = useRef<string>(JSON.stringify(inicial));

  const set = useCallback(<K extends keyof T>(campo: K, valor: T[K]) => {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined, general: undefined }));
  }, []);

  const reiniciar = useCallback((nuevo: T) => {
    base.current = JSON.stringify(nuevo);
    setValores(nuevo);
    setErrores({} as Errores<T>);
  }, []);

  const tomarErroresDelServidor = useCallback((error: unknown) => {
    const campos = erroresDeCampos(error);
    setErrores({ ...campos, general: mensajeDeError(error) } as Errores<T>);
  }, []);

  const cambiado = useMemo(() => JSON.stringify(valores) !== base.current, [valores]);

  return { valores, set, setValores, errores, setErrores, reiniciar, tomarErroresDelServidor, cambiado };
}

/** Props de validación para un <Field> de Fluent. */
export function estadoCampo(mensaje?: string) {
  return mensaje ? { validationState: "error" as const, validationMessage: mensaje } : {};
}
