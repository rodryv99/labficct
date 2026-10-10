import { Button, Caption1, SearchBox, Select, makeStyles, tokens } from "@fluentui/react-components";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useSesion } from "../../app/sesion";
import { Codigo, EtiquetaEstado } from "../../components/datos/Etiquetas";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { EstadoVacio } from "../../components/feedback/Estados";
import { IconoAgregar, IconoHorarios } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { DIAS } from "../../lib/constantes";
import { fechaCorta } from "../../lib/fechas";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { useDebounce } from "../../lib/utiles";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { type GrupoHorario, agruparHorarios, listarHorarios, listarPeriodos, nombreDias } from "./api";
import { HorarioPanel } from "./HorarioPanel";
import { DocentesPanel, MateriasPanel, PeriodosPanel } from "./CatalogosPanel";

const useEstilos = makeStyles({
  materia: {
    display: "flex",
    flexDirection: "column",
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  hora: {
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  busqueda: {
    minWidth: "240px",
  },
});

export function HorariosPage() {
  const estilos = useEstilos();
  const { puede, usuario } = useSesion();
  const gestionar = puede("horarios.gestionar");
  const esDocente = usuario?.rol === "docente";
  const [periodo, setPeriodo] = useState<number | null>(null);
  const [laboratorio, setLaboratorio] = useState("");
  const [dia, setDia] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [panel, setPanel] = useState<{ grupo: GrupoHorario | null } | null>(null);
  const [catalogo, setCatalogo] = useState<"periodos" | "materias" | "docentes" | null>(null);
  const busquedaRetrasada = useDebounce(busqueda);

  useAccionUrl(["nuevo"], () => gestionar && setPanel({ grupo: null }));

  const periodos = useQuery({ queryKey: ["periodos"], queryFn: listarPeriodos });
  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos });

  // Por defecto, el periodo vigente más reciente.
  useEffect(() => {
    if (periodo === null && periodos.data?.length) {
      setPeriodo((periodos.data.find((p) => p.vigente) ?? periodos.data[0]).id);
    }
  }, [periodos.data, periodo]);

  // El día se filtra aquí y no en la API: así cada fila trae todos los días de su clase.
  const consulta = useQuery({
    queryKey: ["horarios", { periodo, laboratorio, busquedaRetrasada }],
    queryFn: () =>
      listarHorarios({
        periodo: periodo ?? undefined,
        laboratorio: laboratorio ? Number(laboratorio) : undefined,
        search: busquedaRetrasada || undefined,
      }),
    enabled: periodo !== null,
    placeholderData: keepPreviousData,
  });

  const periodoActual = useMemo(() => periodos.data?.find((p) => p.id === periodo), [periodos.data, periodo]);
  const grupos = useMemo(() => {
    if (!consulta.data) return undefined;
    const todos = agruparHorarios(consulta.data.results);
    return dia ? todos.filter((g) => g.dias.includes(Number(dia))) : todos;
  }, [consulta.data, dia]);

  const columnas: Columna<GrupoHorario>[] = [
    { clave: "dia", titulo: "Días", ancho: "150px", render: (g) => nombreDias(g.dias) },
    {
      clave: "hora",
      titulo: "Horario",
      ancho: "130px",
      render: ({ base: h }) => (
        <span className={estilos.hora}>
          {h.hora_inicio} – {h.hora_fin}
        </span>
      ),
    },
    {
      clave: "materia",
      titulo: "Materia",
      render: ({ base: h }) => (
        <div className={estilos.materia}>
          <span>
            <Codigo>{h.materia_sigla}</Codigo> {h.materia_nombre}
          </span>
        </div>
      ),
    },
    { clave: "grupo", titulo: "Grupo", ancho: "80px", render: (g) => g.base.grupo },
    {
      clave: "docente",
      titulo: "Docente",
      render: (g) => g.base.docente_nombre || <Caption1 className={estilos.secundario}>Sin asignar</Caption1>,
    },
    { clave: "lab", titulo: "Laboratorio", ancho: "130px", render: (g) => g.base.laboratorio_codigo },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "100px",
      render: (g) => (
        <EtiquetaEstado tono={g.base.activo ? "exito" : "neutro"}>{g.base.activo ? "Activo" : "Inactivo"}</EtiquetaEstado>
      ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        seccion="Planificación"
        titulo={esDocente ? "Mis clases" : "Horarios"}
        descripcion={
          periodoActual
            ? `Periodo ${periodoActual.nombre}: del ${fechaCorta(periodoActual.fecha_inicio)} al ${fechaCorta(periodoActual.fecha_fin)}.`
            : "Clases que se repiten cada semana en los laboratorios."
        }
        acciones={
          gestionar && (
            <>
              <Button onClick={() => setCatalogo("periodos")}>Periodos</Button>
              <Button onClick={() => setCatalogo("materias")}>Materias</Button>
              <Button onClick={() => setCatalogo("docentes")}>Docentes</Button>
              <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setPanel({ grupo: null })}>
                Nuevo horario
              </Button>
            </>
          )
        }
      />

      <BarraFiltros>
        <Select
          aria-label="Periodo"
          value={periodo !== null ? String(periodo) : ""}
          onChange={(_, d) => setPeriodo(Number(d.value))}
        >
          {periodos.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.vigente ? " (vigente)" : ""}
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
        <Select aria-label="Día" value={dia} onChange={(_, d) => setDia(d.value)}>
          <option value="">Todos los días</option>
          {DIAS.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.etiqueta}
            </option>
          ))}
        </Select>
        <SearchBox
          className={estilos.busqueda}
          placeholder="Buscar materia, grupo o docente"
          value={busqueda}
          onChange={(_, d) => setBusqueda(d.value)}
        />
      </BarraFiltros>

      {periodos.data && periodos.data.length === 0 ? (
        <EstadoVacio
          icono={<IconoHorarios />}
          titulo="Primero crea un periodo académico"
          descripcion="Los horarios pertenecen a un periodo (por ejemplo 2-2026) con fecha de inicio y fin."
          accion={gestionar && <Button appearance="primary" onClick={() => setCatalogo("periodos")}>Crear periodo</Button>}
        />
      ) : (
        <TablaDatos
          etiqueta="Horarios"
          columnas={columnas}
          filas={grupos}
          claveFila={(g) => g.clave}
          cargando={consulta.isLoading || periodo === null}
          error={consulta.error}
          onReintentar={() => void consulta.refetch()}
          onFila={gestionar ? (g) => setPanel({ grupo: g }) : undefined}
          vacio={
            <EstadoVacio
              icono={<IconoHorarios />}
              titulo={esDocente ? "No tienes clases asignadas en este periodo" : "Sin horarios con estos filtros"}
              descripcion={gestionar ? "Registra las clases que se repiten cada semana." : undefined}
            />
          }
        />
      )}

      {gestionar && (
        <>
          <HorarioPanel
            abierto={panel !== null}
            grupo={panel?.grupo ?? null}
            periodoPorDefecto={periodo}
            onCerrar={() => setPanel(null)}
          />
          <PeriodosPanel abierto={catalogo === "periodos"} onCerrar={() => setCatalogo(null)} />
          <MateriasPanel abierto={catalogo === "materias"} onCerrar={() => setCatalogo(null)} />
          <DocentesPanel abierto={catalogo === "docentes"} onCerrar={() => setCatalogo(null)} />
        </>
      )}
    </>
  );
}
