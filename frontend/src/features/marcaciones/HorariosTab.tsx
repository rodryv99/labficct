import {
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Switch,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { BloqueHorario, HorarioTrabajo } from "../../api/tipos";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoAgregar, IconoEliminar, IconoHorarios } from "../../components/iconos/iconos";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import {
  DIAS,
  type DatosHorario,
  crearHorario,
  duracion,
  editarHorario,
  eliminarHorario,
  hhmm,
  minutosSemana,
  resumenHorario,
} from "./api";

const useEstilos = makeStyles({
  celda: { display: "flex", flexDirection: "column", minWidth: 0 },
  nombre: { fontWeight: tokens.fontWeightSemibold },
  secundario: { color: tokens.colorNeutralForeground3 },
  espacio: { flex: 1 },
  bloque: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr 1fr auto",
    gap: "8px",
    alignItems: "end",
    marginBottom: "8px",
  },
  quitar: { marginBottom: "2px" },
  etiquetaBloques: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "4px",
  },
});

interface Formulario {
  nombre: string;
  descripcion: string;
  activo: boolean;
}

const vacio: Formulario = { nombre: "", descripcion: "", activo: true };
const bloqueNuevo = (): BloqueHorario => ({ dia: 0, inicio: "08:00", fin: "12:00" });

interface Props {
  horarios: HorarioTrabajo[] | undefined;
  cargando: boolean;
  error: unknown;
  onReintentar: () => void;
  /** null = cerrado; "nuevo" o el horario a editar. */
  panel: HorarioTrabajo | "nuevo" | null;
  onPanel: (panel: HorarioTrabajo | "nuevo" | null) => void;
}

