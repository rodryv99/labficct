import {
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Radio,
  RadioGroup,
  Select,
  SpinButton,
  Spinner,
  Switch,
  Textarea,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { choquesDeError } from "../../api/errores";
import type { Laboratorio, Reserva } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import { ListaSeleccion } from "../../components/formularios/ListaSeleccion";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { SelectorBuscable } from "../../components/formularios/SelectorBuscable";
import { IconoAgregar, IconoAviso, IconoCerrar, IconoError, IconoExito } from "../../components/iconos/iconos";
import { useConfiguracion } from "../../lib/configuracion";
import { aISO, aMinutos, desdeISO, sumarDias } from "../../lib/fechas";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { useDebounce } from "../../lib/utiles";
import { listarLaboratoriosTodos, listarSoftware } from "../laboratorios/api";
import { opcionesUsuarios } from "../usuarios/api";
import {
  type BloqueFormulario,
  type DatosReserva,
  actualizarReserva,
  consultarDisponibilidad,
  crearReserva,
} from "./api";

const useEstilos = makeStyles({
  seccion: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  tituloSeccion: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  bloque: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "12px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  bloqueCampos: {
    display: "grid",
    gridTemplateColumns: "minmax(130px, 1.3fr) minmax(130px, 1.2fr) 96px 96px auto",
    gap: "8px",
    alignItems: "end",
    "@media (max-width: 720px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
  },
  estado: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "20px",
    fontSize: tokens.fontSizeBase200,
  },
  libre: {
    color: tokens.colorStatusSuccessForeground1,
  },
  ocupado: {
    color: tokens.colorStatusDangerForeground1,
  },
  aviso: {
    color: tokens.colorStatusWarningForeground1,
  },
  choqueAviso: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  notaAviso: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    paddingLeft: "26px",
  },
  neutro: {
    color: tokens.colorNeutralForeground3,
  },
  choques: {
    margin: "4px 0 0",
    paddingLeft: "18px",
  },
});

type TipoSolicitante = "usuario" | "externo";

interface Formulario extends DatosReserva {
  tipoSolicitante: TipoSolicitante;
}

function hoy() {
  return aISO(new Date());
}

const bloqueVacio = (p?: Partial<BloqueFormulario>): BloqueFormulario => ({
  laboratorio: p?.laboratorio ?? null,
  fecha: p?.fecha ?? hoy(),
  hora_inicio: p?.hora_inicio ?? "08:00",
  hora_fin: p?.hora_fin ?? sumarHora(p?.hora_inicio ?? "08:00", 120),
});

