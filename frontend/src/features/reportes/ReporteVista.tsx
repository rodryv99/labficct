import {
  Button,
  Caption1,
  Dropdown,
  Input,
  Option,
  Select,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { endOfMonth, startOfMonth } from "date-fns";
import { useState } from "react";
import { useNavigate } from "react-router";

import { mensajeDeError } from "../../api/errores";
import { EstadoError } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { IconoExcel, IconoInfo, IconoPdf, IconoRecargar, IconoVolver } from "../../components/iconos/iconos";
import { BarraFiltros, EncabezadoPagina } from "../../components/layout/EncabezadoPagina";
import { aISO, fechaHora, fechaNumerica } from "../../lib/fechas";
import {
  type ColumnaReporte,
  type DefinicionFiltro,
  type DefinicionReporte,
  type FilaReporte,
  type Formato,
  type SeccionReporte,
  type TipoColumna,
  type ValoresFiltros,
  descargarReporte,
  obtenerReporte,
} from "./api";

const useEstilos = makeStyles({
  dia: {
    width: "170px",
  },
  multiple: {
    minWidth: "220px",
  },
  espacio: {
    flex: 1,
  },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 16px",
    color: tokens.colorNeutralForeground3,
    marginBottom: "16px",
  },
  seccion: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "24px",
  },
  contenedor: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    overflowX: "auto",
  },
  encabezado: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
  // Fluent fija columnas de igual ancho; aquí cada columna toma el ancho de su contenido.
  tabla: {
    tableLayout: "auto",
    width: "100%",
  },
  celdaEncabezado: {
    verticalAlign: "bottom",
  },
  // Columnas numéricas centradas (título y valores), para que cada valor quede bajo su título.
  // El texto del encabezado va en un elemento interno con flex: se alinea ese elemento.
  encabezadoNumero: {
    justifyContent: "center",
    textAlign: "center",
  },
  numero: {
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  totales: {
    fontWeight: tokens.fontWeightSemibold,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  vacio: {
    color: tokens.colorNeutralForeground3,
  },
  notas: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    color: tokens.colorNeutralForeground3,
  },
  nota: {
    display: "flex",
    gap: "6px",
    alignItems: "flex-start",
  },
  actualizando: {
    opacity: 0.6,
  },
  esqueleto: {
    padding: "10px 12px",
  },
});

