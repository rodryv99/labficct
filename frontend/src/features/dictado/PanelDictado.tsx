/**
 * Bloque reutilizable de dictado por voz para los formularios.
 *
 * Muestra un cuadro donde se dicta (o escribe) una frase y, al terminar, llama a
 * `interpretar` para sacar los datos y los entrega con `onAplicar` para que el
 * formulario los rellene. Debajo resume lo que entendió. No guarda nada.
 *
 * Es la misma idea del dictado de reservas, puesta en un componente para usarla en
 * tareas, objetos perdidos, horarios e inventario.
 */
import {
  Button,
  Caption1,
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";

import { IconoMicrofono, IconoMicrofonoActivo } from "../../components/iconos/iconos";
import type { ResultadoBase } from "./nucleo";
import { useDictado } from "./useDictado";

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  botones: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  escuchando: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  neutro: {
    color: tokens.colorNeutralForeground3,
  },
  lista: {
    margin: "4px 0 0",
    paddingLeft: "18px",
  },
});

interface Props<R extends ResultadoBase> {
  /** Etiqueta del cuadro, p. ej. "Dicta o escribe la tarea en una frase". */
  etiqueta: string;
  /** Ejemplo que se muestra como ayuda. */
  ejemplo: string;
  placeholder: string;
  /** Qué se está llenando, para los avisos: "una tarea", "un objeto perdido"… */
  sustantivo: string;
  /** Saca los datos de la frase. */
  interpretar: (texto: string) => R;
  /** Rellena el formulario con lo entendido. */
  onAplicar: (resultado: R) => void;
  /** Cuando el panel se cierra, se suelta el micrófono. */
  abierto: boolean;
}

export function PanelDictado<R extends ResultadoBase>({
  etiqueta,
  ejemplo,
  placeholder,
  sustantivo,
  interpretar,
  onAplicar,
  abierto,
}: Props<R>) {
  const estilos = useEstilos();
  const [frase, setFrase] = useState("");
  const [entendido, setEntendido] = useState<R | null>(null);

  const rellenarCon = (texto: string) => {
    const r = interpretar(texto);
    onAplicar(r);
    setEntendido(r);
  };

  const dictado = useDictado({
    alTerminar: (texto) => {
      setFrase(texto);
      rellenarCon(texto);
    },
  });

  useEffect(() => {
    if (!abierto) dictado.cancelar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  return (
    <div className={estilos.raiz}>
      <Field label={etiqueta} hint={ejemplo}>
        <Textarea
          value={dictado.escuchando ? dictado.parcial : frase}
          readOnly={dictado.escuchando}
          resize="vertical"
          rows={2}
          placeholder={dictado.escuchando ? "Te escucho…" : placeholder}
          onChange={(_, d) => setFrase(d.value)}
        />
      </Field>
      <div className={estilos.botones}>
        {dictado.disponible &&
          (dictado.escuchando ? (
            <Button appearance="primary" icon={<IconoMicrofonoActivo />} onClick={dictado.detener}>
              Detener
            </Button>
          ) : (
            <Button icon={<IconoMicrofono />} onClick={dictado.empezar}>
              Dictar
            </Button>
          ))}
        <Button disabled={dictado.escuchando || !frase.trim()} onClick={() => rellenarCon(frase)}>
          Rellenar formulario
        </Button>
        {dictado.escuchando && <span className={estilos.escuchando}>Escuchando… al terminar, haz una pausa.</span>}
        {!dictado.disponible && (
          <Caption1 className={estilos.neutro}>
            Este navegador no tiene dictado por voz (usa Chrome o Edge). Puedes escribir la frase.
          </Caption1>
        )}
      </div>
      {dictado.error && (
        <MessageBar intent="warning">
          <MessageBarBody>{dictado.error}</MessageBarBody>
        </MessageBar>
      )}
      {entendido && !dictado.escuchando && (
        <MessageBar intent={entendido.entendido.length ? "success" : "warning"} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>
              {entendido.entendido.length
                ? "Rellené esto. Revísalo antes de guardar:"
                : `No entendí datos de ${sustantivo} en esa frase`}
            </MessageBarTitle>
            {entendido.entendido.length > 0 && (
              <ul className={estilos.lista}>
                {entendido.entendido.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ul>
            )}
            {entendido.entendido.length > 0 && entendido.faltantes.length > 0 && (
              <span>Me faltó: {entendido.faltantes.join(", ")}. Complétalo abajo.</span>
            )}
          </MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}
