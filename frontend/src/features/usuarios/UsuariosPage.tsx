import { Avatar, Button, Caption1, SearchBox, Select, makeStyles, tokens } from "@fluentui/react-components";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { Usuario } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { Codigo, EtiquetaEstado, type Tono } from "../../components/datos/Etiquetas";
import { Paginacion } from "../../components/datos/Paginacion";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { EstadoVacio } from "../../components/feedback/Estados";
import { IconoNuevoUsuario, IconoUsuarios } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { ROLES } from "../../lib/constantes";
import { relativo } from "../../lib/fechas";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { useDebounce } from "../../lib/utiles";
import { listarUsuarios } from "./api";
import { UsuarioPanel } from "./UsuarioPanel";

const TAMANO = 25;

const TONO_ROL: Record<string, Tono> = {
  superadmin: "peligro",
  admin: "marca",
  auxiliar: "info",
  docente: "exito",
  administrativo: "neutro",
};

const useEstilos = makeStyles({
  persona: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  textos: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  nombre: {
    fontWeight: tokens.fontWeightSemibold,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  busqueda: {
    minWidth: "280px",
  },
});

export function UsuariosPage() {
  const estilos = useEstilos();
  const { usuario: yo } = useSesion();
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [rol, setRol] = useState("");
  const [activo, setActivo] = useState("true");
  const [orden, setOrden] = useState("apellidos");
  const [panel, setPanel] = useState<{ usuario: Usuario | null } | null>(null);
  const busquedaRetrasada = useDebounce(busqueda);

  useAccionUrl(["nuevo"], () => setPanel({ usuario: null }));
  useEffect(() => setPagina(1), [busquedaRetrasada, rol, activo]);

  const consulta = useQuery({
    queryKey: ["usuarios", { pagina, busquedaRetrasada, rol, activo, orden }],
    queryFn: () =>
      listarUsuarios({
        page: pagina,
        page_size: TAMANO,
        search: busquedaRetrasada || undefined,
        rol: rol || undefined,
        is_active: activo || undefined,
        ordering: orden,
      }),
    placeholderData: keepPreviousData,
  });

  const rolesPermitidos =
    yo?.rol === "superadmin" ? ROLES : ROLES.filter((r) => ["auxiliar", "docente", "administrativo"].includes(r.valor));

  const columnas: Columna<Usuario>[] = [
    {
      clave: "nombre",
      titulo: "Usuario",
      ordenar: "apellidos",
      render: (u) => (
        <div className={estilos.persona}>
          <Avatar name={u.nombre_completo} size={32} color="colorful" />
          <div className={estilos.textos}>
            <span className={estilos.nombre}>{u.nombre_completo}</span>
            <Caption1 className={estilos.secundario}>{u.email}</Caption1>
          </div>
        </div>
      ),
    },
    { clave: "codigo", titulo: "Código", ancho: "140px", render: (u) => (u.codigo ? <Codigo>{u.codigo}</Codigo> : "—") },
    {
      clave: "rol",
      titulo: "Rol",
      ordenar: "rol",
      ancho: "220px",
      render: (u) => <EtiquetaEstado tono={TONO_ROL[u.rol] ?? "neutro"}>{u.rol_nombre}</EtiquetaEstado>,
    },
    { clave: "telefono", titulo: "Teléfono", ancho: "140px", render: (u) => u.telefono || "—" },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "110px",
      render: (u) => (
        <EtiquetaEstado tono={u.is_active ? "exito" : "neutro"}>{u.is_active ? "Activo" : "Inactivo"}</EtiquetaEstado>
      ),
    },
    {
      clave: "acceso",
      titulo: "Último acceso",
      ordenar: "last_login",
      ancho: "160px",
      render: (u) => <Caption1>{u.last_login ? relativo(u.last_login) : "Nunca"}</Caption1>,
    },
  ];

  return (
    <>
      <EncabezadoPagina
        seccion="Administración"
        titulo="Usuarios"
        descripcion={
          yo?.rol === "superadmin"
            ? "Todas las cuentas del sistema."
            : "Cuentas de auxiliares, docentes y personal administrativo."
        }
        acciones={
          <Button appearance="primary" icon={<IconoNuevoUsuario />} onClick={() => setPanel({ usuario: null })}>
            Nuevo usuario
          </Button>
        }
      />

      <BarraFiltros>
        <SearchBox
          className={estilos.busqueda}
          placeholder="Buscar por nombre, correo o código"
          value={busqueda}
          onChange={(_, d) => setBusqueda(d.value)}
        />
        <Select aria-label="Rol" value={rol} onChange={(_, d) => setRol(d.value)}>
          <option value="">Todos los roles</option>
          {rolesPermitidos.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.etiqueta}
            </option>
          ))}
        </Select>
        <Select aria-label="Estado" value={activo} onChange={(_, d) => setActivo(d.value)}>
          <option value="true">Solo activos</option>
          <option value="false">Solo inactivos</option>
          <option value="">Activos e inactivos</option>
        </Select>
      </BarraFiltros>

      <TablaDatos
        etiqueta="Usuarios"
        columnas={columnas}
        filas={consulta.data?.results}
        claveFila={(u) => u.id}
        cargando={consulta.isLoading}
        error={consulta.error}
        onReintentar={() => void consulta.refetch()}
        onFila={(u) => setPanel({ usuario: u })}
        orden={orden}
        onOrden={setOrden}
        vacio={
          <EstadoVacio
            icono={<IconoUsuarios />}
            titulo={busquedaRetrasada || rol ? "Nadie coincide con la búsqueda" : "Todavía no hay usuarios"}
            descripcion={
              busquedaRetrasada || rol
                ? "Prueba con otro nombre o quita los filtros."
                : "Crea la cuenta de cada auxiliar, docente y administrativo para que puedan entrar."
            }
          />
        }
      />
      <Paginacion pagina={pagina} total={consulta.data?.count ?? 0} tamano={TAMANO} onCambiar={setPagina} />

      <UsuarioPanel
        abierto={panel !== null}
        usuario={panel?.usuario ?? null}
        rolesPermitidos={rolesPermitidos}
        onCerrar={() => setPanel(null)}
      />
    </>
  );
}
