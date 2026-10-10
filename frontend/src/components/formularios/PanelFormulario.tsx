import {
  Button,
  Caption1,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { type ReactNode, useState } from "react";

import { ConfirmarDialogo } from "../feedback/ConfirmarDialogo";
import { IconoCerrar } from "../iconos/iconos";

const useEstilos = makeStyles({
  subtitulo: {
    color: tokens.colorNeutralForeground3,
    display: "block",
    marginTop: "2px",
  },
  cuerpo: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    paddingBottom: "24px",
  },
  pie: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    padding: "16px 24px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
});

interface Props {
  abierto: boolean;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  tamano?: "small" | "medium" | "large";
  /** Si hay cambios sin guardar, pregunta antes de cerrar. */
  hayCambios?: boolean;
}

/** Panel lateral para crear, editar o ver el detalle sin perder la lista de fondo. */
export function PanelFormulario({
  abierto,
  titulo,
  subtitulo,
  onCerrar,
  children,
  pie,
  tamano = "medium",
  hayCambios = false,
}: Props) {
  const estilos = useEstilos();
  const [confirmando, setConfirmando] = useState(false);

  const intentarCerrar = () => {
    if (hayCambios) setConfirmando(true);
    else onCerrar();
  };

  return (
    <>
      <OverlayDrawer
        open={abierto}
        position="end"
        size={tamano}
        onOpenChange={(_, datos) => !datos.open && intentarCerrar()}
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button appearance="subtle" aria-label="Cerrar" icon={<IconoCerrar />} onClick={intentarCerrar} />
            }
          >
            {titulo}
          </DrawerHeaderTitle>
          {subtitulo && <Caption1 className={estilos.subtitulo}>{subtitulo}</Caption1>}
        </DrawerHeader>
        <DrawerBody>
          <div className={estilos.cuerpo}>{children}</div>
        </DrawerBody>
        {pie && <div className={estilos.pie}>{pie}</div>}
      </OverlayDrawer>
      <ConfirmarDialogo
        abierto={confirmando}
        titulo="¿Descartar los cambios?"
        mensaje="Lo que escribiste en este panel no se guardó."
        textoConfirmar="Descartar"
        peligroso
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => {
          setConfirmando(false);
          onCerrar();
        }}
      />
    </>
  );
}
