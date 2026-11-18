/** Fila de tarjetas resumen (KPI) de un reporte o del panel. */
import { Caption1, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

import { fuentes } from "../../app/tema";
import type { KpiDTO } from "./api";

const useEstilos = makeStyles({
  // Un solo bloque dividido por líneas, como la tabla de datos de un plano.
  grilla: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "1.5px",
    backgroundColor: tokens.colorNeutralStroke2,
    border: `1.5px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    overflow: "hidden",
  },
  celda: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: "12px 18px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },
  valor: {
    fontFamily: fuentes.titulos,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: "36px",
    lineHeight: "38px",
    color: tokens.colorNeutralForeground1,
  },
  etiqueta: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: tokens.colorNeutralForeground3,
  },
  marca: {
    flexShrink: 0,
    width: "8px",
    height: "8px",
  },
  exito: { backgroundColor: tokens.colorPaletteGreenForeground1 },
  aviso: { backgroundColor: tokens.colorPaletteMarigoldForeground1 },
  peligro: { backgroundColor: tokens.colorPaletteRedForeground1 },
  info: { backgroundColor: tokens.colorBrandForeground1 },
  marcaTono: { backgroundColor: tokens.colorBrandForeground1 },
  neutro: { backgroundColor: tokens.colorNeutralForeground4 },
});

export function TarjetasKpi({ kpis }: { kpis: KpiDTO[] }) {
  const estilos = useEstilos();
  if (!kpis.length) return null;
  const tono = (t: KpiDTO["tono"]) => (t === "marca" ? estilos.marcaTono : estilos[t]);
  return (
    <div className={estilos.grilla}>
      {kpis.map((k, i) => (
        <div key={i} className={estilos.celda} title={k.ayuda || undefined}>
          <span className={estilos.valor}>{k.valor}</span>
          <Caption1 className={estilos.etiqueta}>
            <span className={mergeClasses(estilos.marca, tono(k.tono))} aria-hidden="true" />
            {k.etiqueta}
          </Caption1>
        </div>
      ))}
    </div>
  );
}
