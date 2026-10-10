import {
  Body1,
  Button,
  Caption1,
  CounterBadge,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Spinner,
  Subtitle2,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { mensajeDeError } from "../../api/errores";
import type { Notificacion, Paginado, ResumenNotificaciones, TipoNotificacion } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import {
  IconoAsistencia,
  IconoCampana,
  IconoCandado,
  IconoHorarios,
  IconoLaboratorios,
  IconoRecargar,
  IconoReservas,
  IconoRevisiones,
  IconoTareas,
} from "../../components/iconos/iconos";
import { relativo } from "../../lib/fechas";
import { TAMANO_CAMPANA, listarNotificaciones, marcarLeida, marcarTodasLeidas, obtenerResumen } from "./api";

const CLAVE_RESUMEN = ["notificaciones", "resumen"];
const CLAVE_LISTA = ["notificaciones", "lista"];
const PREFIJO_TITULO = /^\(\d+\+?\)\s/;

/** Pantallas que conviene refrescar cuando llega un aviso de ese tipo. */
const RELACIONADAS: Partial<Record<TipoNotificacion, string[]>> = {
  asistencia: ["asistencia"],
  tarea: ["tareas", "revisiones"],
  revision: ["tareas", "revisiones"],
  reserva: ["reservas", "agenda"],
  clase: ["agenda", "reservas"],
};

const useEstilos = makeStyles({
  boton: {
    position: "relative",
  },
  insignia: {
    position: "absolute",
    top: "2px",
    right: "0px",
    pointerEvents: "none",
  },
  superficie: {
    padding: "0",
    width: "380px",
    maxWidth: "calc(100vw - 16px)",
    maxHeight: "min(480px, calc(100vh - 72px))",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  cabecera: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "10px 8px 10px 16px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  lista: {
    flex: 1,
    overflowY: "auto",
    margin: "0",
    padding: "4px",
    listStyleType: "none",
  },
  item: {
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "10px 12px",
    border: "none",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground1,
    fontFamily: "inherit",
    textAlign: "left",
    cursor: "pointer",
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
    },
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "-2px",
    },
  },
  itemNoLeido: {
    backgroundColor: tokens.colorBrandBackground2,
    ":hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
  },
  icono: {
    width: "32px",
    height: "32px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    fontSize: "18px",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
  },
  iconoNoLeido: {
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorBrandForeground1,
  },
  textos: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  titulo: {
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    wordBreak: "break-word",
  },
  tituloNoLeido: {
    fontWeight: tokens.fontWeightSemibold,
  },
  mensaje: {
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    color: tokens.colorNeutralForeground2,
    whiteSpace: "pre-line",
    wordBreak: "break-word",
    display: "-webkit-box",
    WebkitLineClamp: "3",
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  cuando: {
    color: tokens.colorNeutralForeground3,
  },
  punto: {
    width: "8px",
    height: "8px",
    flexShrink: 0,
    marginTop: "6px",
    borderRadius: "50%",
    backgroundColor: tokens.colorBrandForeground1,
  },
  estado: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "32px 16px",
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
  iconoVacio: {
    fontSize: "28px",
    color: tokens.colorNeutralForeground4,
  },
});

function IconoTipo({ tipo }: { tipo: TipoNotificacion }) {
  switch (tipo) {
    case "alistar":
      return <IconoLaboratorios />;
    case "cerrar":
      return <IconoCandado />;
    case "asistencia":
      return <IconoAsistencia />;
    case "reserva":
      return <IconoReservas />;
    case "clase":
      return <IconoHorarios />;
    case "revision":
      return <IconoRevisiones />;
    case "tarea":
      return <IconoTareas />;
    default:
      return <IconoCampana />;
  }
}

const listarRecientes = () => listarNotificaciones({ page_size: TAMANO_CAMPANA });

