import {
  Button,
  Caption1,
  SearchBox,
  Select,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import type { EstadoLaboratorio, Laboratorio } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado, type Tono } from "../../components/datos/Etiquetas";
import { EstadoError, EstadoVacio } from "../../components/feedback/Estados";
import { MiniMapa } from "../../components/grilla/MiniMapa";
import { IconoAgregar, IconoLaboratorios, IconoUbicacion } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { ESTADOS_LABORATORIO } from "../../lib/constantes";
import { useAccionUrl } from "../../lib/useAccionUrl";
import { useTiposElemento } from "../elementos/useTipos";
import { listarLaboratoriosTodos } from "./api";
import { LaboratorioPanel } from "./LaboratorioPanel";

export const TONO_ESTADO_LAB: Record<EstadoLaboratorio, Tono> = {
  operativo: "exito",
  mantenimiento: "aviso",
  cerrado: "neutro",
};

const useEstilos = makeStyles({
  grilla: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px",
  },
  tarjeta: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    textAlign: "left",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontFamily: "inherit",
    cursor: "pointer",
    transitionProperty: "border-color, box-shadow, transform",
    transitionDuration: tokens.durationFast,
    ":hover": {
      borderColor: tokens.colorNeutralStroke1Hover,
      boxShadow: tokens.shadow8,
    },
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
    },
  },
  cabecera: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
  },
  codigo: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    letterSpacing: "0.02em",
  },
  ubicacion: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: tokens.colorNeutralForeground3,
    "& svg": {
      fontSize: "14px",
    },
  },
  mapa: {
    padding: "10px",
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  pie: {
    display: "flex",
    gap: "16px",
    color: tokens.colorNeutralForeground3,
  },
  inactivo: {
    opacity: 0.65,
  },
  busqueda: {
    minWidth: "260px",
  },
});

export function LaboratoriosPage() {
  const estilos = useEstilos();
  const navegar = useNavigate();
  const { puede } = useSesion();
  const gestionar = puede("laboratorios.gestionar");
  const { mapa: tipos } = useTiposElemento();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [nuevo, setNuevo] = useState(false);

  useAccionUrl(["nuevo"], () => gestionar && setNuevo(true));

  const consulta = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos });

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (consulta.data ?? []).filter(
      (l: Laboratorio) =>
        (!estado || l.estado === estado) &&
        (!q || `${l.codigo} ${l.nombre} ${l.ubicacion}`.toLowerCase().includes(q)),
    );
  }, [consulta.data, busqueda, estado]);

  return (
    <>
      <EncabezadoPagina
        seccion="Recursos"
        titulo="Laboratorios"
        descripcion="La distribución de cada sala, su ficha, credenciales y software instalado."
        acciones={
          gestionar && (
            <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setNuevo(true)}>
              Nuevo laboratorio
            </Button>
          )
        }
      />
      <BarraFiltros>
        <SearchBox
          className={estilos.busqueda}
          placeholder="Buscar por código, nombre o ubicación"
          value={busqueda}
          onChange={(_, d) => setBusqueda(d.value)}
        />
        <Select aria-label="Estado" value={estado} onChange={(_, d) => setEstado(d.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_LABORATORIO.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.etiqueta}
            </option>
          ))}
        </Select>
      </BarraFiltros>

      {consulta.error && !consulta.data ? (
        <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />
      ) : consulta.isLoading ? (
        <div className={estilos.grilla}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} aria-label="Cargando">
              <SkeletonItem style={{ height: 220, borderRadius: 12 }} />
            </Skeleton>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EstadoVacio
          icono={<IconoLaboratorios />}
          titulo={consulta.data?.length ? "Ningún laboratorio coincide" : "Todavía no hay laboratorios"}
          descripcion={
            consulta.data?.length
              ? "Prueba con otra búsqueda o quita el filtro de estado."
              : "Crea un laboratorio y dibuja su distribución con los elementos del catálogo."
          }
          accion={
            gestionar &&
            !consulta.data?.length && (
              <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setNuevo(true)}>
                Crear el primero
              </Button>
            )
          }
        />
      ) : (
        <div className={estilos.grilla}>
          {filtrados.map((lab) => (
            <button
              key={lab.id}
              type="button"
              className={mergeClasses(estilos.tarjeta, !lab.activo && estilos.inactivo)}
              onClick={() => navegar(`/laboratorios/${lab.id}`)}
            >
              <div className={estilos.cabecera}>
                <div>
                  <div className={estilos.codigo}>{lab.codigo}</div>
                  <Subtitle2>{lab.nombre}</Subtitle2>
                </div>
                <EtiquetaEstado tono={TONO_ESTADO_LAB[lab.estado]}>{lab.estado_nombre}</EtiquetaEstado>
              </div>
              {lab.ubicacion && (
                <Caption1 className={estilos.ubicacion}>
                  <IconoUbicacion /> {lab.ubicacion}
                </Caption1>
              )}
              <div className={estilos.mapa}>
                <MiniMapa filas={lab.filas} columnas={lab.columnas} mapa={lab.mapa} tipos={tipos} />
              </div>
              <div className={estilos.pie}>
                <Caption1>{lab.total_elementos} elementos</Caption1>
                <Caption1>{lab.capacidad} estudiantes</Caption1>
                <Caption1>{lab.software.length} programas</Caption1>
              </div>
            </button>
          ))}
        </div>
      )}

      {gestionar && (
        <LaboratorioPanel
          abierto={nuevo}
          laboratorio={null}
          onCerrar={() => setNuevo(false)}
          onCreado={(lab) => navegar(`/laboratorios/${lab.id}`)}
        />
      )}
    </>
  );
}
