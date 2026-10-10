import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

import { IconoCerrar } from "../iconos/iconos";

const useEstilos = makeStyles({
  superficie: {
    width: "min(1100px, calc(100vw - 32px))",
    maxWidth: "none",
    padding: "16px",
  },
  contenido: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    minHeight: "240px",
  },
  imagen: {
    display: "block",
    maxWidth: "100%",
    maxHeight: "calc(100vh - 160px)",
    objectFit: "contain",
  },
  pie: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "12px",
  },
});

interface Props {
  /** URL de la imagen (pública o una URL local creada desde un archivo); null = cerrado. */
  src: string | null;
  titulo: string;
  onCerrar: () => void;
}

/** Muestra una foto a tamaño completo, sin recortes. */
export function VisorImagen({ src, titulo, onCerrar }: Props) {
  const estilos = useEstilos();
  return (
    <Dialog open={src !== null} onOpenChange={(_, d) => !d.open && onCerrar()}>
      <DialogSurface className={estilos.superficie}>
        <DialogBody>
          <DialogTitle
            action={<Button appearance="subtle" aria-label="Cerrar" icon={<IconoCerrar />} onClick={onCerrar} />}
          >
            {titulo}
          </DialogTitle>
          <DialogContent>
            <div className={estilos.contenido}>{src && <img src={src} alt={titulo} className={estilos.imagen} />}</div>
            <div className={estilos.pie}>
              {src && (
                <Button as="a" href={src} target="_blank" rel="noreferrer">
                  Abrir en otra pestaña
                </Button>
              )}
              <Button appearance="primary" onClick={onCerrar}>
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
