import {
  Button,
  Caption1,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  SearchBox,
  Select,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { Reserva } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { Paginacion } from "../../components/datos/Paginacion";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { EstadoVacio } from "../../components/feedback/Estados";
import { IconoAgregar, IconoReservas } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { ESTADOS_RESERVA } from "../../lib/constantes";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { useDebounce } from "../../lib/utiles";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { type BloqueFormulario, listarReservas } from "./api";
import { ReservaDetalle } from "./ReservaDetalle";
import { ReservaPanel } from "./ReservaPanel";
import { TONO_RESERVA, resumenBloque } from "./utiles";

const TAMANO = 25;

const useEstilos = makeStyles({
  titulo: {
    display: "flex",
    flexDirection: "column",
  },
  nombre: {
    fontWeight: tokens.fontWeightSemibold,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  cuando: {
    display: "flex",
    flexDirection: "column",
    fontVariantNumeric: "tabular-nums",
  },
  busqueda: {
    minWidth: "260px",
  },
});

type Panel =
  | { tipo: "formulario"; reserva: Reserva | null; prellenado?: Partial<BloqueFormulario> }
  | { tipo: "detalle"; id: number };

export function ReservasPage() {
  const estilos = useEstilos();
  const { puede } = useSesion();
  const gestionar = puede("reservas.gestionar");
  const aprueba = puede("reservas.aprobar");
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [cuando, setCuando] = useState("proximas");
  const [estado, setEstado] = useState("");
  const [laboratorio, setLaboratorio] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const busquedaRetrasada = useDebounce(busqueda);

  // Desde la pizarra o la búsqueda rápida: ?nuevo=1&laboratorio=3&fecha=2026-10-04&inicio=10:00, o ?id=12
  useAccionUrl(["nuevo", "laboratorio", "fecha", "inicio", "fin", "id"], (p) => {
    if (p.id) setPanel({ tipo: "detalle", id: Number(p.id) });
    else if (p.nuevo && gestionar) {
      setPanel({
        tipo: "formulario",
        reserva: null,
        prellenado: {
          laboratorio: p.laboratorio ? Number(p.laboratorio) : null,
          fecha: p.fecha,
          hora_inicio: p.inicio,
          hora_fin: p.fin,
        },
      });
    }
  });

  useEffect(() => setPagina(1), [busquedaRetrasada, cuando, estado, laboratorio]);

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos });
  const consulta = useQuery({
    queryKey: ["reservas", { pagina, busquedaRetrasada, cuando, estado, laboratorio }],
    queryFn: () =>
      listarReservas({
        page: pagina,
        page_size: TAMANO,
        search: busquedaRetrasada || undefined,
        cuando: cuando || undefined,
        estado: estado || undefined,
        laboratorio: laboratorio ? Number(laboratorio) : undefined,
        ordering: cuando === "proximas" ? "primer_inicio" : "-primer_inicio",
      }),
    placeholderData: keepPreviousData,
  });

  // Aviso para el administrador mientras no haya notificaciones: cuántas esperan su aprobación.
  const porAprobar = useQuery({
    queryKey: ["reservas", "por-aprobar"],
    queryFn: () => listarReservas({ page: 1, page_size: 1, estado: "pendiente", cuando: "proximas" }),
    enabled: aprueba,
  });
  const pendientes = porAprobar.data?.count ?? 0;

  const columnas: Columna<Reserva>[] = [
    {
      clave: "titulo",
      titulo: "Reserva",
      render: (r) => (
        <div className={estilos.titulo}>
          <span className={estilos.nombre}>{r.titulo}</span>
          <Caption1 className={estilos.secundario}>{r.solicitante_nombre}</Caption1>
        </div>
      ),
    },
    {
      clave: "cuando",
      titulo: "Cuándo",
      ancho: "220px",
      render: (r) => (
        <div className={estilos.cuando}>
          <span>{r.bloques[0] ? resumenBloque(r.bloques[0]) : "—"}</span>
          {r.bloques.length > 1 && (
            <Caption1 className={estilos.secundario}>
              y {r.bloques.length - 1} día{r.bloques.length > 2 ? "s" : ""} más
            </Caption1>
          )}
        </div>
      ),
    },
    {
      clave: "labs",
      titulo: "Laboratorio",
      ancho: "150px",
      render: (r) => [...new Set(r.bloques.map((b) => b.laboratorio_codigo))].join(", "),
    },
    {
      clave: "apoyo",
      titulo: "Apoyo",
      ancho: "150px",
      render: (r) =>
        r.requiere_apoyo ? (
          <EtiquetaEstado tono={r.auxiliares.length >= r.auxiliares_requeridos ? "info" : "aviso"}>
            {r.auxiliares.length}/{r.auxiliares_requeridos} auxiliares
          </EtiquetaEstado>
        ) : (
          <Caption1 className={estilos.secundario}>No</Caption1>
        ),
    },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "120px",
      render: (r) => <EtiquetaEstado tono={TONO_RESERVA[r.estado]}>{r.estado_nombre}</EtiquetaEstado>,
    },
  ];

  return (
    <>
      <EncabezadoPagina
        seccion="Operación"
        titulo="Reservas"
        descripcion="Eventos únicos o de pocos días, con programas y apoyo de auxiliares."
        acciones={
          gestionar && (
            <Button
              appearance="primary"
              icon={<IconoAgregar />}
              onClick={() => setPanel({ tipo: "formulario", reserva: null })}
            >
              Nueva reserva
            </Button>
          )
        }
      />
      {aprueba && pendientes > 0 && estado !== "pendiente" && (
        <MessageBar intent="warning">
          <MessageBarBody>
            <MessageBarTitle>
              {pendientes === 1 ? "1 reserva por aprobar" : `${pendientes} reservas por aprobar`}
            </MessageBarTitle>
            Chocan con clases u otras reservas y esperan tu aprobación.
          </MessageBarBody>
          <MessageBarActions>
            <Button
              onClick={() => {
                setEstado("pendiente");
                setCuando("proximas");
              }}
            >
              Ver
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}
      <BarraFiltros>
        <SearchBox
          className={estilos.busqueda}
          placeholder="Buscar por título o solicitante"
          value={busqueda}
          onChange={(_, d) => setBusqueda(d.value)}
        />
        <Select aria-label="Cuándo" value={cuando} onChange={(_, d) => setCuando(d.value)}>
          <option value="proximas">Próximas y en curso</option>
          <option value="pasadas">Pasadas</option>
          <option value="">Todas</option>
        </Select>
        <Select aria-label="Estado" value={estado} onChange={(_, d) => setEstado(d.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_RESERVA.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.etiqueta}
            </option>
          ))}
        </Select>
        <Select aria-label="Laboratorio" value={laboratorio} onChange={(_, d) => setLaboratorio(d.value)}>
          <option value="">Todos los laboratorios</option>
          {laboratorios.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} · {l.nombre}
            </option>
          ))}
        </Select>
      </BarraFiltros>

      <TablaDatos
        etiqueta="Reservas"
        columnas={columnas}
        filas={consulta.data?.results}
        claveFila={(r) => r.id}
        cargando={consulta.isLoading}
        error={consulta.error}
        onReintentar={() => void consulta.refetch()}
        onFila={(r) => setPanel({ tipo: "detalle", id: r.id })}
        vacio={
          <EstadoVacio
            icono={<IconoReservas />}
            titulo={cuando === "proximas" ? "No hay reservas próximas" : "Sin reservas con estos filtros"}
            descripcion={
              gestionar
                ? "Reserva un laboratorio para un curso, examen o taller. También puedes hacerlo desde la pizarra, tocando un espacio libre."
                : undefined
            }
          />
        }
      />
      <Paginacion pagina={pagina} total={consulta.data?.count ?? 0} tamano={TAMANO} onCambiar={setPagina} />

      <ReservaDetalle
        id={panel?.tipo === "detalle" ? panel.id : null}
        onCerrar={() => setPanel(null)}
        onEditar={(reserva) => setPanel({ tipo: "formulario", reserva })}
      />
      {gestionar && (
        <ReservaPanel
          abierto={panel?.tipo === "formulario"}
          reserva={panel?.tipo === "formulario" ? panel.reserva : null}
          prellenado={panel?.tipo === "formulario" ? panel.prellenado : undefined}
          onCerrar={() => setPanel(null)}
        />
      )}
    </>
  );
}
