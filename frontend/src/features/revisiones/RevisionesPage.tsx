import { Button, Caption1, Select, Switch, makeStyles, tokens } from "@fluentui/react-components";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { Revision } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { Paginacion } from "../../components/datos/Paginacion";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { EstadoVacio } from "../../components/feedback/Estados";
import { IconoAgregar, IconoRevisiones } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { fechaCorta } from "../../lib/fechas";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { listarRevisiones, situacionDe } from "./api";
import { RevisionDetalle } from "./RevisionDetalle";
import { RevisionPanel } from "./RevisionPanel";

const TAMANO = 25;

const useEstilos = makeStyles({
  celda: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  proxima: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
    fontVariantNumeric: "tabular-nums",
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
});

type Panel = { tipo: "formulario"; revision: Revision | null } | { tipo: "detalle"; id: number };

export function RevisionesPage() {
  const estilos = useEstilos();
  const { puede } = useSesion();
  const gestionar = puede("revisiones.gestionar");
  const [pagina, setPagina] = useState(1);
  const [laboratorio, setLaboratorio] = useState("");
  const [soloActivas, setSoloActivas] = useState(true);
  const [panel, setPanel] = useState<Panel | null>(null);

  useAccionUrl(["id", "nuevo"], (p) => {
    if (p.id) setPanel({ tipo: "detalle", id: Number(p.id) });
    else if (p.nuevo && gestionar) setPanel({ tipo: "formulario", revision: null });
  });
  useEffect(() => setPagina(1), [laboratorio, soloActivas]);

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos });
  const consulta = useQuery({
    queryKey: ["revisiones", { pagina, laboratorio, soloActivas }],
    queryFn: () =>
      listarRevisiones({
        page: pagina,
        page_size: TAMANO,
        laboratorio: laboratorio ? Number(laboratorio) : undefined,
        activa: soloActivas ? true : undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const columnas: Columna<Revision>[] = [
    {
      clave: "laboratorio",
      titulo: "Laboratorio",
      ancho: "160px",
      render: (r) => (
        <div className={estilos.celda}>
          <span className={estilos.fuerte}>{r.laboratorio_codigo}</span>
          <Caption1 className={estilos.secundario}>{r.laboratorio_nombre}</Caption1>
        </div>
      ),
    },
    {
      clave: "revision",
      titulo: "Revisión",
      render: (r) => (
        <div className={estilos.celda}>
          <span>{r.titulo}</span>
          <Caption1 className={estilos.secundario}>{r.frecuencia}</Caption1>
        </div>
      ),
    },
    {
      clave: "proxima",
      titulo: "Próxima",
      ancho: "190px",
      render: (r) => {
        const s = r.activa ? situacionDe(r) : null;
        return (
          <div className={estilos.proxima}>
            <span>{fechaCorta(r.proxima_fecha)}</span>
            {s && <EtiquetaEstado tono={s.tono}>{s.texto}</EtiquetaEstado>}
          </div>
        );
      },
    },
    {
      clave: "ultima",
      titulo: "Última vez",
      ancho: "120px",
      render: (r) =>
        r.ultima_fecha ? fechaCorta(r.ultima_fecha) : <Caption1 className={estilos.secundario}>Nunca</Caption1>,
    },
    {
      clave: "responsable",
      titulo: "Responsable",
      ancho: "180px",
      render: (r) => r.responsable_nombre || <Caption1 className={estilos.secundario}>Todos los auxiliares</Caption1>,
    },
    {
      clave: "activa",
      titulo: "Estado",
      ancho: "100px",
      render: (r) => (
        <EtiquetaEstado tono={r.activa ? "exito" : "neutro"}>{r.activa ? "Activa" : "Pausada"}</EtiquetaEstado>
      ),
    },
  ];

  return (
    <>
      <EncabezadoPagina
        seccion="Recursos"
        titulo="Revisiones periódicas"
        descripcion="Revisiones que se repiten. Cuando llega la fecha, aparece una tarea en el pizarrón."
        acciones={
          gestionar && (
            <Button
              appearance="primary"
              icon={<IconoAgregar />}
              onClick={() => setPanel({ tipo: "formulario", revision: null })}
            >
              Programar revisión
            </Button>
          )
        }
      />
      <BarraFiltros>
        <Select aria-label="Laboratorio" value={laboratorio} onChange={(_, d) => setLaboratorio(d.value)}>
          <option value="">Todos los laboratorios</option>
          {laboratorios.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} · {l.nombre}
            </option>
          ))}
        </Select>
        <Switch label="Solo activas" checked={soloActivas} onChange={(_, d) => setSoloActivas(d.checked)} />
      </BarraFiltros>

      <TablaDatos
        etiqueta="Revisiones periódicas"
        columnas={columnas}
        filas={consulta.data?.results}
        claveFila={(r) => r.id}
        cargando={consulta.isLoading}
        error={consulta.error}
        onReintentar={() => void consulta.refetch()}
        onFila={(r) => setPanel({ tipo: "detalle", id: r.id })}
        vacio={
          <EstadoVacio
            icono={<IconoRevisiones />}
            titulo={laboratorio ? "Este laboratorio no tiene revisiones programadas" : "No hay revisiones programadas"}
            descripcion={
              gestionar
                ? "Programa revisiones que se repiten, como la revisión de equipos cada 2 semanas. El sistema crea la tarea y avisa solo."
                : "El jefe de laboratorio todavía no programó revisiones."
            }
          />
        }
      />
      <Paginacion pagina={pagina} total={consulta.data?.count ?? 0} tamano={TAMANO} onCambiar={setPagina} />

      <RevisionDetalle
        id={panel?.tipo === "detalle" ? panel.id : null}
        onCerrar={() => setPanel(null)}
        onEditar={(revision) => setPanel({ tipo: "formulario", revision })}
      />
      {gestionar && (
        <RevisionPanel
          abierto={panel?.tipo === "formulario"}
          revision={panel?.tipo === "formulario" ? panel.revision : null}
          onCerrar={() => setPanel(null)}
          onGuardada={(r) => {
            setPanel({ tipo: "detalle", id: r.id });
          }}
        />
      )}
    </>
  );
}
