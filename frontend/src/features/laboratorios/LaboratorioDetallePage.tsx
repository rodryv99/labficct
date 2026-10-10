import {
  Body1,
  Button,
  Caption1,
  Tab,
  TabList,
  Title3,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { EstadoError } from "../../components/feedback/Estados";
import { PantallaCarga } from "../../components/feedback/PantallaCarga";
import { IconoEditar, IconoUbicacion, IconoVolver } from "../../components/iconos/iconos";
import { ListaBitacora } from "../bitacora/ListaBitacora";
import { obtenerLaboratorio } from "./api";
import { CredencialesTab } from "./CredencialesTab";
import { EditorDistribucion } from "./distribucion/EditorDistribucion";
import { LaboratorioPanel } from "./LaboratorioPanel";
import { TONO_ESTADO_LAB } from "./LaboratoriosPage";
import { SoftwareTab } from "./SoftwareTab";

const useEstilos = makeStyles({
  volver: {
    marginLeft: "-8px",
    marginBottom: "4px",
  },
  cabecera: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "12px",
  },
  titulo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  codigo: {
    color: tokens.colorBrandForeground1,
  },
  ubicacion: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginTop: "4px",
    color: tokens.colorNeutralForeground3,
  },
  pestanas: {
    marginBottom: "16px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  oculto: {
    display: "none",
  },
  ficha: {
    display: "grid",
    gridTemplateColumns: "180px minmax(0, 1fr)",
    gap: "12px 24px",
    maxWidth: "760px",
    padding: "20px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  clave: {
    color: tokens.colorNeutralForeground3,
  },
  notas: {
    whiteSpace: "pre-wrap",
  },
});

type Pestana = "distribucion" | "ficha" | "credenciales" | "software" | "bitacora";

export function LaboratorioDetallePage() {
  const estilos = useEstilos();
  const { id } = useParams();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const { puede } = useSesion();
  const [editando, setEditando] = useState(false);
  const pestana = (params.get("tab") as Pestana) || "distribucion";

  const consulta = useQuery({
    queryKey: ["laboratorios", Number(id)],
    queryFn: () => obtenerLaboratorio(Number(id)),
    enabled: Boolean(id),
  });

  if (consulta.isLoading) return <PantallaCarga mensaje="Cargando laboratorio…" />;
  if (consulta.error || !consulta.data) {
    return <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />;
  }
  const lab = consulta.data;

  const cambiarPestana = (valor: Pestana) => {
    const nuevos = new URLSearchParams(params);
    nuevos.set("tab", valor);
    setParams(nuevos, { replace: true });
  };

  return (
    <>
      <Button appearance="subtle" icon={<IconoVolver />} className={estilos.volver} onClick={() => navegar("/laboratorios")}>
        Laboratorios
      </Button>
      <div className={estilos.cabecera}>
        <div>
          <div className={estilos.titulo}>
            <Title3 as="h1">
              <span className={estilos.codigo}>{lab.codigo}</span> · {lab.nombre}
            </Title3>
            <EtiquetaEstado tono={TONO_ESTADO_LAB[lab.estado]}>{lab.estado_nombre}</EtiquetaEstado>
          </div>
          {lab.ubicacion && (
            <Caption1 className={estilos.ubicacion}>
              <IconoUbicacion /> {lab.ubicacion}
            </Caption1>
          )}
        </div>
        {puede("laboratorios.gestionar") && (
          <Button icon={<IconoEditar />} onClick={() => setEditando(true)}>
            Editar ficha
          </Button>
        )}
      </div>

      <TabList
        className={estilos.pestanas}
        selectedValue={pestana}
        onTabSelect={(_, d) => cambiarPestana(d.value as Pestana)}
      >
        <Tab value="distribucion">Distribución</Tab>
        <Tab value="ficha">Información</Tab>
        {puede("laboratorios.credenciales") && <Tab value="credenciales">Credenciales</Tab>}
        <Tab value="software">Software</Tab>
        {puede("bitacora.ver") && <Tab value="bitacora">Bitácora</Tab>}
      </TabList>

      {/* El editor queda montado al cambiar de pestaña, para no perder cambios sin guardar. */}
      <div className={pestana === "distribucion" ? undefined : estilos.oculto}>
        <EditorDistribucion laboratorioId={lab.id} editable={puede("laboratorios.gestionar")} />
      </div>

      {pestana === "ficha" && (
        <div className={estilos.ficha}>
          <Body1 className={estilos.clave}>Código</Body1>
          <Body1>{lab.codigo}</Body1>
          <Body1 className={estilos.clave}>Nombre</Body1>
          <Body1>{lab.nombre}</Body1>
          <Body1 className={estilos.clave}>Ubicación</Body1>
          <Body1>{lab.ubicacion || "—"}</Body1>
          <Body1 className={estilos.clave}>Capacidad</Body1>
          <Body1>{lab.capacidad} estudiantes</Body1>
          <Body1 className={estilos.clave}>Estado</Body1>
          <Body1>{lab.estado_nombre}</Body1>
          <Body1 className={estilos.clave}>Grilla</Body1>
          <Body1>
            {lab.filas} filas × {lab.columnas} columnas · {lab.total_elementos} elementos
          </Body1>
          <Body1 className={estilos.clave}>Software</Body1>
          <Body1>{lab.software_detalle.map((s) => s.nombre_completo).join(", ") || "—"}</Body1>
          <Body1 className={estilos.clave}>Notas</Body1>
          <Body1 className={estilos.notas}>{lab.notas || "—"}</Body1>
        </div>
      )}
      {pestana === "credenciales" && puede("laboratorios.credenciales") && <CredencialesTab laboratorioId={lab.id} />}
      {pestana === "software" && <SoftwareTab laboratorio={lab} />}
      {pestana === "bitacora" && puede("bitacora.ver") && <ListaBitacora laboratorioId={lab.id} />}

      <LaboratorioPanel abierto={editando} laboratorio={lab} onCerrar={() => setEditando(false)} />
    </>
  );
}