/** Campana de la barra superior: avisos sin leer, se consulta cada 20 segundos. */
export function Campana({ className }: { className?: string }) {
  const estilos = useEstilos();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [abierta, setAbierta] = useState(false);
  // La más nueva que ya vimos: si el servidor trae una mayor, llegó algo.
  const ultimaVista = useRef<number | null | undefined>(undefined);

  const resumen = useQuery({
    queryKey: CLAVE_RESUMEN,
    queryFn: obtenerResumen,
    refetchInterval: 20_000,
    // También con la pestaña en segundo plano: así el "(n)" del título avisa aunque no la mires.
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const lista = useQuery({
    queryKey: CLAVE_LISTA,
    queryFn: listarRecientes,
    enabled: abierta,
    staleTime: 10_000,
  });

  const noLeidas = resumen.data?.no_leidas ?? 0;

  // Aviso emergente cuando llega una nueva (no en la primera carga).
  useEffect(() => {
    const datos = resumen.data;
    if (!datos) return;
    const anterior = ultimaVista.current;
    if (anterior === undefined) {
      ultimaVista.current = datos.ultima_id;
      return;
    }
    if (datos.ultima_id === null || (anterior !== null && datos.ultima_id <= anterior)) return;
    ultimaVista.current = datos.ultima_id;

    (async () => {
      // Si la lista está abierta, la invalidación ya la recarga y fetchQuery reutiliza ese mismo pedido.
      void queryClient.invalidateQueries({ queryKey: CLAVE_LISTA });
      const recientes: Paginado<Notificacion> = await queryClient.fetchQuery({
        queryKey: CLAVE_LISTA,
        queryFn: listarRecientes,
        staleTime: 0,
      });
      const nueva = recientes.results.find((n) => !n.leida);
      if (!nueva) return;
      notificar.info(nueva.titulo, nueva.mensaje.split("\n")[0] || undefined);
      (RELACIONADAS[nueva.tipo] ?? []).forEach((clave) => void queryClient.invalidateQueries({ queryKey: [clave] }));
    })().catch(() => {
      /* Si falla, la campana igual muestra el número y la lista se carga al abrirla. */
    });
  }, [resumen.data, queryClient, notificar]);

  // "(3) Laboratorios FICCT" en la pestaña del navegador mientras haya sin leer.
  useEffect(() => {
    const base = document.title.replace(PREFIJO_TITULO, "");
    document.title = noLeidas > 0 ? `(${noLeidas > 99 ? "99+" : noLeidas}) ${base}` : base;
  }, [noLeidas]);
  useEffect(
    () => () => {
      document.title = document.title.replace(PREFIJO_TITULO, "");
    },
    [],
  );

  const leer = useMutation({
    mutationFn: marcarLeida,
    onMutate: (id: number) => {
      queryClient.setQueryData<Paginado<Notificacion>>(CLAVE_LISTA, (actual) =>
        actual ? { ...actual, results: actual.results.map((n) => (n.id === id ? { ...n, leida: true } : n)) } : actual,
      );
      queryClient.setQueryData<ResumenNotificaciones>(CLAVE_RESUMEN, (actual) =>
        actual ? { ...actual, no_leidas: Math.max(0, actual.no_leidas - 1) } : actual,
      );
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["notificaciones"] }),
  });

  const leerTodas = useMutation({
    mutationFn: marcarTodasLeidas,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notificaciones"] }),
    onError: (e) => notificar.error("No se pudieron marcar como leídas", mensajeDeError(e)),
  });

  const abrir = (n: Notificacion) => {
    if (!n.leida) leer.mutate(n.id);
    setAbierta(false);
    if (n.enlace.startsWith("/")) navegar(n.enlace);
  };

  const etiqueta =
    noLeidas === 0 ? "Notificaciones" : `Notificaciones, ${noLeidas === 1 ? "1 sin leer" : `${noLeidas} sin leer`}`;
  const avisos = lista.data?.results;

  return (
    <Popover
      open={abierta}
      onOpenChange={(_, datos) => setAbierta(datos.open)}
      positioning="below-end"
      trapFocus
    >
      <PopoverTrigger disableButtonEnhancement>
        <Tooltip content={etiqueta} relationship="label">
          <button type="button" className={mergeClasses(className, estilos.boton)}>
            <IconoCampana />
            {noLeidas > 0 && (
              <CounterBadge className={estilos.insignia} count={noLeidas} overflowCount={99} size="small" color="danger" />
            )}
          </button>
        </Tooltip>
      </PopoverTrigger>
      <PopoverSurface className={estilos.superficie} aria-label="Notificaciones">
        <div className={estilos.cabecera}>
          <Subtitle2>Notificaciones</Subtitle2>
          <Button
            size="small"
            appearance="transparent"
            disabled={noLeidas === 0 || leerTodas.isPending}
            onClick={() => leerTodas.mutate()}
          >
            Marcar todas como leídas
          </Button>
        </div>

        {lista.isLoading ? (
          <div className={estilos.estado}>
            <Spinner size="small" label="Cargando…" />
          </div>
        ) : lista.error && !avisos ? (
          <div className={estilos.estado} role="alert">
            <Body1>{mensajeDeError(lista.error, "No se pudieron cargar las notificaciones.")}</Body1>
            <Button size="small" icon={<IconoRecargar />} onClick={() => void lista.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : !avisos?.length ? (
          <div className={estilos.estado}>
            <span className={estilos.iconoVacio}>
              <IconoCampana />
            </span>
            <Body1>No tienes notificaciones</Body1>
          </div>
        ) : (
          <ul className={estilos.lista}>
            {avisos.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={mergeClasses(estilos.item, !n.leida && estilos.itemNoLeido)}
                  onClick={() => abrir(n)}
                >
                  <span className={mergeClasses(estilos.icono, !n.leida && estilos.iconoNoLeido)} title={n.tipo_nombre}>
                    <IconoTipo tipo={n.tipo} />
                  </span>
                  <span className={estilos.textos}>
                    <span className={mergeClasses(estilos.titulo, !n.leida && estilos.tituloNoLeido)}>{n.titulo}</span>
                    {n.mensaje && <span className={estilos.mensaje}>{n.mensaje}</span>}
                    <Caption1 className={estilos.cuando}>{relativo(n.creado_en)}</Caption1>
                  </span>
                  {!n.leida && <span className={estilos.punto} aria-label="Sin leer" role="img" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverSurface>
    </Popover>
  );
}
