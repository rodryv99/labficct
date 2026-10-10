import { Button, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import { useRef } from "react";

import { useUrlObjeto } from "../../lib/useUrlObjeto";
import { IconoEliminar, IconoImagen } from "../iconos/iconos";

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  vista: {
    width: "96px",
    height: "96px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
    color: tokens.colorNeutralForeground4,
  },
  imagen: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  acciones: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "6px",
  },
  ayuda: {
    color: tokens.colorNeutralForeground3,
  },
  oculto: {
    display: "none",
  },
});

interface Props {
  /** URL de la imagen ya guardada. */
  actual: string | null;
  archivo: File | null;
  quitada: boolean;
  onArchivo: (archivo: File | null) => void;
  onQuitar: () => void;
  textoBoton?: string;
  /** En celulares abre directamente la cámara trasera. */
  camara?: boolean;
}

export function CampoImagen({ actual, archivo, quitada, onArchivo, onQuitar, textoBoton = "Subir imagen", camara }: Props) {
  const estilos = useEstilos();
  const entrada = useRef<HTMLInputElement>(null);
  const vistaPrevia = useUrlObjeto(archivo);

  const mostrar = vistaPrevia ?? (quitada ? null : actual);

  return (
    <div className={estilos.raiz}>
      <div className={estilos.vista}>
        {mostrar ? <img src={mostrar} alt="Vista previa" className={estilos.imagen} /> : <IconoImagen />}
      </div>
      <div className={estilos.acciones}>
        <Button size="small" icon={<IconoImagen />} onClick={() => entrada.current?.click()}>
          {mostrar ? "Cambiar" : textoBoton}
        </Button>
        {mostrar && (
          <Button
            size="small"
            appearance="subtle"
            icon={<IconoEliminar />}
            onClick={() => {
              onArchivo(null);
              onQuitar();
              if (entrada.current) entrada.current.value = "";
            }}
          >
            Quitar
          </Button>
        )}
        <Caption1 className={estilos.ayuda}>JPG, PNG o WEBP · máximo 5 MB</Caption1>
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={camara ? "environment" : undefined}
        className={estilos.oculto}
        onChange={(e) => onArchivo(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
