import {
  Body1,
  Button,
  Caption1,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { EntradaBitacora } from "../../api/tipos";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoDescargar, IconoEditar, IconoEliminar } from "../../components/iconos/iconos";
import { fechaHora } from "../../lib/fechas";
import { type FormatoExportar, TONO_BITACORA, descargarEntrada, eliminarEntrada } from "./api";
import { MapaBitacora } from "./MapaBitacora";

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
  titulo: {
    fontWeight: tokens.fontWeightSemibold,
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

  const exportar = useMutation({
    mutationFn: (formato: FormatoExportar) => descargarEntrada(entrada!, formato),
    onError: (error) => notificar.error("No se pudo exportar", mensajeDeError(error)),
  });

  const e = entrada;
  const botonExportar = e && (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button icon={<IconoDescargar />} disabled={exportar.isPending}>
          {exportar.isPending ? "Exportando…" : "Exportar"}
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {e.mapa && <MenuItem onClick={() => exportar.mutate("jpg")}>Imagen (JPG)</MenuItem>}
          {e.mapa && <MenuItem onClick={() => exportar.mutate("pdf")}>PDF</MenuItem>}
          <MenuItem onClick={() => exportar.mutate("json")}>Archivo de bitácora (para importar)</MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  );

  return (
    <>
      <PanelFormulario
        abierto={e !== null}
        titulo={e?.titulo ?? "Entrada de bitácora"}
        subtitulo={e ? `${e.laboratorio_codigo} · ${fechaHora(e.fecha)}` : undefined}
        onCerrar={onCerrar}
        tamano={e?.mapa ? "large" : "medium"}
        pie={
          e ? (
            <>
              {e.editable && (
                <Button appearance="primary" icon={<IconoEditar />} onClick={() => onEditar(e)}>
                  Editar
                </Button>
              )}
              {botonExportar}
              <span className={estilos.espacio} />
              {e.editable && (
                <Button appearance="subtle" icon={<IconoEliminar />} onClick={() => setEliminando(true)}>
                  Eliminar
                </Button>
              )}
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
            {e.mapa && (
              <>
                <Body1 className={estilos.titulo}>Mapa del laboratorio</Body1>
                <MapaBitacora mapa={e.mapa} atributos={e.mapa.atributos} marcas={e.mapa.marcas} />
              </>
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
