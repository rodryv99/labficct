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
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { Docente } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { type DatosDocente, guardarDocente } from "./api";

const useEstilos = makeStyles({
  superficie: {
    maxWidth: "520px",
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
  ayuda: {
    color: tokens.colorNeutralForeground3,
  },
  boton: {
    whiteSpace: "nowrap",
  },
});

const VACIO: DatosDocente = { nombres: "", apellidos: "", email: "", telefono: "", activo: true };

interface Props {
  abierto: boolean;
  /** null = nuevo docente. */
  docente: Docente | null;
  onCerrar: () => void;
  onGuardado?: (docente: Docente) => void;
}

/** Registrar o editar un docente. No necesita usuario: se vincula cuando se le cree uno. */
export function DialogoDocente({ abierto, docente, onCerrar, onGuardado }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const f = useFormulario<DatosDocente>(VACIO);

  useEffect(() => {
    if (!abierto) return;
    f.reiniciar(
      docente
        ? {
            nombres: docente.nombres,
            apellidos: docente.apellidos,
            email: docente.email,
            telefono: docente.telefono,
            activo: docente.activo,
          }
        : VACIO,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, docente]);

  const guardar = useMutation({
    mutationFn: () => guardarDocente(f.valores, docente?.id),
    onSuccess: (d) => {
      notificar.exito(docente ? "Docente actualizado" : "Docente registrado", d.nombre_completo);
      void queryClient.invalidateQueries({ queryKey: ["docentes"] });
      void queryClient.invalidateQueries({ queryKey: ["horarios"] });
      onGuardado?.(d);
      onCerrar();
    },
    onError: f.tomarErroresDelServidor,
  });

  const { valores: v, errores: e } = f;
  const soloGeneral = e.general && !e.nombres && !e.apellidos && !e.email && !e.telefono;

  return (
    <Dialog open={abierto} onOpenChange={(_, d) => !d.open && onCerrar()}>
      <DialogSurface className={estilos.superficie}>
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            guardar.mutate();
          }}
        >
          <DialogBody>
            <DialogTitle>{docente ? `Editar a ${docente.nombre_completo}` : "Nuevo docente"}</DialogTitle>
            <DialogContent className={estilos.contenido}>
              {!docente && (
                <Caption1 className={estilos.ayuda}>
                  No necesita tener usuario. Cuando le crees uno con rol Docente, podrás vincularlo a esta ficha y
                  verá sus clases.
                </Caption1>
              )}
              {soloGeneral && (
                <MessageBar intent="error">
                  <MessageBarBody>{e.general}</MessageBarBody>
                </MessageBar>
              )}
              <div className={estilos.fila}>
                <Field label="Nombres" required {...estadoCampo(e.nombres)}>
                  <Input autoFocus value={v.nombres} onChange={(_, d) => f.set("nombres", d.value)} />
                </Field>
                <Field label="Apellidos" required {...estadoCampo(e.apellidos)}>
                  <Input value={v.apellidos} onChange={(_, d) => f.set("apellidos", d.value)} />
                </Field>
              </div>
              <div className={estilos.fila}>
                <Field
                  label="Correo"
                  hint="Si luego se crea un usuario con este correo, se vincula solo."
                  {...estadoCampo(e.email)}
                >
                  <Input type="email" value={v.email} onChange={(_, d) => f.set("email", d.value)} />
                </Field>
                <Field label="Teléfono" {...estadoCampo(e.telefono)}>
                  <Input type="tel" value={v.telefono} onChange={(_, d) => f.set("telefono", d.value)} />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button className={estilos.boton} onClick={onCerrar} disabled={guardar.isPending}>
                Cancelar
              </Button>
              <Button
                className={estilos.boton}
                appearance="primary"
                type="submit"
                disabled={!v.nombres.trim() || !v.apellidos.trim() || guardar.isPending}
                icon={guardar.isPending ? <Spinner size="tiny" /> : undefined}
              >
                {docente ? "Guardar" : "Registrar docente"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
