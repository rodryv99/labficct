import {
  Body1Strong,
  Button,
  Caption1,
  Field,
  Input,
  Select,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

import type { Celda, EstadoElemento, TipoElemento } from "../../../api/tipos";
import { EtiquetaEstado, type Tono } from "../../../components/datos/Etiquetas";
import { IconoEliminar } from "../../../components/iconos/iconos";
import { ESTADOS_ELEMENTO, etiquetaDe } from "../../../lib/constantes";
import { FichaIcono } from "../../elementos/ElementosPage";

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  cabecera: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  dato: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  valor: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  vacio: {
    color: tokens.colorNeutralForeground4,
    fontStyle: "italic",
  },
});

export const TONO_ESTADO_ELEMENTO: Record<EstadoElemento, Tono> = {
  operativo: "exito",
  con_falla: "peligro",
  mantenimiento: "aviso",
  baja: "neutro",
};

interface Props {
  celda: Celda;
  tipo: TipoElemento | undefined;
  tipos: TipoElemento[];
  editable: boolean;
  onCambiar: (campo: keyof Celda, valor: Celda[keyof Celda]) => void;
  onQuitar: () => void;
}

/** Ficha de un elemento de la grilla: se edita en el panel lateral, sin tapar la grilla. */
export function PanelCelda({ celda, tipo, tipos, editable, onCambiar, onQuitar }: Props) {
  const estilos = useEstilos();
  const posicion = `Fila ${celda.fila + 1} · Columna ${celda.columna + 1}`;

  const cabecera = (
    <div className={estilos.cabecera}>
      {tipo && <FichaIcono tipo={tipo} tamano={40} />}
      <div>
        <Body1Strong>{celda.etiqueta || tipo?.nombre || "Elemento"}</Body1Strong>
        <Caption1 block className={estilos.secundario}>
          {tipo?.nombre} · {posicion}
        </Caption1>
      </div>
    </div>
  );

  // Solo lectura (auxiliar y demás roles): se muestran todos los datos, también los
  // vacíos, para que se note que no están registrados y no que falten permisos.
  if (!editable) {
    const datos: [string, string][] = [
      ["IP", celda.ip ?? ""],
      ["MAC", celda.mac],
      ["Código de activo", celda.codigo_activo],
      ["Especificaciones", celda.especificaciones],
      ["Descripción", celda.descripcion],
    ];
    return (
      <div className={estilos.raiz}>
        {cabecera}
        <div>
          <EtiquetaEstado tono={TONO_ESTADO_ELEMENTO[celda.estado]}>
            {etiquetaDe(ESTADOS_ELEMENTO, celda.estado)}
          </EtiquetaEstado>
        </div>
        {datos.map(([nombre, valor]) => (
          <div key={nombre} className={estilos.dato}>
            <Caption1 className={estilos.secundario}>{nombre}</Caption1>
            {valor.trim() ? (
              <span className={estilos.valor}>{valor}</span>
            ) : (
              <span className={estilos.vacio}>Sin registrar</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={estilos.raiz}>
      {cabecera}
      <div className={estilos.fila}>
        <Field label="Etiqueta">
          <Input value={celda.etiqueta} maxLength={30} onChange={(_, d) => onCambiar("etiqueta", d.value)} />
        </Field>
        <Field label="Estado">
          <Select value={celda.estado} onChange={(_, d) => onCambiar("estado", d.value as EstadoElemento)}>
            {ESTADOS_ELEMENTO.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Elemento">
        <Select value={String(celda.tipo)} onChange={(_, d) => onCambiar("tipo", Number(d.value))}>
          {tipos
            .filter((t) => t.activo || t.id === celda.tipo)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
        </Select>
      </Field>
      <div className={estilos.fila}>
        <Field label="IP">
          <Input value={celda.ip ?? ""} placeholder="192.168.1.10" onChange={(_, d) => onCambiar("ip", d.value)} />
        </Field>
        <Field label="MAC">
          <Input value={celda.mac} maxLength={17} onChange={(_, d) => onCambiar("mac", d.value)} />
        </Field>
      </div>
      <Field label="Código de activo">
        <Input value={celda.codigo_activo} onChange={(_, d) => onCambiar("codigo_activo", d.value)} />
      </Field>
      <Field label="Especificaciones">
        <Textarea
          value={celda.especificaciones}
          placeholder="Procesador, RAM, disco…"
          resize="vertical"
          onChange={(_, d) => onCambiar("especificaciones", d.value)}
        />
      </Field>
      <Field label="Descripción">
        <Textarea value={celda.descripcion} resize="vertical" onChange={(_, d) => onCambiar("descripcion", d.value)} />
      </Field>
      <div>
        <Button appearance="subtle" icon={<IconoEliminar />} onClick={onQuitar}>
          Quitar de la grilla
        </Button>
      </div>
    </div>
  );
}
