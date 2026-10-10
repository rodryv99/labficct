import {
  Button,
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
  makeStyles,
} from "@fluentui/react-components";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";

import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { useNotificar } from "../feedback/notificaciones";

const useEstilos = makeStyles({
  contenido: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
});

const VACIO = { actual: "", nueva: "", confirmar: "" };

export function CambiarPasswordDialogo({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const f = useFormulario(VACIO);

  useEffect(() => {
    if (abierto) f.reiniciar(VACIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const guardar = useMutation({
    mutationFn: () =>
      api.post(ENDPOINTS.auth.cambiarPassword, { actual: f.valores.actual, nueva: f.valores.nueva }),
    onSuccess: () => {
      notificar.exito("Contraseña actualizada");
      onCerrar();
    },
    onError: f.tomarErroresDelServidor,
  });

  const enviar = () => {
    if (f.valores.nueva !== f.valores.confirmar) {
      f.setErrores({ confirmar: "Las contraseñas no coinciden." });
      return;
    }
    guardar.mutate();
  };

  const listo = f.valores.actual && f.valores.nueva.length >= 8 && f.valores.confirmar;

  return (
    <Dialog open={abierto} onOpenChange={(_, d) => !d.open && onCerrar()}>
      <DialogSurface style={{ maxWidth: 420 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <DialogBody>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogContent className={estilos.contenido}>
              {f.errores.general && !f.errores.actual && !f.errores.nueva && (
                <MessageBar intent="error">
                  <MessageBarBody>{f.errores.general}</MessageBarBody>
                </MessageBar>
              )}
              <Field label="Contraseña actual" required {...estadoCampo(f.errores.actual)}>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={f.valores.actual}
                  onChange={(_, d) => f.set("actual", d.value)}
                />
              </Field>
              <Field
                label="Contraseña nueva"
                required
                hint="Al menos 8 caracteres, que no sea solo números."
                {...estadoCampo(f.errores.nueva)}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={f.valores.nueva}
                  onChange={(_, d) => f.set("nueva", d.value)}
                />
              </Field>
              <Field label="Repite la contraseña nueva" required {...estadoCampo(f.errores.confirmar)}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={f.valores.confirmar}
                  onChange={(_, d) => f.set("confirmar", d.value)}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button appearance="primary" type="submit" disabled={!listo || guardar.isPending}>
                {guardar.isPending ? "Guardando…" : "Cambiar contraseña"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