const NUMERICOS = new Set<TipoColumna>(["entero", "decimal", "porcentaje", "horas", "minutos"]);
const numero = (decimales: number) =>
  new Intl.NumberFormat("es-BO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
const FORMATO_NUMERO: Partial<Record<TipoColumna, Intl.NumberFormat>> = {
  entero: numero(0),
  decimal: numero(2),
  horas: numero(2),
  minutos: numero(1),
  porcentaje: numero(1),
};

/** Mismo formato que el PDF: "—" cuando no hay dato en una columna numérica o de fecha. */
function formatear(valor: FilaReporte[string] | undefined, tipo: TipoColumna): string {
  if (valor === undefined || valor === "") return "";
  if (valor === null) return tipo === "texto" ? "" : "—";
  if (tipo === "porcentaje") return `${FORMATO_NUMERO.porcentaje!.format(Number(valor) * 100)} %`;
  const formato = FORMATO_NUMERO[tipo];
  if (formato) return formato.format(Number(valor));
  if (tipo === "fecha") return fechaNumerica(String(valor));
  if (tipo === "fechahora") return fechaHora(String(valor));
  return String(valor);
}

function valoresIniciales(definicion: DefinicionReporte): ValoresFiltros {
  const hoy = new Date();
  const valores: ValoresFiltros = {};
  for (const f of definicion.filtros) {
    if (f.clave === "desde") valores.desde = aISO(startOfMonth(hoy));
    else if (f.clave === "hasta") valores.hasta = aISO(endOfMonth(hoy));
    else valores[f.clave] = f.multiple ? f.por_defecto : "";
  }
  return valores;
}

export function ReporteVista({ definicion }: { definicion: DefinicionReporte }) {
  const estilos = useEstilos();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const [borrador, setBorrador] = useState<ValoresFiltros>(() => valoresIniciales(definicion));
  // El reporte se genera con los filtros aplicados; cambiar un filtro no lo recalcula hasta pulsar "Generar".
  const [aplicados, setAplicados] = useState<ValoresFiltros>(borrador);
  const [descargando, setDescargando] = useState<Formato | null>(null);

  const consulta = useQuery({
    queryKey: ["reportes", definicion.codigo, aplicados],
    queryFn: () => obtenerReporte(definicion.codigo, aplicados),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const cambiar = (clave: string, valor: string | string[]) => setBorrador((v) => ({ ...v, [clave]: valor }));
  const pendiente = JSON.stringify(borrador) !== JSON.stringify(aplicados);

  const generar = () => {
    if (pendiente) setAplicados(borrador);
    else consulta.refetch();
  };

  const descargar = async (formato: Formato) => {
    setDescargando(formato);
    try {
      // Se descarga lo que se ve en pantalla: con los filtros aplicados.
      await descargarReporte(definicion.codigo, aplicados, formato);
    } catch (error) {
      notificar.error("No se pudo descargar el reporte", mensajeDeError(error));
    } finally {
      setDescargando(null);
    }
  };

  const reporte = consulta.data;
  const sinDatos = !reporte || consulta.isError;

  return (
    <>
      <EncabezadoPagina
        seccion="Análisis · Reportes"
        titulo={definicion.titulo}
        descripcion={definicion.descripcion}
        acciones={
          <>
            <Button appearance="subtle" icon={<IconoVolver />} onClick={() => navegar("/reportes")}>
              Reportes
            </Button>
            <Button
              icon={<IconoExcel />}
              disabled={sinDatos || pendiente || descargando !== null}
              onClick={() => descargar("xlsx")}
            >
              {descargando === "xlsx" ? "Preparando…" : "Excel"}
            </Button>
            <Button
              icon={<IconoPdf />}
              disabled={sinDatos || pendiente || descargando !== null}
              onClick={() => descargar("pdf")}
            >
              {descargando === "pdf" ? "Preparando…" : "PDF"}
            </Button>
          </>
        }
      />

      <BarraFiltros>
        {definicion.filtros.map((f) => (
          <CampoFiltro key={f.clave} filtro={f} valores={borrador} onCambiar={cambiar} />
        ))}
        <span className={estilos.espacio} />
        <Button
          appearance={pendiente ? "primary" : "secondary"}
          icon={<IconoRecargar />}
          disabled={consulta.isFetching}
          onClick={generar}
        >
          {consulta.isFetching ? "Generando…" : "Generar"}
        </Button>
      </BarraFiltros>

      {consulta.isError ? (
        <div className={estilos.contenedor}>
          <EstadoError error={consulta.error} onReintentar={() => consulta.refetch()} />
        </div>
      ) : !reporte ? (
        <Cargando />
      ) : (
        <div className={consulta.isFetching ? estilos.actualizando : undefined}>
          <div className={estilos.meta}>
            <Caption1>
              Generado el {fechaHora(reporte.generado_en)} por {reporte.generado_por}
            </Caption1>
            <Caption1>{reporte.filtros.map((f) => `${f.etiqueta}: ${f.texto}`).join(" · ")}</Caption1>
          </div>
          {reporte.secciones.map((s) => (
            <Seccion key={s.titulo} seccion={s} />
          ))}
          {reporte.notas.length > 0 && (
            <div className={estilos.notas}>
              {reporte.notas.map((n) => (
                <Caption1 key={n} className={estilos.nota}>
                  <IconoInfo />
                  {n}
                </Caption1>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

interface CampoProps {
  filtro: DefinicionFiltro;
  valores: ValoresFiltros;
  onCambiar: (clave: string, valor: string | string[]) => void;
}

function CampoFiltro({ filtro, valores, onCambiar }: CampoProps) {
  const estilos = useEstilos();
  const valor = valores[filtro.clave];

  if (filtro.tipo === "fecha") {
    const esDesde = filtro.clave === "desde";
    return (
      <Input
        className={estilos.dia}
        type="date"
        aria-label={filtro.etiqueta}
        contentBefore={<Caption1>{filtro.etiqueta}</Caption1>}
        value={String(valor ?? "")}
        max={esDesde ? String(valores.hasta || "") || undefined : undefined}
        min={esDesde ? undefined : String(valores.desde || "") || undefined}
        onChange={(_, d) => onCambiar(filtro.clave, d.value)}
      />
    );
  }

  if (filtro.multiple) {
    const elegidos = Array.isArray(valor) ? valor : [];
    const texto = filtro.opciones
      .filter((o) => elegidos.includes(String(o.valor)))
      .map((o) => o.etiqueta)
      .join(", ");
    return (
      <Dropdown
        className={estilos.multiple}
        multiselect
        aria-label={filtro.etiqueta}
        placeholder={`${filtro.etiqueta}: todas`}
        value={texto}
        selectedOptions={elegidos}
        onOptionSelect={(_, d) => onCambiar(filtro.clave, d.selectedOptions)}
      >
        {filtro.opciones.map((o) => (
          <Option key={o.valor} value={String(o.valor)}>
            {o.etiqueta}
          </Option>
        ))}
      </Dropdown>
    );
  }

  const todos = filtro.tipo === "laboratorio" ? "Todos los laboratorios" : `${filtro.etiqueta}: todos`;
  return (
    <Select aria-label={filtro.etiqueta} value={String(valor ?? "")} onChange={(_, d) => onCambiar(filtro.clave, d.value)}>
      <option value="">{todos}</option>
      {filtro.opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </Select>
  );
}

function Seccion({ seccion }: { seccion: SeccionReporte }) {
  const estilos = useEstilos();
  const celda = (fila: FilaReporte, c: ColumnaReporte) => (
    <TableCell key={c.clave} className={NUMERICOS.has(c.tipo) ? estilos.numero : undefined}>
      {formatear(fila[c.clave], c.tipo)}
    </TableCell>
  );

  return (
    <section className={estilos.seccion}>
      <Subtitle2 as="h2">{seccion.titulo}</Subtitle2>
      <div className={estilos.contenedor}>
        <Table aria-label={seccion.titulo} size="small" className={estilos.tabla}>
          <TableHeader className={estilos.encabezado}>
            <TableRow>
              {seccion.columnas.map((c) => (
                <TableHeaderCell
                  key={c.clave}
                  className={estilos.celdaEncabezado}
                  button={NUMERICOS.has(c.tipo) ? { className: estilos.encabezadoNumero } : undefined}
                >
                  {c.titulo}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {seccion.filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={seccion.columnas.length} className={estilos.vacio}>
                  Sin datos para estos filtros.
                </TableCell>
              </TableRow>
            ) : (
              seccion.filas.map((fila, i) => <TableRow key={i}>{seccion.columnas.map((c) => celda(fila, c))}</TableRow>)
            )}
            {seccion.totales && (
              <TableRow className={estilos.totales}>
                {seccion.columnas.map((c) => celda(seccion.totales!, c))}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function Cargando() {
  const estilos = useEstilos();
  return (
    <div className={estilos.contenedor}>
      <Skeleton aria-label="Generando el reporte">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={estilos.esqueleto}>
            <SkeletonItem size={16} />
          </div>
        ))}
      </Skeleton>
    </div>
  );
}
