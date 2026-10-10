import { Navigate, createBrowserRouter } from "react-router";

import { AppShell } from "../components/layout/AppShell";
import { AsistenciaPage } from "../features/asistencia/AsistenciaPage";
import { LoginPage } from "../features/auth/LoginPage";
import { BitacoraPage } from "../features/bitacora/BitacoraPage";
import { ElementosPage } from "../features/elementos/ElementosPage";
import { HorariosPage } from "../features/horarios/HorariosPage";
import { LaboratorioDetallePage } from "../features/laboratorios/LaboratorioDetallePage";
import { LaboratoriosPage } from "../features/laboratorios/LaboratoriosPage";
import { ObjetosPerdidosPage } from "../features/objetos-perdidos/ObjetosPerdidosPage";
import { PizarraPage } from "../features/pizarra/PizarraPage";
import { PreferenciasPage } from "../features/preferencias/PreferenciasPage";
import { ReservasPage } from "../features/reservas/ReservasPage";
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

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RutaProtegida>
        <AppShell />
      </RutaProtegida>
    ),
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
      { path: "sin-acceso", element: <SinPermisoPage /> },
      { path: "*", element: <NoEncontradoPage /> },
    ],
  },
]);
