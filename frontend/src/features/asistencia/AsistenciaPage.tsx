import { Button, Caption1, SearchBox, Select, makeStyles, tokens } from "@fluentui/react-components";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { SolicitudAsistencia } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { Paginacion } from "../../components/datos/Paginacion";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { EstadoVacio } from "../../components/feedback/Estados";
import { IconoAgregar, IconoAsistencia } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { fechaHora, relativo } from "../../lib/fechas";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { useDebounce } from "../../lib/utiles";
import { TONO_ASISTENCIA, listarSolicitudes } from "./api";
import { SolicitudDetalle } from "./SolicitudDetalle";
import { SolicitudPanel } from "./SolicitudPanel";

const TAMANO = 25;

type Filtro = "abiertas" | "cerradas" | "todas";
type Panel = { tipo: "nueva" } | { tipo: "detalle"; id: number };

const useEstilos = makeStyles({
  celda: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  donde: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
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
  busqueda: {
    minWidth: "240px",
  },
});

export function AsistenciaPage() {
  const estilos = useEstilos();
  const { puede } = useSesion();
  const solicitar = puede("asistencia.solicitar");
  const atender = puede("asistencia.atender");
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("abiertas");
  const [panel, setPanel] = useState<Panel | null>(null);
  const busquedaRetrasada = useDebounce(busqueda);

  // Desde una notificación (?id=7) o la búsqueda rápida (?nuevo=1).
  useAccionUrl(["id", "nuevo"], (p) => {
    if (p.id) setPanel({ tipo: "detalle", id: Number(p.id) });
    else if (p.nuevo && solicitar) setPanel({ tipo: "nueva" });
  });
  useEffect(() => setPagina(1), [busquedaRetrasada, filtro]);

  const consulta = useQuery({
    queryKey: ["asistencia", { pagina, busquedaRetrasada, filtro }],
    queryFn: () =>
      listarSolicitudes({
        page: pagina,
        page_size: TAMANO,
        search: busquedaRetrasada || undefined,
        abiertas: filtro === "todas" ? undefined : filtro === "abiertas",
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  });

  const columnas: Columna<SolicitudAsistencia>[] = [
    {
      clave: "cuando",
      titulo: "Cuándo",
      ancho: "150px",
      render: (s) => {
        const texto = relativo(s.creado_en);
        return (
          <div className={estilos.celda}>
            <span>{texto}</span>
            {!/^(hoy|ayer)/.test(texto) && <Caption1 className={estilos.secundario}>{fechaHora(s.creado_en)}</Caption1>}
          </div>
        );
      },
    },
    {
      clave: "donde",
      titulo: "Dónde",
      ancho: "170px",
      render: (s) => (
        <div className={estilos.donde}>
          <span className={estilos.fuerte}>{s.donde || "—"}</span>
          {s.urgente && <EtiquetaEstado tono="peligro">Urgente</EtiquetaEstado>}
        </div>
      ),
    },
    {
      clave: "que",
      titulo: "Qué pasa",
      render: (s) => (
        <div className={estilos.celda}>
          <span>{s.categoria_nombre}</span>
          <Caption1 className={estilos.secundario}>{s.descripcion}</Caption1>
        </div>
      ),
    },
    ...(atender
      ? [
          {
            clave: "solicita",
            titulo: "Solicita",
            ancho: "180px",
            render: (s: SolicitudAsistencia) => s.solicitante_nombre,
          },
        ]
      : []),
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "120px",
      render: (s) => <EtiquetaEstado tono={TONO_ASISTENCIA[s.estado]}>{s.estado_nombre}</EtiquetaEstado>,
    },
    {
      clave: "atiende",
      titulo: "Atiende",
      ancho: "170px",
      render: (s) => s.atendida_por_nombre || <Caption1 className={estilos.secundario}>—</Caption1>,
    },
  ];

  const botonSolicitar = solicitar && (
    <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setPanel({ tipo: "nueva" })}>
      Solicitar asistencia
    </Button>
  );

  const sinFiltros = !busquedaRetrasada && filtro === "abiertas";

  return (
    <>
      <EncabezadoPagina
        seccion="Operación"
        titulo="Asistencia"
        descripcion={
          atender
            ? "Solicitudes de docentes y administrativos. Toma una para avisar que vas en camino."
            : "Pide apoyo a los auxiliares; te avisamos cuando alguien vaya en camino."
        }
        acciones={botonSolicitar}
      />
      <BarraFiltros>
        <SearchBox
          className={estilos.busqueda}
          placeholder={atender ? "Buscar por lugar, descripción o docente" : "Buscar por lugar o descripción"}
          value={busqueda}
          onChange={(_, d) => setBusqueda(d.value)}
        />
        <Select aria-label="Mostrar" value={filtro} onChange={(_, d) => setFiltro(d.value as Filtro)}>
          <option value="abiertas">Abiertas</option>
          <option value="cerradas">Cerradas</option>
          <option value="todas">Todas</option>
        </Select>
      </BarraFiltros>

      <TablaDatos
        etiqueta="Solicitudes de asistencia"
        columnas={columnas}
        filas={consulta.data?.results}
        claveFila={(s) => s.id}
        cargando={consulta.isLoading}
        error={consulta.error}
        onReintentar={() => void consulta.refetch()}
        onFila={(s) => setPanel({ tipo: "detalle", id: s.id })}
        vacio={
          sinFiltros ? (
            <EstadoVacio
              icono={<IconoAsistencia />}
              titulo={atender ? "No hay solicitudes abiertas" : "No tienes solicitudes abiertas"}
              descripcion={
                atender
                  ? "Cuando un docente o administrativo pida ayuda, aparecerá aquí y te llegará un aviso."
                  : "¿Algo no funciona en el aula? Pide asistencia y un auxiliar irá a ayudarte."
              }
              accion={solicitar && !atender ? botonSolicitar : undefined}
            />
          ) : (
            <EstadoVacio icono={<IconoAsistencia />} titulo="Sin solicitudes con estos filtros" />
          )
        }
      />
      <Paginacion pagina={pagina} total={consulta.data?.count ?? 0} tamano={TAMANO} onCambiar={setPagina} />

      <SolicitudDetalle id={panel?.tipo === "detalle" ? panel.id : null} onCerrar={() => setPanel(null)} />
      {solicitar && (
        <SolicitudPanel
          abierto={panel?.tipo === "nueva"}
          onCerrar={() => setPanel(null)}
          onCreada={(s) => setPanel({ tipo: "detalle", id: s.id })}
        />
      )}
    </>
  );
}
