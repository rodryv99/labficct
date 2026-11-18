/** Dibuja un resultado de reporte: tarjetas KPI, gráficos y la tabla de datos. */
import { makeStyles } from "@fluentui/react-components";

import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import type { Celda, DatosReporte } from "./api";
import { Grafico } from "./Graficos";
import { TarjetasKpi } from "./TarjetasKpi";

interface FilaTabla {
  id: number;
  celdas: Celda[];
}

const useEstilos = makeStyles({
  raiz: { display: "flex", flexDirection: "column", gap: "20px" },
  grilla: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
    "@media (max-width: 900px)": { gridTemplateColumns: "1fr" },
  },
  anchoCompleto: { gridColumn: "1 / -1" },
  numero: { fontVariantNumeric: "tabular-nums" },
});

function textoCelda(valor: Celda): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  return String(valor);
}

export function ResultadoReporte({ datos, mostrarTabla = true }: { datos: DatosReporte; mostrarTabla?: boolean }) {
  const estilos = useEstilos();

  const columnas: Columna<FilaTabla>[] = datos.columnas.map((c, idx) => ({
    clave: c.clave,
    titulo: c.titulo,
    render: (fila) => {
      const esNumero = c.tipo === "numero" || c.tipo === "porcentaje" || c.tipo === "duracion";
      return <span className={esNumero ? estilos.numero : undefined}>{textoCelda(fila.celdas[idx])}</span>;
    },
  }));

  const filas: FilaTabla[] = datos.filas.map((celdas, i) => ({ id: i, celdas }));

  return (
    <div className={estilos.raiz}>
      <TarjetasKpi kpis={datos.kpis} />

      {datos.graficos.length > 0 && (
        <div className={estilos.grilla}>
          {datos.graficos.map((g, i) => (
            <div key={i} className={g.ancho >= 2 ? estilos.anchoCompleto : undefined}>
              <Grafico grafico={g} />
            </div>
          ))}
        </div>
      )}

      {mostrarTabla && datos.columnas.length > 0 && (
        <TablaDatos
          etiqueta="Datos del reporte"
          columnas={columnas}
          filas={filas}
          claveFila={(f) => f.id}
        />
      )}
    </div>
  );
}
