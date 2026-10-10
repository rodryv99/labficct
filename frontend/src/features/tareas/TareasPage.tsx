import {
  Button,
  Caption1,
  CounterBadge,
  SearchBox,
  Select,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  Switch,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { EstadoTarea, Paginado, Tarea } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EstadoError } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { IconoAgregar } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { ESTADOS_TAREA, etiquetaDe } from "../../lib/constantes";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { useDebounce } from "../../lib/utiles";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { cambiarEstadoTarea, listarTareas, ordenarTareas } from "./api";
import { TareaPanel } from "./TareaPanel";
import { TarjetaTarea } from "./TarjetaTarea";

const LIMITE = 500;

const COLOR_COLUMNA: Record<EstadoTarea, string> = {
  pendiente: tokens.colorNeutralForeground3,
  en_progreso: tokens.colorBrandForeground1,
  hecha: tokens.colorPaletteGreenForeground1,
};

const useEstilos = makeStyles({
  busqueda: {
    minWidth: "220px",
  },
  tablero: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
    alignItems: "start",
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  columna: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minHeight: "180px",
    padding: "10px",
    borderRadius: tokens.borderRadiusLarge,
    border: "2px dashed transparent",
    backgroundColor: tokens.colorNeutralBackground3,
    transitionProperty: "background-color, border-top-color, border-right-color, border-bottom-color, border-left-color",
    transitionDuration: tokens.durationFaster,
    "@media (max-width: 900px)": {
      minHeight: "auto",
    },
  },
  columnaSobre: {
    border: `2px dashed ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  cabeceraColumna: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "2px 4px 4px",
  },
  punto: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  vacio: {
    padding: "20px 8px",
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
  aviso: {
    display: "block",
    marginTop: "12px",
    color: tokens.colorNeutralForeground3,
  },
});

/** El panel queda montado al cerrarse, para que no cambie de contenido mientras se oculta. */
interface EstadoPanel {
  abierto: boolean;
  id: number | null;
}

export function TareasPage() {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede } = useSesion();
  const gestionar = puede("tareas.gestionar");
  const [busqueda, setBusqueda] = useState("");
  const [laboratorio, setLaboratorio] = useState("");
  const [mias, setMias] = useState(false);
  const [archivadas, setArchivadas] = useState(false);
  const [panel, setPanel] = useState<EstadoPanel>({ abierto: false, id: null });
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<EstadoTarea | null>(null);
  const busquedaRetrasada = useDebounce(busqueda);

  const abrir = (id: number | null) => setPanel({ abierto: true, id });

  // Desde una notificación o una revisión (?id=9), o la búsqueda rápida (?nuevo=1).
  useAccionUrl(["id", "nuevo"], (p) => {
    if (p.id) abrir(Number(p.id));
    else if (p.nuevo && gestionar) abrir(null);
  });

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos });
  const clave = ["tareas", "tablero", { busquedaRetrasada, laboratorio, mias, archivadas }];
  const consulta = useQuery({
    queryKey: clave,
    queryFn: () =>
      listarTareas({
        page_size: LIMITE,
        search: busquedaRetrasada || undefined,
        laboratorio: laboratorio ? Number(laboratorio) : undefined,
        mias: mias || undefined,
        archivadas: archivadas || undefined,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const columnas = useMemo(() => {
    const tareas = consulta.data?.results ?? [];
    return ESTADOS_TAREA.map((e) => ({
      ...e,
      tareas: ordenarTareas(tareas.filter((t) => t.estado === e.valor)),
    }));
  }, [consulta.data]);

  // Mover de columna: se ve al instante y se deshace si el servidor lo rechaza.
  const mover = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: EstadoTarea }) => cambiarEstadoTarea(id, estado),
    onMutate: async ({ id, estado }) => {
      await queryClient.cancelQueries({ queryKey: clave });
      const anterior = queryClient.getQueryData<Paginado<Tarea>>(clave);
      queryClient.setQueryData<Paginado<Tarea>>(clave, (actual) =>
        actual
          ? {
              ...actual,
              results: actual.results.map((t) =>
                t.id === id
                  ? {
                      ...t,
                      estado,
                      estado_nombre: etiquetaDe(ESTADOS_TAREA, estado),
                      actualizado_en: new Date().toISOString(),
                    }
                  : t,
              ),
            }
          : actual,
      );
      return { anterior };
    },
    onError: (error, _variables, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(clave, contexto.anterior);
      notificar.error("No se pudo mover la tarea", mensajeDeError(error));
    },
    onSuccess: (res) => {
      queryClient.setQueryData(["tareas", "detalle", res.id], res);
      if (res.estado === "hecha" && res.revision !== null) {
        notificar.exito("Tarea hecha", "La revisión quedó registrada en la bitácora.");
        void queryClient.invalidateQueries({ queryKey: ["revisiones"] });
        void queryClient.invalidateQueries({ queryKey: ["bitacora"] });
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["tareas"] }),
  });

  const moverA = (tarea: Tarea, estado: EstadoTarea) => {
    if (tarea.estado !== estado) mover.mutate({ id: tarea.id, estado });
  };

  const soltar = (id: number, estado: EstadoTarea) => {
    const tarea = consulta.data?.results.find((t) => t.id === id);
    if (tarea) moverA(tarea, estado);
  };

  const total = consulta.data?.count ?? 0;
  const mostradas = consulta.data?.results.length ?? 0;

  return (
    <>
      <EncabezadoPagina
        seccion="Operación"
        titulo="Pizarrón de tareas"
        descripcion={
          gestionar
            ? "Arrastra las tarjetas entre columnas o ábrelas para anotar cómo van."
            : "Lo que el equipo de laboratorio tiene pendiente y en curso."
        }
        acciones={
          gestionar && (
            <Button appearance="primary" icon={<IconoAgregar />} onClick={() => abrir(null)}>
              Nueva tarea
            </Button>
          )
        }
      />
      <BarraFiltros>
        <SearchBox
          className={estilos.busqueda}
          placeholder="Buscar tarea o laboratorio"
          value={busqueda}
          onChange={(_, d) => setBusqueda(d.value)}
        />
        <Select aria-label="Laboratorio" value={laboratorio} onChange={(_, d) => setLaboratorio(d.value)}>
          <option value="">Todos los laboratorios</option>
          {laboratorios.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} · {l.nombre}
            </option>
          ))}
        </Select>
        <Switch label="Solo las mías" checked={mias} onChange={(_, d) => setMias(d.checked)} />
        <Switch label="Ver hechas antiguas" checked={archivadas} onChange={(_, d) => setArchivadas(d.checked)} />
      </BarraFiltros>

      {consulta.error && !consulta.data ? (
        <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />
      ) : (
        <div className={estilos.tablero}>
          {columnas.map((c) => (
            <section
              key={c.valor}
              aria-label={`${c.etiqueta}: ${c.tareas.length}`}
              className={mergeClasses(estilos.columna, sobre === c.valor && estilos.columnaSobre)}
              onDragOver={(e) => {
                if (arrastrando === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (sobre !== c.valor) setSobre(c.valor);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                const id = Number(e.dataTransfer.getData("text/plain")) || arrastrando;
                setArrastrando(null);
                if (id) soltar(id, c.valor);
              }}
            >
              <div className={estilos.cabeceraColumna}>
                <span className={estilos.punto} style={{ backgroundColor: COLOR_COLUMNA[c.valor] }} />
                <Subtitle2 as="h2">{c.etiqueta}</Subtitle2>
                <CounterBadge count={c.tareas.length} showZero appearance="ghost" color="informative" size="small" />
              </div>

              {consulta.isLoading && !consulta.data ? (
                Array.from({ length: 2 }, (_, i) => (
                  <Skeleton key={i} aria-label="Cargando">
                    <SkeletonItem style={{ height: 88, borderRadius: 6 }} />
                  </Skeleton>
                ))
              ) : c.tareas.length === 0 ? (
                <Caption1 className={estilos.vacio}>
                  {arrastrando !== null
                    ? "Suelta aquí"
                    : c.valor === "pendiente"
                      ? gestionar
                        ? "Nada pendiente. Crea una tarea con «Nueva tarea»."
                        : "Nada pendiente."
                      : c.valor === "en_progreso"
                        ? "Nadie está trabajando en algo ahora."
                        : "Todavía no hay tareas hechas."}
                </Caption1>
              ) : (
                c.tareas.map((t) => (
                  <TarjetaTarea
                    key={t.id}
                    tarea={t}
                    movible={gestionar}
                    arrastrando={arrastrando === t.id}
                    onAbrir={(tarea) => abrir(tarea.id)}
                    onMover={moverA}
                    onArrastrar={(id) => {
                      setArrastrando(id);
                      if (id === null) setSobre(null);
                    }}
                  />
                ))
              )}
            </section>
          ))}
        </div>
      )}
      {mostradas < total && (
        <Caption1 className={estilos.aviso}>
          Se muestran {mostradas} de {total} tareas. Usa la búsqueda o los filtros para encontrar las demás.
        </Caption1>
      )}

      <TareaPanel abierto={panel.abierto} id={panel.id} onCerrar={() => setPanel((p) => ({ ...p, abierto: false }))} />
    </>
  );
}
