import { FluentProvider } from "@fluentui/react-components";
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

import { almacen } from "../lib/utiles";
import { temaClaro, temaOscuro } from "./tema";

export type ModoTema = "claro" | "oscuro" | "sistema";

interface ContextoTema {
  modo: ModoTema;
  oscuro: boolean;
  cambiarModo: (modo: ModoTema) => void;
}

const Contexto = createContext<ContextoTema | null>(null);
const CLAVE = "labficct.tema";

function prefiereOscuro(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<ModoTema>(() => (almacen.leer(CLAVE) as ModoTema) || "sistema");
  const [sistemaOscuro, setSistemaOscuro] = useState(prefiereOscuro);

  useEffect(() => {
    const consulta = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!consulta) return;
    const escuchar = (e: MediaQueryListEvent) => setSistemaOscuro(e.matches);
    consulta.addEventListener("change", escuchar);
    return () => consulta.removeEventListener("change", escuchar);
  }, []);

  const oscuro = modo === "oscuro" || (modo === "sistema" && sistemaOscuro);

  useEffect(() => {
    document.documentElement.style.colorScheme = oscuro ? "dark" : "light";
  }, [oscuro]);

  const valor = useMemo<ContextoTema>(
    () => ({
      modo,
      oscuro,
      cambiarModo: (nuevo) => {
        almacen.guardar(CLAVE, nuevo);
        setModo(nuevo);
      },
    }),
    [modo, oscuro],
  );

  return (
    <Contexto.Provider value={valor}>
      {/*
        Sin className: Fluent copia las clases del proveedor a cada capa flotante
        (tooltips, menús, avisos). Una altura aquí convertía esa capa en una
        hoja blanca encima de toda la página. La altura va en global.css.
      */}
      <FluentProvider theme={oscuro ? temaOscuro : temaClaro}>
        {children}
      </FluentProvider>
    </Contexto.Provider>
  );
}

export function useTema(): ContextoTema {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useTema debe usarse dentro de TemaProvider");
  return contexto;
}
