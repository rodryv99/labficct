/**
 * Módulo de Reportes / BI (solo Admin). A la izquierda, el catálogo: el panel de
 * portada, los reportes por grupo y el constructor dinámico. A la derecha, lo
 * elegido.
 */
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Spinner,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import { EstadoError } from "../../components/feedback/Estados";
import { IconoConstructor, IconoReportes } from "../../components/iconos/iconos";
import { EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { type ReporteMeta, cargarCatalogo } from "./api";
import { ConstructorPivote } from "./ConstructorPivote";
import { DashboardReportes } from "./DashboardReportes";
import { VistaReporte } from "./VistaReporte";

const useEstilos = makeStyles({
  disposicion: {
    display: "grid",
    gridTemplateColumns: "250px minmax(0, 1fr)",
    gap: "24px",
    alignItems: "start",
    "@media (max-width: 860px)": { gridTemplateColumns: "1fr" },
  },
  menu: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    position: "sticky",
    top: "16px",
    "@media (max-width: 860px)": { position: "static" },
  },
  boton: {
    justifyContent: "flex-start",
    width: "100%",
  },
  activo: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    fontWeight: tokens.fontWeightSemibold,
  },
  grupo: { display: "flex", flexDirection: "column", gap: "2px", paddingBottom: "4px" },
  itemReporte: {
    justifyContent: "flex-start",
    width: "100%",
    fontWeight: tokens.fontWeightRegular,
  },
  separador: {
    height: "1px",
    backgroundColor: tokens.colorNeutralStroke2,
    margin: "6px 0",
  },
  carga: { display: "flex", justifyContent: "center", padding: "64px" },
});

export function ReportesPage() {
  const estilos = useEstilos();
  const [params, setParams] = useSearchParams();
  const catalogo = useQuery({ queryKey: ["reportes", "catalogo"], queryFn: cargarCatalogo });

  const vista = params.get("v") ?? "panel";
  const reporteId = params.get("r") ?? "";

  const ir = (v: string, r?: string) => {
    const nuevos = new URLSearchParams();
    nuevos.set("v", v);
    if (r) nuevos.set("r", r);
    setParams(nuevos, { replace: true });
  };

  const reportes: ReporteMeta[] = (catalogo.data?.grupos ?? []).flatMap((g) => g.reportes);
  const metaActual = reportes.find((r) => r.id === reporteId);

  return (
    <div>
      <EncabezadoPagina
        seccion="Análisis"
        titulo="Reportes"
        descripcion="Tablero, reportes e informes del sistema. Exportables a PDF, Excel, CSV y Word."
      />

      {catalogo.isLoading ? (
        <div className={estilos.carga}>
          <Spinner label="Cargando reportes…" />
        </div>
      ) : catalogo.isError ? (
        <EstadoError error={catalogo.error} onReintentar={() => void catalogo.refetch()} />
      ) : (
        <div className={estilos.disposicion}>
          <nav className={estilos.menu} aria-label="Catálogo de reportes">
            <Button
              appearance="subtle"
              icon={<IconoReportes />}
              className={mergeClasses(estilos.boton, vista === "panel" && estilos.activo)}
              onClick={() => ir("panel")}
            >
              Panel
            </Button>

            <div className={estilos.separador} />

            <Accordion multiple collapsible defaultOpenItems={(catalogo.data?.grupos ?? []).map((g) => g.clave)}>
              {(catalogo.data?.grupos ?? []).map((grupo) => (
                <AccordionItem key={grupo.clave} value={grupo.clave}>
                  <AccordionHeader>{grupo.titulo}</AccordionHeader>
                  <AccordionPanel>
                    <div className={estilos.grupo}>
                      {grupo.reportes.map((r) => (
                        <Button
                          key={r.id}
                          appearance="subtle"
                          size="small"
                          className={mergeClasses(
                            estilos.itemReporte,
                            vista === "reporte" && reporteId === r.id && estilos.activo,
                          )}
                          onClick={() => ir("reporte", r.id)}
                        >
                          {r.nombre}
                        </Button>
                      ))}
                    </div>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>

            <div className={estilos.separador} />

            <Button
              appearance="subtle"
              icon={<IconoConstructor />}
              className={mergeClasses(estilos.boton, vista === "constructor" && estilos.activo)}
              onClick={() => ir("constructor")}
            >
              Constructor dinámico
            </Button>
          </nav>

          <main>
            {vista === "constructor" ? (
              <ConstructorPivote />
            ) : vista === "reporte" && metaActual ? (
              <VistaReporte key={metaActual.id} meta={metaActual} opciones={catalogo.data!.filtros} />
            ) : (
              <DashboardReportes />
            )}
          </main>
        </div>
      )}
    </div>
  );
}
