/** Botón "Exportar" con las cuatro opciones: PDF, Excel, CSV y Word. */
import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  SplitButton,
  Spinner,
  type MenuButtonProps,
} from "@fluentui/react-components";
import { useState } from "react";

import { mensajeDeError } from "../../api/errores";
import { useNotificar } from "../../components/feedback/notificaciones";
import { IconoDescargar } from "../../components/iconos/iconos";
import { type Formato, FORMATOS } from "./api";

interface Props {
  onExportar: (formato: Formato) => Promise<void>;
  disabled?: boolean;
}

export function MenuExportar({ onExportar, disabled }: Props) {
  const notificar = useNotificar();
  const [exportando, setExportando] = useState<Formato | null>(null);

  const exportar = async (formato: Formato) => {
    setExportando(formato);
    try {
      await onExportar(formato);
    } catch (error) {
      notificar.error("No se pudo exportar", mensajeDeError(error));
    } finally {
      setExportando(null);
    }
  };

  const ocupado = exportando !== null;

  return (
    <Menu positioning="below-end">
      <MenuTrigger disableButtonEnhancement>
        {(triggerProps: MenuButtonProps) => (
          <SplitButton
            menuButton={triggerProps}
            primaryActionButton={{ onClick: () => void exportar("pdf") }}
            icon={ocupado ? <Spinner size="tiny" /> : <IconoDescargar />}
            disabled={disabled || ocupado}
            appearance="primary"
          >
            {ocupado ? "Exportando…" : "Exportar"}
          </SplitButton>
        )}
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {FORMATOS.map((f) => (
            <MenuItem key={f.valor} disabled={ocupado} onClick={() => void exportar(f.valor)}>
              {f.etiqueta}
            </MenuItem>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
