import {
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  SpinButton,
  Switch,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { OpcionPreferencia } from "../../api/tipos";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoEliminar, IconoPreferencias } from "../../components/iconos/iconos";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { type DatosOpcion, actualizarOpcion, crearOpcion, eliminarOpcion } from "./api";

const useEstilos = makeStyles({
  pregunta: {
    fontWeight: tokens.fontWeightSemibold,
  },
  texto: {
    color: tokens.colorNeutralForeground2,
  },
  espacio: {
    flex: 1,
  },
});

interface Props {
  opciones: OpcionPreferencia[] | undefined;
  cargando: boolean;
  error: unknown;
  onReintentar: () => void;
  /** null = cerrado; "nueva" o la opción a editar. */
  panel: OpcionPreferencia | "nueva" | null;
  onPanel: (panel: OpcionPreferencia | "nueva" | null) => void;
}

/** La lista de preguntas que ven los docentes (solo el Admin la edita). */
export function OpcionesTab({ opciones, cargando, error, onReintentar, panel, onPanel }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [eliminando, setEliminando] = useState(false);
  const opcion = panel && panel !== "nueva" ? panel : null;
  const siguienteOrden = Math.max(0, ...(opciones ?? []).map((o) => o.orden)) + 1;
  const f = useFormulario<DatosOpcion>({ pregunta: "", texto_si: "", texto_no: "", orden: 1, activa: true });

  useEffect(() => {
    if (!panel) return;
    f.reiniciar(
      opcion
        ? {
            pregunta: opcion.pregunta,
            texto_si: opcion.texto_si,
            texto_no: opcion.texto_no,
            orden: opcion.orden,
            activa: opcion.activa,
          }
        : { pregunta: "", texto_si: "", texto_no: "", orden: siguienteOrden, activa: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["preferencias"] });
    void queryClient.invalidateQueries({ queryKey: ["agenda"] });
  };

  const guardar = useMutation({
    mutationFn: () => {
      const datos: DatosOpcion = {
        ...f.valores,
        pregunta: f.valores.pregunta.trim(),
        texto_si: f.valores.texto_si.trim(),
        texto_no: f.valores.texto_no.trim(),
      };
      return opcion ? actualizarOpcion(opcion.id, datos) : crearOpcion(datos);
    },
    onSuccess: () => {
      notificar.exito(opcion ? "Opción actualizada" : "Opción agregada");
      refrescar();
      onPanel(null);
    },
    onError: f.tomarErroresDelServidor,
  });

  const borrar = useMutation({
    mutationFn: () => eliminarOpcion(opcion!.id),
    onSuccess: () => {
      notificar.exito("Opción eliminada");
      setEliminando(false);
      refrescar();
      onPanel(null);
    },
    onError: (e) => {
      setEliminando(false);
      notificar.error("No se pudo eliminar", mensajeDeError(e));
    },
  });

  const columnas: Columna<OpcionPreferencia>[] = [
    { clave: "orden", titulo: "Orden", ancho: "70px", render: (o) => o.orden },
    { clave: "pregunta", titulo: "Pregunta", render: (o) => <span className={estilos.pregunta}>{o.pregunta}</span> },
    { clave: "si", titulo: "Si responde sí", render: (o) => <span className={estilos.texto}>{o.texto_si}</span> },
    { clave: "no", titulo: "Si responde no", render: (o) => <span className={estilos.texto}>{o.texto_no}</span> },
    {
      clave: "activa",
      titulo: "Estado",
      ancho: "100px",
      render: (o) => (
        <EtiquetaEstado tono={o.activa ? "exito" : "neutro"}>{o.activa ? "Activa" : "Inactiva"}</EtiquetaEstado>
      ),
    },
  ];

  const { valores: v, errores: e } = f;
  const completo = v.pregunta.trim() && v.texto_si.trim() && v.texto_no.trim();

  return (
    <>
      <TablaDatos
        etiqueta="Opciones de preferencias"
        columnas={columnas}
        filas={opciones}
        claveFila={(o) => o.id}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        onFila={(o) => onPanel(o)}
        vacio={
          <EstadoVacio
            icono={<IconoPreferencias />}
            titulo="Todavía no hay preguntas"
            descripcion="Agrega lo que los docentes pueden pedir, por ejemplo si los estudiantes pueden entrar antes que ellos."
          />
        }
      />

      <PanelFormulario
        abierto={panel !== null}
        titulo={opcion ? "Editar opción" : "Nueva opción"}
        subtitulo="El docente responde Sí, No o Me da igual. Según su respuesta, los auxiliares leen una u otra frase."
        onCerrar={() => onPanel(null)}
        hayCambios={f.cambiado && !guardar.isPending}
        pie={
          <>
            <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
              {guardar.isPending ? "Guardando…" : opcion ? "Guardar cambios" : "Agregar"}
            </Button>
            <Button onClick={() => onPanel(null)}>Cancelar</Button>
            {opcion && (
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
        <Field label="Pregunta para el docente" required {...estadoCampo(e.pregunta)}>
          <Input
            value={v.pregunta}
            maxLength={150}
            placeholder="Ej.: ¿Los estudiantes pueden entrar antes que usted?"
            onChange={(_, d) => f.set("pregunta", d.value)}
          />
        </Field>
        <Field
          label="Si responde sí"
          required
          hint="Lo que leen los auxiliares. Ej.: Dejar entrar a los estudiantes apenas lleguen."
          {...estadoCampo(e.texto_si)}
        >
          <Input value={v.texto_si} maxLength={150} onChange={(_, d) => f.set("texto_si", d.value)} />
        </Field>
        <Field
          label="Si responde no"
          required
          hint="Ej.: Los estudiantes esperan afuera hasta que llegue el docente."
          {...estadoCampo(e.texto_no)}
        >
          <Input value={v.texto_no} maxLength={150} onChange={(_, d) => f.set("texto_no", d.value)} />
        </Field>
        <Field label="Orden" hint="Las preguntas se muestran de menor a mayor." {...estadoCampo(e.orden)}>
          <SpinButton
            min={0}
            max={999}
            value={v.orden}
            onChange={(_, d) => f.set("orden", d.value ?? (Number.parseInt(d.displayValue ?? "0", 10) || 0))}
          />
        </Field>
        <Switch
          label={v.activa ? "Activa: los docentes la ven" : "Inactiva: no se muestra ni se avisa"}
          checked={v.activa}
          onChange={(_, d) => f.set("activa", d.checked)}
        />
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={eliminando}
        titulo={`¿Eliminar «${opcion?.pregunta ?? ""}»?`}
        mensaje="Los docentes ya no la verán y lo que respondieron dejará de mostrarse. Si solo quieres ocultarla por un tiempo, desactívala."
        textoConfirmar="Eliminar"
        peligroso
        cargando={borrar.isPending}
        onCancelar={() => setEliminando(false)}
        onConfirmar={() => borrar.mutate()}
      />
    </>
  );
}
