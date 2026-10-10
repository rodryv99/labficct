import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router/dom";

import { ContenedorNotificaciones } from "../components/feedback/notificaciones";
import { router } from "./router";
import { SesionProvider } from "./sesion";
import { TemaProvider } from "./TemaProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (intentos, error) => {
        const estado = (error as { response?: { status?: number } }).response?.status;
        if (estado && estado >= 400 && estado < 500) return false;
        return intentos < 2;
      },
      refetchOnWindowFocus: true,
    },
  },
});

export function App() {
  return (
    <TemaProvider>
      <QueryClientProvider client={queryClient}>
        <SesionProvider>
          <RouterProvider router={router} />
          <ContenedorNotificaciones />
        </SesionProvider>
      </QueryClientProvider>
    </TemaProvider>
  );
}
