import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Spinner,
  Textarea,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";

import { IconoCerrar, IconoImagen } from "../../components/iconos/iconos";
import { useUrlObjeto } from "../../lib/useUrlObjeto";
import type { DatosEntrega } from "./api";

const useEstilos = makeStyles({
  superficie: {
    maxWidth: "620px",
  },
  contenido: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    "@media (max-width: 520px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  fotos: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    "@media (max-width: 520px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
  },
  titulo: {
    color: tokens.colorNeutralForeground3,
  },
  ranura: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    aspectRatio: "4 / 3",
    padding: "8px",
    borderRadius: tokens.borderRadiusMedium,
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground3,
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase200,
    cursor: "pointer",
    overflow: "hidden",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground2Hover,
      borderColor: tokens.colorBrandStroke1,
    },
  },
  ranuraLlena: {
    padding: 0,
    borderStyle: "solid",
    borderColor: tokens.colorNeutralStroke2,
  },
  vista: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  quitar: {
    position: "absolute",
    top: "4px",
    right: "4px",
    minWidth: 0,
  },
  oculto: {
    display: "none",
  },
  boton: {
    whiteSpace: "nowrap",
  },
});

type Foto = "ci_anverso" | "ci_reverso" | "foto_persona";
const RANURAS: { campo: Foto; etiqueta: string; camara: "environment" | "user" }[] = [
  { campo: "ci_anverso", etiqueta: "CI · anverso", camara: "environment" },
  { campo: "ci_reverso", etiqueta: "CI · reverso", camara: "environment" },
  { campo: "foto_persona", etiqueta: "Quien recibe", camara: "user" },
];

const VACIO: DatosEntrega = {
  entregado_a: "",
  entregado_ci: "",
  observacion: "",
  ci_anverso: null,
  ci_reverso: null,
  foto_persona: null,
};

/** Una ranura para foto: en el celular abre la cámara, en la PC el selector de archivos. */
function RanuraFoto({
  etiqueta,
  camara,
  archivo,
  onCambio,
}: {
  etiqueta: string;
  camara: "environment" | "user";
  archivo: File | null;
  onCambio: (archivo: File | null) => void;
}) {
  const estilos = useEstilos();
  const entrada = useRef<HTMLInputElement>(null);
  const vista = useUrlObjeto(archivo);

  return (
    <div>
      <button
        type="button"
        className={mergeClasses(estilos.ranura, vista !== null && estilos.ranuraLlena)}
        onClick={() => entrada.current?.click()}
        aria-label={vista ? `Cambiar foto: ${etiqueta}` : `Agregar foto: ${etiqueta}`}
      >
        {vista ? (
          <img src={vista} alt={etiqueta} className={estilos.vista} />
        ) : (
          <>
            <IconoImagen />
            {etiqueta}
          </>
        )}
      </button>
      {vista && (
        <Caption1 className={estilos.titulo}>
          {etiqueta} ·{" "}
          <Button
            size="small"
            appearance="transparent"
            icon={<IconoCerrar />}
            onClick={() => {
              onCambio(null);
              if (entrada.current) entrada.current.value = "";
            }}
          >
            Quitar
          </Button>
        </Caption1>
      )}
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={camara}
        className={estilos.oculto}
        onChange={(e) => onCambio(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

interface Props {
  abierto: boolean;
  descripcion: string;
  cargando: boolean;
  onCancelar: () => void;
  onConfirmar: (datos: DatosEntrega) => void;
}

export function DialogoEntrega({ abierto, descripcion, cargando, onCancelar, onConfirmar }: Props) {
  const estilos = useEstilos();
  const [datos, setDatos] = useState<DatosEntrega>(VACIO);

  useEffect(() => {
    if (abierto) setDatos(VACIO);
  }, [abierto]);

  const cambiar = <K extends keyof DatosEntrega>(campo: K, valor: DatosEntrega[K]) =>
    setDatos((d) => ({ ...d, [campo]: valor }));

  return (
    <Dialog open={abierto} onOpenChange={(_, d) => !d.open && !cargando && onCancelar()}>
      <DialogSurface className={estilos.superficie}>
        <DialogBody>
          <DialogTitle>Entregar «{descripcion}»</DialogTitle>
          <DialogContent className={estilos.contenido}>
            Registra a quién se entrega. Pide su carnet o CI para comprobar que es el dueño.
            <div className={estilos.fila}>
              <Field label="Nombre de quien recibe" required>
                <Input autoFocus value={datos.entregado_a} onChange={(_, d) => cambiar("entregado_a", d.value)} />
              </Field>
              <Field label="CI">
                <Input value={datos.entregado_ci} onChange={(_, d) => cambiar("entregado_ci", d.value)} />
              </Field>
            </div>
            <Field label="Fotos (opcional)" hint="JPG, PNG o WEBP · máximo 5 MB cada una. Solo las ve quien gestiona objetos perdidos.">
              <div className={estilos.fotos}>
                {RANURAS.map((r) => (
                  <RanuraFoto
                    key={r.campo}
                    etiqueta={r.etiqueta}
                    camara={r.camara}
                    archivo={datos[r.campo] ?? null}
                    onCambio={(archivo) => cambiar(r.campo, archivo)}
                  />
                ))}
              </div>
            </Field>
            <Field label="Observación">
              <Textarea value={datos.observacion} onChange={(_, d) => cambiar("observacion", d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button className={estilos.boton} onClick={onCancelar} disabled={cargando}>
              Cancelar
            </Button>
            <Button
              className={estilos.boton}
              appearance="primary"
              disabled={!datos.entregado_a.trim() || cargando}
              icon={cargando ? <Spinner size="tiny" /> : undefined}
              onClick={() => onConfirmar(datos)}
            >
              Registrar entrega
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
