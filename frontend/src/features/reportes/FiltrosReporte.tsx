/** Barra de filtros de un reporte, armada según los filtros que declara. */
import { Dropdown, Field, Input, Option } from "@fluentui/react-components";

import { BarraFiltros } from "../../components/layout/EncabezadoPagina";
import type { OpcionesFiltro } from "./api";

interface Props {
  filtros: string[];
  opciones: OpcionesFiltro;
  valores: Record<string, string>;
  onCambiar: (clave: string, valor: string) => void;
}

const AGRUPACIONES = [
  { valor: "dia", etiqueta: "Por día" },
  { valor: "semana", etiqueta: "Por semana" },
  { valor: "mes", etiqueta: "Por mes" },
];

export function FiltrosReporte({ filtros, opciones, valores, onCambiar }: Props) {
  if (filtros.length === 0) return null;

  const nombreLab = opciones.laboratorios.find((l) => String(l.id) === valores.laboratorio)?.nombre ?? "Todos";
  const nombrePeriodo = opciones.periodos.find((p) => String(p.id) === valores.periodo)?.nombre ?? "Todos";
  const nombreAgrupar = AGRUPACIONES.find((a) => a.valor === (valores.agrupar || "mes"))?.etiqueta ?? "Por mes";

  return (
    <BarraFiltros>
      {filtros.includes("rango") && (
        <>
          <Field label="Desde">
            <Input
              type="date"
              value={valores.desde ?? ""}
              onChange={(_, d) => onCambiar("desde", d.value)}
            />
          </Field>
          <Field label="Hasta">
            <Input
              type="date"
              value={valores.hasta ?? ""}
              onChange={(_, d) => onCambiar("hasta", d.value)}
            />
          </Field>
        </>
      )}

      {filtros.includes("laboratorio") && (
        <Field label="Laboratorio">
          <Dropdown
            value={nombreLab}
            selectedOptions={valores.laboratorio ? [valores.laboratorio] : [""]}
            onOptionSelect={(_, d) => onCambiar("laboratorio", d.optionValue ?? "")}
          >
            <Option value="">Todos</Option>
            {opciones.laboratorios.map((l) => (
              <Option key={l.id} value={String(l.id)}>
                {l.nombre}
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}

      {filtros.includes("periodo") && (
        <Field label="Periodo">
          <Dropdown
            value={nombrePeriodo}
            selectedOptions={valores.periodo ? [valores.periodo] : [""]}
            onOptionSelect={(_, d) => onCambiar("periodo", d.optionValue ?? "")}
          >
            <Option value="">Todos</Option>
            {opciones.periodos.map((p) => (
              <Option key={p.id} value={String(p.id)}>
                {p.nombre}
                {p.vigente ? " (vigente)" : ""}
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}

      {filtros.includes("agrupar") && (
        <Field label="Agrupar">
          <Dropdown
            value={nombreAgrupar}
            selectedOptions={[valores.agrupar || "mes"]}
            onOptionSelect={(_, d) => onCambiar("agrupar", d.optionValue ?? "mes")}
          >
            {AGRUPACIONES.map((a) => (
              <Option key={a.valor} value={a.valor}>
                {a.etiqueta}
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}

      {filtros.includes("buscar") && (
        <Field label="Buscar">
          <Input value={valores.buscar ?? ""} onChange={(_, d) => onCambiar("buscar", d.value)} />
        </Field>
      )}
    </BarraFiltros>
  );
}
