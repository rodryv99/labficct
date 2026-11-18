import {
  Button,
  Caption1,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  ProgressBar,
  SearchBox,
  Select,
  Switch,
  Tab,
  TabList,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { Activo, ActivoDetalle as DetalleDeActivo, Verificacion } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { Codigo, EtiquetaEstado } from "../../components/datos/Etiquetas";
import { Paginacion } from "../../components/datos/Paginacion";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import {
  IconoAgregar,
  IconoDescargar,
  IconoImportar,
  IconoInventario,
  IconoVerificar,
} from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { fechaCorta } from "../../lib/fechas";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { useDebounce } from "../../lib/utiles";
import { ActivoDetalle } from "./ActivoDetalle";
import { ActivoPanel } from "./ActivoPanel";
import {
  ESTADOS_ACTIVO,
  type FormatoExport,
  TONO_ESTADO,
  exportarActivos,
  listarActivos,
  listarLugares,
  listarTipos,
  listarVerificaciones,
} from "./api";
import { LugaresPanel, TiposPanel } from "./CatalogosInventario";
import { ImportarActivosPanel } from "./ImportarActivosPanel";
import { VerificacionDetalle } from "./VerificacionDetalle";
import { VerificacionPanel } from "./VerificacionPanel";

const TAMANO = 25;

const useEstilos = makeStyles({
  pestanas: {
    marginBottom: "16px",
  },
  busqueda: {
    minWidth: "260px",
  },
  celda: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  fuerte: {
    fontWeight: tokens.fontWeightSemibold,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  avance: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: "120px",
  },
  etiquetas: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
  },
});

type Pestana = "activos" | "verificaciones";

type Panel =
  | { tipo: "activo"; id: number }
  | { tipo: "formulario-activo"; activo: DetalleDeActivo | null }
  | { tipo: "verificacion"; id: number }
  | { tipo: "formulario-verificacion" }
  | { tipo: "tipos" }
  | { tipo: "lugares" }
  | { tipo: "importar" };

