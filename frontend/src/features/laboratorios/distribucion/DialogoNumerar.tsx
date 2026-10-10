import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Radio,
  RadioGroup,
  Select,
  SpinButton,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";

import type { TipoElemento } from "../../../api/tipos";

const useEstilos = makeStyles({
  contenido: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
  },
  ejemplo: {
    color: tokens.colorNeutralForeground3,
  },
});

export interface OpcionesNumerar {
  tipo: number;
  prefijo: string;
  inicio: number;
  digitos: number;
  porColumnas: boolean;
}

interface Props {
  abierto: boolean;
  tipos: TipoElemento[];
  onCerrar: () => void;
  onAplicar: (opciones: OpcionesNumerar) => void;
}

export function DialogoNumerar({ abierto, tipos, onCerrar, onAplicar }: Props) {
  const estilos = useEstilos();
  const [tipo, setTipo] = useState<number | null>(null);
  const [prefijo, setPrefijo] = useState("");
  const [inicio, setInicio] = useState(1);
  const [digitos, setDigitos] = useState(2);
  const [orden, setOrden] = useState("filas");

  useEffect(() => {
    if (!abierto || !tipos.length) return;
    const primero = tipos.find((t) => t.prefijo_etiqueta) ?? tipos[0];
    setTipo(primero.id);
    setPrefijo(primero.prefijo_etiqueta);
  }, [abierto, tipos]);

  const ejemplo = (n: number) => {
    const numero = String(n).padStart(digitos, "0");
    return prefijo ? `${prefijo}-${numero}` : numero;
  };

  return (
    <Dialog open={abierto} onOpenChange={(_, d) => !d.open && onCerrar()}>
      <DialogSurface style={{ maxWidth: 460 }}>
        <DialogBody>
          <DialogTitle>Numerar elementos</DialogTitle>
          <DialogContent className={estilos.contenido}>
            <Field label="Elemento">
              <Select
                value={tipo !== null ? String(tipo) : ""}
                onChange={(_, d) => {
                  const t = tipos.find((x) => x.id === Number(d.value));
                  setTipo(Number(d.value));
                  setPrefijo(t?.prefijo_etiqueta ?? "");
                }}
              >
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <div className={estilos.fila}>
              <Field label="Prefijo">
                <Input value={prefijo} maxLength={10} onChange={(_, d) => setPrefijo(d.value.toUpperCase())} />
              </Field>
              <Field label="Empieza en">
                <SpinButton
                  min={0}
                  max={999}
                  value={inicio}
                  onChange={(_, d) => setInicio(d.value ?? (Number.parseInt(d.displayValue ?? "1", 10) || 1))}
                />
              </Field>
              <Field label="Dígitos">
                <SpinButton
                  min={1}
                  max={4}
                  value={digitos}
                  onChange={(_, d) => setDigitos(d.value ?? (Number.parseInt(d.displayValue ?? "2", 10) || 2))}
                />
              </Field>
            </div>
            <Field label="Orden">
              <RadioGroup value={orden} onChange={(_, d) => setOrden(d.value)} layout="horizontal">
                <Radio value="filas" label="Por filas (como se lee)" />
                <Radio value="columnas" label="Por columnas" />
              </RadioGroup>
            </Field>
            <Caption1 className={estilos.ejemplo}>
              Quedará: {ejemplo(inicio)}, {ejemplo(inicio + 1)}, {ejemplo(inicio + 2)}…
            </Caption1>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCerrar}>Cancelar</Button>
            <Button
              appearance="primary"
              disabled={tipo === null}
              onClick={() => {
                if (tipo === null) return;
                onAplicar({ tipo, prefijo, inicio, digitos, porColumnas: orden === "columnas" });
              }}
            >
              Numerar
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
