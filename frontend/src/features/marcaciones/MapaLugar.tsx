import { Caption1, Link, makeStyles, tokens } from "@fluentui/react-components";

import { enlaceMapa } from "./api";

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  marco: {
    width: "100%",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  pie: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    flexWrap: "wrap",
    color: tokens.colorNeutralForeground3,
  },
});

interface Props {
  latitud: number;
  longitud: number;
  /** Para elegir cuánto mapa se ve alrededor del punto. */
  radioM?: number;
  alto?: number;
  titulo?: string;
}

/** Mapa de OpenStreetMap con un marcador en el punto. No necesita claves ni instalar nada. */
export function MapaLugar({ latitud, longitud, radioM = 100, alto = 220, titulo = "Mapa del lugar" }: Props) {
  const estilos = useEstilos();
  // Unos tres radios hacia cada lado (un grado son unos 111 km).
  const margen = Math.max(0.0015, (radioM * 3) / 111_000);
  const caja = [longitud - margen, latitud - margen, longitud + margen, latitud + margen]
    .map((n) => n.toFixed(6))
    .join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${caja}&layer=mapnik&marker=${latitud.toFixed(6)},${longitud.toFixed(6)}`;

  return (
    <div className={estilos.raiz}>
      <iframe
        className={estilos.marco}
        title={titulo}
        src={src}
        height={alto}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className={estilos.pie}>
        <Caption1>
          {latitud.toFixed(6)}, {longitud.toFixed(6)}
        </Caption1>
        <Link href={enlaceMapa(latitud, longitud)} target="_blank" rel="noreferrer">
          Abrir en Google Maps
        </Link>
      </div>
    </div>
  );
}