/** Inventario de activos fijos: qué hay, dónde está, sus movimientos y las verificaciones. */
export function InventarioPage() {
  const estilos = useEstilos();
  const { puede } = useSesion();
  const gestionar = puede("inventario.gestionar");
  const [pestana, setPestana] = useState<Pestana>("activos");
  const [panel, setPanel] = useState<Panel | null>(null);
  const notificar = useNotificar();
  const [exportando, setExportando] = useState<FormatoExport | null>(null);

  // Activos
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");
  const [lugar, setLugar] = useState("");
  // "" = lo que está en el inventario (sin los dados de baja).
  const [estado, setEstado] = useState("");
  const [orden, setOrden] = useState("codigo");
  const busquedaRetrasada = useDebounce(busqueda);

  // Verificaciones
  const [paginaV, setPaginaV] = useState(1);
  const [estadoV, setEstadoV] = useState("");
  const [soloMias, setSoloMias] = useState(false);

  // Desde un aviso, el pizarrón o la búsqueda rápida: ?id=5, ?verificacion=3 o ?nuevo=1
  useAccionUrl(["id", "verificacion", "nuevo"], (p) => {
    if (p.verificacion) {
      setPestana("verificaciones");
      setPanel({ tipo: "verificacion", id: Number(p.verificacion) });
    } else if (p.id) {
      setPestana("activos");
      setPanel({ tipo: "activo", id: Number(p.id) });
    } else if (p.nuevo && gestionar) {
      setPanel({ tipo: "formulario-activo", activo: null });
    }
  });

  useEffect(() => setPagina(1), [busquedaRetrasada, tipo, lugar, estado]);
  useEffect(() => setPaginaV(1), [estadoV, soloMias]);

  const tipos = useQuery({ queryKey: ["inventario", "tipos"], queryFn: listarTipos });
  const lugares = useQuery({ queryKey: ["inventario", "lugares"], queryFn: listarLugares });

  const activos = useQuery({
    queryKey: ["inventario", "activos", { pagina, busquedaRetrasada, tipo, lugar, estado, orden }],
    queryFn: () =>
      listarActivos({
        page: pagina,
        page_size: TAMANO,
        search: busquedaRetrasada || undefined,
        tipos: tipo || undefined,
        lugares: lugar || undefined,
        estado: estado && estado !== "todos" ? estado : undefined,
        vigentes: estado === "" ? true : undefined,
        ordering: orden,
      }),
    placeholderData: keepPreviousData,
    enabled: pestana === "activos",
  });

  const verificaciones = useQuery({
    queryKey: ["inventario", "verificaciones", { paginaV, estadoV, soloMias }],
    queryFn: () =>
      listarVerificaciones({
        page: paginaV,
        page_size: TAMANO,
        estado: estadoV || undefined,
        mias: soloMias ? true : undefined,
      }),
    placeholderData: keepPreviousData,
    enabled: pestana === "verificaciones",
  });

  const columnasActivos: Columna<Activo>[] = [
    { clave: "codigo", titulo: "Código", ancho: "130px", ordenar: "codigo", render: (a) => <Codigo>{a.codigo}</Codigo> },
    {
      clave: "descripcion",
      titulo: "Activo",
      ordenar: "descripcion",
      render: (a) => (
        <div className={estilos.celda}>
          <span className={estilos.fuerte}>{a.descripcion}</span>
          <Caption1 className={estilos.secundario}>
            {[a.marca, a.modelo, a.serie && `Serie ${a.serie}`].filter(Boolean).join(" · ") || "Sin marca ni modelo"}
          </Caption1>
        </div>
      ),
    },
    { clave: "tipo", titulo: "Tipo", ancho: "150px", ordenar: "tipo__nombre", render: (a) => a.tipo_nombre },
    { clave: "lugar", titulo: "Lugar", ancho: "210px", ordenar: "lugar__nombre", render: (a) => a.lugar_nombre },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "130px",
      ordenar: "estado",
      render: (a) => <EtiquetaEstado tono={TONO_ESTADO[a.estado]}>{a.estado_nombre}</EtiquetaEstado>,
    },
  ];

  const columnasVerificaciones: Columna<Verificacion>[] = [
    {
      clave: "titulo",
      titulo: "Verificación",
      render: (v) => (
        <div className={estilos.celda}>
          <span className={estilos.fuerte}>{v.titulo}</span>
          <Caption1 className={estilos.secundario}>{v.alcance}</Caption1>
        </div>
      ),
    },
    {
      clave: "avance",
      titulo: "Avance",
      ancho: "170px",
      render: (v) => (
        <div className={estilos.avance}>
          <ProgressBar
            value={v.progreso / 100}
            color={v.estado === "cerrada" ? "success" : "brand"}
            aria-label={`Avance: ${v.progreso}%`}
          />
          <Caption1 className={estilos.secundario}>
            {v.conteo.revisados} de {v.conteo.total} revisados
          </Caption1>
        </div>
      ),
    },
    {
      clave: "diferencias",
      titulo: "Diferencias",
      ancho: "220px",
      render: (v) => {
        const c = v.conteo;
        if (!c.falta && !c.otro_lugar && !c.danado) {
          return <Caption1 className={estilos.secundario}>{c.revisados ? "Ninguna" : "—"}</Caption1>;
        }
        return (
          <div className={estilos.etiquetas}>
            {c.falta > 0 && <EtiquetaEstado tono="peligro">{c.falta} faltan</EtiquetaEstado>}
            {c.otro_lugar > 0 && <EtiquetaEstado tono="aviso">{c.otro_lugar} en otro lugar</EtiquetaEstado>}
            {c.danado > 0 && <EtiquetaEstado tono="aviso">{c.danado} dañados</EtiquetaEstado>}
          </div>
        );
      },
    },
    {
      clave: "responsables",
      titulo: "Responsables",
      ancho: "190px",
      render: (v) =>
        v.responsables_detalle.map((r) => r.nombre_completo).join(", ") || (
          <Caption1 className={estilos.secundario}>Todos los auxiliares</Caption1>
        ),
    },
    {
      clave: "limite",
      titulo: "Fecha límite",
      ancho: "120px",
      render: (v) => (v.fecha_limite ? fechaCorta(v.fecha_limite) : <Caption1 className={estilos.secundario}>—</Caption1>),
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "110px",
      render: (v) => (
        <EtiquetaEstado tono={v.estado === "abierta" ? "marca" : v.estado === "cerrada" ? "exito" : "neutro"}>
          {v.estado_nombre}
        </EtiquetaEstado>
      ),
    },
  ];

  const hayFiltros = Boolean(busquedaRetrasada || tipo || lugar || estado);

  // Los mismos filtros que la lista, para que la exportación descargue lo que se está viendo.
  const filtrosExport: Record<string, string> = {
    ...(busquedaRetrasada ? { search: busquedaRetrasada } : {}),
    ...(tipo ? { tipos: tipo } : {}),
    ...(lugar ? { lugares: lugar } : {}),
    ...(estado && estado !== "todos" ? { estado } : {}),
    ...(estado === "" ? { vigentes: "true" } : {}),
  };
  const exportar = async (formato: FormatoExport) => {
    setExportando(formato);
    try {
      await exportarActivos(formato, filtrosExport);
    } catch {
      notificar.error("No se pudo exportar", "Inténtalo de nuevo en un momento.");
    } finally {
      setExportando(null);
    }
  };

  return (
    <>
      <EncabezadoPagina
        seccion="Recursos"
        titulo="Inventario"
        descripcion="Los activos de los laboratorios: dónde están, sus traslados y bajas, y las verificaciones."
        acciones={
          <>
            {pestana === "activos" && (
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button icon={<IconoDescargar />} disabled={exportando !== null}>
                    {exportando ? "Exportando…" : "Exportar"}
                  </Button>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem onClick={() => exportar("xlsx")}>Excel (.xlsx)</MenuItem>
                    <MenuItem onClick={() => exportar("csv")}>CSV</MenuItem>
                    <MenuItem onClick={() => exportar("pdf")}>PDF</MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            )}
            {gestionar && (
              <>
                {pestana === "activos" && (
                  <Button icon={<IconoImportar />} onClick={() => setPanel({ tipo: "importar" })}>
                    Importar
                  </Button>
                )}
                <Button onClick={() => setPanel({ tipo: "tipos" })}>Tipos</Button>
                <Button onClick={() => setPanel({ tipo: "lugares" })}>Lugares</Button>
                <Button icon={<IconoVerificar />} onClick={() => setPanel({ tipo: "formulario-verificacion" })}>
                  Pedir verificación
                </Button>
                <Button
                  appearance="primary"
                  icon={<IconoAgregar />}
                  onClick={() => setPanel({ tipo: "formulario-activo", activo: null })}
                >
                  Registrar activo
                </Button>
              </>
            )}
          </>
        }
      />

      <TabList
        className={estilos.pestanas}
        selectedValue={pestana}
        onTabSelect={(_, d) => setPestana(d.value as Pestana)}
      >
        <Tab value="activos">Activos</Tab>
        <Tab value="verificaciones">Verificaciones</Tab>
      </TabList>

      {pestana === "activos" && (
        <>
          <BarraFiltros>
            <SearchBox
              className={estilos.busqueda}
              placeholder="Buscar por código, descripción, marca o serie"
              value={busqueda}
              onChange={(_, d) => setBusqueda(d.value)}
            />
            <Select aria-label="Tipo" value={tipo} onChange={(_, d) => setTipo(d.value)}>
              <option value="">Todos los tipos</option>
              {tipos.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Select>
            <Select aria-label="Lugar" value={lugar} onChange={(_, d) => setLugar(d.value)}>
              <option value="">Todos los lugares</option>
              {lugares.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </Select>
            <Select aria-label="Estado" value={estado} onChange={(_, d) => setEstado(d.value)}>
              <option value="">En inventario (sin bajas)</option>
              {ESTADOS_ACTIVO.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta}
                </option>
              ))}
              <option value="todos">Todos, con las bajas</option>
            </Select>
          </BarraFiltros>

          <TablaDatos
            etiqueta="Activos"
            columnas={columnasActivos}
            filas={activos.data?.results}
            claveFila={(a) => a.id}
            cargando={activos.isLoading}
            error={activos.error}
            onReintentar={() => void activos.refetch()}
            onFila={(a) => setPanel({ tipo: "activo", id: a.id })}
            orden={orden}
            onOrden={setOrden}
            vacio={
              <EstadoVacio
                icono={<IconoInventario />}
                titulo={hayFiltros ? "Ningún activo coincide" : "Todavía no hay activos registrados"}
                descripcion={
                  hayFiltros
                    ? "Prueba con otra búsqueda o quita algún filtro."
                    : gestionar
                      ? "Registra el primero con su código. Después podrás trasladarlo, darlo de baja y mandarlo a verificar."
                      : "El jefe de laboratorio todavía no registró activos."
                }
              />
            }
          />
          <Paginacion pagina={pagina} total={activos.data?.count ?? 0} tamano={TAMANO} onCambiar={setPagina} />
        </>
      )}

      {pestana === "verificaciones" && (
        <>
          <BarraFiltros>
            <Select aria-label="Estado" value={estadoV} onChange={(_, d) => setEstadoV(d.value)}>
              <option value="">Todas</option>
              <option value="abierta">Abiertas</option>
              <option value="cerrada">Cerradas</option>
              <option value="cancelada">Canceladas</option>
            </Select>
            <Switch label="Solo las asignadas a mí" checked={soloMias} onChange={(_, d) => setSoloMias(d.checked)} />
          </BarraFiltros>

          <TablaDatos
            etiqueta="Verificaciones de inventario"
            columnas={columnasVerificaciones}
            filas={verificaciones.data?.results}
            claveFila={(v) => v.id}
            cargando={verificaciones.isLoading}
            error={verificaciones.error}
            onReintentar={() => void verificaciones.refetch()}
            onFila={(v) => setPanel({ tipo: "verificacion", id: v.id })}
            vacio={
              <EstadoVacio
                icono={<IconoVerificar />}
                titulo={estadoV || soloMias ? "Ninguna verificación coincide" : "Todavía no hay verificaciones"}
                descripcion={
                  gestionar
                    ? "Pide una verificación para que los auxiliares revisen si los activos están donde deberían. Aparece como tarea en el pizarrón."
                    : "Cuando el jefe de laboratorio pida una verificación, aparecerá aquí y en el pizarrón de tareas."
                }
              />
            }
          />
          <Paginacion pagina={paginaV} total={verificaciones.data?.count ?? 0} tamano={TAMANO} onCambiar={setPaginaV} />
        </>
      )}

      <ActivoDetalle
        id={panel?.tipo === "activo" ? panel.id : null}
        onCerrar={() => setPanel(null)}
        onEditar={(activo) => setPanel({ tipo: "formulario-activo", activo })}
      />
      <VerificacionDetalle
        id={panel?.tipo === "verificacion" ? panel.id : null}
        onCerrar={() => setPanel(null)}
        onVerActivo={(id) => {
          setPestana("activos");
          setPanel({ tipo: "activo", id });
        }}
      />
      {gestionar && (
        <>
          <ActivoPanel
            abierto={panel?.tipo === "formulario-activo"}
            activo={panel?.tipo === "formulario-activo" ? panel.activo : null}
            onCerrar={() => setPanel(null)}
            onGuardado={(a) => setPanel({ tipo: "activo", id: a.id })}
          />
          <VerificacionPanel
            abierto={panel?.tipo === "formulario-verificacion"}
            onCerrar={() => setPanel(null)}
            onCreada={(v) => {
              setPestana("verificaciones");
              setPanel({ tipo: "verificacion", id: v.id });
            }}
          />
          <ImportarActivosPanel abierto={panel?.tipo === "importar"} onCerrar={() => setPanel(null)} />
          <TiposPanel abierto={panel?.tipo === "tipos"} onCerrar={() => setPanel(null)} />
          <LugaresPanel abierto={panel?.tipo === "lugares"} onCerrar={() => setPanel(null)} />
        </>
      )}
    </>
  );
}
