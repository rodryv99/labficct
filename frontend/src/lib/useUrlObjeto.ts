import { useEffect, useState } from "react";

/**
 * URL local (blob:) para mostrar un archivo o una imagen descargada.
 * Se crea y se libera dentro del mismo efecto: así sigue funcionando con
 * StrictMode (que monta dos veces en desarrollo) y nunca queda una URL rota.
 */
export function useUrlObjeto(dato: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!dato) {
      setUrl(null);
      return;
    }
    const nueva = URL.createObjectURL(dato);
    setUrl(nueva);
    return () => URL.revokeObjectURL(nueva);
  }, [dato]);

  return dato ? url : null;
}
