/** Constructor dinámico (tabla pivote): elige entidad, dimensiones y medida. */
import { Body1, Button, Dropdown, Field, Option, Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import { EstadoError, EstadoVacio } from "../../components/feedback/Estados";
import { IconoConstructor } from "../../components/iconos/iconos";
import {
  type CuerpoPivote,
  type EntidadPivote,
  type Formato,
  cargarPivoteMeta,
  construirPivote,
  exportarPivote,
} from "./api";
import { FiltrosReporte } from "./FiltrosReporte";
import { MenuExportar } from "./MenuExportar";
import { ResultadoReporte } from "./ResultadoReporte";

const SIN_COLUMNAS = "";

const useEstilos = makeStyles({
  cabecera: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "12px",
  },
  selectores: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" },
  carga: { display: "flex", justifyContent: "center", padding: "48px" },
  ayuda: { color: tokens.colorNeutralForeground3, marginBottom: "12px" },
});

export function ConstructorPivote() {
  const estilos = useEstilos();
  const meta = useQuery({ queryKey: ["reportes", "pivote", "meta"], queryFn: cargarPivoteMeta });

  if (meta.isLoading) {
    return (
      <div className={estilos.carga}>
        <Spinner label="Cargando constructor…" />
      </div>
    );
  }
  if (meta.isError || !meta.data) {
    return <EstadoError error={meta.error} onReintentar={() => void meta.refetch()} />;
  }
  return <Formulario entidades={meta.data.entidades} opciones={meta.data.filtros} />;
}

function Formulario({
  entidades,
  opciones,
}: {
  entidades: EntidadPivote[];
  opciones: { laboratorios: { id: number; nombre: string }[]; periodos: { id: number; nombre: string; vigente: boolean }[] };
}) {
  const estilos = useEstilos();
  const [entidadId, setEntidadId] = useState(entidades[0]?.id ?? "");
  const entidad = useMemo(() => entidades.find((e) => e.id === entidadId) ?? entidades[0], [entidades, entidadId]);

  const [filas, setFilas] = useState(entidad?.dimensiones[0]?.id ?? "");
  const [columnas, setColumnas] = useState<string>(SIN_COLUMNAS);
  const [medida, setMedida] = useState(entidad?.medidas[0]?.id ?? "");
  const [valores, setValores] = useState<Record<string, string>>({});

  // Al cambiar de entidad, se reinician las dimensiones y la medida a las de esa entidad.
  useEffect(() => {
    setFilas(entidad?.dimensiones[0]?.id ?? "");
    setColumnas(SIN_COLUMNAS);
    setMedida(entidad?.medidas[0]?.id ?? "");
    setValores({});
  }, [entidad]);

  const cuerpo: CuerpoPivote = useMemo(
    () => ({
      entidad: entidadId,
      filas,
      columnas: columnas || null,
      medida,
      desde: valores.desde || undefined,
      hasta: valores.hasta || undefined,
      laboratorio: valores.laboratorio ? Number(valores.laboratorio) : null,
    }),
    [entidadId, filas, columnas, medida, valores],
  );

  const generar = useMutation({ mutationFn: () => construirPivote(cuerpo) });

  const etiquetaDim = (id: string) => entidad?.dimensiones.find((d) => d.id === id)?.label ?? "";
  const etiquetaMedida = (id: string) => entidad?.medidas.find((m) => m.id === id)?.label ?? "";

  if (!entidad) return null;

  return (
    <section>
      <div className={estilos.cabecera}>
        <div className={estilos.selectores}>
          <Field label="Datos de">
            <Dropdown
              value={entidad.label}
              selectedOptions={[entidadId]}
              onOptionSelect={(_, d) => setEntidadId(d.optionValue ?? entidadId)}
            >
              {entidades.map((e) => (
                <Option key={e.id} value={e.id}>
                  {e.label}
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Field label="Filas (agrupar por)">
            <Dropdown value={etiquetaDim(filas)} selectedOptions={[filas]} onOptionSelect={(_, d) => setFilas(d.optionValue ?? filas)}>
              {entidad.dimensiones.map((dim) => (
                <Option key={dim.id} value={dim.id}>
                  {dim.label}
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Field label="Columnas (opcional)">
            <Dropdown
              value={columnas ? etiquetaDim(columnas) : "Sin columnas"}
              selectedOptions={[columnas]}
              onOptionSelect={(_, d) => setColumnas(d.optionValue ?? SIN_COLUMNAS)}
            >
              <Option value={SIN_COLUMNAS}>Sin columnas</Option>
              {entidad.dimensiones
                .filter((dim) => dim.id !== filas)
                .map((dim) => (
                  <Option key={dim.id} value={dim.id}>
                    {dim.label}
                  </Option>
                ))}
            </Dropdown>
          </Field>

          <Field label="Medida">
            <Dropdown value={etiquetaMedida(medida)} selectedOptions={[medida]} onOptionSelect={(_, d) => setMedida(d.optionValue ?? medida)}>
              {entidad.medidas.map((m) => (
                <Option key={m.id} value={m.id}>
                  {m.label}
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Button appearance="primary" icon={<IconoConstructor />} onClick={() => generar.mutate()} disabled={generar.isPending}>
            {generar.isPending ? "Generando…" : "Generar"}
          </Button>
        </div>

        {generar.data && (
          <MenuExportar onExportar={(formato: Formato) => exportarPivote(cuerpo, formato)} />
        )}
      </div>

      {entidad.filtros.length > 0 && (
        <FiltrosReporte
          filtros={entidad.filtros}
          opciones={opciones}
          valores={valores}
          onCambiar={(clave, valor) => setValores((prev) => ({ ...prev, [clave]: valor }))}
        />
      )}

      {generar.isPending ? (
        <div className={estilos.carga}>
          <Spinner label="Generando…" />
        </div>
      ) : generar.isError ? (
        <Body1 role="alert">{mensajeDeError(generar.error)}</Body1>
      ) : generar.data ? (
        <ResultadoReporte datos={generar.data} />
      ) : (
        <EstadoVacio
          icono={<IconoConstructor />}
          titulo="Arma tu propio reporte"
          descripcion="Elige qué datos, cómo agruparlos y qué medir; luego pulsa Generar. Puedes exportarlo a PDF, Excel, CSV o Word."
        />
      )}
    </section>
  );
}
