import { Toast, ToastBody, ToastTitle, Toaster, useToastController } from "@fluentui/react-components";
import { useMemo } from "react";

export const ID_NOTIFICACIONES = "notificaciones-app";

export function ContenedorNotificaciones() {
  return <Toaster toasterId={ID_NOTIFICACIONES} position="bottom-end" pauseOnHover pauseOnWindowBlur />;
}

type Tono = "success" | "error" | "warning" | "info";

/** Avisos breves en la esquina inferior derecha. */
export function useNotificar() {
  const { dispatchToast } = useToastController(ID_NOTIFICACIONES);
  return useMemo(() => {
    const mostrar = (intent: Tono, titulo: string, cuerpo?: string) =>
      dispatchToast(
        <Toast>
          <ToastTitle>{titulo}</ToastTitle>
          {cuerpo ? <ToastBody>{cuerpo}</ToastBody> : null}
        </Toast>,
        { intent, timeout: intent === "error" || intent === "warning" ? 8000 : 4000 },
      );
    return {
      exito: (titulo: string, cuerpo?: string) => mostrar("success", titulo, cuerpo),
      error: (titulo: string, cuerpo?: string) => mostrar("error", titulo, cuerpo),
      aviso: (titulo: string, cuerpo?: string) => mostrar("warning", titulo, cuerpo),
      info: (titulo: string, cuerpo?: string) => mostrar("info", titulo, cuerpo),
    };
  }, [dispatchToast]);
}
