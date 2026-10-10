import {
  Body1Strong,
  Button,
  Caption1,
  SearchBox,
  Select,
  Skeleton,
  SkeletonItem,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { TipoElemento } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { EstadoError, EstadoVacio } from "../../components/feedback/Estados";
import { IconoElemento } from "../../components/iconos/IconoElemento";
import { IconoAgregar, IconoElementos } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { CATEGORIAS_ELEMENTO } from "../../lib/constantes";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { useDebounce } from "../../lib/utiles";
import { listarElementos } from "./api";
import { ElementoPanel } from "./ElementoPanel";

const useEstilos = makeStyles({
  grilla: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "12px",
  },
  tarjeta: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px",
    textAlign: "left",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontFamily: "inherit",
    transitionProperty: "border-color, box-shadow",
    transitionDuration: tokens.durationFast,
  },
  clicable: {
    cursor: "pointer",
    ":hover": {
      borderColor: tokens.colorNeutralStroke1Hover,
      boxShadow: tokens.shadow4,
    },
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
    },
  },
  inactiva: {
    opacity: 0.6,
  },
  icono: {
    width: "48px",
    height: "48px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusLarge,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imagen: {
    width: "32px",
    height: "32px",
    objectFit: "contain",
  },
  textos: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  busqueda: {
    minWidth: "260px",
  },
});

/** Ícono del elemento sobre un fondo de su color, como se ve en la grilla. */
export function FichaIcono({ tipo, tamano = 48 }: { tipo: Pick<TipoElemento, "icono" | "color" | "imagen">; tamano?: number }) {
  const estilos = useEstilos();
  return (
    <div
      className={estilos.icono}
      style={{ width: tamano, height: tamano, backgroundColor: `${tipo.color}1A`, border: `1px solid ${tipo.color}55` }}
    >
      {tipo.imagen ? (
        <img src={tipo.imagen} alt="" className={estilos.imagen} />
      ) : (
        <IconoElemento icono={tipo.icono} tamano={Math.round(tamano * 0.55)} color={tipo.color} />
      )}
    </div>
  );
}

export function ElementosPage() {
  const estilos = useEstilos();
  const { puede } = useSesion();
  const gestionar = puede("elementos.gestionar");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [panel, setPanel] = useState<{ elemento: TipoElemento | null } | null>(null);
  const busquedaRetrasada = useDebounce(busqueda);

  useAccionUrl(["nuevo"], () => gestionar && setPanel({ elemento: null }));

  const consulta = useQuery({
    queryKey: ["elementos", { busquedaRetrasada, categoria }],
    queryFn: () =>
      listarElementos({ search: busquedaRetrasada || undefined, categoria: categoria || undefined }),
  });

  return (
    <>
      <EncabezadoPagina
        seccion="Recursos"
        titulo="Elementos"
        descripcion="Lo que se coloca en la grilla de un laboratorio: computadoras, proyectores, pizarras…"
        acciones={
          gestionar && (
            <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setPanel({ elemento: null })}>
              Nuevo elemento
            </Button>
          )
        }
      />
      <BarraFiltros>
        <SearchBox
          className={estilos.busqueda}
          placeholder="Buscar elemento"
          value={busqueda}
          onChange={(_, d) => setBusqueda(d.value)}
        />
        <Select aria-label="Categoría" value={categoria} onChange={(_, d) => setCategoria(d.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS_ELEMENTO.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </Select>
      </BarraFiltros>

      {consulta.error && !consulta.data ? (
        <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />
      ) : consulta.isLoading ? (
        <div className={estilos.grilla}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} aria-label="Cargando">
              <SkeletonItem style={{ height: 78, borderRadius: 8 }} />
            </Skeleton>
          ))}
        </div>
      ) : consulta.data?.length === 0 ? (
        <EstadoVacio
          icono={<IconoElementos />}
          titulo={busquedaRetrasada || categoria ? "Ningún elemento coincide" : "Todavía no hay elementos"}
          descripcion="Crea los elementos (PC, proyector, pizarra…) para poder dibujarlos en los laboratorios."
          accion={
            gestionar && (
              <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setPanel({ elemento: null })}>
                Crear el primero
              </Button>
            )
          }
        />
      ) : (
        <div className={estilos.grilla}>
          {consulta.data?.map((el) => {
            const contenido = (
              <>
                <FichaIcono tipo={el} />
                <div className={estilos.textos}>
                  <Body1Strong>{el.nombre}</Body1Strong>
                  <Caption1 className={estilos.secundario}>{el.categoria_nombre}</Caption1>
                  <Caption1 className={estilos.secundario}>
                    {el.en_uso === 0 ? "Sin usar" : `En ${el.en_uso} casilla${el.en_uso === 1 ? "" : "s"}`}
                  </Caption1>
                  {!el.activo && <EtiquetaEstado tono="neutro">Inactivo</EtiquetaEstado>}
                </div>
              </>
            );
            return gestionar ? (
              <button
                key={el.id}
                type="button"
                className={mergeClasses(estilos.tarjeta, estilos.clicable, !el.activo && estilos.inactiva)}
                onClick={() => setPanel({ elemento: el })}
              >
                {contenido}
              </button>
            ) : (
              <div key={el.id} className={mergeClasses(estilos.tarjeta, !el.activo && estilos.inactiva)}>
                {contenido}
              </div>
            );
          })}
        </div>
      )}

      {gestionar && (
        <ElementoPanel abierto={panel !== null} elemento={panel?.elemento ?? null} onCerrar={() => setPanel(null)} />
      )}
    </>
  );
}
