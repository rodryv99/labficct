import { Body1, Button, Subtitle2, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import type { ReactNode } from "react";

import { mensajeDeError } from "../../api/errores";
import { IconoError, IconoRecargar } from "../iconos/iconos";

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: "8px",
    padding: "48px 24px",
    color: tokens.colorNeutralForeground2,
  },
  icono: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    marginBottom: "4px",
    "& svg": {
      width: "24px",
      height: "24px",
    },
  },
  iconoError: {
    backgroundColor: tokens.colorStatusDangerBackground1,
    color: tokens.colorStatusDangerForeground1,
  },
  texto: {
    maxWidth: "420px",
    color: tokens.colorNeutralForeground3,
  },
  accion: {
    marginTop: "8px",
  },
});

interface VacioProps {
  icono: ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}

/** Estado vacío que enseña: qué va aquí y cómo crear lo primero. */
export function EstadoVacio({ icono, titulo, descripcion, accion }: VacioProps) {
  const estilos = useEstilos();
  return (
    <div className={estilos.raiz}>
      <div className={estilos.icono}>{icono}</div>
      <Subtitle2>{titulo}</Subtitle2>
      {descripcion && <Body1 className={estilos.texto}>{descripcion}</Body1>}
      {accion && <div className={estilos.accion}>{accion}</div>}
    </div>
  );
}

export function EstadoError({ error, onReintentar }: { error: unknown; onReintentar?: () => void }) {
  const estilos = useEstilos();
  return (
    <div className={estilos.raiz} role="alert">
      <div className={mergeClasses(estilos.icono, estilos.iconoError)}>
        <IconoError />
      </div>
      <Subtitle2>No se pudo cargar</Subtitle2>
      <Body1 className={estilos.texto}>{mensajeDeError(error)}</Body1>
      {onReintentar && (
        <Button className={estilos.accion} icon={<IconoRecargar />} onClick={onReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
