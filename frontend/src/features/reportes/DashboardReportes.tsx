/** Panel de portada: tarjetas y gráficos de un vistazo. */
import { Spinner, makeStyles } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";

import { EstadoError } from "../../components/feedback/Estados";
import { cargarDashboard } from "./api";
import { ResultadoReporte } from "./ResultadoReporte";

const useEstilos = makeStyles({
  carga: { display: "flex", justifyContent: "center", padding: "48px" },
});

export function DashboardReportes() {
  const estilos = useEstilos();
  const consulta = useQuery({ queryKey: ["reportes", "dashboard"], queryFn: cargarDashboard });

  if (consulta.isLoading) {
    return (
      <div className={estilos.carga}>
        <Spinner label="Cargando panel…" />
      </div>
    );
  }
  if (consulta.isError) {
    return <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />;
  }
  return consulta.data ? <ResultadoReporte datos={consulta.data} mostrarTabla={false} /> : null;
}
