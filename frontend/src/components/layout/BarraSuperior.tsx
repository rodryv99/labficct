import {
  Avatar,
  Menu,
  MenuDivider,
  MenuGroupHeader,
  MenuItem,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";

import { useTema } from "../../app/TemaProvider";
import { identidad } from "../../app/tema";
import { useSesion } from "../../app/sesion";
import { env } from "../../config/env";
import { Campana } from "../../features/notificaciones/Campana";
import { IconoBuscar, IconoLuna, IconoMenu, IconoPassword, IconoSalir, IconoSol } from "../iconos/iconos";

const useEstilos = makeStyles({
  raiz: {
    gridColumn: "1 / -1",
    height: "48px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 12px 0 8px",
    backgroundColor: identidad.azulFicct,
    color: "#ffffff",
  },
  marca: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    paddingRight: "12px",
    minWidth: 0,
  },
  logo: {
    height: "30px",
    width: "auto",
  },
  nombre: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: "nowrap",
    "@media (max-width: 640px)": {
      display: "none",
    },
  },
  boton: {
    height: "36px",
    minWidth: "36px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "0 8px",
    border: "none",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "transparent",
    color: "#ffffff",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "20px",
    ":hover": {
      backgroundColor: "rgba(255, 255, 255, 0.12)",
    },
    ":active": {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    ":focus-visible": {
      outline: "2px solid #ffffff",
      outlineOffset: "-2px",
    },
  },
  buscador: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    justifyContent: "center",
  },
  cajaBusqueda: {
    width: "min(480px, 100%)",
    height: "32px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 10px",
    border: "1px solid rgba(255, 255, 255, 0.24)",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "rgba(255, 255, 255, 0.85)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase300,
    textAlign: "left",
    ":hover": {
      backgroundColor: "rgba(255, 255, 255, 0.16)",
    },
    ":focus-visible": {
      outline: "2px solid #ffffff",
    },
  },
  textoBusqueda: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  atajo: {
    fontSize: tokens.fontSizeBase100,
    border: "1px solid rgba(255, 255, 255, 0.35)",
    borderRadius: tokens.borderRadiusSmall,
    padding: "0 5px",
    lineHeight: "16px",
    "@media (max-width: 640px)": {
      display: "none",
    },
  },
  derecha: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
  },
  avatar: {
    padding: "0 4px",
  },
});

interface Props {
  onMenu: () => void;
  onBuscar: () => void;
  onCambiarPassword: () => void;
}

export function BarraSuperior({ onMenu, onBuscar, onCambiarPassword }: Props) {
  const estilos = useEstilos();
  const { usuario, cerrarSesion } = useSesion();
  const { oscuro, modo, cambiarModo } = useTema();

  return (
    <header className={estilos.raiz}>
      <Tooltip content="Menú" relationship="label">
        <button type="button" className={estilos.boton} onClick={onMenu}>
          <IconoMenu />
        </button>
      </Tooltip>
      <div className={estilos.marca}>
        <img src="/logo-ficct.png" alt="FICCT" className={estilos.logo} />
        <span className={estilos.nombre}>{env.appName}</span>
      </div>

      <div className={estilos.buscador}>
        <button type="button" className={estilos.cajaBusqueda} onClick={onBuscar}>
          <IconoBuscar />
          <span className={estilos.textoBusqueda}>Buscar o ir a…</span>
          <kbd className={estilos.atajo}>Ctrl K</kbd>
        </button>
      </div>

      <div className={estilos.derecha}>
        <Campana className={estilos.boton} />
        <Tooltip content={oscuro ? "Usar tema claro" : "Usar tema oscuro"} relationship="label">
          <button type="button" className={estilos.boton} onClick={() => cambiarModo(oscuro ? "claro" : "oscuro")}>
            {oscuro ? <IconoSol /> : <IconoLuna />}
          </button>
        </Tooltip>

        <Menu
          checkedValues={{ tema: [modo] }}
          onCheckedValueChange={(_, datos) => {
            if (datos.name === "tema" && datos.checkedItems[0]) {
              cambiarModo(datos.checkedItems[0] as "claro" | "oscuro" | "sistema");
            }
          }}
        >
          <MenuTrigger disableButtonEnhancement>
            <button type="button" className={mergeClasses(estilos.boton, estilos.avatar)} aria-label="Cuenta">
              <Avatar name={usuario?.nombre_completo} size={28} color="colorful" />
            </button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuGroupHeader>
                {usuario?.nombre_completo} · {usuario?.rol_nombre}
              </MenuGroupHeader>
              <MenuItem icon={<IconoPassword />} onClick={onCambiarPassword}>
                Cambiar contraseña
              </MenuItem>
              <MenuDivider />
              <MenuGroupHeader>Tema</MenuGroupHeader>
              <MenuItemRadio name="tema" value="sistema">
                Igual que el sistema
              </MenuItemRadio>
              <MenuItemRadio name="tema" value="claro">
                Claro
              </MenuItemRadio>
              <MenuItemRadio name="tema" value="oscuro">
                Oscuro
              </MenuItemRadio>
              <MenuDivider />
              <MenuItem icon={<IconoSalir />} onClick={() => void cerrarSesion()}>
                Cerrar sesión
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
    </header>
  );
}
