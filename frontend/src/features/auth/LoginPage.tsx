import {
  Body1,
  Button,
  Caption1,
  Checkbox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Title2,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router";

import { mensajeDeError } from "../../api/errores";
import { primeraRuta } from "../../app/navegacion";
import { useSesion } from "../../app/sesion";
import { identidad } from "../../app/tema";
import { IconoOcultar, IconoVer } from "../../components/iconos/iconos";
import { PantallaCarga } from "../../components/feedback/PantallaCarga";
import { env } from "../../config/env";

const ANGOSTO = "@media (max-width: 820px)";

const useEstilos = makeStyles({
  raiz: {
    height: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(380px, 44%) 1fr",
    backgroundColor: tokens.colorNeutralBackground1,
    [ANGOSTO]: {
      gridTemplateColumns: "1fr",
      gridTemplateRows: "auto 1fr",
    },
  },
  marca: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "48px",
    color: "#ffffff",
    backgroundColor: identidad.azulFicct,
    // Trama de cuadrícula: la grilla de los laboratorios como firma visual.
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
    backgroundSize: "32px 32px",
    overflow: "hidden",
    [ANGOSTO]: {
      padding: "24px",
      flexDirection: "row",
      alignItems: "center",
      gap: "16px",
    },
  },
  marcaCentro: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "20px",
    marginTop: "auto",
    marginBottom: "auto",
    [ANGOSTO]: {
      flexDirection: "row",
      alignItems: "center",
      margin: "0",
    },
  },
  logo: {
    width: "132px",
    height: "auto",
    filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.25))",
    [ANGOSTO]: {
      width: "56px",
    },
  },
  titulo: {
    margin: "0",
    fontSize: "40px",
    lineHeight: "48px",
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: "-0.01em",
    [ANGOSTO]: {
      fontSize: "22px",
      lineHeight: "28px",
    },
  },
  acento: {
    width: "48px",
    height: "4px",
    borderRadius: "2px",
    backgroundColor: identidad.oro,
    [ANGOSTO]: {
      display: "none",
    },
  },
  lema: {
    maxWidth: "380px",
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase400,
    color: "rgba(255,255,255,0.82)",
    [ANGOSTO]: {
      display: "none",
    },
  },
  facultad: {
    color: "rgba(255,255,255,0.7)",
    maxWidth: "360px",
    [ANGOSTO]: {
      display: "none",
    },
  },
  lado: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
  },
  formulario: {
    width: "100%",
    maxWidth: "360px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  encabezado: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  subtitulo: {
    color: tokens.colorNeutralForeground3,
  },
  boton: {
    width: "100%",
  },
  ayuda: {
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
  },
  pie: {
    marginTop: "48px",
    color: tokens.colorNeutralForeground4,
  },
});

export function LoginPage() {
  const estilos = useEstilos();
  const { estado, iniciarSesion, puede, sesionExpirada } = useSesion();
  const ubicacion = useLocation();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [recordar, setRecordar] = useState(true);
  const [verPassword, setVerPassword] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (estado === "cargando") return <PantallaCarga />;
  if (estado === "autenticado") {
    const desde = (ubicacion.state as { desde?: string } | null)?.desde;
    return <Navigate to={desde && desde !== "/" ? desde : primeraRuta(puede)} replace />;
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await iniciarSesion(usuario.trim(), password, recordar);
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo iniciar sesión."));
      setEnviando(false);
    }
  };

  return (
    <div className={estilos.raiz}>
      <aside className={estilos.marca}>
        <div className={estilos.marcaCentro}>
          <img src="/logo-ficct.png" alt="Logo de la FICCT" className={estilos.logo} />
          <h1 className={estilos.titulo}>{env.appName}</h1>
          <div className={estilos.acento} />
          <p className={estilos.lema}>
            Horarios, reservas, laboratorios y objetos perdidos de la facultad, en un solo lugar.
          </p>
        </div>
        <Caption1 className={estilos.facultad}>
          Facultad de Ingeniería en Ciencias de la Computación y Telecomunicaciones · UAGRM
        </Caption1>
      </aside>

      <main className={estilos.lado}>
        <form className={estilos.formulario} onSubmit={enviar} noValidate>
          <div className={estilos.encabezado}>
            <Title2 as="h2">Iniciar sesión</Title2>
            <Body1 className={estilos.subtitulo}>Usa tu correo o tu código institucional.</Body1>
          </div>

          {sesionExpirada && !error && (
            <MessageBar intent="info">
              <MessageBarBody>Tu sesión terminó. Vuelve a iniciar sesión.</MessageBarBody>
            </MessageBar>
          )}
          {error && (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}

          <Field label="Correo o código" required>
            <Input
              size="large"
              autoFocus
              autoComplete="username"
              value={usuario}
              onChange={(_, d) => setUsuario(d.value)}
            />
          </Field>

          <Field
            label="Contraseña"
            required
            validationState={mayusculas ? "warning" : "none"}
            validationMessage={mayusculas ? "Bloq Mayús está activado." : undefined}
          >
            <Input
              size="large"
              type={verPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(_, d) => setPassword(d.value)}
              onKeyUp={(e) => setMayusculas(e.getModifierState("CapsLock"))}
              contentAfter={
                <Button
                  appearance="transparent"
                  size="small"
                  aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  icon={verPassword ? <IconoOcultar /> : <IconoVer />}
                  onClick={() => setVerPassword((v) => !v)}
                />
              }
            />
          </Field>

          <Checkbox
            label="Mantener la sesión iniciada en este equipo"
            checked={recordar}
            onChange={(_, d) => setRecordar(Boolean(d.checked))}
          />

          <Button
            appearance="primary"
            size="large"
            type="submit"
            className={estilos.boton}
            disabled={!usuario.trim() || !password || enviando}
            icon={enviando ? <Spinner size="tiny" appearance="inverted" /> : undefined}
          >
            {enviando ? "Ingresando…" : "Iniciar sesión"}
          </Button>

          <Caption1 className={estilos.ayuda}>
            ¿Olvidaste tu contraseña? Pídele al jefe de laboratorio que la restablezca.
          </Caption1>
        </form>
        <Caption1 className={estilos.pie}>© {new Date().getFullYear()} FICCT · UAGRM</Caption1>
      </main>
    </div>
  );
}
