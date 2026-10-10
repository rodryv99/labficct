import {
  Button,
  Caption1,
  Field,
  Link,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Select,
  Switch,
  Textarea,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { choquesDeError, mensajeDeError } from "../../api/errores";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { SelectorBuscable } from "../../components/formularios/SelectorBuscable";
import { IconoEliminar } from "../../components/iconos/iconos";
import { franjasPorDuracion, useConfiguracion } from "../../lib/configuracion";
import { DIAS } from "../../lib/constantes";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import {
  type DatosHorario,
  type GrupoHorario,
  crearHorariosEnDias,
  editarHorariosEnDias,
  eliminarHorario,
  listarDocentes,
  listarMaterias,
  listarPeriodos,
  nombreDias,
} from "./api";
import { DialogoDocente } from "./DialogoDocente";

/** Atajos de días: los dos patrones de clases más comunes. */
const ATAJOS_DIAS: { etiqueta: string; dias: number[] }[] = [
  { etiqueta: "Lun · Mié · Vie", dias: [1, 3, 5] },
  { etiqueta: "Mar · Jue", dias: [2, 4] },
];
const INICIALES = ["L", "M", "X", "J", "V", "S", "D"];

const mismosDias = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

const useEstilos = makeStyles({
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  franjas: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  franja: {
    padding: "2px 8px",
    borderRadius: tokens.borderRadiusCircular,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground2,
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase200,
    fontVariantNumeric: "tabular-nums",
    cursor: "pointer",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  franjaActiva: {
    borderColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  ayuda: {
    color: tokens.colorNeutralForeground3,
  },
  espacio: {
    flex: 1,
  },
  choques: {
    margin: "4px 0 0",
    paddingLeft: "18px",
  },
  dias: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
  },
  dia: {
    width: "36px",
    height: "32px",
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontFamily: "inherit",
    fontWeight: tokens.fontWeightSemibold,
    cursor: "pointer",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  diaActivo: {
    borderColor: tokens.colorBrandBackground,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
  },
  separador: {
    width: "1px",
    alignSelf: "stretch",
    backgroundColor: tokens.colorNeutralStroke2,
    margin: "0 4px",
  },
  grupoFranjas: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  docente: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

interface Props {
  abierto: boolean;
  /** La fila de la tabla que se edita (la clase con todos sus días), o null para una nueva. */
  grupo: GrupoHorario | null;
  periodoPorDefecto: number | null;
  onCerrar: () => void;
}

type Formulario = Omit<DatosHorario, "periodo" | "laboratorio" | "materia"> & {
  periodo: number | null;
  laboratorio: number | null;
  materia: number | null;
  /** La clase se da en todos estos días (al editar, se agregan o quitan días). */
  dias: number[];
};

const vacio = (periodo: number | null): Formulario => ({
  periodo,
  laboratorio: null,
  materia: null,
  grupo: "",
  docente: null,
  dia_semana: 1,
  dias: [1, 3, 5],
  hora_inicio: "07:00",
  hora_fin: "09:15",
  observaciones: "",
  activo: true,
});

export function HorarioPanel({ abierto, grupo, periodoPorDefecto, onCerrar }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<Formulario>(vacio(periodoPorDefecto));
  const [choques, setChoques] = useState<string[]>([]);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [nuevoDocente, setNuevoDocente] = useState(false);
  const esNuevo = grupo === null;
  const horario = grupo?.base ?? null;
  const configuracion = useConfiguracion();
  const gruposFranjas = franjasPorDuracion(configuracion.franjas);

  const periodos = useQuery({ queryKey: ["periodos"], queryFn: listarPeriodos, enabled: abierto });
  const materias = useQuery({ queryKey: ["materias"], queryFn: listarMaterias, enabled: abierto });
  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos, enabled: abierto });
  const docentes = useQuery({ queryKey: ["docentes"], queryFn: () => listarDocentes(), enabled: abierto });

  useEffect(() => {
    if (!abierto) return;
    setChoques([]);
    f.reiniciar(
      horario
        ? {
            periodo: horario.periodo,
            laboratorio: horario.laboratorio,
            materia: horario.materia,
            grupo: horario.grupo,
            docente: horario.docente,
            dia_semana: horario.dia_semana,
            dias: grupo!.dias,
            hora_inicio: horario.hora_inicio,
            hora_fin: horario.hora_fin,
            observaciones: horario.observaciones,
            activo: horario.activo,
          }
        : vacio(periodoPorDefecto),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, grupo]);

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["horarios"] });
    void queryClient.invalidateQueries({ queryKey: ["agenda"] });
  };

  const guardar = useMutation({
    mutationFn: async () => {
      const { dias, ...v } = f.valores;
      const datos = { ...v, periodo: v.periodo!, laboratorio: v.laboratorio!, materia: v.materia! };
      const { dia_semana: _dia, ...sinDia } = datos;
      if (esNuevo) return crearHorariosEnDias(sinDia, dias);
      return editarHorariosEnDias(grupo.horarios.map((h) => h.id), sinDia, dias);
    },
    onSuccess: (creados) => {
      const h = creados[0];
      const dias = creados.map((c) => c.dia_nombre.toLowerCase()).join(", ");
      notificar.exito(
        esNuevo ? (creados.length > 1 ? `${creados.length} clases creadas` : "Horario creado") : "Horario actualizado",
        `${h.materia_sigla} ${h.grupo} · ${dias} · ${h.hora_inicio}–${h.hora_fin}`,
      );
      refrescar();
      onCerrar();
    },
    onError: (error) => {
      setChoques(choquesDeError(error));
      f.tomarErroresDelServidor(error);
    },
  });

  const eliminar = useMutation({
    // Uno por uno: si algo falla a medio camino, lo que quede se ve al recargar la tabla.
    mutationFn: async () => {
      for (const h of grupo!.horarios) await eliminarHorario(h.id);
    },
    onSuccess: () => {
      notificar.exito(grupo && grupo.dias.length > 1 ? "Clase eliminada de todos sus días" : "Horario eliminado");
      setConfirmarEliminar(false);
      refrescar();
      onCerrar();
    },
    onError: (e) => {
      setConfirmarEliminar(false);
      refrescar();
      notificar.error("No se pudo eliminar", mensajeDeError(e));
    },
  });

  const { valores: v, errores: e } = f;
  const completo =
    v.periodo && v.laboratorio && v.materia && v.grupo.trim() && v.hora_inicio && v.hora_fin && v.dias.length > 0;
  const quitados = grupo ? grupo.dias.filter((d) => !v.dias.includes(d)) : [];
  const alternarDia = (dia: number) =>
    f.set("dias", v.dias.includes(dia) ? v.dias.filter((d) => d !== dia) : [...v.dias, dia].sort((a, b) => a - b));
  const opcionesDocentes = (docentes.data ?? [])
    .filter((d) => d.activo || d.id === v.docente)
    .map((d) => ({
      id: d.id,
      etiqueta: d.nombre_completo,
      secundaria: d.tiene_usuario ? d.usuario_email : "Sin usuario todavía",
    }));

  return (
    <>
      <PanelFormulario
        abierto={abierto}
        titulo={esNuevo ? "Nuevo horario" : `${horario!.materia_sigla} · ${horario!.grupo}`}
        subtitulo="Una clase que se repite cada semana durante el periodo."
        onCerrar={onCerrar}
        hayCambios={f.cambiado && !guardar.isPending}
        pie={
          <>
            <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
              {guardar.isPending ? "Guardando…" : esNuevo ? "Crear horario" : "Guardar cambios"}
            </Button>
            <Button onClick={onCerrar}>Cancelar</Button>
            <span className={estilos.espacio} />
            {!esNuevo && (
              <Tooltip content="Eliminar horario" relationship="label">
                <Button appearance="subtle" icon={<IconoEliminar />} onClick={() => setConfirmarEliminar(true)} />
              </Tooltip>
            )}
          </>
        }
      >
        {e.general && (choques.length > 0 || Object.keys(e).length === 1) && (
          <MessageBar intent="error">
            <MessageBarBody>
              <MessageBarTitle>{choques.length ? "Ese horario choca" : "No se pudo guardar"}</MessageBarTitle>
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

        <div className={estilos.fila}>
          <Field label="Periodo" required {...estadoCampo(e.periodo)}>
            <Select value={v.periodo ? String(v.periodo) : ""} onChange={(_, d) => f.set("periodo", Number(d.value))}>
              <option value="" disabled>
                Elige un periodo
              </option>
              {periodos.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Laboratorio" required {...estadoCampo(e.laboratorio)}>
            <Select
              value={v.laboratorio ? String(v.laboratorio) : ""}
              onChange={(_, d) => f.set("laboratorio", Number(d.value))}
            >
              <option value="" disabled>
                Elige un laboratorio
              </option>
              {laboratorios.data
                ?.filter((l) => l.activo || l.id === v.laboratorio)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.codigo} · {l.nombre}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <div className={estilos.fila}>
          <Field label="Materia" required {...estadoCampo(e.materia)}>
            <SelectorBuscable
              opciones={(materias.data ?? []).map((m) => ({ id: m.id, etiqueta: `${m.sigla} · ${m.nombre}` }))}
              valor={v.materia}
              onCambio={(id) => f.set("materia", id)}
              placeholder="Escribe la sigla o el nombre"
            />
          </Field>
          <Field label="Grupo" required hint="Ej.: SA, SB, Z1" {...estadoCampo(e.grupo)}>
            <Input value={v.grupo} maxLength={10} onChange={(_, d) => f.set("grupo", d.value.toUpperCase())} />
          </Field>
        </div>

        <div className={estilos.docente}>
          <Field label="Docente" {...estadoCampo(e.docente)}>
            <SelectorBuscable
              opciones={opcionesDocentes}
              valor={v.docente}
              onCambio={(id) => f.set("docente", id)}
              permitirVacio
              textoVacio="Sin docente asignado"
              placeholder="Escribe el nombre"
            />
          </Field>
          <Caption1 className={estilos.ayuda}>
            ¿No está en la lista?{" "}
            <Link as="button" type="button" inline onClick={() => setNuevoDocente(true)}>
              Registrar un docente nuevo
            </Link>{" "}
            (no necesita usuario).
          </Caption1>
        </div>

        <Field
          label="Días"
          required
          hint={
            quitados.length === 1
              ? `Al guardar, la clase se quita del ${nombreDias(quitados).toLowerCase()}.`
              : quitados.length > 1
                ? `Al guardar, la clase se quita de estos días: ${nombreDias(quitados)}.`
                : esNuevo
                ? v.dias.length > 1
                  ? `Se crea una clase por día (${v.dias.length} en total), con el mismo horario.`
                  : "Elige uno o varios días."
                : "Los cambios se aplican a todos los días de esta clase."
          }
          {...estadoCampo(e.dias ?? e.dia_semana)}
        >
          <div className={estilos.dias}>
            {ATAJOS_DIAS.map((a) => (
              <button
                key={a.etiqueta}
                type="button"
                className={mergeClasses(estilos.franja, mismosDias(v.dias, a.dias) && estilos.franjaActiva)}
                onClick={() => f.set("dias", a.dias)}
              >
                {a.etiqueta}
              </button>
            ))}
            <span className={estilos.separador} aria-hidden />
            {DIAS.slice(0, 6).map((d) => (
              <Tooltip key={d.valor} content={d.etiqueta} relationship="label">
                <button
                  type="button"
                  aria-pressed={v.dias.includes(d.valor)}
                  className={mergeClasses(estilos.dia, v.dias.includes(d.valor) && estilos.diaActivo)}
                  onClick={() => alternarDia(d.valor)}
                >
                  {INICIALES[d.valor - 1]}
                </button>
              </Tooltip>
            ))}
          </div>
        </Field>

        <div className={estilos.fila}>
          <Field label="Desde" required {...estadoCampo(e.hora_inicio)}>
            <Input
              type="time"
              step={300}
              min={configuracion.atencion_inicio}
              max={configuracion.atencion_fin}
              value={v.hora_inicio}
              onChange={(_, d) => f.set("hora_inicio", d.value)}
            />
          </Field>
          <Field label="Hasta" required {...estadoCampo(e.hora_fin)}>
            <Input
              type="time"
              step={300}
              min={configuracion.atencion_inicio}
              max={configuracion.atencion_fin}
              value={v.hora_fin}
              onChange={(_, d) => f.set("hora_fin", d.value)}
            />
          </Field>
        </div>
        <div className={estilos.grupoFranjas}>
          <Caption1 className={estilos.ayuda}>
            Franjas habituales · atención de {configuracion.atencion_inicio} a {configuracion.atencion_fin}
          </Caption1>
          {gruposFranjas.map((grupo) => (
            <div key={grupo.titulo} className={estilos.franjas} role="group" aria-label={`Bloques de ${grupo.titulo}`}>
              {grupo.franjas.map(([inicio, fin]) => (
                <button
                  key={`${inicio}-${fin}`}
                  type="button"
                  title={`Bloque de ${grupo.titulo}`}
                  className={mergeClasses(
                    estilos.franja,
                    v.hora_inicio === inicio && v.hora_fin === fin && estilos.franjaActiva,
                  )}
                  onClick={() => {
                    f.set("hora_inicio", inicio);
                    f.set("hora_fin", fin);
                  }}
                >
                  {inicio}–{fin}
                </button>
              ))}
            </div>
          ))}
        </div>

        <Field label="Observaciones" {...estadoCampo(e.observaciones)}>
          <Textarea value={v.observaciones} resize="vertical" onChange={(_, d) => f.set("observaciones", d.value)} />
        </Field>

        {!esNuevo && (
          <Switch
            label={v.activo ? "Activo" : "Inactivo: no aparece en la pizarra"}
            checked={v.activo}
            onChange={(_, d) => f.set("activo", d.checked)}
          />
        )}
      </PanelFormulario>

      <DialogoDocente
        abierto={nuevoDocente}
        docente={null}
        onCerrar={() => setNuevoDocente(false)}
        onGuardado={(d) => f.set("docente", d.id)}
      />

      <ConfirmarDialogo
        abierto={confirmarEliminar}
        titulo={`¿Eliminar ${horario?.materia_sigla} ${horario?.grupo} (${nombreDias(grupo?.dias ?? []).toLowerCase()})?`}
        mensaje="La clase desaparece de la pizarra en todos sus días y en todas las semanas del periodo. Si solo no habrá clase un día, suspéndela desde la pizarra."
        textoConfirmar="Eliminar"
        peligroso
        cargando={eliminar.isPending}
        onCancelar={() => setConfirmarEliminar(false)}
        onConfirmar={() => eliminar.mutate()}
      />
    </>
  );
}
