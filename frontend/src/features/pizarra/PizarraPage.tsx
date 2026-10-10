import {
  Button,
  Caption1,
  Input,
  Select,
  Tab,
  TabList,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { isSameDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import type { EventoAgenda } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { identidad } from "../../app/tema";
import { EstadoError } from "../../components/feedback/Estados";
import { PantallaCarga } from "../../components/feedback/PantallaCarga";
import { IconoAgregar, IconoAnterior, IconoSiguiente } from "../../components/iconos/iconos";
import { EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { aHora, aISO, aMinutos, desdeISO, diaCorto, fechaLarga, lunesDe, minutosAhora, sumarDias } from "../../lib/fechas";
import { useConfiguracion } from "../../lib/configuracion";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { almacen } from "../../lib/utiles";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { obtenerAgenda } from "../reservas/api";
import { EventoPanel } from "./EventoPanel";
import { type ColumnaRejilla, RejillaTiempo } from "./RejillaTiempo";
import { VistaProximas } from "./VistaProximas";

type Vista = "dia" | "semana" | "proximas";
const CLAVE_VISTA = "labficct.pizarra.vista";

const useEstilos = makeStyles({
  barra: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  navegacion: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  espacio: {
    flex: 1,
  },
  leyenda: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    color: tokens.colorNeutralForeground3,
  },
  muestra: {
    display: "inline-block",
    width: "12px",
    height: "12px",
    borderRadius: "3px",
    marginRight: "6px",
    verticalAlign: "-1px",
  },
});

export function PizarraPage() {
  const estilos = useEstilos();
  const navegar = useNavigate();
  const { puede } = useSesion();
  const reservar = puede("reservas.gestionar");
  const configuracion = useConfiguracion();
  const [fecha, setFecha] = useState(() => new Date());
  const [vista, setVista] = useState<Vista>(() => (almacen.leer(CLAVE_VISTA) as Vista) || "dia");
  const [labSemana, setLabSemana] = useState<number | null>(null);
  const [ahora, setAhora] = useState(minutosAhora);
  const [evento, setEvento] = useState<EventoAgenda | null>(null);

  // Desde una notificación: ?fecha=2026-09-28 abre ese día.
  useAccionUrl(["fecha"], (p) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) return;
    setFecha(desdeISO(p.fecha));
    setVista((v) => (v === "proximas" ? "dia" : v));
  });

  // La línea de "ahora" avanza sola.
  useEffect(() => {
    const t = window.setInterval(() => setAhora(minutosAhora()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos });
  const labs = useMemo(() => (laboratorios.data ?? []).filter((l) => l.activo), [laboratorios.data]);

  useEffect(() => {
    if (labSemana === null && labs.length) setLabSemana(labs[0].id);
  }, [labs, labSemana]);

  const hoy = new Date();
  const lunes = lunesDe(fecha);
  const [desde, hasta] =
    vista === "semana" ? [aISO(lunes), aISO(sumarDias(lunes, 6))] : vista === "proximas" ? [aISO(hoy), aISO(hoy)] : [aISO(fecha), aISO(fecha)];

  const agenda = useQuery({
    queryKey: ["agenda", desde, hasta, vista === "semana" ? labSemana : "todos"],
    queryFn: () => obtenerAgenda(desde, hasta, vista === "semana" && labSemana ? [labSemana] : undefined),
    enabled: vista !== "semana" || labSemana !== null,
    refetchInterval: 60_000,
  });

  const cambiarVista = (v: Vista) => {
    almacen.guardar(CLAVE_VISTA, v);
    setVista(v);
  };

  const mover = (dias: number) => setFecha((f) => sumarDias(f, dias));
  const paso = vista === "semana" ? 7 : 1;

  // Rango visible: el horario de atención del .env (07:00–22:45), o más si hay eventos fuera.
  const eventos = agenda.data ?? [];
  const inicioAtencion = Math.floor(aMinutos(configuracion.atencion_inicio) / 60) * 60;
  const finAtencion = Math.ceil(aMinutos(configuracion.atencion_fin) / 60) * 60;
  const inicio = Math.min(inicioAtencion, ...eventos.map((e) => Math.floor(aMinutos(e.hora_inicio) / 60) * 60));
  const fin = Math.max(finAtencion, ...eventos.map((e) => Math.ceil(aMinutos(e.hora_fin) / 60) * 60));

  let columnas: ColumnaRejilla[] = [];
  if (vista === "dia") {
    columnas = labs.map((l) => ({
      clave: String(l.id),
      titulo: l.codigo,
      subtitulo: l.nombre,
      mostrarAhora: isSameDay(fecha, hoy),
      eventos: eventos.filter((e) => e.laboratorio === l.id),
    }));
  } else if (vista === "semana") {
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
    const conDomingo = eventos.some((e) => desdeISO(e.fecha).getDay() === 0);
    columnas = dias
      .filter((d) => d.getDay() !== 0 || conDomingo)
      .map((d) => ({
        clave: aISO(d),
        titulo: diaCorto(d),
        destacada: isSameDay(d, hoy),
        mostrarAhora: isSameDay(d, hoy),
        eventos: eventos.filter((e) => e.fecha === aISO(d)),
      }));
  }

  const alEspacioLibre = (columna: ColumnaRejilla, minutos: number) => {
    const laboratorio = vista === "dia" ? columna.clave : String(labSemana);
    const dia = vista === "dia" ? aISO(fecha) : columna.clave;
    const params = new URLSearchParams({
      nuevo: "1",
      laboratorio,
      fecha: dia,
      inicio: aHora(minutos),
      fin: aHora(Math.min(minutos + 90, 23 * 60 + 30)),
    });
    navegar(`/reservas?${params.toString()}`);
  };

  const descripcion =
    vista === "semana"
      ? `Semana del ${diaCorto(lunes)} al ${diaCorto(sumarDias(lunes, 6))}`
      : vista === "proximas"
        ? `Hoy, ${fechaLarga(hoy).toLowerCase()}`
        : fechaLarga(fecha);

  if (laboratorios.isLoading) return <PantallaCarga mensaje="Cargando pizarra…" />;

  return (
    <>
      <EncabezadoPagina
        seccion="Operación"
        titulo="Pizarra de actividades"
        descripcion={descripcion}
        acciones={
          reservar && (
            <Button appearance="primary" icon={<IconoAgregar />} onClick={() => navegar("/reservas?nuevo=1")}>
              Nueva reserva
            </Button>
          )
        }
      />

      <div className={estilos.barra}>
        <TabList selectedValue={vista} onTabSelect={(_, d) => cambiarVista(d.value as Vista)}>
          <Tab value="dia">Por laboratorio</Tab>
          <Tab value="semana">Semana</Tab>
          <Tab value="proximas">Próximas 2 horas</Tab>
        </TabList>

        {vista !== "proximas" && (
          <div className={estilos.navegacion}>
            <Button onClick={() => setFecha(new Date())}>Hoy</Button>
            <Tooltip content={vista === "semana" ? "Semana anterior" : "Día anterior"} relationship="label">
              <Button appearance="subtle" icon={<IconoAnterior />} onClick={() => mover(-paso)} />
            </Tooltip>
            <Tooltip content={vista === "semana" ? "Semana siguiente" : "Día siguiente"} relationship="label">
              <Button appearance="subtle" icon={<IconoSiguiente />} onClick={() => mover(paso)} />
            </Tooltip>
            <Input
              type="date"
              aria-label="Fecha"
              value={aISO(fecha)}
              onChange={(_, d) => d.value && setFecha(desdeISO(d.value))}
            />
          </div>
        )}
        {vista === "semana" && (
          <Select
            aria-label="Laboratorio"
            value={labSemana !== null ? String(labSemana) : ""}
            onChange={(_, d) => setLabSemana(Number(d.value))}
          >
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} · {l.nombre}
              </option>
            ))}
          </Select>
        )}

        <span className={estilos.espacio} />
        {vista !== "proximas" && (
          <div className={estilos.leyenda}>
            <Caption1>
              <span className={estilos.muestra} style={{ backgroundColor: tokens.colorBrandBackground2, borderLeft: `3px solid ${tokens.colorBrandForeground1}` }} />
              Clase
            </Caption1>
            <Caption1>
              <span
                className={estilos.muestra}
                style={{ backgroundColor: tokens.colorPaletteMarigoldBackground1, borderLeft: `3px solid ${tokens.colorPaletteMarigoldBorderActive}` }}
              />
              Reserva
            </Caption1>
            <Caption1>
              <span className={estilos.muestra} style={{ backgroundColor: identidad.oro, height: 3 }} />
              Ahora
            </Caption1>
          </div>
        )}
      </div>

      {agenda.error && !agenda.data ? (
        <EstadoError error={agenda.error} onReintentar={() => void agenda.refetch()} />
      ) : vista === "proximas" ? (
        <VistaProximas eventos={eventos} ahora={ahora} onEvento={setEvento} />
      ) : (
        <RejillaTiempo
          columnas={columnas}
          inicio={inicio}
          fin={fin}
          ahora={ahora}
          anchoMinimo={vista === "semana" ? 130 : 160}
          onEvento={setEvento}
          onEspacioLibre={reservar ? alEspacioLibre : undefined}
        />
      )}

      <EventoPanel evento={evento} onCerrar={() => setEvento(null)} />
    </>
  );
}
