import {
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Select,
  Spinner,
  Switch,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoError, IconoExito, IconoImportar } from "../../components/iconos/iconos";
import {
  CAMPOS_IMPORTABLES,
  type ResultadoImportacion,
  importarActivos,
  listarLugares,
} from "./api";

const useEstilos = makeStyles({
  zona: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "32px",
    textAlign: "center",
    borderRadius: tokens.borderRadiusLarge,
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  zonaActiva: {
    borderColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
  seccion: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  tituloSeccion: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  resumen: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  tarjeta: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: "92px",
    padding: "10px 14px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  numero: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
  },
  columna: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)",
    gap: "10px",
    alignItems: "start",
    padding: "8px 0",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  muestra: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tituloColumna: {
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tablaEnvoltura: {
    overflowX: "auto",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  tabla: {
    borderCollapse: "collapse",
    width: "100%",
    fontSize: tokens.fontSizeBase200,
    whiteSpace: "nowrap",
  },
  th: {
    textAlign: "left",
    padding: "6px 10px",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    position: "sticky",
    top: 0,
  },
  td: {
    padding: "6px 10px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  lista: {
    margin: "4px 0 0",
    paddingLeft: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  exito: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "28px",
    textAlign: "center",
  },
});

const ACEPTA = ".xlsx,.xlsm,.csv,.txt,.pdf";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

/** Importar muchos activos de una planilla: subir, revisar lo detectado y confirmar. */
export function ImportarActivosPanel({ abierto, onCerrar }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement | null>(null);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<ResultadoImportacion | null>(null);
  const [mapeo, setMapeo] = useState<string[]>([]);
  const [titulos, setTitulos] = useState<"auto" | "si" | "no">("auto");
  const [lugarDefecto, setLugarDefecto] = useState<number | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [hecho, setHecho] = useState<ResultadoImportacion | null>(null);

  const lugares = useQuery({
    queryKey: ["inventario", "lugares"],
    queryFn: listarLugares,
    enabled: abierto,
  });

  const reiniciar = () => {
    setArchivo(null);
    setPreview(null);
    setMapeo([]);
    setTitulos("auto");
    setLugarDefecto(null);
    setHecho(null);
    if (entrada.current) entrada.current.value = "";
  };

  const cerrar = () => {
    reiniciar();
    onCerrar();
  };

  // Analiza el archivo (sin guardar) y actualiza la vista previa.
  const analizar = useMutation({
    mutationFn: (v: {
      file: File;
      titulos: "auto" | "si" | "no";
      mapeo: string[] | null;
      lugar: number | null;
    }) => importarActivos(v.file, { confirmar: false, titulos: v.titulos, mapeo: v.mapeo, lugar_por_defecto: v.lugar }),
    onSuccess: (res, v) => {
      setPreview(res);
      if (v.mapeo === null) setMapeo(res.columnas.map((c) => c.campo));
    },
    onError: (e) => {
      setPreview(null);
      notificar.error("No se pudo leer el archivo", mensajeDeError(e));
    },
  });

  const confirmar = useMutation({
    mutationFn: () =>
      importarActivos(archivo!, { confirmar: true, titulos, mapeo, lugar_por_defecto: lugarDefecto }),
    onSuccess: (res) => {
      setHecho(res);
      void queryClient.invalidateQueries({ queryKey: ["inventario"] });
      notificar.exito(
        `${res.creados} ${res.creados === 1 ? "activo importado" : "activos importados"}`,
        res.omitidos_total ? `${res.omitidos_total} repetidos se omitieron.` : undefined,
      );
    },
    onError: (e) => notificar.error("No se pudo importar", mensajeDeError(e)),
  });

  const tomarArchivo = (file: File | undefined) => {
    if (!file) return;
    reiniciar();
    setArchivo(file);
    analizar.mutate({ file, titulos: "auto", mapeo: null, lugar: null });
  };

  const reanalizar = (cambio: { titulos?: "auto" | "si" | "no"; mapeo?: string[]; lugar?: number | null }) => {
    if (!archivo) return;
    const t = cambio.titulos ?? titulos;
    const m = cambio.mapeo ?? mapeo;
    const l = cambio.lugar !== undefined ? cambio.lugar : lugarDefecto;
    analizar.mutate({ file: archivo, titulos: t, mapeo: m, lugar: l });
  };

  const cambiarColumna = (indice: number, campo: string) => {
    const nuevo = mapeo.length ? [...mapeo] : preview!.columnas.map((c) => c.campo);
    nuevo[indice] = campo;
    setMapeo(nuevo);
    reanalizar({ mapeo: nuevo });
  };

  const cambiarTitulos = (primeraEsTitulo: boolean) => {
    const t = primeraEsTitulo ? "si" : "no";
    setTitulos(t);
    reanalizar({ titulos: t });
  };

  const cambiarLugarDefecto = (id: number | null) => {
    setLugarDefecto(id);
    reanalizar({ lugar: id });
  };

  const usados = new Set(mapeo.filter(Boolean));
  const faltaLugar = Boolean(preview?.faltan.includes("Lugar"));
  const lugaresActivos = (lugares.data ?? []).filter((l) => l.activo);
  const puedeImportar = Boolean(preview && preview.faltan.length === 0 && preview.validas > 0);
  const cargando = analizar.isPending;
  const primeraEsTitulo = titulos === "auto" ? Boolean(preview?.con_titulos) : titulos === "si";

  return (
    <PanelFormulario
      abierto={abierto}
      tamano="large"
      titulo="Importar activos"
      subtitulo="Sube un Excel, un CSV o un PDF (incluido el formato de patrimonio de la UAGRM). Reconozco las columnas por su título o por lo que contienen; revisa y confirma."
      onCerrar={cerrar}
      hayCambios={Boolean(archivo) && !hecho && !confirmar.isPending}
      pie={
        hecho ? (
          <Button appearance="primary" onClick={cerrar}>
            Listo
          </Button>
        ) : preview ? (
          <>
            <Button
              appearance="primary"
              disabled={!puedeImportar || confirmar.isPending || cargando}
              onClick={() => confirmar.mutate()}
            >
              {confirmar.isPending
                ? "Importando…"
                : preview.validas > 0
                  ? `Importar ${preview.validas} ${preview.validas === 1 ? "activo" : "activos"}`
                  : "Importar"}
            </Button>
            <Button onClick={reiniciar}>Elegir otro archivo</Button>
            <Button appearance="subtle" onClick={cerrar}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button onClick={cerrar}>Cancelar</Button>
        )
      }
    >
      <input
        ref={entrada}
        type="file"
        accept={ACEPTA}
        style={{ display: "none" }}
        onChange={(e) => tomarArchivo(e.target.files?.[0])}
      />

      {hecho ? (
        <div className={estilos.exito}>
          <IconoExito style={{ fontSize: "40px", color: tokens.colorStatusSuccessForeground1 }} />
          <Body1Strong>
            {hecho.creados} {hecho.creados === 1 ? "activo importado" : "activos importados"}
          </Body1Strong>
          <Body1>
            {[
              hecho.omitidos_total ? `${hecho.omitidos_total} repetidos (se omitieron)` : "",
              hecho.con_error ? `${hecho.con_error} con error (no se importaron)` : "",
            ]
              .filter(Boolean)
              .join(" · ") || "Todo salió bien."}
          </Body1>
        </div>
      ) : !archivo ? (
        <div
          className={`${estilos.zona} ${arrastrando ? estilos.zonaActiva : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            tomarArchivo(e.dataTransfer.files?.[0]);
          }}
        >
          <IconoImportar style={{ fontSize: "32px", color: tokens.colorNeutralForeground3 }} />
          <Body1Strong>Arrastra aquí tu planilla o PDF</Body1Strong>
          <Caption1>Excel (.xlsx), CSV o PDF. Hasta 5000 filas.</Caption1>
          <Button appearance="primary" onClick={() => entrada.current?.click()}>
            Elegir archivo
          </Button>
          <Caption1>
            Pon una fila de títulos como «Código» (o «Activo»), «Descripción», «Ubicación», «Tipo» (o «Grupo»),
            «Estado» o «Responsable». Los lugares y tipos que no existan se crean solos.
          </Caption1>
        </div>
      ) : (
        <>
          <Caption1>
            Archivo: <b>{archivo.name}</b>
          </Caption1>

          {cargando && !preview && <Spinner label="Leyendo el archivo…" />}

          {preview && (
            <>
              <div className={estilos.resumen}>
                <div className={estilos.tarjeta}>
                  <span className={estilos.numero}>{preview.validas}</span>
                  <Caption1>se importarán</Caption1>
                </div>
                {preview.existentes > 0 && (
                  <div className={estilos.tarjeta}>
                    <span className={estilos.numero}>{preview.existentes}</span>
                    <Caption1>ya están</Caption1>
                  </div>
                )}
                {preview.con_error > 0 && (
                  <div className={estilos.tarjeta}>
                    <span className={estilos.numero}>{preview.con_error}</span>
                    <Caption1>con error</Caption1>
                  </div>
                )}
                <div className={estilos.tarjeta}>
                  <span className={estilos.numero}>{preview.total}</span>
                  <Caption1>filas en total</Caption1>
                </div>
              </div>

              {preview.faltan.length > 0 && (
                <MessageBar intent="error">
                  <MessageBarBody>
                    <MessageBarTitle>Falta decir qué columna es: {preview.faltan.join(", ")}</MessageBarTitle>
                    Elige la columna correcta abajo
                    {faltaLugar ? ", o indica un lugar para las filas que no lo traigan." : "."}
                  </MessageBarBody>
                </MessageBar>
              )}

              <Switch
                label="La primera fila son los títulos de las columnas"
                checked={primeraEsTitulo}
                onChange={(_, d) => cambiarTitulos(d.checked)}
              />

              <div className={estilos.seccion}>
                <Caption1 className={estilos.tituloSeccion}>Qué es cada columna</Caption1>
                {preview.columnas.map((col) => (
                  <div key={col.indice} className={estilos.columna}>
                    <div>
                      <Select
                        value={mapeo[col.indice] ?? ""}
                        onChange={(_, d) => cambiarColumna(col.indice, d.value)}
                      >
                        <option value="">— No importar —</option>
                        {CAMPOS_IMPORTABLES.map((c) => (
                          <option
                            key={c.valor}
                            value={c.valor}
                            disabled={usados.has(c.valor) && mapeo[col.indice] !== c.valor}
                          >
                            {c.etiqueta}
                          </option>
                        ))}
                      </Select>
                      <div className={estilos.tituloColumna}>
                        {col.titulo || `Columna ${col.indice + 1}`}
                      </div>
                    </div>
                    <Caption1 className={estilos.muestra}>
                      {col.muestra.length ? col.muestra.join(" · ") : "—"}
                    </Caption1>
                  </div>
                ))}
              </div>

              <Field
                label="Lugar para las filas sin lugar"
                hint={
                  faltaLugar
                    ? "La planilla no trae una columna de lugar: elige dónde quedan todos."
                    : "Opcional. Se usa solo en las filas cuyo lugar quede vacío."
                }
              >
                <Select
                  value={lugarDefecto ? String(lugarDefecto) : ""}
                  onChange={(_, d) => cambiarLugarDefecto(d.value ? Number(d.value) : null)}
                >
                  <option value="">Sin lugar por defecto</option>
                  {lugaresActivos.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </Select>
              </Field>

              {preview.avisos.length > 0 && (
                <MessageBar intent="info">
                  <MessageBarBody>
                    <ul className={estilos.lista}>
                      {preview.avisos.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </MessageBarBody>
                </MessageBar>
              )}

              {preview.errores.length > 0 && (
                <MessageBar intent="warning">
                  <MessageBarBody>
                    <MessageBarTitle>
                      {preview.con_error} {preview.con_error === 1 ? "fila con error" : "filas con error"} (se omiten)
                    </MessageBarTitle>
                    <ul className={estilos.lista}>
                      {preview.errores.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </MessageBarBody>
                </MessageBar>
              )}

              {preview.omitidos.length > 0 && (
                <MessageBar intent="info">
                  <MessageBarBody>
                    <MessageBarTitle>
                      {preview.omitidos_total}{" "}
                      {preview.omitidos_total === 1 ? "código repetido (se omite)" : "códigos repetidos (se omiten)"}
                    </MessageBarTitle>
                    <ul className={estilos.lista}>
                      {preview.omitidos.map((o, i) => (
                        <li key={`${o.codigo}-${i}`}>
                          {o.codigo} — {o.motivo}
                        </li>
                      ))}
                    </ul>
                    {preview.omitidos_total > preview.omitidos.length && (
                      <Caption1>…y {preview.omitidos_total - preview.omitidos.length} más.</Caption1>
                    )}
                  </MessageBarBody>
                </MessageBar>
              )}

              {preview.ejemplo.length > 0 && (
                <div className={estilos.seccion}>
                  <Caption1 className={estilos.tituloSeccion}>
                    Así quedarían (primeras {preview.ejemplo.length})
                  </Caption1>
                  <div className={estilos.tablaEnvoltura}>
                    <table className={estilos.tabla}>
                      <thead>
                        <tr>
                          {CAMPOS_IMPORTABLES.map((c) => (
                            <th key={c.valor} className={estilos.th}>
                              {c.etiqueta}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.ejemplo.map((fila, i) => (
                          <tr key={i}>
                            {CAMPOS_IMPORTABLES.map((c) => (
                              <td key={c.valor} className={estilos.td}>
                                {fila[c.valor as keyof typeof fila] || ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {preview.validas === 0 && preview.faltan.length === 0 && (
                <MessageBar intent="warning">
                  <MessageBarBody>
                    <IconoError /> No hay filas nuevas para importar en este archivo.
                  </MessageBarBody>
                </MessageBar>
              )}
            </>
          )}
        </>
      )}
    </PanelFormulario>
  );
}