/** Los horarios de trabajo que el Admin crea y luego asigna a los auxiliares. */
export function HorariosTab({ horarios, cargando, error, onReintentar, panel, onPanel }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [eliminando, setEliminando] = useState(false);
  const [bloques, setBloques] = useState<BloqueHorario[]>([bloqueNuevo()]);
  const horario = panel && panel !== "nuevo" ? panel : null;
  const f = useFormulario<Formulario>(vacio);

  useEffect(() => {
    if (!panel) return;
    if (horario) {
      f.reiniciar({ nombre: horario.nombre, descripcion: horario.descripcion, activo: horario.activo });
      setBloques(horario.bloques.map((b) => ({ dia: b.dia, inicio: hhmm(b.inicio), fin: hhmm(b.fin) })));
    } else {
      f.reiniciar(vacio);
      setBloques([bloqueNuevo()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  const { valores: v, errores: e } = f;

  const cambiarBloque = (i: number, campo: keyof BloqueHorario, valor: string | number) =>
    setBloques((prev) => prev.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)));

  const bloqueMalo = bloques.some((b) => hhmm(b.inicio) >= hhmm(b.fin));
  const completo = v.nombre.trim() !== "" && bloques.length > 0 && !bloqueMalo;

  const guardar = useMutation({
    mutationFn: () => {
      const datos: DatosHorario = {
        nombre: v.nombre.trim(),
        descripcion: v.descripcion.trim(),
        activo: v.activo,
        bloques: bloques.map((b) => ({ dia: b.dia, inicio: hhmm(b.inicio), fin: hhmm(b.fin) })),
      };
      return horario ? editarHorario(horario.id, datos) : crearHorario(datos);
    },
    onSuccess: (guardado) => {
      notificar.exito(horario ? "Horario actualizado" : "Horario agregado", guardado.nombre);
      void queryClient.invalidateQueries({ queryKey: ["marcaciones"] });
      onPanel(null);
    },
    onError: f.tomarErroresDelServidor,
  });

  const borrar = useMutation({
    mutationFn: () => eliminarHorario(horario!.id),
    onSuccess: () => {
      notificar.exito("Horario eliminado");
      setEliminando(false);
      void queryClient.invalidateQueries({ queryKey: ["marcaciones"] });
      onPanel(null);
    },
    onError: (falla) => {
      setEliminando(false);
      notificar.error("No se pudo eliminar", mensajeDeError(falla));
    },
  });

  const columnas: Columna<HorarioTrabajo>[] = [
    {
      clave: "nombre",
      titulo: "Horario",
      render: (h) => (
        <div className={estilos.celda}>
          <span className={estilos.nombre}>{h.nombre}</span>
          <Caption1 className={estilos.secundario}>{resumenHorario(h.bloques)}</Caption1>
        </div>
      ),
    },
    {
      clave: "semana",
      titulo: "Por semana",
      ancho: "120px",
      render: (h) => duracion(minutosSemana(h.bloques)),
    },
    {
      clave: "asignados",
      titulo: "Auxiliares",
      ancho: "120px",
      render: (h) => (h.asignados ? `${h.asignados}` : <Caption1 className={estilos.secundario}>Ninguno</Caption1>),
    },
    {
      clave: "activo",
      titulo: "Estado",
      ancho: "100px",
      render: (h) => <EtiquetaEstado tono={h.activo ? "exito" : "neutro"}>{h.activo ? "Activo" : "Inactivo"}</EtiquetaEstado>,
    },
  ];

  return (
    <>
      <TablaDatos
        etiqueta="Horarios de trabajo"
        columnas={columnas}
        filas={horarios}
        claveFila={(h) => h.id}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        onFila={(h) => onPanel(h)}
        vacio={
          <EstadoVacio
            icono={<IconoHorarios />}
            titulo="Todavía no hay horarios"
            descripcion="Crea un horario de trabajo (por ejemplo, «Mañana: Lun a Vie de 08:00 a 12:00») y luego asígnalo a los auxiliares desde la pestaña «Hoy»."
          />
        }
      />

      <PanelFormulario
        abierto={panel !== null}
        titulo={horario ? "Editar horario" : "Nuevo horario"}
        subtitulo="Dale un nombre y agrega los bloques por día. Luego lo asignas a cada auxiliar."
        onCerrar={() => onPanel(null)}
        hayCambios={f.cambiado && !guardar.isPending}
        pie={
          <>
            <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
              {guardar.isPending ? "Guardando…" : horario ? "Guardar cambios" : "Agregar"}
            </Button>
            <Button onClick={() => onPanel(null)}>Cancelar</Button>
            {horario && (
              <>
                <span className={estilos.espacio} />
                <Button appearance="subtle" icon={<IconoEliminar />} onClick={() => setEliminando(true)}>
                  Eliminar
                </Button>
              </>
            )}
          </>
        }
      >
        {e.general && Object.keys(e).length <= 2 && (
          <MessageBar intent="error">
            <MessageBarBody>{e.general}</MessageBarBody>
          </MessageBar>
        )}

        <Field label="Nombre" required {...estadoCampo(e.nombre)}>
          <Input
            value={v.nombre}
            maxLength={100}
            placeholder="Ej.: Mañana · Lun a Vie"
            onChange={(_, d) => f.set("nombre", d.value)}
          />
        </Field>

        <Field label="Descripción" hint="Opcional." {...estadoCampo(e.descripcion)}>
          <Input
            value={v.descripcion}
            maxLength={200}
            placeholder="Ej.: Turno de la mañana en el módulo 236"
            onChange={(_, d) => f.set("descripcion", d.value)}
          />
        </Field>

        <div className={estilos.etiquetaBloques}>
          <Caption1 className={estilos.secundario}>Bloques (día y horario)</Caption1>
          <Button size="small" icon={<IconoAgregar />} onClick={() => setBloques((p) => [...p, bloqueNuevo()])}>
            Agregar bloque
          </Button>
        </div>

        {bloques.map((b, i) => {
          const malo = hhmm(b.inicio) >= hhmm(b.fin);
          return (
            <div key={i}>
              <div className={estilos.bloque}>
                <Field label={i === 0 ? "Día" : undefined}>
                  <Select value={String(b.dia)} onChange={(_, d) => cambiarBloque(i, "dia", Number(d.value))}>
                    {DIAS.map((nombre, dia) => (
                      <option key={dia} value={dia}>
                        {nombre}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={i === 0 ? "Inicio" : undefined}>
                  <Input type="time" value={b.inicio} onChange={(_, d) => cambiarBloque(i, "inicio", d.value)} />
                </Field>
                <Field label={i === 0 ? "Fin" : undefined}>
                  <Input type="time" value={b.fin} onChange={(_, d) => cambiarBloque(i, "fin", d.value)} />
                </Field>
                <Button
                  className={estilos.quitar}
                  appearance="subtle"
                  icon={<IconoEliminar />}
                  aria-label="Quitar bloque"
                  disabled={bloques.length === 1}
                  onClick={() => setBloques((p) => p.filter((_, j) => j !== i))}
                />
              </div>
              {malo && (
                <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>
                  La hora de fin debe ser posterior a la de inicio.
                </Caption1>
              )}
            </div>
          );
        })}

        {e.bloques && (
          <MessageBar intent="error">
            <MessageBarBody>{e.bloques}</MessageBarBody>
          </MessageBar>
        )}

        <Switch
          label={v.activo ? "Activo: se puede asignar a auxiliares" : "Inactivo: no se puede asignar"}
          checked={v.activo}
          onChange={(_, d) => f.set("activo", d.checked)}
        />
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={eliminando}
        titulo={`¿Eliminar «${horario?.nombre ?? ""}»?`}
        mensaje="Los auxiliares que lo tenían asignado quedan sin horario. Esto no borra sus marcaciones."
        textoConfirmar="Eliminar"
        peligroso
        cargando={borrar.isPending}
        onCancelar={() => setEliminando(false)}
        onConfirmar={() => borrar.mutate()}
      />
    </>
  );
}
