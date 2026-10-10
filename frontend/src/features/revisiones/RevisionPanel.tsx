import {
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  SpinButton,
  Switch,
  Textarea,
  makeStyles,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { Revision, UnidadFrecuencia } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { UNIDADES_FRECUENCIA } from "../../lib/constantes";
import { aISO } from "../../lib/fechas";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { opcionesUsuarios } from "../usuarios/api";
import { type DatosRevision, crearRevision, editarRevision } from "./api";

const useEstilos = makeStyles({
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    "@media (max-width: 480px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  frecuencia: {
    display: "grid",
    gridTemplateColumns: "96px minmax(0, 1fr)",
    gap: "8px",
  },
});

interface Formulario extends Omit<DatosRevision, "laboratorio"> {
  laboratorio: number | null;
}

const vacio = (): Formulario => ({
  laboratorio: null,
  titulo: "",
  instrucciones: "",
  cada: 1,
  unidad: "semanas",
  proxima_fecha: aISO(new Date()),
  responsable: null,
  activa: true,
});

interface Props {
  abierto: boolean;
  revision: Revision | null;
  onCerrar: () => void;
  onGuardada: (revision: Revision) => void;
}

export function RevisionPanel({ abierto, revision, onCerrar, onGuardada }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<Formulario>(vacio());
  const esNueva = revision === null;

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos, enabled: abierto });
  const responsables = useQuery({
    queryKey: ["usuarios", "opciones", "auxiliar,admin"],
    queryFn: () => opcionesUsuarios("auxiliar,admin"),
    enabled: abierto,
  });

  useEffect(() => {
    if (!abierto) return;
    f.reiniciar(
      revision
        ? {
            laboratorio: revision.laboratorio,
            titulo: revision.titulo,
            instrucciones: revision.instrucciones,
            cada: revision.cada,
            unidad: revision.unidad,
            proxima_fecha: revision.proxima_fecha,
            responsable: revision.responsable,
            activa: revision.activa,
          }
        : vacio(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, revision]);

  const guardar = useMutation({
    mutationFn: () => {
      const datos: DatosRevision = {
        ...f.valores,
        laboratorio: f.valores.laboratorio!,
        titulo: f.valores.titulo.trim(),
        instrucciones: f.valores.instrucciones.trim(),
      };
      return esNueva ? crearRevision(datos) : editarRevision(revision.id, datos);
    },
    onSuccess: (r) => {
      notificar.exito(esNueva ? "Revisión programada" : "Cambios guardados", `${r.titulo} · ${r.frecuencia.toLowerCase()}`);
      void queryClient.invalidateQueries({ queryKey: ["revisiones"] });
      onGuardada(r);
    },
    onError: f.tomarErroresDelServidor,
  });

  const { valores: v, errores: e } = f;
  const completo = v.laboratorio !== null && v.titulo.trim() && v.cada >= 1 && v.cada <= 365 && v.proxima_fecha;
  const labs = (laboratorios.data ?? []).filter((l) => l.activo || l.id === v.laboratorio);
  const personas = responsables.data ?? [];
  // Si el responsable ya no está en la lista (desactivado), igual se muestra su nombre.
  const responsableFuera = v.responsable !== null && !personas.some((p) => p.id === v.responsable);

  return (
    <PanelFormulario
      abierto={abierto}
      titulo={esNueva ? "Programar revisión" : "Editar revisión"}
      subtitulo="Cuando llega la fecha, aparece una tarea en el pizarrón y se avisa al responsable."
      onCerrar={onCerrar}
      hayCambios={f.cambiado && !guardar.isPending}
      pie={
        <>
          <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending ? "Guardando…" : esNueva ? "Programar" : "Guardar cambios"}
          </Button>
          <Button onClick={onCerrar}>Cancelar</Button>
        </>
      }
    >
      {e.general && Object.keys(e).length <= 2 && (
        <MessageBar intent="error">
          <MessageBarBody>{e.general}</MessageBarBody>
        </MessageBar>
      )}

      <Field label="Laboratorio" required {...estadoCampo(e.laboratorio)}>
        <Select
          value={v.laboratorio ? String(v.laboratorio) : ""}
          onChange={(_, d) => f.set("laboratorio", d.value ? Number(d.value) : null)}
        >
          <option value="" disabled>
            Elegir…
          </option>
          {labs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} · {l.nombre}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Título" required {...estadoCampo(e.titulo)}>
        <Input
          value={v.titulo}
          maxLength={150}
          placeholder="Revisión de equipos"
          onChange={(_, d) => f.set("titulo", d.value)}
        />
      </Field>

      <Field label="Instrucciones" hint="Qué hay que revisar. Se muestra en la tarea." {...estadoCampo(e.instrucciones)}>
        <Textarea
          value={v.instrucciones}
          resize="vertical"
          rows={4}
          placeholder="Ej.: Encender cada PC, probar teclado y mouse, revisar el proyector."
          onChange={(_, d) => f.set("instrucciones", d.value)}
        />
      </Field>

      <div className={estilos.fila}>
        <div className={estilos.frecuencia}>
          <Field label="Cada" required {...estadoCampo(e.cada)}>
            <SpinButton
              min={1}
              max={365}
              value={v.cada}
              onChange={(_, d) => f.set("cada", d.value ?? (Number.parseInt(d.displayValue ?? "1", 10) || 1))}
            />
          </Field>
          <Field label="Unidad" {...estadoCampo(e.unidad)}>
            <Select value={v.unidad} onChange={(_, d) => f.set("unidad", d.value as UnidadFrecuencia)}>
              {UNIDADES_FRECUENCIA.map((u) => (
                <option key={u.valor} value={u.valor}>
                  {u.etiqueta}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Próxima fecha" required {...estadoCampo(e.proxima_fecha)}>
          <Input type="date" value={v.proxima_fecha} onChange={(_, d) => f.set("proxima_fecha", d.value)} />
        </Field>
      </div>

      <Field
        label="Responsable"
        hint="Si no eliges a nadie, se avisa a todos los auxiliares."
        {...estadoCampo(e.responsable)}
      >
        <Select
          value={v.responsable !== null ? String(v.responsable) : ""}
          onChange={(_, d) => f.set("responsable", d.value ? Number(d.value) : null)}
        >
          <option value="">Todos los auxiliares</option>
          {responsableFuera && revision && (
            <option value={revision.responsable ?? ""}>{revision.responsable_nombre}</option>
          )}
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre_completo}
            </option>
          ))}
        </Select>
      </Field>

      {!esNueva && (
        <Switch
          label={v.activa ? "Activa: se sigue programando" : "Pausada: no crea tareas ni avisa"}
          checked={v.activa}
          onChange={(_, d) => f.set("activa", d.checked)}
        />
      )}
    </PanelFormulario>
  );
}
