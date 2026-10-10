import {
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Textarea,
  makeStyles,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { EntradaBitacora, TipoBitacora } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { TIPOS_BITACORA } from "../../lib/constantes";
import { aInputLocal, ahoraLocalInput, localAIso } from "../../lib/fechas";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { crearEntrada, editarEntrada } from "./api";

const useEstilos = makeStyles({
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    "@media (max-width: 480px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
});

interface Formulario {
  laboratorio: number | null;
  tipo: TipoBitacora;
  titulo: string;
  fecha: string;
  elementos: string;
  descripcion: string;
}

const vacio = (laboratorio: number | null): Formulario => ({
  laboratorio,
  tipo: "mantenimiento",
  titulo: "",
  fecha: ahoraLocalInput(),
  elementos: "",
  descripcion: "",
});

interface Props {
  abierto: boolean;
  entrada: EntradaBitacora | null;
  /** Laboratorio ya elegido (desde la ficha del laboratorio). */
  laboratorioId?: number;
  onCerrar: () => void;
  onGuardada: (entrada: EntradaBitacora) => void;
}

export function EntradaPanel({ abierto, entrada, laboratorioId, onCerrar, onGuardada }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<Formulario>(vacio(laboratorioId ?? null));
  const esNueva = entrada === null;

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos, enabled: abierto });

  useEffect(() => {
    if (!abierto) return;
    f.reiniciar(
      entrada
        ? {
            laboratorio: entrada.laboratorio,
            tipo: entrada.tipo,
            titulo: entrada.titulo,
            fecha: aInputLocal(entrada.fecha),
            elementos: entrada.elementos,
            descripcion: entrada.descripcion,
          }
        : vacio(laboratorioId ?? null),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, entrada]);

  const guardar = useMutation({
    mutationFn: () => {
      const v = f.valores;
      const datos = {
        laboratorio: v.laboratorio!,
        tipo: v.tipo,
        titulo: v.titulo.trim(),
        fecha: localAIso(v.fecha),
        elementos: v.elementos.trim(),
        descripcion: v.descripcion.trim(),
      };
      return esNueva ? crearEntrada(datos) : editarEntrada(entrada.id, datos);
    },
    onSuccess: (res) => {
      notificar.exito(esNueva ? "Registrado en la bitácora" : "Cambios guardados", res.titulo);
      void queryClient.invalidateQueries({ queryKey: ["bitacora"] });
      onGuardada(res);
    },
    onError: f.tomarErroresDelServidor,
  });

  const { valores: v, errores: e } = f;
  const completo = v.laboratorio !== null && v.titulo.trim() && v.fecha;
  // Los laboratorios inactivos solo aparecen si la entrada ya era de uno.
  const opcionesLab = (laboratorios.data ?? []).filter((l) => l.activo || l.id === v.laboratorio);

  return (
    <PanelFormulario
      abierto={abierto}
      titulo={esNueva ? "Registrar en la bitácora" : "Editar entrada"}
      subtitulo="Lo que se hizo o pasó en el laboratorio: instalaciones, fallas, mantenimiento."
      onCerrar={onCerrar}
      hayCambios={f.cambiado && !guardar.isPending}
      pie={
        <>
          <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending ? "Guardando…" : esNueva ? "Registrar" : "Guardar cambios"}
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

      <div className={estilos.fila}>
        <Field label="Laboratorio" required {...estadoCampo(e.laboratorio)}>
          <Select
            value={v.laboratorio ? String(v.laboratorio) : ""}
            onChange={(_, d) => f.set("laboratorio", d.value ? Number(d.value) : null)}
          >
            <option value="" disabled>
              Elegir…
            </option>
            {opcionesLab.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} · {l.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo" {...estadoCampo(e.tipo)}>
          <Select value={v.tipo} onChange={(_, d) => f.set("tipo", d.value as TipoBitacora)}>
            {TIPOS_BITACORA.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Título" required {...estadoCampo(e.titulo)}>
        <Input
          value={v.titulo}
          maxLength={150}
          placeholder="Ej.: Se instaló Docker Desktop"
          onChange={(_, d) => f.set("titulo", d.value)}
        />
      </Field>

      <div className={estilos.fila}>
        <Field label="Fecha y hora" required {...estadoCampo(e.fecha)}>
          <Input
            type="datetime-local"
            value={v.fecha}
            max={ahoraLocalInput()}
            onChange={(_, d) => f.set("fecha", d.value)}
          />
        </Field>
        <Field label="Elementos" hint="Ej.: PC-01, PC-07" {...estadoCampo(e.elementos)}>
          <Input value={v.elementos} maxLength={200} onChange={(_, d) => f.set("elementos", d.value)} />
        </Field>
      </div>

      <Field label="Descripción" {...estadoCampo(e.descripcion)}>
        <Textarea
          value={v.descripcion}
          resize="vertical"
          rows={4}
          placeholder="Qué se hizo, qué se encontró, qué falta."
          onChange={(_, d) => f.set("descripcion", d.value)}
        />
      </Field>
    </PanelFormulario>
  );
}
