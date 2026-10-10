import { Button, Caption1, Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { datosDeError, mensajeDeError } from "../../api/errores";
import { EstadoError, EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { IconoGuardar, IconoPersona } from "../../components/iconos/iconos";
import { EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { relativo } from "../../lib/fechas";
import { guardarMisPreferencias, listarOpciones, obtenerMisPreferencias } from "./api";
import { EditorPreferencias, useEditorPreferencias } from "./EditorPreferencias";

const useEstilos = makeStyles({
  acciones: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    paddingTop: "4px",
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  contenido: {
    maxWidth: "1080px",
  },
});

/** El docente marca cómo quiere encontrar el aula. */
export function MisPreferencias() {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();

  const opciones = useQuery({ queryKey: ["preferencias", "opciones"], queryFn: () => listarOpciones() });
  const mias = useQuery({ queryKey: ["preferencias", "mias"], queryFn: obtenerMisPreferencias });
  const editor = useEditorPreferencias(mias.data, opciones.data);

  const guardar = useMutation({
    mutationFn: () => guardarMisPreferencias(editor.cuerpo()),
    onSuccess: (p) => {
      queryClient.setQueryData(["preferencias", "mias"], p);
      notificar.exito("Preferencias guardadas", "Los auxiliares las verán desde tu próxima clase.");
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: (e) => notificar.error("No se pudieron guardar", mensajeDeError(e)),
  });

  const error = mias.error ?? opciones.error;
  const sinFicha = datosDeError(mias.error)?.codigo === "sin_ficha";

  return (
    <>
      <EncabezadoPagina
        seccion="Planificación"
        titulo="Mis preferencias"
        descripcion="Los auxiliares verán esto en el aviso para alistar tu aula, 15 minutos antes de cada clase."
      />
      {sinFicha ? (
        <EstadoVacio
          icono={<IconoPersona />}
          titulo="Tu cuenta aún no tiene clases asignadas"
          descripcion="Pídele al jefe de laboratorio que vincule tu cuenta con tu ficha de docente. Luego podrás marcar tus preferencias aquí."
        />
      ) : error && !(mias.data && opciones.data) ? (
        <EstadoError
          error={error}
          onReintentar={() => {
            void mias.refetch();
            void opciones.refetch();
          }}
        />
      ) : !mias.data || !opciones.data ? (
        <Spinner label="Cargando tus preferencias…" />
      ) : (
        <div className={estilos.contenido}>
          <EditorPreferencias
            editor={editor}
            deshabilitado={guardar.isPending}
            pie={
              <div className={estilos.acciones}>
                <Button
                  appearance="primary"
                  icon={<IconoGuardar />}
                  disabled={!editor.cambiado || guardar.isPending}
                  onClick={() => guardar.mutate()}
                >
                  {guardar.isPending ? "Guardando…" : "Guardar"}
                </Button>
                {editor.cambiado && !guardar.isPending && (
                  <Button appearance="subtle" onClick={editor.descartar}>
                    Descartar cambios
                  </Button>
                )}
                {!editor.cambiado && mias.data.actualizado_en && (
                  <Caption1 className={estilos.secundario}>Guardadas {relativo(mias.data.actualizado_en)}</Caption1>
                )}
              </div>
            }
          />
        </div>
      )}
    </>
  );
}
