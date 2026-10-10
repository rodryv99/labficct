import { Button } from "@fluentui/react-components";
import { useNavigate } from "react-router";

import { EstadoVacio } from "../../components/feedback/Estados";
import { IconoCandado } from "../../components/iconos/iconos";

export function SinPermisoPage() {
  const navegar = useNavigate();
  return (
    <EstadoVacio
      icono={<IconoCandado />}
      titulo="Esta sección no está disponible para tu rol"
      descripcion="Si necesitas acceso, pídeselo al jefe de laboratorio."
      accion={<Button onClick={() => navegar("/")}>Ir al inicio</Button>}
    />
  );
}

export function NoEncontradoPage() {
  const navegar = useNavigate();
  return (
    <EstadoVacio
      icono={<IconoCandado />}
      titulo="No encontramos esta página"
      descripcion="Puede que el enlace esté mal escrito o que la página ya no exista."
      accion={<Button onClick={() => navegar("/")}>Ir al inicio</Button>}
    />
  );
}
