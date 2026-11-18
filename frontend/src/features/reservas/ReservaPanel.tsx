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
  Spinner,
  SpinButton,
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
import {
  IconoAgregar,
  IconoAviso,
  IconoCerrar,
  IconoError,
  IconoExito,
  IconoMicrofono,
  IconoMicrofonoActivo,
} from "../../components/iconos/iconos";
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
import { type ResultadoDictado, interpretarDictado } from "./dictado";
import { useDictado } from "./useDictado";

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
    gap: "10px",
    padding: "12px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  encabezadoBloque: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  numeroDia: {
    color: tokens.colorNeutralForeground3,
  },
  horas: {
    display: "grid",
    gridTemplateColumns: "minmax(130px, 1.4fr) 110px 110px",
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
  dispLab: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
  },
  codigoLab: {
    minWidth: "64px",
    paddingTop: "1px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    flexShrink: 0,
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
    flex: 1,
    minWidth: 0,
  },
  notaAviso: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  neutro: {
    color: tokens.colorNeutralForeground3,
  },
  choques: {
    margin: "4px 0 0",
    paddingLeft: "18px",
  },
  dictado: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  dictadoBotones: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  escuchando: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  entendido: {
    margin: "4px 0 0",
    paddingLeft: "18px",
  },
});

type TipoSolicitante = "usuario" | "externo";

/** Una fila del formulario: un día y horario con una o varias aulas. Al guardar,
 * cada aula se vuelve un bloque propio (así cada aula sale en la pizarra). */
interface FilaReserva {
  laboratorios: number[];
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

interface Formulario {
  titulo: string;
  descripcion: string;
  tipoSolicitante: TipoSolicitante;
  solicitante: number | null;
  solicitante_externo: string;
  contacto: string;
  programas: number[];
  requiere_apoyo: boolean;
  auxiliares_requeridos: number;
  auxiliares: number[];
  filas: FilaReserva[];
}

function hoy() {
  return aISO(new Date());
}

function sumarHora(hora: string, minutos: number) {
  const total = Math.min(aMinutos(hora) + minutos, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const filaVacia = (p?: Partial<BloqueFormulario>): FilaReserva => ({
  laboratorios: p?.laboratorio ? [p.laboratorio] : [],
  fecha: p?.fecha ?? hoy(),
  hora_inicio: p?.hora_inicio ?? "08:00",
  hora_fin: p?.hora_fin ?? sumarHora(p?.hora_inicio ?? "08:00", 120),
});

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
  filas: [filaVacia(p)],
});

/** Agrupa los bloques guardados (uno por aula) en filas por día y horario, para editar. */
function filasDesdeReserva(reserva: Reserva): FilaReserva[] {
  const porClave = new Map<string, FilaReserva>();
  for (const b of reserva.bloques) {
    const clave = `${b.fecha}|${b.hora_inicio}|${b.hora_fin}`;
    const fila = porClave.get(clave);
    if (fila) {
      if (!fila.laboratorios.includes(b.laboratorio)) fila.laboratorios.push(b.laboratorio);
    } else {
      porClave.set(clave, {
        laboratorios: [b.laboratorio],
        fecha: b.fecha,
        hora_inicio: b.hora_inicio,
        hora_fin: b.hora_fin,
      });
    }
  }
  return porClave.size > 0 ? [...porClave.values()] : [filaVacia()];
}

/**
 * Muestra en vivo si un aula está libre en ese día y horario. Si choca con una
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
  if (!completo) return <div className={`${estilos.estado} ${estilos.neutro}`}>Elige día y horas.</div>;
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
  // Combinaciones día+aula que chocan con algo: la reserva quedará por aprobar.
  const [conChoque, setConChoque] = useState<Record<string, boolean>>({});
  const esNueva = reserva === null;
  const configuracion = useConfiguracion();
  // Dictado: la frase (dicha o escrita) y lo que se entendió de ella.
  const [frase, setFrase] = useState("");
  const [entendido, setEntendido] = useState<ResultadoDictado | null>(null);

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
    setFrase("");
    setEntendido(null);
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
            filas: filasDesdeReserva(reserva),
          }
        : VACIO(prellenado),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, reserva]);

  const guardar = useMutation({
    mutationFn: () => {
      const { tipoSolicitante, filas, ...v } = f.valores;
      // Cada aula de cada fila es un bloque: así cada aula sale en la pizarra con esta actividad.
      const bloques: BloqueFormulario[] = filas.flatMap((fila) =>
        fila.laboratorios.map((laboratorio) => ({
          laboratorio,
          fecha: fila.fecha,
          hora_inicio: fila.hora_inicio,
          hora_fin: fila.hora_fin,
        })),
      );
      const datos: DatosReserva = {
        ...v,
        solicitante: tipoSolicitante === "usuario" ? v.solicitante : null,
        solicitante_externo: tipoSolicitante === "externo" ? v.solicitante_externo : "",
        auxiliares_requeridos: v.requiere_apoyo ? v.auxiliares_requeridos : 0,
        auxiliares: v.requiere_apoyo ? v.auxiliares : [],
        bloques,
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

  const cambiarFila = (i: number, cambio: Partial<FilaReserva>) => {
    f.set(
      "filas",
      v.filas.map((fila, j) => (j === i ? { ...fila, ...cambio } : fila)),
    );
  };

  const agregarDia = () => {
    const ultima = v.filas[v.filas.length - 1];
    const siguiente = ultima
      ? { ...ultima, fecha: aISO(sumarDias(desdeISO(ultima.fecha), 1)) }
      : filaVacia(prellenado);
    f.set("filas", [...v.filas, siguiente]);
  };

  const quitarDia = (i: number) => f.set("filas", v.filas.filter((_, j) => j !== i));
  const marcarChoque = (clave: string, hay: boolean) =>
    setConChoque((actual) => (Boolean(actual[clave]) === hay ? actual : { ...actual, [clave]: hay }));
  const requiereAprobacion = Object.values(conChoque).some(Boolean);

  const labsActivos: Laboratorio[] = (laboratorios.data ?? []).filter((l) => l.activo);

  /** Saca de la frase lo que se pueda y lo pone en el formulario. No guarda nada: se revisa abajo. */
  const rellenarCon = (texto: string) => {
    const r = interpretarDictado(texto, {
      hoy: new Date(),
      laboratorios: labsActivos,
      personas: personas.data ?? [],
      programas: software.data ?? [],
    });
    f.setValores((actual) => {
      const primera = { ...(actual.filas[0] ?? filaVacia()) };
      if (r.laboratorios) primera.laboratorios = r.laboratorios;
      if (r.fecha) primera.fecha = r.fecha;
      if (r.hora_inicio && r.hora_fin) {
        primera.hora_inicio = r.hora_inicio;
        primera.hora_fin = r.hora_fin;
      }
      const quien: Partial<Formulario> =
        r.solicitante !== undefined
          ? { tipoSolicitante: "usuario", solicitante: r.solicitante }
          : r.solicitante_externo
            ? { tipoSolicitante: "externo", solicitante_externo: r.solicitante_externo }
            : {};
      const apoyo: Partial<Formulario> =
        r.requiere_apoyo === undefined
          ? {}
          : {
              requiere_apoyo: r.requiere_apoyo,
              auxiliares_requeridos: r.auxiliares_requeridos ?? actual.auxiliares_requeridos,
            };
      return {
        ...actual,
        ...quien,
        ...apoyo,
        titulo: r.titulo ?? actual.titulo,
        descripcion: r.descripcion ?? actual.descripcion,
        contacto: r.contacto ?? actual.contacto,
        programas: r.programas ? [...new Set([...actual.programas, ...r.programas])] : actual.programas,
        filas: [primera, ...actual.filas.slice(1)],
      };
    });
    setEntendido(r);
  };

