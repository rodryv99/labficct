import {
  Badge,
  Button,
  Caption1,
  Checkbox,
  Divider,
  Link,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMemo } from "react";

import type { Laboratorio } from "../../api/tipos";
import { IconoLaboratorios } from "../../components/iconos/iconos";

const useEstilos = makeStyles({
  superficie: {
    width: "300px",
    maxHeight: "60vh",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
  },
  cabecera: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "8px",
  },
  ayuda: {
    color: tokens.colorNeutralForeground3,
  },
  lista: {
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    paddingRight: "4px",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  orden: {
    minWidth: "22px",
    textAlign: "center",
  },
  etiqueta: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  secundaria: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});

interface Props {
  laboratorios: Laboratorio[];
  /** Ids en el orden en que el usuario los marcó. Vacío = se muestran todos. */
  orden: number[];
  onCambio: (orden: number[]) => void;
}

/** Elige qué laboratorios salen en la pizarra y en qué orden (según el orden de marcado). */
export function SelectorLaboratoriosPizarra({ laboratorios, orden, onCambio }: Props) {
  const estilos = useEstilos();
  const personalizado = orden.length > 0;

  // Primero los marcados, en su orden; luego el resto, en el orden del catálogo.
  const ordenados = useMemo(() => {
    const porId = new Map(laboratorios.map((l) => [l.id, l]));
    const marcados = orden.map((id) => porId.get(id)).filter((l): l is Laboratorio => Boolean(l));
    const idsMarcados = new Set(orden);
    const resto = laboratorios.filter((l) => !idsMarcados.has(l.id));
    return [...marcados, ...resto];
  }, [laboratorios, orden]);

  const alternar = (id: number, marcado: boolean) => {
    // Al marcar se agrega al final (ese es el orden); al desmarcar se quita.
    onCambio(marcado ? [...orden.filter((x) => x !== id), id] : orden.filter((x) => x !== id));
  };

  const posicion = (id: number) => {
    const i = orden.indexOf(id);
    return i >= 0 ? i + 1 : null;
  };

  const resumen = personalizado ? `${orden.length} elegidos` : "Todos";

  return (
    <Popover positioning="below-end" withArrow>
      <PopoverTrigger disableButtonEnhancement>
        <Button icon={<IconoLaboratorios />}>
          Laboratorios
          <Badge appearance="tint" color="informative" style={{ marginLeft: 6 }}>
            {resumen}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={estilos.superficie}>
        <div className={estilos.cabecera}>
          <Caption1 className={estilos.ayuda}>
            Marca los que quieres ver. Se ordenan según los vayas marcando.
          </Caption1>
          {personalizado && (
            <Link as="button" onClick={() => onCambio([])}>
              Todos
            </Link>
          )}
        </div>
        <Divider />
        <div className={estilos.lista}>
          {ordenados.map((l) => {
            const pos = posicion(l.id);
            return (
              <div key={l.id} className={estilos.item}>
                <Caption1 className={estilos.orden}>{pos ? `${pos}.` : ""}</Caption1>
                <Checkbox
                  checked={pos !== null}
                  onChange={(_, d) => alternar(l.id, Boolean(d.checked))}
                  label={
                    <span className={estilos.etiqueta}>
                      <span>{l.codigo}</span>
                      <Caption1 className={estilos.secundaria}>{l.nombre}</Caption1>
                    </span>
                  }
                />
              </div>
            );
          })}
        </div>
      </PopoverSurface>
    </Popover>
  );
}
