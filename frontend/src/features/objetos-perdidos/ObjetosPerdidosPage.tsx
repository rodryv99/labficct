import { Button, Caption1, SearchBox, Select, makeStyles, tokens } from "@fluentui/react-components";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { EstadoObjeto, ObjetoPerdido } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { Codigo, EtiquetaEstado, type Tono } from "../../components/datos/Etiquetas";
import { Paginacion } from "../../components/datos/Paginacion";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { EstadoVacio } from "../../components/feedback/Estados";
import { IconoAgregar, IconoImagen, IconoObjetos } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { CATEGORIAS_OBJETO, ESTADOS_OBJETO } from "../../lib/constantes";
import { relativo } from "../../lib/fechas";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { useDebounce } from "../../lib/utiles";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { listarObjetos } from "./api";
import { ObjetoDetalle } from "./ObjetoDetalle";
import { ObjetoPanel } from "./ObjetoPanel";

const TAMANO = 25;

export const TONO_OBJETO: Record<EstadoObjeto, Tono> = {
  en_custodia: "aviso",
  entregado: "exito",
  anulado: "neutro",
};

const useEstilos = makeStyles({
  objeto: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  miniatura: {
    width: "40px",
    height: "40px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusMedium,
    objectFit: "cover",
    backgroundColor: tokens.colorNeutralBackground3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForeground4,
  },
  textos: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  nombre: {
    fontWeight: tokens.fontWeightSemibold,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  busqueda: {
    minWidth: "280px",
  },
});

type Panel = { tipo: "formulario"; objeto: ObjetoPerdido | null } | { tipo: "detalle"; id: number };

export function ObjetosPerdidosPage() {
  const estilos = useEstilos();
  const { puede } = useSesion();
  const registrar = puede("objetos.registrar");
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<string>("en_custodia");
  const [categoria, setCategoria] = useState("");
  const [laboratorio, setLaboratorio] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const busquedaRetrasada = useDebounce(busqueda);

  useAccionUrl(["nuevo", "id"], (p) => {
    if (p.id) setPanel({ tipo: "detalle", id: Number(p.id) });
    else if (p.nuevo && registrar) setPanel({ tipo: "formulario", objeto: null });
  });
  useEffect(() => setPagina(1), [busquedaRetrasada, estado, categoria, laboratorio]);

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos });
  const consulta = useQuery({
    queryKey: ["objetos", { pagina, busquedaRetrasada, estado, categoria, laboratorio }],
    queryFn: () =>
      listarObjetos({
        page: pagina,
        page_size: TAMANO,
        search: busquedaRetrasada || undefined,
        estado: estado || undefined,
        categoria: categoria || undefined,
        laboratorio: laboratorio ? Number(laboratorio) : undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const columnas: Columna<ObjetoPerdido>[] = [
    { clave: "codigo", titulo: "Código", ancho: "140px", render: (o) => <Codigo>{o.codigo}</Codigo> },
    {
      clave: "objeto",
      titulo: "Objeto",
      render: (o) => (
        <div className={estilos.objeto}>
          {o.foto ? (
            <img src={o.foto} alt="" className={estilos.miniatura} />
          ) : (
            <span className={estilos.miniatura}>
              <IconoImagen />
            </span>
          )}
          <div className={estilos.textos}>
            <span className={estilos.nombre}>{o.descripcion}</span>
            <Caption1 className={estilos.secundario}>{o.caracteristicas || o.categoria_nombre}</Caption1>
          </div>
        </div>
      ),
    },
    {
      clave: "donde",
      titulo: "Dónde",
      ancho: "200px",
      render: (o) => (
        <div className={estilos.textos}>
          <span>{o.laboratorio_codigo || "Fuera de laboratorio"}</span>
          {o.lugar && <Caption1 className={estilos.secundario}>{o.lugar}</Caption1>}
        </div>
      ),
    },
    { clave: "hallado", titulo: "Hallado", ancho: "150px", render: (o) => <Caption1>{relativo(o.fecha_hallazgo)}</Caption1> },
    {
      clave: "estado",
      titulo: "Estado",
      ancho: "130px",
      render: (o) => <EtiquetaEstado tono={TONO_OBJETO[o.estado]}>{o.estado_nombre}</EtiquetaEstado>,
    },
  ];

  return (
    <>
      <EncabezadoPagina
        seccion="Operación"
        titulo="Objetos perdidos"
        descripcion="Lo que se encuentra en los laboratorios. Los registros no se borran: se entregan o se anulan."
        acciones={
          registrar && (
            <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setPanel({ tipo: "formulario", objeto: null })}>
              Registrar objeto
            </Button>
          )
        }
      />
      <BarraFiltros>
        <SearchBox
          className={estilos.busqueda}
          placeholder="Buscar por descripción o código (OP-2026-0012)"
          value={busqueda}
          onChange={(_, d) => setBusqueda(d.value)}
        />
        <Select aria-label="Estado" value={estado} onChange={(_, d) => setEstado(d.value)}>
          {ESTADOS_OBJETO.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.etiqueta}
            </option>
          ))}
          <option value="">Todos los estados</option>
        </Select>
        <Select aria-label="Categoría" value={categoria} onChange={(_, d) => setCategoria(d.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS_OBJETO.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </Select>
        <Select aria-label="Laboratorio" value={laboratorio} onChange={(_, d) => setLaboratorio(d.value)}>
          <option value="">Todos los lugares</option>
          {laboratorios.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} · {l.nombre}
            </option>
          ))}
        </Select>
      </BarraFiltros>

      <TablaDatos
        etiqueta="Objetos perdidos"
        columnas={columnas}
        filas={consulta.data?.results}
        claveFila={(o) => o.id}
        cargando={consulta.isLoading}
        error={consulta.error}
        onReintentar={() => void consulta.refetch()}
        onFila={(o) => setPanel({ tipo: "detalle", id: o.id })}
        vacio={
          <EstadoVacio
            icono={<IconoObjetos />}
            titulo={estado === "en_custodia" && !busquedaRetrasada ? "No hay objetos en custodia" : "Sin resultados"}
            descripcion={
              registrar ? "Cuando alguien encuentre algo en un laboratorio, regístralo aquí con una foto." : undefined
            }
          />
        }
      />
      <Paginacion pagina={pagina} total={consulta.data?.count ?? 0} tamano={TAMANO} onCambiar={setPagina} />

      <ObjetoDetalle
        id={panel?.tipo === "detalle" ? panel.id : null}
        onCerrar={() => setPanel(null)}
        onEditar={(objeto) => setPanel({ tipo: "formulario", objeto })}
      />
      {registrar && (
        <ObjetoPanel
          abierto={panel?.tipo === "formulario"}
          objeto={panel?.tipo === "formulario" ? panel.objeto : null}
          onCerrar={() => setPanel(null)}
          onGuardado={(o) => setPanel({ tipo: "detalle", id: o.id })}
        />
      )}
    </>
  );
}
