import { Body1, Button, Spinner, Subtitle2, Text, Title3, makeStyles, tokens } from "@fluentui/react-components";
import { useState } from "react";

import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { useSesion } from "../../app/sesion";
import { TERMINOS_INTRO, TERMINOS_SECCIONES, TERMINOS_TITULO } from "./terminos";

const useEstilos = makeStyles({
  raiz: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    backgroundColor: tokens.colorNeutralBackgroundAlpha2,
  },
  tarjeta: {
    display: "flex",
    flexDirection: "column",
    width: "min(640px, 100%)",
    maxHeight: "90vh",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow28,
    overflow: "hidden",
  },
  cabecera: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "24px 24px 12px",
  },
  cuerpo: {
    overflowY: "auto",
    padding: "4px 24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  seccion: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  pie: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    padding: "12px 24px 20px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    marginRight: "auto",
    alignSelf: "center",
  },
});

/**
 * Pantalla bloqueante de términos y condiciones. Se muestra tras iniciar sesión
 * mientras el usuario no haya aceptado la versión vigente. Si acepta, continúa;
 * si rechaza, se cierra la sesión (y le volverá a aparecer la próxima vez).
 */
export function PantallaTerminos() {
  const estilos = useEstilos();
  const { recargarUsuario, cerrarSesion } = useSesion();
  const [enviando, setEnviando] = useState<"aceptar" | "rechazar" | null>(null);
  const [error, setError] = useState("");

  const aceptar = async () => {
    setError("");
    setEnviando("aceptar");
    try {
      await api.post(ENDPOINTS.auth.aceptarTerminos);
      await recargarUsuario();
    } catch {
      setError("No se pudo registrar la aceptación. Revisa tu conexión e inténtalo de nuevo.");
      setEnviando(null);
    }
  };

  const rechazar = async () => {
    setEnviando("rechazar");
    try {
      await cerrarSesion();
    } catch {
      setEnviando(null);
    }
  };

  return (
    <div className={estilos.raiz} role="dialog" aria-modal="true" aria-label={TERMINOS_TITULO}>
      <div className={estilos.tarjeta}>
        <div className={estilos.cabecera}>
          <Title3>{TERMINOS_TITULO}</Title3>
          <Body1>{TERMINOS_INTRO}</Body1>
        </div>
        <div className={estilos.cuerpo}>
          {TERMINOS_SECCIONES.map((s) => (
            <div key={s.titulo} className={estilos.seccion}>
              <Subtitle2>{s.titulo}</Subtitle2>
              <Body1>{s.cuerpo}</Body1>
            </div>
          ))}
        </div>
        <div className={estilos.pie}>
          {error && (
            <Text size={200} className={estilos.error}>
              {error}
            </Text>
          )}
          <Button appearance="secondary" disabled={enviando !== null} onClick={rechazar}>
            {enviando === "rechazar" ? "Cerrando sesión…" : "No acepto"}
          </Button>
          <Button
            appearance="primary"
            disabled={enviando !== null}
            icon={enviando === "aceptar" ? <Spinner size="tiny" /> : undefined}
            onClick={aceptar}
          >
            Acepto los términos
          </Button>
        </div>
      </div>
    </div>
  );
}
