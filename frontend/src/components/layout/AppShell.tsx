import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";

import { almacen } from "../../lib/utiles";
import { BarraSuperior } from "./BarraSuperior";
import { CambiarPasswordDialogo } from "./CambiarPasswordDialogo";
import { MenuLateral } from "./MenuLateral";
import { PaletaComandos } from "./PaletaComandos";

const ANGOSTO = "@media (max-width: 900px)";

const useEstilos = makeStyles({
  raiz: {
    height: "100%",
    display: "grid",
    gridTemplateRows: "48px 1fr",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  menu: {
    [ANGOSTO]: {
      position: "fixed",
      top: "48px",
      bottom: "0",
      left: "0",
      zIndex: 20,
      boxShadow: tokens.shadow16,
      transform: "translateX(-100%)",
      transitionProperty: "transform",
      transitionDuration: tokens.durationNormal,
    },
  },
  menuAbiertoMovil: {
    [ANGOSTO]: {
      transform: "translateX(0)",
    },
  },
  velo: {
    display: "none",
    [ANGOSTO]: {
      display: "block",
      position: "fixed",
      inset: "48px 0 0 0",
      zIndex: 10,
      backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
  },
  contenido: {
    overflowY: "auto",
    minWidth: 0,
    padding: "24px 32px 40px",
    [ANGOSTO]: {
      gridColumn: "1 / -1",
      padding: "16px",
    },
  },
});

const CLAVE_MENU = "labficct.menu-colapsado";

export function AppShell() {
  const estilos = useEstilos();
  const [colapsado, setColapsado] = useState(() => almacen.leer(CLAVE_MENU) === "1");
  const [menuMovil, setMenuMovil] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const [cambiarPassword, setCambiarPassword] = useState(false);

  // Ctrl+K o ⌘K abre la búsqueda rápida desde cualquier pantalla.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaleta(true);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  const alternarMenu = () => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      setMenuMovil((v) => !v);
      return;
    }
    setColapsado((v) => {
      almacen.guardar(CLAVE_MENU, v ? "0" : "1");
      return !v;
    });
  };

  return (
    <div className={estilos.raiz}>
      <BarraSuperior
        onMenu={alternarMenu}
        onBuscar={() => setPaleta(true)}
        onCambiarPassword={() => setCambiarPassword(true)}
      />
      <MenuLateral
        colapsado={colapsado && !menuMovil}
        onAlternar={alternarMenu}
        onNavegar={() => setMenuMovil(false)}
        className={mergeClasses(estilos.menu, menuMovil && estilos.menuAbiertoMovil)}
      />
      {menuMovil && <div className={estilos.velo} onClick={() => setMenuMovil(false)} aria-hidden="true" />}
      <main className={estilos.contenido}>
        <Outlet />
      </main>
      <PaletaComandos abierta={paleta} onCerrar={() => setPaleta(false)} />
      <CambiarPasswordDialogo abierto={cambiarPassword} onCerrar={() => setCambiarPassword(false)} />
    </div>
  );
}
