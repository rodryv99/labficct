import {
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Select,
  Subtitle2,
  ToggleButton,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { type PointerEvent as EventoPuntero, useEffect, useMemo, useRef, useState } from "react";

import type {
  AtributoMapa,
  CeldaMapa,
  IconoElemento as TipoIcono,
  MapaBitacora,
  MarcaMapa,
} from "../../api/tipos";
import {
  IconoAcercar,
  IconoAlejar,
  IconoBorrador,
  IconoEditar,
  IconoMano,
  IconoPantallaCompleta,
  IconoPincel,
  IconoSalirPantalla,
} from "../../components/iconos/iconos";
import { IconoElemento } from "../../components/iconos/IconoElemento";
import { MAX_ATRIBUTOS, PALETA_MAPA } from "./api";

const LADO = 64;
const ESPACIO = 6;
const ZOOMS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 2];

const ESTADOS: Record<string, string> = {
  operativo: "Operativo",
  con_falla: "Con falla",
  mantenimiento: "En mantenimiento",
  baja: "De baja",
};

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
  barra: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
  },
  separador: {
    width: "1px",
    alignSelf: "stretch",
    margin: "0 4px",
    backgroundColor: tokens.colorNeutralStroke2,
  },
  espacio: {
    flex: 1,
  },
  zoom: {
    minWidth: "44px",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    color: tokens.colorNeutralForeground3,
  },
  atributos: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  atributo: {
    display: "flex",
    alignItems: "stretch",
    borderRadius: tokens.borderRadiusLarge,
    border: `2px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: "hidden",
  },
  atributoActivo: {
    border: `2px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  // Toda esta zona es el botón para elegir el atributo: grande, para no tener que apuntar.
  zonaElegir: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: "150px",
    minHeight: "48px",
    padding: "6px 10px 6px 8px",
    border: "none",
    background: "none",
    color: tokens.colorNeutralForeground1,
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase300,
    textAlign: "left",
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `2px solid ${tokens.colorBrandStroke1}`, outlineOffset: "-2px" },
  },
  muestra: {
    width: "28px",
    height: "28px",
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  nombreAtributo: {
    flex: 1,
    minWidth: 0,
    maxWidth: "150px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontWeight: tokens.fontWeightSemibold,
  },
  conteoAtributo: {
    color: tokens.colorNeutralForeground3,
    fontVariantNumeric: "tabular-nums",
  },
  botonEditar: {
    alignSelf: "center",
    marginRight: "4px",
    flexShrink: 0,
  },
  edicion: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: "220px",
  },
  selectorColor: {
    width: "100%",
    height: "40px",
    padding: 0,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    background: "none",
  },
  leyenda: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 16px",
  },
  itemLeyenda: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  cuadrito: {
    width: "16px",
    height: "16px",
    borderRadius: "4px",
    flexShrink: 0,
  },
  sinMarcar: {
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  marco: {
    overflow: "auto",
    maxHeight: "62vh",
    padding: "12px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    userSelect: "none",
  },
  // En pantalla completa el lienzo ocupa todo el alto disponible.
  marcoGrande: {
    flex: 1,
    minHeight: 0,
    maxHeight: "none",
  },
  surfaceCompleta: {
    width: "96vw",
    maxWidth: "96vw",
    height: "94vh",
    maxHeight: "94vh",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  encabezadoCompleta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  cuerpoCompleta: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  avisoCompleta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "16px",
    borderRadius: tokens.borderRadiusLarge,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground3,
  },
  grilla: {
    display: "grid",
    width: "max-content",
    margin: "0 auto",
  },
  celda: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    borderRadius: tokens.borderRadiusMedium,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 1.1,
  },
  vacia: {
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
  },
  elemento: {
    borderStyle: "solid",
    borderWidth: "3px",
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    cursor: "pointer",
  },
  etiqueta: {
    fontWeight: tokens.fontWeightBold,
    maxWidth: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    padding: "0 3px",
  },
  icono: {
    flexShrink: 0,
    display: "flex",
  },
  ficha: {
    display: "grid",
    gridTemplateColumns: "130px minmax(0, 1fr)",
    gap: "6px 12px",
  },
  clave: {
    color: tokens.colorNeutralForeground3,
  },
  valor: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  notaFicha: {
    marginTop: "12px",
    color: tokens.colorNeutralForeground3,
  },
  vacioTexto: {
    color: tokens.colorNeutralForeground4,
    fontStyle: "italic",
  },
});

