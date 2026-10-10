import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { errorDeConfiguracion } from "./config/env";
import "./styles/global.css";

const raiz = createRoot(document.getElementById("root")!);

if (errorDeConfiguracion) {
  // Sin .env la web no sabe dónde está la API: se avisa en pantalla, sin adivinar.
  raiz.render(
    <div style={{ fontFamily: "Segoe UI, system-ui, sans-serif", padding: 32, maxWidth: 640 }}>
      <h1 style={{ fontSize: 20 }}>Falta configurar la web</h1>
      <p>{errorDeConfiguracion}</p>
    </div>,
  );
} else {
  raiz.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
