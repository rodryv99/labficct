import {
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  Tag,
  TagGroup,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { Laboratorio } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { ListaSeleccion } from "../../components/formularios/ListaSeleccion";
import { IconoAgregar, IconoElementos } from "../../components/iconos/iconos";
import { crearSoftware, guardarSoftwareLaboratorio, listarSoftware } from "./api";

const useEstilos = makeStyles({
  raiz: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 520px) minmax(240px, 320px)",
    gap: "24px",
    alignItems: "start",
    "@media (max-width: 900px)": {
      gridTemplateColumns: "1fr",
    },
  },
  columna: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  acciones: {
    display: "flex",
    gap: "8px",
  },
  nuevo: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px",
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
});

export function SoftwareTab({ laboratorio }: { laboratorio: Laboratorio }) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede } = useSesion();
  // Admin y auxiliar: marcan los programas instalados y agregan programas nuevos al catálogo.
  const gestionar = puede("laboratorios.software");
  const [seleccion, setSeleccion] = useState<number[]>(laboratorio.software);
  const [nombre, setNombre] = useState("");
  const [version, setVersion] = useState("");

  useEffect(() => setSeleccion(laboratorio.software), [laboratorio.software]);

  const catalogo = useQuery({ queryKey: ["software"], queryFn: listarSoftware, enabled: gestionar });

  const guardar = useMutation({
    mutationFn: () => guardarSoftwareLaboratorio(laboratorio.id, seleccion),
    onSuccess: () => {
      notificar.exito("Software actualizado");
      void queryClient.invalidateQueries({ queryKey: ["laboratorios"] });
    },
    onError: (e) => notificar.error("No se pudo guardar", mensajeDeError(e)),
  });

  const agregar = useMutation({
    mutationFn: () => crearSoftware({ nombre: nombre.trim(), version: version.trim() }),
    onSuccess: (s) => {
      setSeleccion((v) => [...v, s.id]);
      setNombre("");
      setVersion("");
      void queryClient.invalidateQueries({ queryKey: ["software"] });
      notificar.exito("Programa agregado al catálogo", "Guarda para instalarlo en este laboratorio.");
    },
    onError: (e) => notificar.error("No se pudo agregar", mensajeDeError(e)),
  });

  if (!gestionar) {
    return laboratorio.software_detalle.length ? (
      <TagGroup aria-label="Software instalado">
        {laboratorio.software_detalle.map((s) => (
          <Tag key={s.id} appearance="outline">
            {s.nombre_completo}
          </Tag>
        ))}
      </TagGroup>
    ) : (
      <EstadoVacio icono={<IconoElementos />} titulo="Sin software registrado" />
    );
  }

  const cambiado = [...seleccion].sort().join() !== [...laboratorio.software].sort().join();

  return (
    <div className={estilos.raiz}>
      <div className={estilos.columna}>
        <Body1>Marca los programas instalados. Al reservar, el sistema avisa si falta alguno.</Body1>
        <ListaSeleccion
          opciones={(catalogo.data ?? []).map((s) => ({
            id: s.id,
            etiqueta: s.nombre_completo,
            secundaria: `En ${s.total_laboratorios} laboratorio${s.total_laboratorios === 1 ? "" : "s"}`,
          }))}
          seleccionados={seleccion}
          onCambio={setSeleccion}
          placeholder="Buscar programa"
          alto={360}
        />
        <div className={estilos.acciones}>
          <Button appearance="primary" disabled={!cambiado || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending ? "Guardando…" : "Guardar"}
          </Button>
          {cambiado && <Button onClick={() => setSeleccion(laboratorio.software)}>Descartar</Button>}
        </div>
      </div>
      <form
        className={estilos.nuevo}
        onSubmit={(e) => {
          e.preventDefault();
          if (nombre.trim()) agregar.mutate();
        }}
      >
        <Caption1 className={estilos.secundario}>¿No está en la lista? Agrégalo al catálogo.</Caption1>
        <Field label="Programa">
          <Input value={nombre} placeholder="Ej.: AutoCAD" onChange={(_, d) => setNombre(d.value)} />
        </Field>
        <Field label="Versión">
          <Input value={version} placeholder="Ej.: 2026" onChange={(_, d) => setVersion(d.value)} />
        </Field>
        <Button type="submit" icon={<IconoAgregar />} disabled={!nombre.trim() || agregar.isPending}>
          Agregar al catálogo
        </Button>
      </form>
    </div>
  );
}
