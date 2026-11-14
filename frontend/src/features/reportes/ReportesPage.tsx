import { Body1, Caption1, Subtitle2, makeStyles, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { EstadoError, EstadoVacio } from "../../components/feedback/Estados";
import { IconoReportes } from "../../components/iconos/iconos";
import { EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { listarReportes } from "./api";
import { ReporteVista } from "./ReporteVista";

const useEstilos = makeStyles({
  grilla: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "12px",
  },
  tarjeta: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    padding: "16px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: "inherit",
    textDecorationLine: "none",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      border: `1px solid ${tokens.colorBrandStroke2}`,
    },
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
    },
  },
  icono: {
    flexShrink: 0,
    width: "36px",
    height: "36px",
    borderRadius: tokens.borderRadiusMedium,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  textos: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  codigo: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
  },
  descripcion: {
    color: tokens.colorNeutralForeground3,
  },
});

/** CU24. Sin código en la URL: la lista de reportes; con código, ese reporte. */
export function ReportesPage() {
  const estilos = useEstilos();
  const { codigo } = useParams();
  const catalogo = useQuery({ queryKey: ["reportes", "catalogo"], queryFn: listarReportes });

  if (catalogo.error) return <EstadoError error={catalogo.error} onReintentar={() => catalogo.refetch()} />;
  if (!catalogo.data) return null;

  if (codigo) {
    const definicion = catalogo.data.find((r) => r.codigo === codigo.toLowerCase());
    if (!definicion) {
      return (
        <EstadoVacio
          icono={<IconoReportes />}
          titulo="Ese reporte no existe"
          descripcion="Vuelve a la lista y elige uno."
          accion={<Link to="/reportes">Ver los reportes</Link>}
        />
      );
    }
    return <ReporteVista key={definicion.codigo} definicion={definicion} />;
  }

  return (
    <>
      <EncabezadoPagina
        seccion="Análisis"
        titulo="Reportes"
        descripcion="Elige un reporte, ajusta los filtros y descárgalo en Excel o PDF."
      />
      <div className={estilos.grilla}>
        {catalogo.data.map((r) => (
          <Link key={r.codigo} to={`/reportes/${r.codigo}`} className={estilos.tarjeta}>
            <span className={estilos.icono}>
              <IconoReportes />
            </span>
            <span className={estilos.textos}>
              <Caption1 className={estilos.codigo}>{r.codigo}</Caption1>
              <Subtitle2>{r.titulo}</Subtitle2>
              <Body1 className={estilos.descripcion}>{r.descripcion}</Body1>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
