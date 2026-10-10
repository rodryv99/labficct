import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { ReactNode } from "react";

const useEstilos = makeStyles({
  superficie: {
    maxWidth: "460px",
  },
  contenido: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  peligro: {
    backgroundColor: tokens.colorStatusDangerBackground3,
    ":hover": {
      backgroundColor: tokens.colorStatusDangerForeground1,
    },
    ":hover:active": {
      backgroundColor: tokens.colorStatusDangerForeground2,
    },
  },
});

interface Props {
  abierto: boolean;
  titulo: string;
  mensaje?: ReactNode;
  textoConfirmar: string;
  peligroso?: boolean;
  cargando?: boolean;
  deshabilitado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
  children?: ReactNode;
}

/** Confirmación solo para lo que no se deshace. El título nombra la cosa. */
export function ConfirmarDialogo({
  abierto,
  titulo,
  mensaje,
  textoConfirmar,
  peligroso,
  cargando,
  deshabilitado,
  onConfirmar,
  onCancelar,
  children,
}: Props) {
  const estilos = useEstilos();
  return (
    <Dialog open={abierto} onOpenChange={(_, datos) => !datos.open && onCancelar()}>
      <DialogSurface className={estilos.superficie}>
        <DialogBody>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogContent className={estilos.contenido}>
            {mensaje}
            {children}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onCancelar} disabled={cargando}>
              Cancelar
            </Button>
            <Button
              appearance="primary"
              className={peligroso ? estilos.peligro : undefined}
              onClick={onConfirmar}
              disabled={cargando || deshabilitado}
              icon={cargando ? <Spinner size="tiny" /> : undefined}
            >
              {textoConfirmar}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
