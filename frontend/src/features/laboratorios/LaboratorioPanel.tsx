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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { EstadoLaboratorio, Laboratorio } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { ESTADOS_LABORATORIO } from "../../lib/constantes";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { type DatosLaboratorio, actualizarLaboratorio, crearLaboratorio } from "./api";

const useEstilos = makeStyles({
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
});

const VACIO: DatosLaboratorio = {
  codigo: "",
  nombre: "",
  ubicacion: "",
  capacidad: 30,
  estado: "operativo",
  notas: "",
  activo: true,
  filas: 8,
  columnas: 10,
};

/** Número desde un SpinButton (el valor llega vacío mientras se escribe). */
function numero(valor: number | null | undefined, texto: string | undefined, porDefecto: number) {
  if (typeof valor === "number") return valor;
  const n = Number.parseInt(texto ?? "", 10);
  return Number.isNaN(n) ? porDefecto : n;
}

interface Props {
  abierto: boolean;
  laboratorio: Laboratorio | null;
  onCerrar: () => void;
  onCreado?: (lab: Laboratorio) => void;
}

export function LaboratorioPanel({ abierto, laboratorio, onCerrar, onCreado }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<DatosLaboratorio>(VACIO);
  const esNuevo = laboratorio === null;

  useEffect(() => {
    if (!abierto) return;
    f.reiniciar(
      laboratorio
        ? {
            codigo: laboratorio.codigo,
            nombre: laboratorio.nombre,
            ubicacion: laboratorio.ubicacion,
            capacidad: laboratorio.capacidad,
            estado: laboratorio.estado,
            notas: laboratorio.notas,
            activo: laboratorio.activo,
          }
        : VACIO,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, laboratorio]);

  const guardar = useMutation({
    mutationFn: () => (esNuevo ? crearLaboratorio(f.valores) : actualizarLaboratorio(laboratorio.id, f.valores)),
    onSuccess: (lab) => {
      notificar.exito(esNuevo ? "Laboratorio creado" : "Ficha actualizada", `${lab.codigo} · ${lab.nombre}`);
      void queryClient.invalidateQueries({ queryKey: ["laboratorios"] });
      onCerrar();
      if (esNuevo) onCreado?.(lab);
    },
    onError: f.tomarErroresDelServidor,
  });

  const { valores: v, errores: e } = f;

  return (
    <PanelFormulario
      abierto={abierto}
      titulo={esNuevo ? "Nuevo laboratorio" : "Editar ficha"}
      subtitulo={esNuevo ? "Después podrás dibujar su distribución." : `${laboratorio.codigo} · ${laboratorio.nombre}`}
      onCerrar={onCerrar}
      hayCambios={f.cambiado && !guardar.isPending}
      pie={
        <>
          <Button
            appearance="primary"
            disabled={!v.codigo.trim() || !v.nombre.trim() || guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            {guardar.isPending ? "Guardando…" : esNuevo ? "Crear laboratorio" : "Guardar cambios"}
          </Button>
          <Button onClick={onCerrar}>Cancelar</Button>
        </>
      }
    >
      {e.general && Object.keys(e).length === 1 && (
        <MessageBar intent="error">
          <MessageBarBody>{e.general}</MessageBarBody>
        </MessageBar>
      )}
      <div className={estilos.fila}>
        <Field label="Código" required hint="Ej.: LAB-1" {...estadoCampo(e.codigo)}>
          <Input value={v.codigo} onChange={(_, d) => f.set("codigo", d.value.toUpperCase())} />
        </Field>
        <Field label="Estado" {...estadoCampo(e.estado)}>
          <Select value={v.estado} onChange={(_, d) => f.set("estado", d.value as EstadoLaboratorio)}>
            {ESTADOS_LABORATORIO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Nombre" required {...estadoCampo(e.nombre)}>
        <Input value={v.nombre} placeholder="Ej.: Laboratorio de Redes" onChange={(_, d) => f.set("nombre", d.value)} />
      </Field>
      <Field label="Ubicación" {...estadoCampo(e.ubicacion)}>
        <Input value={v.ubicacion} placeholder="Ej.: Módulo 236, primer piso" onChange={(_, d) => f.set("ubicacion", d.value)} />
      </Field>
      <Field label="Capacidad (estudiantes)" {...estadoCampo(e.capacidad)}>
        <SpinButton
          min={0}
          max={500}
          value={v.capacidad}
          onChange={(_, d) => f.set("capacidad", numero(d.value, d.displayValue, v.capacidad))}
        />
      </Field>
      {esNuevo && (
        <div className={estilos.fila}>
          <Field label="Filas de la grilla" hint="Se puede cambiar después." {...estadoCampo(e.filas)}>
            <SpinButton
              min={1}
              max={40}
              value={v.filas}
              onChange={(_, d) => f.set("filas", numero(d.value, d.displayValue, v.filas ?? 8))}
            />
          </Field>
          <Field label="Columnas de la grilla" {...estadoCampo(e.columnas)}>
            <SpinButton
              min={1}
              max={40}
              value={v.columnas}
              onChange={(_, d) => f.set("columnas", numero(d.value, d.displayValue, v.columnas ?? 10))}
            />
          </Field>
        </div>
      )}
      <Field
        label="Notas"
        hint="Información útil: llaves, horarios de limpieza, contacto de soporte…"
        {...estadoCampo(e.notas)}
      >
        <Textarea value={v.notas} rows={4} resize="vertical" onChange={(_, d) => f.set("notas", d.value)} />
      </Field>
      {!esNuevo && (
        <Switch
          label={v.activo ? "Activo" : "Inactivo: no aparece para reservas nuevas"}
          checked={v.activo}
          onChange={(_, d) => f.set("activo", d.checked)}
        />
      )}
    </PanelFormulario>
  );
}
