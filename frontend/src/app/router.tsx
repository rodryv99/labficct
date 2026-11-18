import { Navigate, createBrowserRouter, useLocation } from "react-router";

import { AppShell } from "../components/layout/AppShell";
import { AsistenciaPage } from "../features/asistencia/AsistenciaPage";
import { LoginPage } from "../features/auth/LoginPage";
import { BitacoraPage } from "../features/bitacora/BitacoraPage";
import { ElementosPage } from "../features/elementos/ElementosPage";
import { HorariosPage } from "../features/horarios/HorariosPage";
import { InventarioPage } from "../features/inventario/InventarioPage";
import { LaboratorioDetallePage } from "../features/laboratorios/LaboratorioDetallePage";
import { LaboratoriosPage } from "../features/laboratorios/LaboratoriosPage";
import { LandingPage } from "../features/landing/LandingPage";
import { MarcacionesPage } from "../features/marcaciones/MarcacionesPage";
import { ObjetosPerdidosPage } from "../features/objetos-perdidos/ObjetosPerdidosPage";
import { PizarraPage } from "../features/pizarra/PizarraPage";
import { PreferenciasPage } from "../features/preferencias/PreferenciasPage";
import { ReportesPage } from "../features/reportes/ReportesPage";
import { ReservasPage } from "../features/reservas/ReservasPage";
import { RespaldosPage } from "../features/respaldos/RespaldosPage";
import { RevisionesPage } from "../features/revisiones/RevisionesPage";
import { NoEncontradoPage, SinPermisoPage } from "../features/sistema/SinPermisoPage";
import { TareasPage } from "../features/tareas/TareasPage";
import { UsuariosPage } from "../features/usuarios/UsuariosPage";
import { primeraRuta } from "./navegacion";
import { ConPermiso, RutaProtegida, useSesion } from "./sesion";

function Inicio() {
  const { puede } = useSesion();
  return <Navigate to={primeraRuta(puede)} replace />;
}

/**
 * La raíz del sitio. Sin sesión, "/" muestra la página de inicio pública;
 * cualquier otra ruta sigue pidiendo iniciar sesión, igual que antes.
 */
function Raiz() {
  const { estado } = useSesion();
  const ubicacion = useLocation();
  if (estado === "anonimo" && ubicacion.pathname === "/") return <LandingPage />;
  return (
    <RutaProtegida>
      <AppShell />
    </RutaProtegida>
  );
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <Raiz />,
    children: [
      { index: true, element: <Inicio /> },
      {
        path: "pizarra",
        element: (
          <ConPermiso permiso="pizarra.ver">
            <PizarraPage />
          </ConPermiso>
        ),
      },
      {
        path: "reservas",
        element: (
          <ConPermiso permiso="reservas.ver">
            <ReservasPage />
          </ConPermiso>
        ),
      },
      {
        path: "horarios",
        element: (
          <ConPermiso permiso="horarios.ver">
            <HorariosPage />
          </ConPermiso>
        ),
      },
      {
        path: "laboratorios",
        element: (
          <ConPermiso permiso="laboratorios.ver">
            <LaboratoriosPage />
          </ConPermiso>
        ),
      },
      {
        path: "laboratorios/:id",
        element: (
          <ConPermiso permiso="laboratorios.ver">
            <LaboratorioDetallePage />
          </ConPermiso>
        ),
      },
      {
        path: "elementos",
        element: (
          <ConPermiso permiso="elementos.catalogo">
            <ElementosPage />
          </ConPermiso>
        ),
      },
      {
        path: "usuarios",
        element: (
          <ConPermiso permiso="usuarios.gestionar">
            <UsuariosPage />
          </ConPermiso>
        ),
      },
      {
        path: "objetos-perdidos",
        element: (
          <ConPermiso permiso="objetos.ver">
            <ObjetosPerdidosPage />
          </ConPermiso>
        ),
      },
      {
        path: "tareas",
        element: (
          <ConPermiso permiso="tareas.ver">
            <TareasPage />
          </ConPermiso>
        ),
      },
      {
        path: "asistencia",
        element: (
          <ConPermiso permiso="asistencia.ver">
            <AsistenciaPage />
          </ConPermiso>
        ),
      },
      {
        path: "preferencias",
        element: (
          <ConPermiso permiso="preferencias.opciones">
            <PreferenciasPage />
          </ConPermiso>
        ),
      },
      {
        path: "bitacora",
        element: (
          <ConPermiso permiso="bitacora.ver">
            <BitacoraPage />
          </ConPermiso>
        ),
      },
      {
        path: "revisiones",
        element: (
          <ConPermiso permiso="revisiones.ver">
            <RevisionesPage />
          </ConPermiso>
        ),
      },
      {
        path: "inventario",
        element: (
          <ConPermiso permiso="inventario.ver">
            <InventarioPage />
          </ConPermiso>
        ),
      },
      {
        path: "control-asistencia",
        element: (
          <ConPermiso permiso="marcaciones.gestionar">
            <MarcacionesPage />
          </ConPermiso>
        ),
      },
      {
        path: "respaldos",
        element: (
          <ConPermiso permiso="respaldos.ver">
            <RespaldosPage />
          </ConPermiso>
        ),
      },
      {
        path: "reportes",
        element: (
          <ConPermiso permiso="reportes.ver">
            <ReportesPage />
          </ConPermiso>
        ),
      },
      { path: "sin-acceso", element: <SinPermisoPage /> },
      { path: "*", element: <NoEncontradoPage /> },
    ],
  },
]);
