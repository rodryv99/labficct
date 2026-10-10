import { Button, Caption1, makeStyles, tokens } from "@fluentui/react-components";

import { IconoAnterior, IconoSiguiente } from "../iconos/iconos";

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 4px 0",
    color: tokens.colorNeutralForeground3,
  },
  botones: {
    display: "flex",
    gap: "4px",
  },
});

interface Props {
  pagina: number;
  total: number;
  tamano: number;
  onCambiar: (pagina: number) => void;
}

export function Paginacion({ pagina, total, tamano, onCambiar }: Props) {
  const estilos = useEstilos();
  if (total === 0) return null;
  const paginas = Math.max(1, Math.ceil(total / tamano));
  const desde = (pagina - 1) * tamano + 1;
  const hasta = Math.min(total, pagina * tamano);

  return (
    <div className={estilos.raiz}>
      <Caption1>
        {desde}–{hasta} de {total}
      </Caption1>
      {paginas > 1 && (
        <div className={estilos.botones}>
          <Button
            size="small"
            appearance="subtle"
            icon={<IconoAnterior />}
            disabled={pagina <= 1}
            onClick={() => onCambiar(pagina - 1)}
          >
            Anterior
          </Button>
          <Button
            size="small"
            appearance="subtle"
            icon={<IconoSiguiente />}
            iconPosition="after"
            disabled={pagina >= paginas}
            onClick={() => onCambiar(pagina + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
