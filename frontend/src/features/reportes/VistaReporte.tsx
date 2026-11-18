/** Un reporte completo: cabecera, filtros, exportar y el resultado (KPIs + gráficos + tabla). */
import { Body1, Spinner, Subtitle2, makeStyles, tokens } from "@fluentui/react-components";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { EstadoError } from "../../components/feedback/Estados";
import {
  type Filtros,
  type Formato,
  type OpcionesFiltro,
  type ReporteMeta,
  cargarReporte,
  exportarReporte,
} from "./api";
import { FiltrosReporte } from "./FiltrosReporte";
import { MenuExportar } from "./MenuExportar";
import { ResultadoReporte } from "./ResultadoReporte";

const useEstilos = makeStyles({
  cabecera: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  textos: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
  descripcion: { color: tokens.colorNeutralForeground3 },
  carga: { display: "flex", justifyContent: "center", padding: "48px" },
});

function valoresIniciales(meta: ReporteMeta): Record<string, string> {
  const valores: Record<string, string> = {};
  if (meta.filtros.includes("agrupar")) valores.agrupar = "mes";
  return valores;
}

export function VistaReporte({ meta, opciones }: { meta: ReporteMeta; opciones: OpcionesFiltro }) {
  const estilos = useEstilos();
  const [valores, setValores] = useState<Record<string, string>>(() => valoresIniciales(meta));

  const filtrosLimpios: Filtros = useMemo(() => {
    const limpios: Filtros = {};
    for (const [clave, valor] of Object.entries(valores)) {
      if (valor) limpios[clave] = valor;
    }
    return limpios;
  }, [valores]);

  const consulta = useQuery({
    queryKey: ["reportes", "datos", meta.id, filtrosLimpios],
    queryFn: () => cargarReporte(meta.id, filtrosLimpios),
    placeholderData: keepPreviousData,
  });

  const cambiar = (clave: string, valor: string) => setValores((prev) => ({ ...prev, [clave]: valor }));

  return (
    <section>
      <header className={estilos.cabecera}>
        <div className={estilos.textos}>
          <Subtitle2 as="h2">{meta.nombre}</Subtitle2>
          {meta.descripcion && <Body1 className={estilos.descripcion}>{meta.descripcion}</Body1>}
        </div>
        <MenuExportar
          disabled={consulta.isLoading}
          onExportar={(formato: Formato) => exportarReporte(meta.id, formato, filtrosLimpios)}
        />
      </header>

      <FiltrosReporte filtros={meta.filtros} opciones={opciones} valores={valores} onCambiar={cambiar} />

      {consulta.isLoading ? (
        <div className={estilos.carga}>
          <Spinner label="Cargando reporte…" />
        </div>
      ) : consulta.isError ? (
        <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />
      ) : consulta.data ? (
        <ResultadoReporte datos={consulta.data} />
      ) : null}
    </section>
  );
}
