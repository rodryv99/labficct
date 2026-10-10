import {
  Body1,
  Body1Strong,
  Caption1,
  Field,
  Radio,
  RadioGroup,
  Subtitle2,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { type ReactNode, useEffect, useMemo } from "react";

import type { OpcionPreferencia, Preferencias, ValoresPreferencias } from "../../api/tipos";
import { IconoInfo } from "../../components/iconos/iconos";
import { useFormulario } from "../../lib/useFormulario";
import type { DatosPreferencias } from "./api";

const useEstilos = makeStyles({
  raiz: {
    display: "grid",
    // Se adapta al ancho del contenedor: dos columnas en la página, una en el panel.
    gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
    gap: "20px",
    alignItems: "start",
  },
  campos: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
  pregunta: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px 14px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  radios: {
    flexWrap: "wrap",
    marginLeft: "-8px",
  },
  vista: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorBrandStroke2}`,
    backgroundColor: tokens.colorBrandBackground2,
    minWidth: 0,
  },
  lista: {
    margin: "0",
    paddingLeft: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    wordBreak: "break-word",
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  nota: {
    display: "flex",
    alignItems: "flex-start",
    gap: "6px",
    color: tokens.colorNeutralForeground3,
  },
});

type Respuesta = "si" | "no" | "igual";

function aRespuesta(valor: boolean | null | undefined): Respuesta {
  return valor === true ? "si" : valor === false ? "no" : "igual";
}

/** Lo que guardó el servidor, sin los "me da igual" (ausentes). */
function desdeServidor(p: Preferencias): DatosPreferencias {
  const valores: ValoresPreferencias = {};
  Object.entries(p.valores).forEach(([id, valor]) => {
    if (valor === true || valor === false) valores[id] = valor;
  });
  return { valores, nota: p.nota };
}

/** Las frases que leerán los auxiliares, igual que las arma el servidor. */
export function resumenLocal(activas: OpcionPreferencia[], datos: DatosPreferencias): string[] {
  const lineas: string[] = [];
  activas.forEach((o) => {
    const valor = datos.valores[String(o.id)];
    if (valor === true && o.texto_si.trim()) lineas.push(o.texto_si.trim());
    if (valor === false && o.texto_no.trim()) lineas.push(o.texto_no.trim());
  });
  if (datos.nota.trim()) lineas.push(datos.nota.trim());
  return lineas;
}

/**
 * Estado del formulario de preferencias de un docente. Se reinicia cuando llegan
 * otras preferencias (otro docente, o las recién guardadas).
 */
export function useEditorPreferencias(preferencias: Preferencias | undefined, opciones: OpcionPreferencia[] | undefined) {
  const f = useFormulario<DatosPreferencias>({ valores: {}, nota: "" });
  const clave = preferencias ? `${preferencias.docente}|${preferencias.actualizado_en ?? ""}` : "";

  useEffect(() => {
    if (preferencias) f.reiniciar(desdeServidor(preferencias));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const activas = useMemo(
    () => (opciones ?? []).filter((o) => o.activa).sort((a, b) => a.orden - b.orden || a.id - b.id),
    [opciones],
  );
  const lineas = useMemo(() => resumenLocal(activas, f.valores), [activas, f.valores]);

  const cambiarValor = (id: number, valor: boolean | null) => {
    const nuevos = { ...f.valores.valores };
    if (valor === null) delete nuevos[String(id)];
    else nuevos[String(id)] = valor;
    f.set("valores", nuevos);
  };

  /** Cuerpo del PUT. Conserva lo marcado en opciones desactivadas y descarta las que ya no existen. */
  const cuerpo = (): DatosPreferencias => {
    const existentes = new Set((opciones ?? []).map((o) => String(o.id)));
    const valores: ValoresPreferencias = {};
    Object.entries(f.valores.valores).forEach(([id, valor]) => {
      if (existentes.has(id) && valor !== null) valores[id] = valor;
    });
    return { valores, nota: f.valores.nota.trim() };
  };

  const descartar = () => {
    if (preferencias) f.reiniciar(desdeServidor(preferencias));
  };

  return {
    valores: f.valores,
    setNota: (nota: string) => f.set("nota", nota),
    cambiarValor,
    cambiado: f.cambiado,
    activas,
    lineas,
    cuerpo,
    descartar,
  };
}

export type EditorPreferenciasEstado = ReturnType<typeof useEditorPreferencias>;

/** Tarjeta "Así lo verán los auxiliares". */
export function VistaPreviaPreferencias({ lineas, vacio }: { lineas: string[]; vacio?: string }) {
  const estilos = useEstilos();
  return (
    <section className={estilos.vista} aria-live="polite">
      <Subtitle2>Así lo verán los auxiliares</Subtitle2>
      {lineas.length ? (
        <ul className={estilos.lista}>
          {lineas.map((l, i) => (
            <li key={`${i}-${l}`}>
              <Body1>{l}</Body1>
            </li>
          ))}
        </ul>
      ) : (
        <Body1 className={estilos.secundario}>
          {vacio ?? "Todavía no hay nada marcado: los auxiliares no verán indicaciones especiales."}
        </Body1>
      )}
    </section>
  );
}

interface Props {
  editor: EditorPreferenciasEstado;
  deshabilitado?: boolean;
  /** Botones debajo de los campos (Guardar…). */
  pie?: ReactNode;
}

/** Preguntas Sí / No / Me da igual, la nota libre y la vista previa en vivo. */
export function EditorPreferencias({ editor, deshabilitado, pie }: Props) {
  const estilos = useEstilos();
  const { valores, activas, lineas } = editor;

  return (
    <div className={estilos.raiz}>
      <div className={estilos.campos}>
        {activas.length === 0 && (
          <Caption1 className={estilos.nota}>
            <IconoInfo /> Todavía no hay preguntas activas. Puedes escribir tus indicaciones abajo.
          </Caption1>
        )}
        {activas.map((o) => (
          <div key={o.id} className={estilos.pregunta} role="group" aria-labelledby={`pregunta-${o.id}`}>
            <Body1Strong id={`pregunta-${o.id}`}>{o.pregunta}</Body1Strong>
            <RadioGroup
              className={estilos.radios}
              layout="horizontal"
              aria-labelledby={`pregunta-${o.id}`}
              disabled={deshabilitado}
              value={aRespuesta(valores.valores[String(o.id)])}
              onChange={(_, d) => editor.cambiarValor(o.id, d.value === "si" ? true : d.value === "no" ? false : null)}
            >
              <Radio value="si" label="Sí" />
              <Radio value="no" label="No" />
              <Radio value="igual" label="Me da igual" />
            </RadioGroup>
          </div>
        ))}
        <Field label="Otras indicaciones" hint="Ej.: Llego 5 minutos antes; dejen la puerta abierta.">
          <Textarea
            value={valores.nota}
            maxLength={1000}
            resize="vertical"
            rows={3}
            disabled={deshabilitado}
            onChange={(_, d) => editor.setNota(d.value)}
          />
        </Field>
        {pie}
      </div>
      <VistaPreviaPreferencias lineas={lineas} />
    </div>
  );
}
