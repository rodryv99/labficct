import {
  Body1,
  Button,
  Caption1,
  MessageBar,
  MessageBarBody,
  SearchBox,
  Tab,
  TabList,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { OpcionPreferencia, Preferencias } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoAgregar, IconoPreferencias } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { relativo } from "../../lib/fechas";
import { useDebounce } from "../../lib/utiles";
import { SinPermisoPage } from "../sistema/SinPermisoPage";
import { guardarPreferenciasDocente, listarOpciones, listarPreferenciasDocentes } from "./api";
import { EditorPreferencias, VistaPreviaPreferencias, useEditorPreferencias } from "./EditorPreferencias";
import { MisPreferencias } from "./MisPreferencias";
import { OpcionesTab } from "./OpcionesTab";

const useEstilos = makeStyles({
  pestanas: {
    marginBottom: "16px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  docente: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  nombre: {
    fontWeight: tokens.fontWeightSemibold,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  resumen: {
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    color: tokens.colorNeutralForeground2,
  },
  busqueda: {
    minWidth: "260px",
  },
});

/** Una sola ruta: la vista de Admin y auxiliares, o "Mis preferencias" para el docente. */
export function PreferenciasPage() {
  const { puede } = useSesion();
  if (puede("preferencias.ver")) return <PreferenciasDocentes />;
  if (puede("preferencias.propias")) return <MisPreferencias />;
  return <SinPermisoPage />;
}

type Pestana = "docentes" | "opciones";

function PreferenciasDocentes() {
  const estilos = useEstilos();
  const { puede } = useSesion();
  const gestionar = puede("preferencias.gestionar");
  const [pestana, setPestana] = useState<Pestana>("docentes");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Preferencias | null>(null);
  const [panelOpcion, setPanelOpcion] = useState<OpcionPreferencia | "nueva" | null>(null);
  const busquedaRetrasada = useDebounce(busqueda);

  const opciones = useQuery({ queryKey: ["preferencias", "opciones"], queryFn: () => listarOpciones() });
  const docentes = useQuery({
    queryKey: ["preferencias", "docentes", busquedaRetrasada],
    queryFn: () => listarPreferenciasDocentes(busquedaRetrasada),
    placeholderData: keepPreviousData,
  });

  const opcionesOrdenadas = opciones.data ? [...opciones.data].sort((a, b) => a.orden - b.orden || a.id - b.id) : undefined;

  const columnas: Columna<Preferencias>[] = [
    {
      clave: "docente",
      titulo: "Docente",
      ancho: "240px",
      render: (p) => (
        <div className={estilos.docente}>
          <span className={estilos.nombre}>{p.docente_nombre}</span>
          {!p.tiene_usuario && <Caption1 className={estilos.secundario}>Sin cuenta en el sistema</Caption1>}
        </div>
      ),
    },
    {
      clave: "resumen",
      titulo: "Preferencias",
      render: (p) =>
        p.resumen.length ? (
          <span className={estilos.resumen} title={p.resumen.join("\n")}>
            {p.resumen.join(" · ")}
          </span>
        ) : (
          <Caption1 className={estilos.secundario}>Sin preferencias</Caption1>
        ),
    },
    {
      clave: "actualizado",
      titulo: "Actualizado",
      ancho: "150px",
      render: (p) =>
        p.actualizado_en ? (
          <Caption1>{relativo(p.actualizado_en)}</Caption1>
        ) : (
          <Caption1 className={estilos.secundario}>Nunca</Caption1>
        ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        seccion="Planificación"
        titulo="Preferencias docentes"
        descripcion="Lo que cada docente pide para su clase. Los auxiliares lo ven en el aviso para alistar el aula."
        acciones={
          gestionar &&
          pestana === "opciones" && (
            <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setPanelOpcion("nueva")}>
              Nueva opción
            </Button>
          )
        }
      />

      {gestionar && (
        <TabList
          className={estilos.pestanas}
          selectedValue={pestana}
          onTabSelect={(_, d) => setPestana(d.value as Pestana)}
        >
          <Tab value="docentes">Por docente</Tab>
          <Tab value="opciones">Opciones</Tab>
        </TabList>
      )}

      {pestana === "docentes" || !gestionar ? (
        <>
          <BarraFiltros>
            <SearchBox
              className={estilos.busqueda}
              placeholder="Buscar docente"
              value={busqueda}
              onChange={(_, d) => setBusqueda(d.value)}
            />
          </BarraFiltros>
          <TablaDatos
            etiqueta="Preferencias por docente"
            columnas={columnas}
            filas={docentes.data}
            claveFila={(p) => p.docente}
            cargando={docentes.isLoading}
            error={docentes.error}
            onReintentar={() => void docentes.refetch()}
            onFila={(p) => setSeleccion(p)}
            vacio={
              <EstadoVacio
                icono={<IconoPreferencias />}
                titulo={busquedaRetrasada ? "Ningún docente coincide" : "No hay docentes activos"}
                descripcion={busquedaRetrasada ? undefined : "Los docentes se registran en Horarios."}
              />
            }
          />
        </>
      ) : (
        <OpcionesTab
          opciones={opcionesOrdenadas}
          cargando={opciones.isLoading}
          error={opciones.error}
          onReintentar={() => void opciones.refetch()}
          panel={panelOpcion}
          onPanel={setPanelOpcion}
        />
      )}

      <PanelDocente
        preferencias={seleccion}
        opciones={opciones.data}
        editable={gestionar}
        onCerrar={() => setSeleccion(null)}
        onGuardado={setSeleccion}
      />
    </>
  );
}

interface PanelDocenteProps {
  preferencias: Preferencias | null;
  opciones: OpcionPreferencia[] | undefined;
  editable: boolean;
  onCerrar: () => void;
  onGuardado: (p: Preferencias) => void;
}

/** Las preferencias de un docente: solo lectura para auxiliares, editables para el Admin. */
function PanelDocente({ preferencias, opciones, editable, onCerrar, onGuardado }: PanelDocenteProps) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const editor = useEditorPreferencias(preferencias ?? undefined, opciones);

  const guardar = useMutation({
    mutationFn: () => guardarPreferenciasDocente(preferencias!.docente, editor.cuerpo()),
    onSuccess: (p) => {
      notificar.exito("Preferencias guardadas", p.docente_nombre);
      void queryClient.invalidateQueries({ queryKey: ["preferencias"] });
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
      onGuardado(p);
    },
    onError: (e) => notificar.error("No se pudieron guardar", mensajeDeError(e)),
  });

  const p = preferencias;
  const subtitulo = p
    ? p.actualizado_en
      ? `Actualizadas ${relativo(p.actualizado_en)}`
      : p.tiene_usuario
        ? "Todavía no marcó nada."
        : "No tiene cuenta en el sistema."
    : undefined;

  return (
    <PanelFormulario
      abierto={p !== null}
      tamano={editable ? "medium" : "small"}
      titulo={p?.docente_nombre ?? "Docente"}
      subtitulo={subtitulo}
      onCerrar={onCerrar}
      hayCambios={editable && editor.cambiado && !guardar.isPending}
      pie={
        editable && p ? (
          <>
            <Button
              appearance="primary"
              disabled={!editor.cambiado || guardar.isPending || !opciones}
              onClick={() => guardar.mutate()}
            >
              {guardar.isPending ? "Guardando…" : "Guardar"}
            </Button>
            <Button onClick={onCerrar}>Cancelar</Button>
          </>
        ) : undefined
      }
    >
      {p && editable && (
        <>
          {!p.tiene_usuario && (
            <MessageBar intent="info">
              <MessageBarBody>Este docente no tiene cuenta: puedes cargar aquí lo que te pidió.</MessageBarBody>
            </MessageBar>
          )}
          <EditorPreferencias editor={editor} deshabilitado={guardar.isPending} />
        </>
      )}
      {p && !editable && (
        <>
          <VistaPreviaPreferencias lineas={p.resumen} vacio="Este docente no marcó preferencias." />
          <Body1 className={estilos.secundario}>
            Estas indicaciones llegan en el aviso para alistar el aula, 15 minutos antes de cada clase.
          </Body1>
        </>
      )}
    </PanelFormulario>
  );
}
