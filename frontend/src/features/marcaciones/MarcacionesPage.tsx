import {
  Button,
  Caption1,
  Field,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Select,
  Switch,
  Tab,
  TabList,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { AuxiliarAsistencia, HorarioTrabajo, LugarAsistencia, Marcacion, ResumenAsistencia } from "../../api/tipos";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { Paginacion } from "../../components/datos/Paginacion";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoAgregar, IconoDescargar, IconoMarcaciones, IconoPersona } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { aISO, fechaCorta } from "../../lib/fechas";
import {
  type FiltrosMarcaciones,
  type FormatoExport,
  SITUACIONES,
  asignarHorario,
  asignarLugar,
  duracion,
  exportarMarcaciones,
  horaDe,
  listarAuxiliares,
  listarHorarios,
  listarLugares,
  listarMarcaciones,
  metros,
  resumenHorario,
  resumenMarcaciones,
} from "./api";
import { HorariosTab } from "./HorariosTab";
import { LugaresTab } from "./LugaresTab";
import { MarcacionDetalle } from "./MarcacionDetalle";

const TAMANO = 25;

const useEstilos = makeStyles({
  pestanas: {
    marginBottom: "16px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
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
  },
  numeros: {
    fontVariantNumeric: "tabular-nums",
  },
  fecha: {
    width: "190px",
  },
  aviso: {
    marginBottom: "12px",
  },
  ayuda: {
    display: "block",
    marginBottom: "8px",
    color: tokens.colorNeutralForeground3,
  },
});

type Pestana = "hoy" | "marcaciones" | "resumen" | "lugares" | "horarios";

function primerDiaDelMes(): string {
  const hoy = new Date();
  return aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
}