  const dictado = useDictado({
    alTerminar: (texto) => {
      setFrase(texto);
      rellenarCon(texto);
    },
  });

  // Si se cierra el panel mientras escucha, se suelta el micrófono.
  useEffect(() => {
    if (!abierto) dictado.cancelar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);
  const codigoLab = (id: number) => labsActivos.find((l) => l.id === id)?.codigo ?? `#${id}`;
  const opcionesLabs = labsActivos.map((l) => ({ id: l.id, etiqueta: `${l.codigo} · ${l.nombre}` }));
  const auxiliares = (personas.data ?? []).filter((p) => p.rol === "auxiliar");
  const filasCompletas =
    v.filas.length > 0 && v.filas.every((fila) => fila.laboratorios.length > 0 && fila.fecha && fila.hora_inicio && fila.hora_fin);
  const solicitanteListo =
    v.tipoSolicitante === "usuario" ? v.solicitante !== null : v.solicitante_externo.trim().length > 0;
  const completo = v.titulo.trim() && solicitanteListo && filasCompletas;

  return (
    <PanelFormulario
      abierto={abierto}
      tamano="large"
      titulo={esNueva ? "Nueva reserva" : "Editar reserva"}
      subtitulo="Un evento único o de pocos días. Puedes reservar varias aulas a la vez; cada una aparecerá con esta actividad en la pizarra. Si choca con una clase o con otra reserva te aviso; puedes registrarla igual y queda por aprobar."
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
            <MessageBarTitle>{choques.length ? "El aula no está libre" : "No se pudo guardar"}</MessageBarTitle>
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

      {esNueva && (
        <div className={estilos.dictado}>
          <Field
            label="Dicta o escribe la reserva en una frase"
            hint="Ej.: Taller de Git, mañana de 8 a 10, laboratorios 41 y 42, solicita Centro de Estudiantes."
          >
            <Textarea
              value={dictado.escuchando ? dictado.parcial : frase}
              readOnly={dictado.escuchando}
              resize="vertical"
              rows={2}
              placeholder={dictado.escuchando ? "Te escucho…" : "Qué actividad, qué día, a qué hora y en qué aulas"}
              onChange={(_, d) => setFrase(d.value)}
            />
          </Field>
          <div className={estilos.dictadoBotones}>
            {dictado.disponible &&
              (dictado.escuchando ? (
                <Button appearance="primary" icon={<IconoMicrofonoActivo />} onClick={dictado.detener}>
                  Detener
                </Button>
              ) : (
                <Button icon={<IconoMicrofono />} onClick={dictado.empezar}>
                  Dictar
                </Button>
              ))}
            <Button disabled={dictado.escuchando || !frase.trim()} onClick={() => rellenarCon(frase)}>
              Rellenar formulario
            </Button>
            {dictado.escuchando && <span className={estilos.escuchando}>Escuchando… al terminar, haz una pausa.</span>}
            {!dictado.disponible && (
              <Caption1 className={estilos.neutro}>
                Este navegador no tiene dictado por voz (usa Chrome o Edge). Puedes escribir la frase.
              </Caption1>
            )}
          </div>
          {dictado.error && (
            <MessageBar intent="warning">
              <MessageBarBody>{dictado.error}</MessageBarBody>
            </MessageBar>
          )}
          {entendido && !dictado.escuchando && (
            <MessageBar intent={entendido.entendido.length ? "success" : "warning"} layout="multiline">
              <MessageBarBody>
                <MessageBarTitle>
                  {entendido.entendido.length ? "Rellené esto. Revísalo antes de registrar:" : "No entendí datos de una reserva en esa frase"}
                </MessageBarTitle>
                {entendido.entendido.length > 0 && (
                  <ul className={estilos.entendido}>
                    {entendido.entendido.map((linea) => (
                      <li key={linea}>{linea}</li>
                    ))}
                  </ul>
                )}
                {entendido.entendido.length > 0 && entendido.faltantes.length > 0 && (
                  <span>Me faltó: {entendido.faltantes.join(", ")}. Complétalo abajo.</span>
                )}
              </MessageBarBody>
            </MessageBar>
          )}
        </div>
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
        <Caption1 className={estilos.tituloSeccion}>Aulas, días y horarios</Caption1>
        {v.filas.map((fila, i) => (
          <div key={i} className={estilos.bloque}>
            <div className={estilos.encabezadoBloque}>
              <Caption1 className={estilos.numeroDia}>
                {v.filas.length > 1 ? `Día ${i + 1}` : "Día"}
              </Caption1>
              <Tooltip content="Quitar este día" relationship="label">
                <Button
                  size="small"
                  appearance="subtle"
                  icon={<IconoCerrar />}
                  disabled={v.filas.length === 1}
                  onClick={() => quitarDia(i)}
                />
              </Tooltip>
            </div>

            <Field label="Aulas" hint="Elige una o varias; cada una se reserva para esta actividad.">
              <ListaSeleccion
                opciones={opcionesLabs}
                seleccionados={fila.laboratorios}
                onCambio={(ids) => cambiarFila(i, { laboratorios: ids })}
                placeholder="Buscar aula"
                alto={168}
              />
            </Field>

            <div className={estilos.horas}>
              <Field label="Día" size="small">
                <Input size="small" type="date" value={fila.fecha} onChange={(_, d) => cambiarFila(i, { fecha: d.value })} />
              </Field>
              <Field label="Desde" size="small">
                <Input
                  size="small"
                  type="time"
                  step={300}
                  min={configuracion.atencion_inicio}
                  max={configuracion.atencion_fin}
                  value={fila.hora_inicio}
                  onChange={(_, d) => cambiarFila(i, { hora_inicio: d.value })}
                />
              </Field>
              <Field label="Hasta" size="small">
                <Input
                  size="small"
                  type="time"
                  step={300}
                  min={configuracion.atencion_inicio}
                  max={configuracion.atencion_fin}
                  value={fila.hora_fin}
                  onChange={(_, d) => cambiarFila(i, { hora_fin: d.value })}
                />
              </Field>
            </div>

            {fila.laboratorios.length === 0 ? (
              <div className={`${estilos.estado} ${estilos.neutro}`}>Elige al menos un aula.</div>
            ) : (
              fila.laboratorios.map((labId) => (
                <div key={labId} className={estilos.dispLab}>
                  <span className={estilos.codigoLab}>{codigoLab(labId)}</span>
                  <Disponibilidad
                    bloque={{ laboratorio: labId, fecha: fila.fecha, hora_inicio: fila.hora_inicio, hora_fin: fila.hora_fin }}
                    excluir={reserva?.id}
                    onChoque={(hay) => marcarChoque(`${i}:${labId}`, hay)}
                  />
                </div>
              ))
            )}
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
