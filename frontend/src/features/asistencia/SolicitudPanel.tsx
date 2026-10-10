import {
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Switch,
  Textarea,
  makeStyles,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { CategoriaAsistencia, SolicitudAsistencia } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { CATEGORIAS_ASISTENCIA } from "../../lib/constantes";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { type DatosSolicitud, crearSolicitud } from "./api";

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

const VACIO: DatosSolicitud = {
  laboratorio: null,
  lugar: "",
  categoria: "equipo",
  descripcion: "",
  urgente: false,
};

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCreada: (solicitud: SolicitudAsistencia) => void;
}

export function SolicitudPanel({ abierto, onCerrar, onCreada }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<DatosSolicitud>(VACIO);

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos, enabled: abierto });
  const activos = (laboratorios.data ?? []).filter((l) => l.activo);

  useEffect(() => {
    if (abierto) f.reiniciar(VACIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const enviar = useMutation({
    mutationFn: () => crearSolicitud({ ...f.valores, lugar: f.valores.lugar.trim(), descripcion: f.valores.descripcion.trim() }),
    onSuccess: (s) => {
      notificar.exito("Solicitud enviada. Te avisaremos cuando un auxiliar la tome.");
      void queryClient.invalidateQueries({ queryKey: ["asistencia"] });
      onCreada(s);
    },
    onError: f.tomarErroresDelServidor,
  });

  const { valores: v, errores: e } = f;
  const sinLaboratorio = v.laboratorio === null;
  const completo = v.descripcion.trim() && (!sinLaboratorio || v.lugar.trim());

  return (
    <PanelFormulario
      abierto={abierto}
      titulo="Solicitar asistencia"
      subtitulo="Les llega un aviso a todos los auxiliares. Te avisamos cuando alguien vaya en camino."
      onCerrar={onCerrar}
      hayCambios={f.cambiado && !enviar.isPending}
      pie={
        <>
          <Button appearance="primary" disabled={!completo || enviar.isPending} onClick={() => enviar.mutate()}>
            {enviar.isPending ? "Enviando…" : "Enviar solicitud"}
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
        <Field label="Laboratorio" {...estadoCampo(e.laboratorio)}>
          <Select
            value={v.laboratorio ? String(v.laboratorio) : ""}
            onChange={(_, d) => f.set("laboratorio", d.value ? Number(d.value) : null)}
          >
            <option value="">Otro lugar</option>
            {activos.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} · {l.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoría" {...estadoCampo(e.categoria)}>
          <Select value={v.categoria} onChange={(_, d) => f.set("categoria", d.value as CategoriaAsistencia)}>
            {CATEGORIAS_ASISTENCIA.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Lugar"
        required={sinLaboratorio}
        hint={sinLaboratorio ? "Dónde estás: aula, oficina, piso." : "Opcional: dónde exactamente, por ejemplo «fila 3»."}
        {...estadoCampo(e.lugar)}
      >
        <Input
          value={v.lugar}
          placeholder={sinLaboratorio ? "Ej.: Aula 236, módulo 236" : "Ej.: PC-12"}
          onChange={(_, d) => f.set("lugar", d.value)}
        />
      </Field>

      <Field label="¿Qué pasa?" required {...estadoCampo(e.descripcion)}>
        <Textarea
          value={v.descripcion}
          resize="vertical"
          rows={4}
          placeholder="Ej.: El proyector no muestra imagen desde mi laptop."
          onChange={(_, d) => f.set("descripcion", d.value)}
        />
      </Field>

      <Switch
        label="Es urgente"
        checked={v.urgente}
        onChange={(_, d) => f.set("urgente", d.checked)}
      />
    </PanelFormulario>
  );
}
