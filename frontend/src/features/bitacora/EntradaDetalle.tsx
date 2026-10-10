import { Body1, Button, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { EntradaBitacora } from "../../api/tipos";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoEditar, IconoEliminar } from "../../components/iconos/iconos";
import { fechaHora } from "../../lib/fechas";
import { TONO_BITACORA, eliminarEntrada } from "./api";

const useEstilos = makeStyles({
  cuadro: {
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr)",
    gap: "8px 16px",
  },
  clave: {
    color: tokens.colorNeutralForeground3,
  },
  texto: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  espacio: {
    flex: 1,
  },
});

interface Props {
  entrada: EntradaBitacora | null;
  onCerrar: () => void;
  onEditar: (entrada: EntradaBitacora) => void;
}

export function EntradaDetalle({ entrada, onCerrar, onEditar }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [eliminando, setEliminando] = useState(false);

  const borrar = useMutation({
    mutationFn: () => eliminarEntrada(entrada!.id),
    onSuccess: () => {
      notificar.exito("Entrada eliminada");
      setEliminando(false);
      void queryClient.invalidateQueries({ queryKey: ["bitacora"] });
      onCerrar();
    },
    onError: (e) => {
      setEliminando(false);
      notificar.error("No se pudo eliminar", mensajeDeError(e));
    },
  });

  const e = entrada;

  return (
    <>
      <PanelFormulario
        abierto={e !== null}
        titulo={e?.titulo ?? "Entrada de bitácora"}
        subtitulo={e ? `${e.laboratorio_codigo} · ${fechaHora(e.fecha)}` : undefined}
        onCerrar={onCerrar}
        pie={
          e?.editable ? (
            <>
              <Button appearance="primary" icon={<IconoEditar />} onClick={() => onEditar(e)}>
                Editar
              </Button>
              <span className={estilos.espacio} />
              <Button appearance="subtle" icon={<IconoEliminar />} onClick={() => setEliminando(true)}>
                Eliminar
              </Button>
            </>
          ) : undefined
        }
      >
        {e && (
          <>
            <div>
              <EtiquetaEstado tono={TONO_BITACORA[e.tipo]}>{e.tipo_nombre}</EtiquetaEstado>
            </div>
            <div className={estilos.cuadro}>
              <Caption1 className={estilos.clave}>Laboratorio</Caption1>
              <Body1>{e.laboratorio_codigo}</Body1>
              <Caption1 className={estilos.clave}>Fecha</Caption1>
              <Body1>{fechaHora(e.fecha)}</Body1>
              {e.elementos && (
                <>
                  <Caption1 className={estilos.clave}>Elementos</Caption1>
                  <Body1>{e.elementos}</Body1>
                </>
              )}
              {e.revision !== null && (
                <>
                  <Caption1 className={estilos.clave}>Revisión</Caption1>
                  <Body1>{e.revision_titulo || "Revisión periódica"}</Body1>
                </>
              )}
              <Caption1 className={estilos.clave}>Registró</Caption1>
              <Body1>{e.autor_nombre || "—"}</Body1>
            </div>
            {e.descripcion ? (
              <Body1 className={estilos.texto}>{e.descripcion}</Body1>
            ) : (
              <Caption1 className={estilos.secundario}>Sin descripción.</Caption1>
            )}
            {Date.parse(e.actualizado_en) - Date.parse(e.creado_en) > 60_000 && (
              <Caption1 className={estilos.secundario}>Editada el {fechaHora(e.actualizado_en)}.</Caption1>
            )}
          </>
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={eliminando}
        titulo={`¿Eliminar «${e?.titulo ?? ""}»?`}
        mensaje="La entrada se borra de la bitácora y no se puede recuperar."
        textoConfirmar="Eliminar"
        peligroso
        cargando={borrar.isPending}
        onCancelar={() => setEliminando(false)}
        onConfirmar={() => borrar.mutate()}
      />
    </>
  );
}