/** Control de asistencia de los auxiliares: cómo van hoy, las marcaciones, los totales y los lugares. */
export function MarcacionesPage() {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [pestana, setPestana] = useState<Pestana>("hoy");
  const [desde, setDesde] = useState(primerDiaDelMes);
  const [hasta, setHasta] = useState(() => aISO(new Date()));
  const [auxiliar, setAuxiliar] = useState("");
  const [lugarFiltro, setLugarFiltro] = useState("");
  const [soloAbiertas, setSoloAbiertas] = useState(false);
  const [soloRetraso, setSoloRetraso] = useState(false);
  const [retrasoMin, setRetrasoMin] = useState("");
  const [minRetrasos, setMinRetrasos] = useState("");
  const [pagina, setPagina] = useState(1);
  const [detalle, setDetalle] = useState<number | null>(null);
  const [panelLugar, setPanelLugar] = useState<LugarAsistencia | "nuevo" | null>(null);
  const [panelHorario, setPanelHorario] = useState<HorarioTrabajo | "nuevo" | null>(null);
  const [asignando, setAsignando] = useState<AuxiliarAsistencia | null>(null);
  const [lugarElegido, setLugarElegido] = useState("");
  const [horarioElegido, setHorarioElegido] = useState("");
  const [exportando, setExportando] = useState<FormatoExport | null>(null);

  useEffect(() => setPagina(1), [desde, hasta, auxiliar, lugarFiltro, soloAbiertas, soloRetraso, retrasoMin]);

  // Ojo: con_retraso/retraso_min solo se mandan cuando están activos (false filtraría a los puntuales).
  const retrasoDesde = retrasoMin && Number(retrasoMin) > 0 ? Number(retrasoMin) : undefined;
  const filtros: FiltrosMarcaciones = {
    desde: desde || undefined,
    hasta: hasta || undefined,
    usuario: auxiliar ? Number(auxiliar) : undefined,
    lugar: lugarFiltro ? Number(lugarFiltro) : undefined,
    abiertas: soloAbiertas ? true : undefined,
    con_retraso: soloRetraso ? true : undefined,
    retraso_min: retrasoDesde,
  };
  // El resumen no tiene filtro de auxiliar ni de "sin salida", pero sí los de retraso.
  const filtrosResumen: FiltrosMarcaciones = {
    desde: filtros.desde,
    hasta: filtros.hasta,
    lugar: filtros.lugar,
    con_retraso: soloRetraso ? true : undefined,
    retraso_min: retrasoDesde,
    min_retrasos: minRetrasos && Number(minRetrasos) > 0 ? Number(minRetrasos) : undefined,
  };

  const auxiliares = useQuery({
    queryKey: ["marcaciones", "auxiliares"],
    queryFn: listarAuxiliares,
    // La pestaña "Hoy" se actualiza sola para ver quién va llegando.
    refetchInterval: pestana === "hoy" ? 30_000 : false,
  });
  const lugares = useQuery({ queryKey: ["marcaciones", "lugares"], queryFn: listarLugares });
  const horarios = useQuery({
    queryKey: ["marcaciones", "horarios"],
    queryFn: listarHorarios,
    enabled: pestana === "horarios" || pestana === "hoy" || asignando !== null,
  });
  const lista = useQuery({
    queryKey: ["marcaciones", "lista", { pagina, ...filtros }],
    queryFn: () => listarMarcaciones({ page: pagina, page_size: TAMANO, ...filtros }),
    placeholderData: keepPreviousData,
    enabled: pestana === "marcaciones",
  });
  const resumen = useQuery({
    queryKey: ["marcaciones", "resumen", filtrosResumen],
    queryFn: () => resumenMarcaciones(filtrosResumen),
    placeholderData: keepPreviousData,
    enabled: pestana === "resumen",
  });

  const asignar = useMutation({
    mutationFn: async () => {
      const a = asignando!;
      const lugar = lugarElegido ? Number(lugarElegido) : null;
      const horario = horarioElegido ? Number(horarioElegido) : null;
      if (lugar !== a.lugar) await asignarLugar(a.id, lugar);
      if (horario !== a.horario) await asignarHorario(a.id, horario);
    },
    onSuccess: () => {
      notificar.exito("Auxiliar actualizado", asignando?.nombre_completo);
      void queryClient.invalidateQueries({ queryKey: ["marcaciones"] });
      setAsignando(null);
    },
    onError: (falla) => notificar.error("No se pudo guardar", mensajeDeError(falla)),
  });

  const abrirAsignacion = (a: AuxiliarAsistencia) => {
    setLugarElegido(a.lugar !== null ? String(a.lugar) : "");
    setHorarioElegido(a.horario !== null ? String(a.horario) : "");
    setAsignando(a);
  };

  const sinCambiosAsig =
    asignando !== null &&
    lugarElegido === (asignando.lugar !== null ? String(asignando.lugar) : "") &&
    horarioElegido === (asignando.horario !== null ? String(asignando.horario) : "");

  const exportar = async (formato: FormatoExport) => {
    setExportando(formato);
    try {
      // Se descarga lo que se está viendo: en el resumen, todas las marcaciones de esas fechas.
      await exportarMarcaciones(formato, pestana === "resumen" ? filtrosResumen : filtros);
    } catch {
      notificar.error("No se pudo exportar", "Inténtalo de nuevo en un momento.");
    } finally {
      setExportando(null);
    }
  };

  const lugaresActivos = (lugares.data ?? []).filter((l) => l.activo);
  const predeterminado = lugaresActivos.find((l) => l.predeterminado);
  const sinLugar = (auxiliares.data ?? []).filter((a) => a.lugar_efectivo === null).length;

  const columnasHoy: Columna<AuxiliarAsistencia>[] = [
    {
      clave: "auxiliar",
      titulo: "Auxiliar",
      render: (a) => (
        <div className={estilos.celda}>
          <span className={estilos.fuerte}>{a.nombre_completo}</span>
          <Caption1 className={estilos.secundario}>{a.email}</Caption1>
        </div>
      ),
    },
    {
      clave: "lugar",
      titulo: "Dónde marca",
      ancho: "230px",
      render: (a) =>
        a.lugar_efectivo === null ? (
          <EtiquetaEstado tono="peligro">Sin lugar: no puede marcar</EtiquetaEstado>
        ) : (
          <div className={estilos.celda}>
            <span>{a.lugar_nombre}</span>
            <Caption1 className={estilos.secundario}>{a.usa_predeterminado ? "Predeterminado" : "Lugar propio"}</Caption1>
          </div>
        ),
    },
    {
      clave: "horario",
      titulo: "Horario",
      ancho: "160px",
      render: (a) =>
        a.horario === null ? (
          <Caption1 className={estilos.secundario}>Sin horario</Caption1>
        ) : (
          <span>{a.horario_nombre}</span>
        ),
    },
    {
      clave: "situacion",
      titulo: "Hoy",
      ancho: "120px",
      render: (a) => <EtiquetaEstado tono={SITUACIONES[a.situacion].tono}>{SITUACIONES[a.situacion].texto}</EtiquetaEstado>,
    },
    {
      clave: "entrada",
      titulo: "Entrada",
      ancho: "90px",
      render: (a) => <span className={estilos.numeros}>{a.entrada_en ? horaDe(a.entrada_en) : "—"}</span>,
    },
    {
      clave: "salida",
      titulo: "Salida",
      ancho: "90px",
      render: (a) => <span className={estilos.numeros}>{a.salida_en ? horaDe(a.salida_en) : "—"}</span>,
    },
    {
      clave: "tiempo",
      titulo: "Tiempo hoy",
      ancho: "120px",
      render: (a) => (a.minutos_hoy > 0 ? duracion(a.minutos_hoy) : "—"),
    },
  ];

  const columnasLista: Columna<Marcacion>[] = [
    {
      clave: "auxiliar",
      titulo: "Auxiliar",
      render: (m) => <span className={estilos.fuerte}>{m.usuario_nombre}</span>,
    },
    { clave: "fecha", titulo: "Fecha", ancho: "120px", render: (m) => fechaCorta(m.fecha) },
    { clave: "lugar", titulo: "Lugar", ancho: "190px", render: (m) => m.lugar_nombre },
    {
      clave: "entrada",
      titulo: "Entrada",
      ancho: "120px",
      render: (m) => (
        <div className={estilos.celda}>
          <span className={estilos.numeros}>{horaDe(m.entrada_en)}</span>
          <Caption1 className={estilos.secundario}>a {metros(m.entrada_distancia_m)}</Caption1>
        </div>
      ),
    },
    {
      clave: "retraso",
      titulo: "Retraso",
      ancho: "110px",
      render: (m) =>
        m.retraso_min > 0 ? (
          <EtiquetaEstado tono="aviso">{m.retraso_min} min</EtiquetaEstado>
        ) : m.turno_inicio ? (
          <EtiquetaEstado tono="exito">Puntual</EtiquetaEstado>
        ) : (
          <Caption1 className={estilos.secundario}>—</Caption1>
        ),
    },
    {
      clave: "salida",
      titulo: "Salida",
      ancho: "140px",
      render: (m) =>
        m.salida_en === null ? (
          <EtiquetaEstado tono="aviso">Sin salida</EtiquetaEstado>
        ) : (
          <div className={estilos.celda}>
            <span className={estilos.numeros}>{horaDe(m.salida_en)}</span>
            <Caption1 className={estilos.secundario}>
              {m.salida_manual ? "Puesta a mano" : `a ${metros(m.salida_distancia_m)}`}
            </Caption1>
          </div>
        ),
    },
    {
      clave: "tiempo",
      titulo: "Tiempo",
      ancho: "120px",
      render: (m) => (m.minutos === null ? "—" : duracion(m.minutos)),
    },
  ];

  const columnasResumen: Columna<ResumenAsistencia>[] = [
    {
      clave: "auxiliar",
      titulo: "Auxiliar",
      render: (r) => <span className={estilos.fuerte}>{r.usuario_nombre}</span>,
    },
    { clave: "dias", titulo: "Días asistidos", ancho: "130px", render: (r) => r.dias },
    { clave: "marcaciones", titulo: "Marcaciones", ancho: "120px", render: (r) => r.marcaciones },
    { clave: "tiempo", titulo: "Tiempo total", ancho: "140px", render: (r) => duracion(r.minutos) },
    {
      clave: "sin_salida",
      titulo: "Sin salida",
      ancho: "110px",
      render: (r) => (r.sin_salida ? <EtiquetaEstado tono="aviso">{r.sin_salida}</EtiquetaEstado> : "—"),
    },
    {
      clave: "retrasos",
      titulo: "Retrasos",
      ancho: "150px",
      render: (r) =>
        r.retrasos ? (
          <div className={estilos.celda}>
            <EtiquetaEstado tono="aviso">{r.retrasos}</EtiquetaEstado>
            <Caption1 className={estilos.secundario}>
              prom {r.retraso_promedio_min}m · máx {r.retraso_max_min}m
            </Caption1>
          </div>
        ) : (
          <EtiquetaEstado tono="exito">0</EtiquetaEstado>
        ),
    },
    {
      clave: "manuales",
      titulo: "Salidas a mano",
      ancho: "130px",
      render: (r) => r.salidas_manuales || "—",
    },
  ];

  const filtrosFecha = (
    <>
      <Input
        className={estilos.fecha}
        type="date"
        aria-label="Desde"
        contentBefore={<Caption1>Desde</Caption1>}
        value={desde}
        max={hasta || undefined}
        onChange={(_, d) => setDesde(d.value)}
      />
      <Input
        className={estilos.fecha}
        type="date"
        aria-label="Hasta"
        contentBefore={<Caption1>Hasta</Caption1>}
        value={hasta}
        min={desde || undefined}
        onChange={(_, d) => setHasta(d.value)}
      />
      <Select aria-label="Lugar" value={lugarFiltro} onChange={(_, d) => setLugarFiltro(d.value)}>
        <option value="">Todos los lugares</option>
        {lugares.data?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nombre}
          </option>
        ))}
      </Select>
    </>
  );

  const filtrosRetraso = (
    <>
      <Switch label="Solo con retraso" checked={soloRetraso} onChange={(_, d) => setSoloRetraso(d.checked)} />
      <Input
        className={estilos.fecha}
        type="number"
        min={0}
        aria-label="Retraso de al menos (min)"
        contentBefore={<Caption1>Retraso ≥</Caption1>}
        contentAfter={<Caption1>min</Caption1>}
        value={retrasoMin}
        onChange={(_, d) => setRetrasoMin(d.value)}
      />
    </>
  );

  return (
    <>
      <EncabezadoPagina
        seccion="Administración"
        titulo="Control de asistencia"
        descripcion="Los auxiliares marcan entrada y salida desde la app, con su huella y solo si están en su lugar."
        acciones={
          <>
            {(pestana === "marcaciones" || pestana === "resumen") && (
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button icon={<IconoDescargar />} disabled={exportando !== null}>
                    {exportando ? "Exportando…" : "Exportar"}
                  </Button>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem onClick={() => void exportar("xlsx")}>Excel (.xlsx)</MenuItem>
                    <MenuItem onClick={() => void exportar("csv")}>CSV</MenuItem>
                    <MenuItem onClick={() => void exportar("pdf")}>PDF</MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            )}
            {pestana === "lugares" && (
              <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setPanelLugar("nuevo")}>
                Nuevo lugar
              </Button>
            )}
            {pestana === "horarios" && (
              <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setPanelHorario("nuevo")}>
                Nuevo horario
              </Button>
            )}
          </>
        }
      />

      <TabList className={estilos.pestanas} selectedValue={pestana} onTabSelect={(_, d) => setPestana(d.value as Pestana)}>
        <Tab value="hoy">Asignar horario y lugar</Tab>
        <Tab value="marcaciones">Marcaciones</Tab>
        <Tab value="resumen">Resumen por auxiliar</Tab>
        <Tab value="lugares">Lugares</Tab>
        <Tab value="horarios">Horarios</Tab>
      </TabList>

      {pestana === "hoy" && (
        <>
          {lugares.data && auxiliares.data && sinLugar > 0 && (
            <MessageBar className={estilos.aviso} intent="warning" layout="multiline">
              <MessageBarBody>
                {sinLugar === 1 ? "Un auxiliar no tiene" : `${sinLugar} auxiliares no tienen`} dónde marcar.{" "}
                {predeterminado
                  ? "Asígnales un lugar tocando su fila."
                  : "Crea un lugar predeterminado (vale para todos) o asígnale uno a cada quien."}
              </MessageBarBody>
              {!predeterminado && (
                <MessageBarActions>
                  <Button size="small" onClick={() => setPestana("lugares")}>
                    Ir a Lugares
                  </Button>
                </MessageBarActions>
              )}
            </MessageBar>
          )}
          <Caption1 className={estilos.ayuda}>
            Haz clic en un auxiliar para cambiar el lugar donde marca. Esta lista se actualiza sola.
          </Caption1>
          <TablaDatos
            etiqueta="Asistencia de hoy"
            columnas={columnasHoy}
            filas={auxiliares.data}
            claveFila={(a) => a.id}
            cargando={auxiliares.isLoading}
            error={auxiliares.error}
            onReintentar={() => void auxiliares.refetch()}
            onFila={abrirAsignacion}
            vacio={
              <EstadoVacio
                icono={<IconoPersona />}
                titulo="No hay auxiliares activos"
                descripcion="Los auxiliares se crean en Usuarios."
              />
            }
          />
        </>
      )}

      {pestana === "marcaciones" && (
        <>
          <BarraFiltros>
            {filtrosFecha}
            <Select aria-label="Auxiliar" value={auxiliar} onChange={(_, d) => setAuxiliar(d.value)}>
              <option value="">Todos los auxiliares</option>
              {auxiliares.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre_completo}
                </option>
              ))}
            </Select>
            <Switch label="Solo sin salida" checked={soloAbiertas} onChange={(_, d) => setSoloAbiertas(d.checked)} />
            {filtrosRetraso}
          </BarraFiltros>
          <TablaDatos
            etiqueta="Marcaciones"
            columnas={columnasLista}
            filas={lista.data?.results}
            claveFila={(m) => m.id}
            cargando={lista.isLoading}
            error={lista.error}
            onReintentar={() => void lista.refetch()}
            onFila={(m) => setDetalle(m.id)}
            vacio={
              <EstadoVacio
                icono={<IconoMarcaciones />}
                titulo="No hay marcaciones con esos filtros"
                descripcion="Los auxiliares marcan su entrada y su salida desde la app, en «Mi asistencia»."
              />
            }
          />
          <Paginacion pagina={pagina} total={lista.data?.count ?? 0} tamano={TAMANO} onCambiar={setPagina} />
        </>
      )}

      {pestana === "resumen" && (
        <>
          <BarraFiltros>
            {filtrosFecha}
            {filtrosRetraso}
            <Input
              className={estilos.fecha}
              type="number"
              min={0}
              aria-label="Cantidad de retrasos de al menos"
              contentBefore={<Caption1>≥</Caption1>}
              contentAfter={<Caption1>retrasos</Caption1>}
              value={minRetrasos}
              onChange={(_, d) => setMinRetrasos(d.value)}
            />
          </BarraFiltros>
          <Caption1 className={estilos.ayuda}>
            El tiempo total cuenta solo las marcaciones con salida. Haz clic en un auxiliar para ver sus marcaciones.
          </Caption1>
          <TablaDatos
            etiqueta="Resumen por auxiliar"
            columnas={columnasResumen}
            filas={resumen.data}
            claveFila={(r) => r.usuario}
            cargando={resumen.isLoading}
            error={resumen.error}
            onReintentar={() => void resumen.refetch()}
            onFila={(r) => {
              setAuxiliar(String(r.usuario));
              setSoloAbiertas(false);
              setPestana("marcaciones");
            }}
            vacio={
              <EstadoVacio
                icono={<IconoMarcaciones />}
                titulo="Nadie marcó en esas fechas"
                descripcion="Cambia el rango de fechas para ver otros días."
              />
            }
          />
        </>
      )}

      {pestana === "lugares" && (
        <LugaresTab
          lugares={lugares.data}
          cargando={lugares.isLoading}
          error={lugares.error}
          onReintentar={() => void lugares.refetch()}
          panel={panelLugar}
          onPanel={setPanelLugar}
        />
      )}

      {pestana === "horarios" && (
        <HorariosTab
          horarios={horarios.data}
          cargando={horarios.isLoading}
          error={horarios.error}
          onReintentar={() => void horarios.refetch()}
          panel={panelHorario}
          onPanel={setPanelHorario}
        />
      )}

      <MarcacionDetalle id={detalle} onCerrar={() => setDetalle(null)} />

      <PanelFormulario
        abierto={asignando !== null}
        tamano="small"
        titulo={asignando?.nombre_completo ?? "Auxiliar"}
        subtitulo="Dónde marca su asistencia y en qué horario trabaja."
        onCerrar={() => setAsignando(null)}
        pie={
          <>
            <Button appearance="primary" disabled={asignar.isPending || sinCambiosAsig} onClick={() => asignar.mutate()}>
              {asignar.isPending ? "Guardando…" : "Guardar"}
            </Button>
            <Button onClick={() => setAsignando(null)}>Cancelar</Button>
          </>
        }
      >
        <Field
          label="Lugar"
          hint={
            predeterminado
              ? `Sin lugar propio, marca en el predeterminado: ${predeterminado.nombre}.`
              : "No hay un lugar predeterminado: sin lugar propio no podrá marcar."
          }
        >
          <Select value={lugarElegido} onChange={(_, d) => setLugarElegido(d.value)}>
            <option value="">{predeterminado ? `Predeterminado (${predeterminado.nombre})` : "Sin lugar propio"}</option>
            {(lugares.data ?? [])
              .filter((l) => l.activo || String(l.id) === lugarElegido)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre} · {l.radio_m} m
                </option>
              ))}
          </Select>
        </Field>
        <Field
          label="Horario de trabajo"
          hint={
            horarioElegido
              ? resumenHorario((horarios.data ?? []).find((h) => String(h.id) === horarioElegido)?.bloques ?? [])
              : "Sin horario asignado. Créalos en la pestaña «Horarios»."
          }
        >
          <Select value={horarioElegido} onChange={(_, d) => setHorarioElegido(d.value)}>
            <option value="">Sin horario</option>
            {(horarios.data ?? [])
              .filter((h) => h.activo || String(h.id) === horarioElegido)
              .map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                </option>
              ))}
          </Select>
        </Field>
        {asignando && asignando.situacion === "presente" && (
          <MessageBar intent="info">
            <MessageBarBody>
              Ahora mismo tiene una entrada abierta: la salida de hoy la marca donde entró. El cambio vale desde su
              próxima entrada.
            </MessageBarBody>
          </MessageBar>
        )}
      </PanelFormulario>
    </>
  );
}
