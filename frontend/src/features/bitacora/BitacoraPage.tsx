import { EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { ListaBitacora } from "./ListaBitacora";

export function BitacoraPage() {
  return (
    <ListaBitacora
      encabezado={(accion) => (
        <EncabezadoPagina
          seccion="Recursos"
          titulo="Bitácora"
          descripcion="Lo que se hizo o pasó en cada laboratorio: instalaciones, fallas, mantenimiento y revisiones."
          acciones={accion}
        />
      )}
    />
  );
}