function sumarHora(hora: string, minutos: number) {
  const total = Math.min(aMinutos(hora) + minutos, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const VACIO = (p?: Partial<BloqueFormulario>): Formulario => ({
  titulo: "",
  descripcion: "",
  tipoSolicitante: "externo",
  solicitante: null,
  solicitante_externo: "",
  contacto: "",
  programas: [],
  requiere_apoyo: false,
  auxiliares_requeridos: 1,
  auxiliares: [],
  bloques: [bloqueVacio(p)],
});

/**
 * Muestra en vivo si el laboratorio está libre en ese día y horario. Si choca con una
 * clase u otra reserva solo avisa: se puede registrar igual y queda por aprobar.
 */
function Disponibilidad({
  bloque,
  excluir,
  onChoque,
}: {
  bloque: BloqueFormulario;
  excluir?: number;
  onChoque: (hayChoque: boolean) => void;
}) {
  const estilos = useEstilos();
  const retrasado = useDebounce(bloque, 450);
  const completo =
    retrasado.laboratorio !== null &&
    retrasado.fecha &&
    retrasado.hora_inicio &&
    retrasado.hora_fin &&
    aMinutos(retrasado.hora_fin) > aMinutos(retrasado.hora_inicio);

  const consulta = useQuery({
    queryKey: ["disponibilidad", retrasado, excluir],
    queryFn: () => consultarDisponibilidad(retrasado, excluir),
    enabled: Boolean(completo),
    staleTime: 10_000,
  });

  const hayChoque = Boolean(completo && consulta.data?.requiere_aprobacion);
  useEffect(() => {
    onChoque(hayChoque);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayChoque]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onChoque(false), []);

  if (bloque.hora_fin && bloque.hora_inicio && aMinutos(bloque.hora_fin) <= aMinutos(bloque.hora_inicio)) {
    return (
      <div className={`${estilos.estado} ${estilos.ocupado}`}>
        <IconoError /> La hora final debe ser posterior a la inicial.
      </div>
    );
  }
  if (!completo) return <div className={`${estilos.estado} ${estilos.neutro}`}>Elige laboratorio, día y horas.</div>;
  if (consulta.isFetching && !consulta.data) {
    return (
      <div className={`${estilos.estado} ${estilos.neutro}`}>
        <Spinner size="extra-tiny" /> Revisando disponibilidad…
      </div>
    );
  }
  if (!consulta.data) return null;
  if (consulta.data.disponible) {
    return (
      <div className={`${estilos.estado} ${estilos.libre}`}>
        <IconoExito /> Libre en ese horario
      </div>
    );
  }
  if (!consulta.data.requiere_aprobacion) {
    return (
      <div className={`${estilos.estado} ${estilos.ocupado}`}>
        <IconoError /> {consulta.data.choques[0]}
      </div>
    );
  }
  return (
    <div className={estilos.choqueAviso}>
      {consulta.data.choques.map((c) => (
        <div key={c} className={`${estilos.estado} ${estilos.aviso}`}>
          <IconoAviso /> {c}
        </div>
      ))}
      <span className={estilos.notaAviso}>
        Puedes registrarla igual: quedará por aprobar. Si un administrador la aprueba, la reserva tendrá prioridad.
      </span>
    </div>
  );
}

interface Props {
  abierto: boolean;
  reserva: Reserva | null;
  prellenado?: Partial<BloqueFormulario>;
  onCerrar: () => void;
}

export function ReservaPanel({ abierto, reserva, prellenado, onCerrar }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<Formulario>(VACIO());
  const [choques, setChoques] = useState<string[]>([]);
  // Días (por posición) que chocan con algo: la reserva quedará por aprobar.
  const [conChoque, setConChoque] = useState<Record<number, boolean>>({});
  const esNueva = reserva === null;
  const configuracion = useConfiguracion();

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos, enabled: abierto });
  const software = useQuery({ queryKey: ["software"], queryFn: listarSoftware, enabled: abierto });
  const personas = useQuery({
    queryKey: ["usuarios", "opciones", "solicitantes"],
    queryFn: () => opcionesUsuarios("docente,administrativo,auxiliar,admin"),
    enabled: abierto,
  });

  useEffect(() => {
    if (!abierto) return;
    setChoques([]);
    setConChoque({});
    f.reiniciar(
      reserva
        ? {
            titulo: reserva.titulo,
            descripcion: reserva.descripcion,
            tipoSolicitante: reserva.solicitante ? "usuario" : "externo",
            solicitante: reserva.solicitante,
            solicitante_externo: reserva.solicitante_externo,
            contacto: reserva.contacto,
            programas: reserva.programas,
            requiere_apoyo: reserva.requiere_apoyo,
            auxiliares_requeridos: Math.max(reserva.auxiliares_requeridos, 1),
            auxiliares: reserva.auxiliares,
            bloques: reserva.bloques.map((b) => ({
              laboratorio: b.laboratorio,
              fecha: b.fecha,
              hora_inicio: b.hora_inicio,
              hora_fin: b.hora_fin,
            })),
          }
        : VACIO(prellenado),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, reserva]);

  const guardar = useMutation({
    mutationFn: () => {
      const { tipoSolicitante, ...v } = f.valores;
      const datos: DatosReserva = {
        ...v,
        solicitante: tipoSolicitante === "usuario" ? v.solicitante : null,
        solicitante_externo: tipoSolicitante === "externo" ? v.solicitante_externo : "",
        auxiliares_requeridos: v.requiere_apoyo ? v.auxiliares_requeridos : 0,
        auxiliares: v.requiere_apoyo ? v.auxiliares : [],
      };
      return esNueva ? crearReserva(datos) : actualizarReserva(reserva.id, datos);
    },
    onSuccess: (r) => {
      if (r.estado === "pendiente") {
        notificar.aviso(
          `«${r.titulo}» quedó por aprobar`,
          "Choca con otra actividad. Un administrador debe aprobarla; si la aprueba, tendrá prioridad.",
        );
      } else {
        notificar.exito(esNueva ? "Reserva registrada" : "Reserva actualizada", r.titulo);
      }
      r.advertencias.forEach((a) => notificar.aviso("Revisa el software", a));
      void queryClient.invalidateQueries({ queryKey: ["reservas"] });
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
      onCerrar();
    },
    onError: (error) => {
      setChoques(choquesDeError(error));
      f.tomarErroresDelServidor(error);
    },
  });

  const { valores: v, errores: e } = f;

  const cambiarBloque = (i: number, cambio: Partial<BloqueFormulario>) => {
    f.set(
      "bloques",
      v.bloques.map((b, j) => (j === i ? { ...b, ...cambio } : b)),
    );
  };

  const agregarDia = () => {
    const ultimo = v.bloques[v.bloques.length - 1];
    const siguiente = ultimo
      ? { ...ultimo, fecha: aISO(sumarDias(desdeISO(ultimo.fecha), 1)) }
      : bloqueVacio(prellenado);
    f.set("bloques", [...v.bloques, siguiente]);
  };

  const quitarDia = (i: number) => f.set("bloques", v.bloques.filter((_, j) => j !== i));
  const marcarChoque = (i: number, hay: boolean) =>
    setConChoque((actual) => (Boolean(actual[i]) === hay ? actual : { ...actual, [i]: hay }));
  const requiereAprobacion = v.bloques.some((_, i) => conChoque[i]);

  const labsActivos: Laboratorio[] = (laboratorios.data ?? []).filter((l) => l.activo);
  const auxiliares = (personas.data ?? []).filter((p) => p.rol === "auxiliar");
  const bloquesCompletos = v.bloques.length > 0 && v.bloques.every((b) => b.laboratorio && b.fecha && b.hora_inicio && b.hora_fin);
  const solicitanteListo =
    v.tipoSolicitante === "usuario" ? v.solicitante !== null : v.solicitante_externo.trim().length > 0;
  const completo = v.titulo.trim() && solicitanteListo && bloquesCompletos;

  return (
    <PanelFormulario
      abierto={abierto}
      tamano="large"
      titulo={esNueva ? "Nueva reserva" : "Editar reserva"}
      subtitulo="Un evento único o de pocos días. Si choca con una clase o con otra reserva te aviso; puedes registrarla igual y queda por aprobar."
      onCerrar={onCerrar}
      hayCambios={f.cambiado && !guardar.isPending}
      pie={
        <>
          <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending
              ? "Guardando…"
              : !esNueva
                ? "Guardar cambios"
                : requiereAprobacion
                  ? "Registrar para aprobación"
                  : "Registrar reserva"}
          </Button>
          <Button onClick={onCerrar}>Cancelar</Button>
        </>
      }
    >
      {e.general && (choques.length > 0 || Object.keys(e).length <= 2) && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>{choques.length ? "El laboratorio no está libre" : "No se pudo guardar"}</MessageBarTitle>
            {choques.length > 1 ? (
              <ul className={estilos.choques}>
                {choques.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : (
              e.general
            )}
          </MessageBarBody>
        </MessageBar>
      )}

      <Field label="Título" required {...estadoCampo(e.titulo)}>
        <Input value={v.titulo} placeholder="Ej.: Taller de Git y GitHub" onChange={(_, d) => f.set("titulo", d.value)} />
      </Field>

      <div className={estilos.seccion}>
        <Caption1 className={estilos.tituloSeccion}>Quién lo solicita</Caption1>
        <RadioGroup
          layout="horizontal"
          value={v.tipoSolicitante}
          onChange={(_, d) => f.set("tipoSolicitante", d.value as TipoSolicitante)}
        >
          <Radio value="usuario" label="Un usuario del sistema" />
          <Radio value="externo" label="Otra persona o unidad" />
        </RadioGroup>
        {v.tipoSolicitante === "usuario" ? (
          <Field {...estadoCampo(e.solicitante)}>
            <SelectorBuscable
              opciones={(personas.data ?? []).map((p) => ({ id: p.id, etiqueta: p.nombre_completo, secundaria: p.email }))}
              valor={v.solicitante}
              onCambio={(id) => f.set("solicitante", id)}
              placeholder="Escribe el nombre"
            />
          </Field>
        ) : (
          <div className={estilos.fila}>
            <Field label="Nombre" {...estadoCampo(e.solicitante_externo ?? e.solicitante)}>
              <Input
                value={v.solicitante_externo}
                placeholder="Ej.: Centro de Estudiantes"
                onChange={(_, d) => f.set("solicitante_externo", d.value)}
              />
            </Field>
            <Field label="Contacto" {...estadoCampo(e.contacto)}>
              <Input value={v.contacto} placeholder="Teléfono o correo" onChange={(_, d) => f.set("contacto", d.value)} />
            </Field>
          </div>
        )}
      </div>

      <div className={estilos.seccion}>
        <Caption1 className={estilos.tituloSeccion}>Días y horarios</Caption1>
        {v.bloques.map((b, i) => (
          <div key={i} className={estilos.bloque}>
            <div className={estilos.bloqueCampos}>
              <Field label="Laboratorio" size="small" {...estadoCampo(e[`bloques.${i}.laboratorio`])}>
                <Select
                  size="small"
                  value={b.laboratorio ? String(b.laboratorio) : ""}
                  onChange={(_, d) => cambiarBloque(i, { laboratorio: Number(d.value) })}
                >
                  <option value="" disabled>
                    Elegir…
                  </option>
                  {labsActivos.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.codigo} · {l.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Día" size="small" {...estadoCampo(e[`bloques.${i}.fecha`])}>
                <Input size="small" type="date" value={b.fecha} onChange={(_, d) => cambiarBloque(i, { fecha: d.value })} />
              </Field>
              <Field label="Desde" size="small" {...estadoCampo(e[`bloques.${i}.hora_inicio`])}>
                <Input
                  size="small"
                  type="time"
                  step={300}
                  min={configuracion.atencion_inicio}
                  max={configuracion.atencion_fin}
                  value={b.hora_inicio}
                  onChange={(_, d) => cambiarBloque(i, { hora_inicio: d.value })}
                />
              </Field>
              <Field label="Hasta" size="small" {...estadoCampo(e[`bloques.${i}.hora_fin`])}>
                <Input
                  size="small"
                  type="time"
                  step={300}
                  min={configuracion.atencion_inicio}
                  max={configuracion.atencion_fin}
                  value={b.hora_fin}
                  onChange={(_, d) => cambiarBloque(i, { hora_fin: d.value })}
                />
              </Field>
              <Tooltip content="Quitar este día" relationship="label">
                <Button
                  size="small"
                  appearance="subtle"
                  icon={<IconoCerrar />}
                  disabled={v.bloques.length === 1}
                  onClick={() => quitarDia(i)}
                />
              </Tooltip>
            </div>
            <Disponibilidad bloque={b} excluir={reserva?.id} onChoque={(hay) => marcarChoque(i, hay)} />
          </div>
        ))}
        <div>
          <Button size="small" icon={<IconoAgregar />} onClick={agregarDia}>
            Agregar otro día
          </Button>
        </div>
      </div>

      <Field label="Descripción" {...estadoCampo(e.descripcion)}>
        <Textarea
          value={v.descripcion}
          resize="vertical"
          placeholder="Qué se hará, quiénes asisten, necesidades especiales…"
          onChange={(_, d) => f.set("descripcion", d.value)}
        />
      </Field>

      <div className={estilos.seccion}>
        <Caption1 className={estilos.tituloSeccion}>Programas requeridos</Caption1>
        <ListaSeleccion
          opciones={(software.data ?? []).map((s) => ({ id: s.id, etiqueta: s.nombre_completo }))}
          seleccionados={v.programas}
          onCambio={(ids) => f.set("programas", ids)}
          placeholder="Buscar programa"
          alto={180}
        />
      </div>

      <div className={estilos.seccion}>
        <Caption1 className={estilos.tituloSeccion}>Apoyo de auxiliares</Caption1>
        <Switch
          label="Requiere apoyo de auxiliares durante el evento"
          checked={v.requiere_apoyo}
          onChange={(_, d) => f.set("requiere_apoyo", d.checked)}
        />
        {v.requiere_apoyo && (
          <>
            <Field label="¿Cuántos auxiliares?" {...estadoCampo(e.auxiliares_requeridos)}>
              <SpinButton
                min={1}
                max={10}
                value={v.auxiliares_requeridos}
                onChange={(_, d) =>
                  f.set("auxiliares_requeridos", d.value ?? (Number.parseInt(d.displayValue ?? "1", 10) || 1))
                }
              />
            </Field>
            <Field label="Asignar ahora (opcional)" hint="Puedes asignarlos después.">
              <ListaSeleccion
                opciones={auxiliares.map((a) => ({ id: a.id, etiqueta: a.nombre_completo }))}
                seleccionados={v.auxiliares}
                onCambio={(ids) => f.set("auxiliares", ids)}
                alto={160}
              />
            </Field>
          </>
        )}
      </div>

    </PanelFormulario>
  );
}
