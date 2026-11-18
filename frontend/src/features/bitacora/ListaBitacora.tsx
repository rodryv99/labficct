import { Button, Caption1, Input, SearchBox, Select, makeStyles, tokens } from "@fluentui/react-components";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { EntradaBitacora } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { Paginacion } from "../../components/datos/Paginacion";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { IconoAgregar, IconoBitacora, IconoImportar } from "../../components/iconos/iconos";
import { BarraFiltros } from "../../components/layout/EncabezadoPagina";
import { TIPOS_BITACORA } from "../../lib/constantes";
import { fechaHora } from "../../lib/fechas";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { useDebounce } from "../../lib/utiles";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { TONO_BITACORA, importarEntrada, listarBitacora } from "./api";
import { EntradaDetalle } from "./EntradaDetalle";
import { EntradaPanel } from "./EntradaPanel";

const TAMANO = 25;

const useEstilos = makeStyles({
  celda: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  fuerte: {
    fontWeight: tokens.fontWeightSemibold,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  fecha: {
    fontVariantNumeric: "tabular-nums",
  },
  busqueda: {
    minWidth: "220px",
  },
  dia: {
    width: "170px",
  },
  espacio: {
    flex: 1,
  },
  acciones: {
    display: "flex",
    gap: "8px",
  },
  titulo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  oculto: {
    display: "none",
  },
});

type Panel = { tipo: "formulario"; entrada: EntradaBitacora | null } | { tipo: "detalle"; entrada: EntradaBitacora };

interface Props {
  /** Dentro de la ficha de un laboratorio: sin filtro ni columna de laboratorio. */
  laboratorioId?: number;
  /** Para la página: recibe el botón "Registrar" y arma el encabezado. Sin esto, el botón va en la barra de filtros. */
  encabezado?: (accion: ReactNode) => ReactNode;
}

/** Historial de lo que pasó en los laboratorios. Se usa en su página y en la ficha de cada laboratorio. */
export function ListaBitacora({ laboratorioId, encabezado }: Props) {
  const estilos = useEstilos();
  const { puede } = useSesion();
  const gestionar = puede("bitacora.gestionar");
  const fijo = laboratorioId !== undefined;
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [laboratorio, setLaboratorio] = useState("");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const busquedaRetrasada = useDebounce(busqueda);
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const selectorArchivo = useRef<HTMLInputElement>(null);

  useAccionUrl(["nuevo"], (p) => {
    if (p.nuevo && gestionar && !fijo) setPanel({ tipo: "formulario", entrada: null });
  });
  useEffect(() => setPagina(1), [busquedaRetrasada, laboratorio, tipo, desde, hasta]);

  const laboratorios = useQuery({
    queryKey: ["laboratorios", "todos"],
    queryFn: listarLaboratoriosTodos,
    enabled: !fijo,
  });
  const labFiltro = fijo ? laboratorioId : laboratorio ? Number(laboratorio) : undefined;
  const consulta = useQuery({
    queryKey: ["bitacora", { pagina, busquedaRetrasada, labFiltro, tipo, desde, hasta }],
    queryFn: () =>
      listarBitacora({
        page: pagina,
        page_size: TAMANO,
        search: busquedaRetrasada || undefined,
        laboratorio: labFiltro,
        tipo: tipo || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  // Importar un archivo de bitácora exportado (también desde otro equipo).
  const destino = fijo ? laboratorioId : laboratorio ? Number(laboratorio) : undefined;
  const importar = useMutation({
    mutationFn: async (archivo: File) => {
      let contenido: unknown;
      try {
        contenido = JSON.parse(await archivo.text());
      } catch {
        throw new Error("El archivo no es una bitácora de Laboratorios FICCT.");
      }
      return importarEntrada(contenido, destino);
    },
    onSuccess: (entrada) => {
      notificar.exito("Bitácora importada", `${entrada.titulo} · ${entrada.laboratorio_codigo}`);
      void queryClient.invalidateQueries({ queryKey: ["bitacora"] });
      setPanel({ tipo: "detalle", entrada });
    },
    onError: (e) => {
      // Un JSON roto no es un error del servidor: se muestra el mensaje tal cual.
      const texto = e instanceof Error && !("isAxiosError" in e) ? e.message : mensajeDeError(e);
      notificar.error(
        "No se pudo importar",
        destino === undefined
          ? `${texto} Puedes filtrar por un laboratorio o importarla desde su pestaña Bitácora.`
          : texto,
      );
    },
  });

  const columnas: Columna<EntradaBitacora>[] = [
    {
      clave: "fecha",
      titulo: "Fecha",
      ancho: "160px",
      render: (e) => <span className={estilos.fecha}>{fechaHora(e.fecha)}</span>,
    },
    ...(fijo
      ? []
      : [
          {
            clave: "laboratorio",
            titulo: "Laboratorio",
            ancho: "110px",
            render: (e: EntradaBitacora) => e.laboratorio_codigo,
          },
        ]),
    {
      clave: "tipo",
      titulo: "Tipo",
      ancho: "190px",
      render: (e) => <EtiquetaEstado tono={TONO_BITACORA[e.tipo]}>{e.tipo_nombre}</EtiquetaEstado>,
    },
    {
      clave: "titulo",
      titulo: "Qué pasó",
      render: (e) => (
        <div className={estilos.celda}>
          <span className={estilos.titulo}>
            <span className={estilos.fuerte}>{e.titulo}</span>
            {e.mapa && <EtiquetaEstado tono="info">Con mapa</EtiquetaEstado>}
          </span>
          {e.descripcion && <Caption1 className={estilos.secundario}>{e.descripcion}</Caption1>}
          {e.elementos && <Caption1 className={estilos.secundario}>Elementos: {e.elementos}</Caption1>}
        </div>
      ),
    },
    { clave: "autor", titulo: "Registró", ancho: "170px", render: (e) => e.autor_nombre || "—" },
  ];

  const botonRegistrar = gestionar && (
    <span className={estilos.acciones}>
      <Button
        icon={<IconoImportar />}
        disabled={importar.isPending}
        onClick={() => selectorArchivo.current?.click()}
      >
        {importar.isPending ? "Importando…" : "Importar"}
      </Button>
      <input
        ref={selectorArchivo}
        type="file"
        accept=".json,application/json"
        className={estilos.oculto}
        onChange={(ev) => {
          const archivo = ev.target.files?.[0];
          ev.target.value = "";
          if (archivo) importar.mutate(archivo);
        }}
      />
      <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setPanel({ tipo: "formulario", entrada: null })}>
        Registrar
      </Button>
    </span>
  );
  const conFiltros = Boolean(busquedaRetrasada || laboratorio || tipo || desde || hasta);

  return (
    <>
      {encabezado?.(botonRegistrar)}
      <BarraFiltros>
        <SearchBox
          className={estilos.busqueda}
          placeholder="Buscar por título, descripción o elemento"
          value={busqueda}
          onChange={(_, d) => setBusqueda(d.value)}
        />
        {!fijo && (
          <Select aria-label="Laboratorio" value={laboratorio} onChange={(_, d) => setLaboratorio(d.value)}>
            <option value="">Todos los laboratorios</option>
            {laboratorios.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} · {l.nombre}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Tipo" value={tipo} onChange={(_, d) => setTipo(d.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS_BITACORA.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </Select>
        <Input
          className={estilos.dia}
          type="date"
          aria-label="Desde"
          contentBefore={<Caption1>Desde</Caption1>}
          value={desde}
          max={hasta || undefined}
          onChange={(_, d) => setDesde(d.value)}
        />
        <Input
          className={estilos.dia}
          type="date"
          aria-label="Hasta"
          contentBefore={<Caption1>Hasta</Caption1>}
          value={hasta}
          min={desde || undefined}
          onChange={(_, d) => setHasta(d.value)}
        />
        {!encabezado && botonRegistrar && (
          <>
            <span className={estilos.espacio} />
            {botonRegistrar}
          </>
        )}
      </BarraFiltros>

      <TablaDatos
        etiqueta="Bitácora"
        columnas={columnas}
        filas={consulta.data?.results}
        claveFila={(e) => e.id}
        cargando={consulta.isLoading}
        error={consulta.error}
        onReintentar={() => void consulta.refetch()}
        onFila={(e) => setPanel({ tipo: "detalle", entrada: e })}
        vacio={
          <EstadoVacio
            icono={<IconoBitacora />}
            titulo={conFiltros ? "Sin entradas con estos filtros" : "La bitácora está vacía"}
            descripcion={
              conFiltros
                ? undefined
                : "Registra instalaciones, fallas, mantenimientos y limpiezas para que todos sepan qué pasó en cada laboratorio."
            }
          />
        }
      />
      <Paginacion pagina={pagina} total={consulta.data?.count ?? 0} tamano={TAMANO} onCambiar={setPagina} />

      <EntradaDetalle
        entrada={panel?.tipo === "detalle" ? panel.entrada : null}
        onCerrar={() => setPanel(null)}
        onEditar={(entrada) => setPanel({ tipo: "formulario", entrada })}
      />
      {gestionar && (
        <EntradaPanel
          abierto={panel?.tipo === "formulario"}
          entrada={panel?.tipo === "formulario" ? panel.entrada : null}
          laboratorioId={laboratorioId}
          onCerrar={() => setPanel(null)}
          onGuardada={(entrada) => setPanel({ tipo: "detalle", entrada })}
        />
      )}
    </>
  );
}
