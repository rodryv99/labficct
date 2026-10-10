import { Combobox, Option } from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";

export interface OpcionBuscable {
  id: number;
  etiqueta: string;
  secundaria?: string;
}

interface Props {
  opciones: OpcionBuscable[];
  valor: number | null;
  onCambio: (id: number | null) => void;
  placeholder?: string;
  permitirVacio?: boolean;
  textoVacio?: string;
  deshabilitado?: boolean;
  id?: string;
}

const VACIO = "__vacio__";

/** Un desplegable en el que se puede escribir para filtrar (materias, docentes…). */
export function SelectorBuscable({
  opciones,
  valor,
  onCambio,
  placeholder = "Escribe para buscar",
  permitirVacio = false,
  textoVacio = "Sin asignar",
  deshabilitado,
  id,
}: Props) {
  const seleccionada = opciones.find((o) => o.id === valor);
  const [texto, setTexto] = useState(seleccionada?.etiqueta ?? "");
  const [escribiendo, setEscribiendo] = useState(false);

  useEffect(() => {
    if (!escribiendo) setTexto(seleccionada?.etiqueta ?? "");
  }, [seleccionada?.etiqueta, escribiendo]);

  const filtradas = useMemo(() => {
    const q = escribiendo ? texto.trim().toLowerCase() : "";
    if (!q) return opciones;
    return opciones.filter((o) => `${o.etiqueta} ${o.secundaria ?? ""}`.toLowerCase().includes(q));
  }, [opciones, texto, escribiendo]);

  return (
    <Combobox
      id={id}
      value={texto}
      placeholder={placeholder}
      disabled={deshabilitado}
      selectedOptions={valor != null ? [String(valor)] : []}
      onChange={(evento) => {
        setTexto(evento.target.value);
        setEscribiendo(true);
      }}
      onOptionSelect={(_, datos) => {
        setEscribiendo(false);
        if (!datos.optionValue) return;
        if (datos.optionValue === VACIO) {
          onCambio(null);
          setTexto("");
        } else {
          onCambio(Number(datos.optionValue));
          setTexto(datos.optionText ?? "");
        }
      }}
      onOpenChange={(_, datos) => {
        if (!datos.open) setEscribiendo(false);
      }}
    >
      {permitirVacio && (
        <Option value={VACIO} text="">
          {textoVacio}
        </Option>
      )}
      {filtradas.map((o) => (
        <Option key={o.id} value={String(o.id)} text={o.etiqueta}>
          {o.secundaria ? `${o.etiqueta} · ${o.secundaria}` : o.etiqueta}
        </Option>
      ))}
      {filtradas.length === 0 && (
        <Option value="__sin_resultados__" text="" disabled>
          Sin resultados
        </Option>
      )}
    </Combobox>
  );
}