type Herramienta = "pintar" | "borrar" | "mano";

/** Texto oscuro o claro según el color de fondo, para que se lea la etiqueta. */
function tintaSobre(color: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return "inherit";
  const [r = 0, g = 0, b = 0] = [m[1], m[2], m[3]].map((h) => parseInt(h ?? "0", 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111827" : "#ffffff";
}

const clave = (fila: number, columna: number) => `${fila},${columna}`;

interface Props {
  /** De aquí salen la grilla y los elementos (la copia guardada o la plantilla del laboratorio). */
  mapa: MapaBitacora;
  atributos: AtributoMapa[];
  marcas: MarcaMapa[];
  /** Sin esto, el mapa es de solo lectura. */
  onCambiar?: (atributos: AtributoMapa[], marcas: MarcaMapa[]) => void;
}

/**
 * Mapa de la bitácora al estilo OrganiLab: se elige un atributo (p. ej. "Con falla") y se
 * tocan los elementos para pintarlos con su color. Mano para moverse, zoom, borrador, y
 * doble clic en un elemento para ver su ficha (solo lectura).
 */
export function MapaBitacora({ mapa, atributos, marcas, onCambiar }: Props) {
  const estilos = useEstilos();
  const editable = onCambiar !== undefined;
  const [herramienta, setHerramienta] = useState<Herramienta>(editable ? "pintar" : "mano");
  const [activo, setActivo] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [ficha, setFicha] = useState<CeldaMapa | null>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const marco = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; y: number; izquierda: number; arriba: number } | null>(null);
  const pintando = useRef(false);

  const celdas = useMemo(() => new Map(mapa.celdas.map((c) => [clave(c.fila, c.columna), c])), [mapa.celdas]);
  const pintadas = useMemo(() => new Map(marcas.map((m) => [clave(m.fila, m.columna), m.atributo])), [marcas]);
  // Lo más reciente, para pintar varias casillas seguidas en un mismo arrastre.
  const actual = useRef({ atributos, pintadas });
  actual.current = { atributos, pintadas };

  useEffect(() => {
    if (activo >= atributos.length) setActivo(Math.max(0, atributos.length - 1));
  }, [activo, atributos.length]);

  useEffect(() => {
    const soltar = () => {
      pintando.current = false;
      arrastre.current = null;
    };
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => {
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
  }, []);

  const conteo = useMemo(() => {
    const n = atributos.map(() => 0);
    pintadas.forEach((a) => {
      if (a < n.length) n[a] += 1;
    });
    return n;
  }, [atributos, pintadas]);
  const sinMarcar = mapa.celdas.length - [...pintadas.keys()].filter((k) => celdas.has(k)).length;

  const aplicar = (k: string) => {
    if (!onCambiar || !celdas.has(k)) return;
    const { atributos: lista, pintadas: mapaActual } = actual.current;
    const nuevo = new Map(mapaActual);
    if (herramienta === "borrar") {
      if (!nuevo.has(k)) return;
      nuevo.delete(k);
    } else {
      if (nuevo.get(k) === activo) return;
      nuevo.set(k, activo);
    }
    actual.current = { atributos: lista, pintadas: nuevo };
    onCambiar(
      lista,
      [...nuevo.entries()].map(([kk, atributo]) => {
        const [fila, columna] = kk.split(",").map(Number);
        return { fila, columna, atributo };
      }),
    );
  };

  const casillaBajo = (e: EventoPuntero) =>
    document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-casilla]")?.getAttribute("data-casilla") ?? null;

  const alPresionar = (e: EventoPuntero<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (herramienta === "mano" || !editable) {
      const m = marco.current;
      if (m) arrastre.current = { x: e.clientX, y: e.clientY, izquierda: m.scrollLeft, arriba: m.scrollTop };
      return;
    }
    const k = casillaBajo(e);
    if (k) {
      pintando.current = true;
      aplicar(k);
    }
  };

  const alMover = (e: EventoPuntero<HTMLDivElement>) => {
    if (arrastre.current && marco.current) {
      marco.current.scrollLeft = arrastre.current.izquierda - (e.clientX - arrastre.current.x);
      marco.current.scrollTop = arrastre.current.arriba - (e.clientY - arrastre.current.y);
      return;
    }
    if (pintando.current) {
      const k = casillaBajo(e);
      if (k) aplicar(k);
    }
  };

  // ── Atributos ──
  const cambiarCantidad = (n: number) => {
    if (!onCambiar) return;
    const lista = Array.from(
      { length: n },
      (_, i) =>
        atributos[i] ?? { nombre: `Atributo ${i + 1}`, color: PALETA_MAPA[i % PALETA_MAPA.length] ?? "#7F8C8D" },
    );
    onCambiar(
      lista,
      marcas.filter((m) => m.atributo < n),
    );
  };
  const editarAtributo = (i: number, cambio: Partial<AtributoMapa>) =>
    onCambiar?.(
      atributos.map((a, j) => (j === i ? { ...a, ...cambio } : a)),
      marcas,
    );

  const nombreMarca = (c: CeldaMapa) => {
    const a = pintadas.get(clave(c.fila, c.columna));
    return a === undefined ? "Sin marcar" : (atributos[a]?.nombre ?? "");
  };

  const lado = Math.round(LADO * zoom);
  const espacio = Math.max(2, Math.round(ESPACIO * zoom));
  const indiceZoom = ZOOMS.indexOf(zoom);
  const tamanoIcono = Math.max(12, Math.round(24 * zoom));

  const panel = (
    <>
      <div className={estilos.barra}>
        {editable && (
          <>
            <Tooltip content="Pintar con el atributo elegido" relationship="label">
              <ToggleButton
                icon={<IconoPincel />}
                checked={herramienta === "pintar"}
                onClick={() => setHerramienta("pintar")}
              >
                Pintar
              </ToggleButton>
            </Tooltip>
            <Tooltip content="Quitar el color" relationship="label">
              <ToggleButton
                icon={<IconoBorrador />}
                checked={herramienta === "borrar"}
                onClick={() => setHerramienta("borrar")}
              >
                Borrar
              </ToggleButton>
            </Tooltip>
            <Tooltip content="Mover el mapa" relationship="label">
              <ToggleButton icon={<IconoMano />} checked={herramienta === "mano"} onClick={() => setHerramienta("mano")} />
            </Tooltip>
            <span className={estilos.separador} aria-hidden />
          </>
        )}
        <Tooltip content="Alejar" relationship="label">
          <Button
            appearance="subtle"
            icon={<IconoAlejar />}
            disabled={indiceZoom <= 0}
            onClick={() => setZoom(ZOOMS[Math.max(0, indiceZoom - 1)] ?? 1)}
          />
        </Tooltip>
        <Caption1 className={estilos.zoom}>{Math.round(zoom * 100)} %</Caption1>
        <Tooltip content="Acercar" relationship="label">
          <Button
            appearance="subtle"
            icon={<IconoAcercar />}
            disabled={indiceZoom >= ZOOMS.length - 1}
            onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, indiceZoom + 1)] ?? 1)}
          />
        </Tooltip>
        {!pantallaCompleta && (
          <>
            <span className={estilos.separador} aria-hidden />
            <Tooltip content="Ver en pantalla completa" relationship="label">
              <Button
                appearance="subtle"
                icon={<IconoPantallaCompleta />}
                aria-label="Ver en pantalla completa"
                onClick={() => setPantallaCompleta(true)}
              />
            </Tooltip>
          </>
        )}
        <span className={estilos.espacio} />
        {editable && (
          <Select
            aria-label="Cantidad de atributos"
            value={String(atributos.length)}
            onChange={(_, d) => cambiarCantidad(Number(d.value))}
          >
            {Array.from({ length: MAX_ATRIBUTOS }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} {i === 0 ? "atributo" : "atributos"}
              </option>
            ))}
          </Select>
        )}
      </div>

      {editable ? (
        <div className={estilos.atributos} role="radiogroup" aria-label="Atributo para pintar">
          {atributos.map((a, i) => (
            <div key={i} className={mergeClasses(estilos.atributo, activo === i && estilos.atributoActivo)}>
              <button
                type="button"
                role="radio"
                aria-checked={activo === i}
                className={estilos.zonaElegir}
                onClick={() => {
                  setActivo(i);
                  setHerramienta("pintar");
                }}
              >
                <span className={estilos.muestra} style={{ backgroundColor: a.color }} />
                <span className={estilos.nombreAtributo}>{a.nombre || `Atributo ${i + 1}`}</span>
                <Caption1 className={estilos.conteoAtributo}>{conteo[i]}</Caption1>
              </button>
              <Popover positioning="below-end" trapFocus>
                <PopoverTrigger disableButtonEnhancement>
                  <Tooltip content="Cambiar nombre o color" relationship="label">
                    <Button
                      className={estilos.botonEditar}
                      appearance="subtle"
                      size="small"
                      icon={<IconoEditar />}
                      aria-label={`Editar ${a.nombre}`}
                    />
                  </Tooltip>
                </PopoverTrigger>
                <PopoverSurface>
                  <div className={estilos.edicion}>
                    <Caption1>Nombre</Caption1>
                    <Input
                      aria-label={`Nombre del atributo ${i + 1}`}
                      value={a.nombre}
                      maxLength={40}
                      onChange={(_, d) => editarAtributo(i, { nombre: d.value })}
                    />
                    <Caption1>Color</Caption1>
                    <input
                      type="color"
                      className={estilos.selectorColor}
                      aria-label={`Color de ${a.nombre}`}
                      value={a.color.toLowerCase()}
                      onChange={(e) => editarAtributo(i, { color: e.target.value.toUpperCase() })}
                    />
                  </div>
                </PopoverSurface>
              </Popover>
            </div>
          ))}
        </div>
      ) : (
        <div className={estilos.leyenda}>
          {atributos.map((a, i) => (
            <span key={i} className={estilos.itemLeyenda}>
              <span className={estilos.cuadrito} style={{ backgroundColor: a.color }} />
              <Body1>
                {a.nombre} ({conteo[i]})
              </Body1>
            </span>
          ))}
          {sinMarcar > 0 && (
            <span className={estilos.itemLeyenda}>
              <span className={mergeClasses(estilos.cuadrito, estilos.sinMarcar)} />
              <Body1>Sin marcar ({sinMarcar})</Body1>
            </span>
          )}
        </div>
      )}

      <div
        ref={marco}
        className={mergeClasses(estilos.marco, pantallaCompleta && estilos.marcoGrande)}
        style={{
          cursor: herramienta === "mano" || !editable ? "grab" : "crosshair",
          touchAction: editable && herramienta !== "mano" ? "none" : "auto",
        }}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
      >
        <div
          className={estilos.grilla}
          style={{
            gridTemplateColumns: `repeat(${mapa.columnas}, ${lado}px)`,
            gridAutoRows: `${lado}px`,
            gap: `${espacio}px`,
          }}
        >
          {Array.from({ length: mapa.filas * mapa.columnas }, (_, i) => {
            const fila = Math.floor(i / mapa.columnas);
            const columna = i % mapa.columnas;
            const k = clave(fila, columna);
            const c = celdas.get(k);
            if (!c) return <div key={k} className={mergeClasses(estilos.celda, estilos.vacia)} />;
            const atributo = pintadas.get(k);
            const fondo = atributo !== undefined ? atributos[atributo]?.color : undefined;
            return (
              <div
                key={k}
                data-casilla={k}
                title={`${c.etiqueta || c.tipo_nombre}${fondo ? ` · ${atributos[atributo!].nombre}` : ""}`}
                className={mergeClasses(estilos.celda, estilos.elemento)}
                style={{
                  borderColor: c.color || tokens.colorNeutralStroke1,
                  ...(fondo ? { backgroundColor: fondo, color: tintaSobre(fondo) } : {}),
                  fontSize: `${Math.max(9, Math.round(13 * zoom))}px`,
                }}
                onDoubleClick={() => setFicha(c)}
                onClick={() => {
                  if (!editable) setFicha(c);
                }}
              >
                <span className={estilos.icono}>
                  <IconoElemento
                    icono={(c.icono || "generico") as TipoIcono}
                    tamano={tamanoIcono}
                    color={fondo ? "currentColor" : c.color || "currentColor"}
                  />
                </span>
                <span className={estilos.etiqueta}>{c.etiqueta || c.tipo_nombre}</span>
              </div>
            );
          })}
        </div>
      </div>
      <Caption1 className={estilos.clave}>
        {editable
          ? "Toca un atributo y luego toca o arrastra sobre los elementos. Doble clic en un elemento para ver su ficha."
          : "Toca un elemento para ver su ficha."}
      </Caption1>
    </>
  );

  return (
    <div className={estilos.raiz}>
      {pantallaCompleta ? (
        <div className={estilos.avisoCompleta}>
          <Caption1>El mapa está abierto en pantalla completa.</Caption1>
          <Button appearance="subtle" icon={<IconoSalirPantalla />} onClick={() => setPantallaCompleta(false)}>
            Salir de pantalla completa
          </Button>
        </div>
      ) : (
        panel
      )}

      <Dialog open={pantallaCompleta} onOpenChange={(_, d) => setPantallaCompleta(d.open)}>
        <DialogSurface className={estilos.surfaceCompleta}>
          <div className={estilos.encabezadoCompleta}>
            <Subtitle2>Mapa del laboratorio</Subtitle2>
            <Button
              appearance="subtle"
              icon={<IconoSalirPantalla />}
              onClick={() => setPantallaCompleta(false)}
            >
              Salir de pantalla completa
            </Button>
          </div>
          <div className={estilos.cuerpoCompleta}>{pantallaCompleta ? panel : null}</div>
        </DialogSurface>
      </Dialog>

      <Dialog open={ficha !== null} onOpenChange={(_, d) => !d.open && setFicha(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{ficha ? ficha.etiqueta || ficha.tipo_nombre : ""}</DialogTitle>
            <DialogContent>
              {ficha && (
                <div className={estilos.ficha}>
                  {(
                    [
                      ["Elemento", ficha.tipo_nombre],
                      ["Estado", ESTADOS[ficha.estado] ?? ficha.estado],
                      ["En el mapa", nombreMarca(ficha)],
                      ["IP", ficha.ip],
                      ["MAC", ficha.mac],
                      ["Código de activo", ficha.codigo_activo],
                      ["Especificaciones", ficha.especificaciones],
                      ["Descripción", ficha.descripcion],
                    ] as [string, string][]
                  ).map(([nombre, valor]) => (
                    <div key={nombre} style={{ display: "contents" }}>
                      <Caption1 className={estilos.clave}>{nombre}</Caption1>
                      {valor ? (
                        <Body1 className={estilos.valor}>{valor}</Body1>
                      ) : (
                        <Body1 className={estilos.vacioTexto}>Sin registrar</Body1>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Caption1 block className={estilos.notaFicha}>
                Datos del elemento cuando se hizo este mapa.
              </Caption1>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setFicha(null)}>
                Cerrar
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}