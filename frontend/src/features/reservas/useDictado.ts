import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictado por voz con el reconocedor del navegador (Web Speech API). Es gratis y no usa
 * nuestro servidor, pero solo existe en Chrome y Edge, necesita internet y exige que la
 * página esté en HTTPS (o en localhost).
 *
 * Los tipos se declaran aquí porque no todos los navegadores (ni TypeScript) los traen.
 */
interface ResultadoVoz {
  isFinal: boolean;
  [indice: number]: { transcript: string };
}

interface EventoVoz {
  resultIndex: number;
  results: ArrayLike<ResultadoVoz>;
}

interface ReconocedorVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((evento: EventoVoz) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type ConstructorVoz = new () => ReconocedorVoz;

function constructorVoz(): ConstructorVoz | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructorVoz; webkitSpeechRecognition?: ConstructorVoz };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MENSAJES: Record<string, string> = {
  "not-allowed": "El navegador no tiene permiso para usar el micrófono. Permítelo en el candado de la barra de direcciones.",
  "service-not-allowed": "El navegador no tiene permiso para usar el micrófono. Permítelo en el candado de la barra de direcciones.",
  "audio-capture": "No encontré un micrófono conectado.",
  "no-speech": "No escuché nada. Acércate al micrófono e intenta de nuevo.",
  network: "El dictado necesita internet y funciona en Chrome o Edge. Mientras tanto puedes escribir la frase.",
  "language-not-supported": "Este navegador no tiene dictado en español.",
};

/** Segundos de silencio tras los que se deja de escuchar sola. */
const SILENCIO_MS = 4000;
const SIN_EMPEZAR_MS = 9000;

interface Opciones {
  /** Se llama una vez, al dejar de escuchar, con todo lo que se dijo. */
  alTerminar: (texto: string) => void;
}

export function useDictado({ alTerminar }: Opciones) {
  const [escuchando, setEscuchando] = useState(false);
  /** Lo que se va entendiendo mientras la persona habla. */
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState("");
  const reconocedor = useRef<ReconocedorVoz | null>(null);
  const dicho = useRef("");
  const silencio = useRef<number | undefined>(undefined);
  // Siempre la última versión del aviso (usa datos que cargan después, como los laboratorios).
  const aviso = useRef(alTerminar);
  aviso.current = alTerminar;
  const disponible = constructorVoz() !== null;

  const esperarSilencio = useCallback((ms: number) => {
    window.clearTimeout(silencio.current);
    silencio.current = window.setTimeout(() => reconocedor.current?.stop(), ms);
  }, []);

  const detener = useCallback(() => {
    window.clearTimeout(silencio.current);
    reconocedor.current?.stop();
  }, []);

  const empezar = useCallback(() => {
    const Reconocedor = constructorVoz();
    if (!Reconocedor || reconocedor.current) return;
    const r = new Reconocedor();
    r.lang = "es-BO";
    r.continuous = true;
    r.interimResults = true;
    dicho.current = "";
    setParcial("");
    setError("");

    r.onresult = (evento) => {
      let provisional = "";
      for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
        const resultado = evento.results[i];
        const texto = resultado?.[0]?.transcript ?? "";
        if (resultado?.isFinal) dicho.current = `${dicho.current} ${texto}`.trim();
        else provisional += texto;
      }
      setParcial(`${dicho.current} ${provisional}`.trim());
      esperarSilencio(SILENCIO_MS);
    };
    r.onerror = (evento) => {
      // "aborted" es cuando se cierra el panel: no es un error para mostrar.
      if (evento.error !== "aborted") setError(MENSAJES[evento.error] ?? "No se pudo usar el dictado. Puedes escribir la frase.");
    };
    r.onend = () => {
      window.clearTimeout(silencio.current);
      reconocedor.current = null;
      setEscuchando(false);
      setParcial("");
      const texto = dicho.current.trim();
      dicho.current = "";
      if (texto) aviso.current(texto);
    };

    reconocedor.current = r;
    try {
      r.start();
      setEscuchando(true);
      esperarSilencio(SIN_EMPEZAR_MS);
    } catch {
      reconocedor.current = null;
      setError("No se pudo iniciar el dictado. Intenta de nuevo.");
    }
  }, [esperarSilencio]);

  /** Suelta el micrófono sin rellenar nada (al cerrar el panel). */
  const cancelar = useCallback(() => {
    window.clearTimeout(silencio.current);
    if (reconocedor.current) {
      reconocedor.current.onend = null;
      reconocedor.current.abort();
      reconocedor.current = null;
    }
    dicho.current = "";
    setEscuchando(false);
    setParcial("");
  }, []);

  useEffect(() => cancelar, [cancelar]);

  return { disponible, escuchando, parcial, error, empezar, detener, cancelar };
}
