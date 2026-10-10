import { Caption1, Checkbox, Input, Link, makeStyles, tokens } from "@fluentui/react-components";
import { useMemo, useState } from "react";

import { IconoBuscar } from "../iconos/iconos";

const useEstilos = makeStyles({
  raiz: {
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: "hidden",
  },
  buscador: {
    padding: "8px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  lista: {
    overflowY: "auto",
    padding: "4px 4px",
  },
  item: {
    display: "flex",
    flexDirection: "column",
  },
  secundaria: {
    color: tokens.colorNeutralForeground3,
    marginLeft: "32px",
    marginTop: "-6px",
    marginBottom: "4px",
  },
  pie: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 12px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  vacio: {
    padding: "12px",
    color: tokens.colorNeutralForeground3,
  },
});

export interface OpcionLista {
  id: number;
  etiqueta: string;
  secundaria?: string;
}

interface Props {
  opciones: OpcionLista[];
  seleccionados: number[];
  onCambio: (ids: number[]) => void;
  placeholder?: string;
  alto?: number;
  deshabilitado?: boolean;
}

/** Selección múltiple con búsqueda: más clara que un desplegable para 5–50 opciones. */
export function ListaSeleccion({
  opciones,
  seleccionados,
  onCambio,
  placeholder = "Buscar…",
  alto = 220,
  deshabilitado,
}: Props) {
  const estilos = useEstilos();
  const [busqueda, setBusqueda] = useState("");
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => `${o.etiqueta} ${o.secundaria ?? ""}`.toLowerCase().includes(q));
  }, [opciones, busqueda]);

  const alternar = (id: number, marcado: boolean) => {
    onCambio(marcado ? [...seleccionados, id] : seleccionados.filter((s) => s !== id));
  };

  return (
    <div className={estilos.raiz}>
      {opciones.length > 6 && (
        <div className={estilos.buscador}>
          <Input
            size="small"
            appearance="filled-darker"
            contentBefore={<IconoBuscar />}
            placeholder={placeholder}
            value={busqueda}
            onChange={(_, d) => setBusqueda(d.value)}
            style={{ width: "100%" }}
          />
        </div>
      )}
      <div className={estilos.lista} style={{ maxHeight: alto }}>
        {filtradas.length === 0 && <Caption1 className={estilos.vacio}>Sin resultados.</Caption1>}
        {filtradas.map((o) => (
          <div key={o.id} className={estilos.item}>
            <Checkbox
              label={o.etiqueta}
              checked={seleccionados.includes(o.id)}
              disabled={deshabilitado}
              onChange={(_, d) => alternar(o.id, Boolean(d.checked))}
            />
            {o.secundaria && <Caption1 className={estilos.secundaria}>{o.secundaria}</Caption1>}
          </div>
        ))}
      </div>
      <div className={estilos.pie}>
        <Caption1>
          {seleccionados.length === 0
            ? "Ninguno seleccionado"
            : `${seleccionados.length} seleccionado${seleccionados.length === 1 ? "" : "s"}`}
        </Caption1>
        {seleccionados.length > 0 && !deshabilitado && (
          <Link as="button" onClick={() => onCambio([])}>
            Limpiar
          </Link>
        )}
      </div>
    </div>
  );
}
