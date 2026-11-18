import {
  Button,
  Caption1,
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { Respaldo } from "../../api/tipos";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { IconoDescargar, IconoEliminar, IconoRespaldos } from "../../components/iconos/iconos";
import { EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { fechaHora } from "../../lib/fechas";
import { descargarRespaldo, eliminarRespaldo, estadoRespaldos, generarRespaldo, listarRespaldos } from "./api";

const useEstilos = makeStyles({
  celda: { display: "flex", flexDirection: "column", minWidth: 0 },
  nombre: { fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: "tabular-nums" },
  secundario: { color: tokens.colorNeutralForeground3 },
  acciones: { display: "flex", gap: "4px", justifyContent: "flex-end" },
  aviso: { marginBottom: "12px" },
});

/** Respaldos (copias de seguridad) de la base de datos: generar, descargar y eliminar. */
export function RespaldosPage() {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [eliminando, setEliminando] = useState<Respaldo | null>(null);
  const [descargando, setDescargando] = useState<number | null>(null);

  const estado = useQuery({ queryKey: ["respaldos", "estado"], queryFn: estadoRespaldos });
  const lista = useQuery({ queryKey: ["respaldos", "lista"], queryFn: listarRespaldos });

  const generar = useMutation({
    mutationFn: () => generarRespaldo(),
    onSuccess: (r) => {
      notificar.exito("Respaldo creado", r.archivo);
      void queryClient.invalidateQueries({ queryKey: ["respaldos"] });
    },
    onError: (falla) => notificar.error("No se pudo crear el respaldo", mensajeDeError(falla)),
  });

  const borrar = useMutation({
    mutationFn: () => eliminarRespaldo(eliminando!.id),
    onSuccess: () => {
      notificar.exito("Respaldo eliminado");
      setEliminando(null);
      void queryClient.invalidateQueries({ queryKey: ["respaldos"] });
    },
    onError: (falla) => {
      setEliminando(null);
      notificar.error("No se pudo eliminar", mensajeDeError(falla));
    },
  });

  const descargar = async (r: Respaldo) => {
    setDescargando(r.id);
    try {
      await descargarRespaldo(r);
    } catch {
      notificar.error("No se pudo descargar", "El archivo puede que ya no esté en el servidor.");
    } finally {
      setDescargando(null);
    }
  };

  const disponible = estado.data?.pg_dump_disponible ?? true;

  const columnas: Columna<Respaldo>[] = [
    {
      clave: "archivo",
      titulo: "Archivo",
      render: (r) => (
        <div className={estilos.celda}>
          <span className={estilos.nombre}>{r.archivo}</span>
          <Caption1 className={estilos.secundario}>
            {r.tamano}
            {r.creado_por_nombre ? ` · ${r.creado_por_nombre}` : ""}
            {r.nota ? ` · ${r.nota}` : ""}
          </Caption1>
        </div>
      ),
    },
    {
      clave: "origen",
      titulo: "Origen",
      ancho: "120px",
      render: (r) => (
        <EtiquetaEstado tono={r.origen === "automatico" ? "info" : "neutro"}>
          {r.origen === "automatico" ? "Automático" : "Manual"}
        </EtiquetaEstado>
      ),
    },
    { clave: "fecha", titulo: "Fecha", ancho: "170px", render: (r) => fechaHora(r.creado_en) },
    {
      clave: "acciones",
      titulo: "",
      ancho: "120px",
      render: (r) => (
        <div className={estilos.acciones} onClick={(e) => e.stopPropagation()}>
          <Button
            appearance="subtle"
            icon={descargando === r.id ? <Spinner size="tiny" /> : <IconoDescargar />}
            aria-label="Descargar"
            disabled={descargando !== null}
            onClick={() => void descargar(r)}
          />
          <Button
            appearance="subtle"
            icon={<IconoEliminar />}
            aria-label="Eliminar"
            onClick={() => setEliminando(r)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        seccion="Administración"
        titulo="Respaldos de la base de datos"
        descripcion="Crea una copia de seguridad completa de la base y descárgala cuando la necesites."
        acciones={
          <Button
            appearance="primary"
            icon={<IconoRespaldos />}
            disabled={!disponible || generar.isPending}
            onClick={() => generar.mutate()}
          >
            {generar.isPending ? "Creando respaldo…" : "Generar respaldo"}
          </Button>
        }
      />

      {estado.data && !disponible && (
        <MessageBar className={estilos.aviso} intent="warning" layout="multiline">
          <MessageBarBody>
            El servidor todavía no puede crear respaldos porque le falta la herramienta <code>pg_dump</code>. Reconstruye
            la imagen del backend (<code>docker compose build backend worker</code> y luego{" "}
            <code>docker compose up -d</code>) y vuelve a entrar.
          </MessageBarBody>
        </MessageBar>
      )}

      {estado.data && disponible && (
        <Caption1 className={estilos.secundario} style={{ display: "block", marginBottom: 8 }}>
          Se conservan los {estado.data.maximos} respaldos más recientes; al crear uno nuevo se borra el más antiguo.
        </Caption1>
      )}

      <TablaDatos
        etiqueta="Respaldos"
        columnas={columnas}
        filas={lista.data}
        claveFila={(r) => r.id}
        cargando={lista.isLoading}
        error={lista.error}
        onReintentar={() => void lista.refetch()}
        vacio={
          <EstadoVacio
            icono={<IconoRespaldos />}
            titulo="Todavía no hay respaldos"
            descripcion="Crea el primero con el botón «Generar respaldo». El archivo queda disponible para descargar."
          />
        }
      />

      <ConfirmarDialogo
        abierto={eliminando !== null}
        titulo="¿Eliminar este respaldo?"
        mensaje={`Se borrará el archivo «${eliminando?.archivo ?? ""}» del servidor. Esta acción no se puede deshacer.`}
        textoConfirmar="Eliminar"
        peligroso
        cargando={borrar.isPending}
        onCancelar={() => setEliminando(null)}
        onConfirmar={() => borrar.mutate()}
      />
    </>
  );
}
