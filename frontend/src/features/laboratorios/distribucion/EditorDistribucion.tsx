import {
  Body1Strong,
  Button,
  Caption1,
  Caption1Strong,
  Divider,
  Field,
  Link,
  MessageBar,
  MessageBarBody,
  Spinner,
  SpinButton,
  ToggleButton,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router";

import { mensajeDeError } from "../../../api/errores";
import type { Celda } from "../../../api/tipos";
import { ConfirmarDialogo } from "../../../components/feedback/ConfirmarDialogo";
import { EstadoError } from "../../../components/feedback/Estados";
import { useNotificar } from "../../../components/feedback/notificaciones";
import { GrillaLaboratorio, clave, tamanoGrilla } from "../../../components/grilla/GrillaLaboratorio";
import { IconoElemento } from "../../../components/iconos/IconoElemento";
import {
  IconoAcercar,
  IconoAlejar,
  IconoBorrador,
  IconoDeshacer,
  IconoEtiqueta,
  IconoGuardar,
  IconoMano,
  IconoRehacer,
  IconoSeleccionar,
} from "../../../components/iconos/iconos";
import { FichaIcono } from "../../elementos/ElementosPage";
import { useTiposElemento } from "../../elementos/useTipos";
import { guardarDistribucion, obtenerDistribucion } from "../api";
import { DialogoNumerar } from "./DialogoNumerar";
import {
  type EstadoGrilla,
  aDistribucion,
  desdeDistribucion,
  firma,
  nuevaCelda,
  numerar,
  redimensionar,
  siguienteEtiqueta,
  useHistorial,
} from "./modelo";
import { PanelCelda } from "./PanelCelda";

type Herramienta = "seleccionar" | "mano" | "pintar" | "borrar";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2;
const acotar = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));

const useEstilos = makeStyles({
  raiz: {
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: "hidden",
  },
  barra: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
    padding: "8px 10px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  divisor: {
    alignSelf: "stretch",
    flexGrow: 0,
    margin: "0 4px",
  },
  paleta: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
  },
  espacio: {
    flex: 1,
  },
  zoom: {
    minWidth: "48px",
    fontVariantNumeric: "tabular-nums",
  },
  sinGuardar: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: tokens.colorNeutralForeground3,
    "::before": {
      content: '""',
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      backgroundColor: tokens.colorStatusWarningForeground1,
    },
  },
  cuerpo: {
    display: "grid",
    gridTemplateColumns: "1fr 320px",
    height: "calc(100vh - 290px)",
    minHeight: "460px",
    "@media (max-width: 1100px)": {
      gridTemplateColumns: "1fr",
      height: "auto",
    },
  },
  lienzo: {
    overflow: "auto",
    backgroundColor: tokens.colorNeutralBackground2,
    backgroundImage: `radial-gradient(${tokens.colorNeutralStroke2} 1px, transparent 1px)`,
    backgroundSize: "16px 16px",
    "@media (max-width: 1100px)": {
      height: "60vh",
    },
  },
  lienzoInterior: {
    padding: "24px",
    width: "fit-content",
    minWidth: "100%",
    display: "flex",
    justifyContent: "center",
  },
  panel: {
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: "16px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    "@media (max-width: 1100px)": {
      borderLeft: "none",
      borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    },
  },
  seccion: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  tituloSeccion: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  conteo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  conteoNumero: {
    marginLeft: "auto",
    fontVariantNumeric: "tabular-nums",
    fontWeight: tokens.fontWeightSemibold,
  },
  tamano: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  atajos: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: "4px 12px",
    color: tokens.colorNeutralForeground3,
  },
  tecla: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    padding: "0 6px",
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    color: tokens.colorNeutralForeground2,
    justifySelf: "start",
  },
  cargando: {
    padding: "64px",
  },
});

const ATAJOS: [string, string][] = [
  ["V", "Seleccionar"],
  ["H", "Mano (o mantener Espacio)"],
  ["E", "Borrador"],
  ["1–9", "Elegir elemento"],
  ["Ctrl+Z / Ctrl+Y", "Deshacer / rehacer"],
  ["Ctrl+S", "Guardar"],
  ["Supr", "Quitar el seleccionado"],
  ["Ctrl+rueda", "Zoom"],
];

interface Props {
  laboratorioId: number;
  editable: boolean;
}

/**
 * Editor de la distribución (la "plantilla" de OrganiLab): mano, paleta de
 * elementos y borrador; arrastrar pinta varias casillas; doble clic abre la ficha.
 */
export function EditorDistribucion({ laboratorioId, editable }: Props) {
  const estilos = useEstilos();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { tipos, mapa } = useTiposElemento();
  const tiposActivos = useMemo(() => tipos.filter((t) => t.activo), [tipos]);

  const consulta = useQuery({
    queryKey: ["distribucion", laboratorioId],
    queryFn: () => obtenerDistribucion(laboratorioId),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  const historial = useHistorial<EstadoGrilla>({ filas: 1, columnas: 1, celdas: {} });
  const e = historial.presente;
  const base = useRef("");
  const [cargado, setCargado] = useState(false);
  const [herramienta, setHerramienta] = useState<Herramienta>(editable ? "pintar" : "seleccionar");
  const [tipoActivo, setTipoActivo] = useState<number | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [espacio, setEspacio] = useState(false);
  const [numerarAbierto, setNumerarAbierto] = useState(false);
  const [tamanoPendiente, setTamanoPendiente] = useState<{ filas: number; columnas: number; quitadas: number } | null>(
    null,
  );

  const lienzo = useRef<HTMLDivElement>(null);
  const trabajo = useRef<EstadoGrilla | null>(null);
  const ultima = useRef<string | null>(null);
  const arrastre = useRef<{ x: number; y: number; izquierda: number; arriba: number } | null>(null);

  const modo: Herramienta = espacio ? "mano" : herramienta;
  const sucio = cargado && firma(e) !== base.current;

  // Carga inicial (y después de guardar).
  useEffect(() => {
    if (!consulta.data) return;
    const inicial = desdeDistribucion(consulta.data);
    historial.reiniciar(inicial);
    base.current = firma(inicial);
    setCargado(true);
  }, [consulta.data, historial.reiniciar]);

  useEffect(() => {
    if (tipoActivo === null && tiposActivos.length) setTipoActivo(tiposActivos[0].id);
  }, [tiposActivos, tipoActivo]);

  const ajustar = () => {
    const contenedor = lienzo.current;
    if (!contenedor) return;
    const { ancho, alto } = tamanoGrilla(e.filas, e.columnas);
    setZoom(acotar(Math.min((contenedor.clientWidth - 48) / ancho, (contenedor.clientHeight - 48) / alto, 1.4)));
  };

  // Al cargar, la grilla se ajusta al espacio disponible.
  useEffect(() => {
    if (cargado) ajustar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargado]);

  const guardar = useMutation({
    mutationFn: () => guardarDistribucion(laboratorioId, aDistribucion(e)),
    onSuccess: (datos) => {
      queryClient.setQueryData(["distribucion", laboratorioId], datos);
      void queryClient.invalidateQueries({ queryKey: ["laboratorios"] });
      setSeleccion(null);
      notificar.exito("Distribución guardada");
    },
    onError: (error) => notificar.error("No se pudo guardar la distribución", mensajeDeError(error)),
  });

  // ── Pintar y borrar arrastrando ──
  const aplicarEn = (k: string) => {
    const t = trabajo.current;
    if (!t || ultima.current === k) return;
    ultima.current = k;
    const [fila, columna] = k.split(",").map(Number);
    if (modo === "borrar") {
      if (!t.celdas[k]) return;
      const celdas = { ...t.celdas };
      delete celdas[k];
      trabajo.current = { ...t, celdas };
    } else if (modo === "pintar") {
      if (tipoActivo === null || t.celdas[k]?.tipo === tipoActivo) return;
      const etiqueta = siguienteEtiqueta(mapa.get(tipoActivo), t.celdas);
      trabajo.current = { ...t, celdas: { ...t.celdas, [k]: nuevaCelda(fila, columna, tipoActivo, etiqueta) } };
    } else {
      return;
    }
    historial.aplicar(trabajo.current);
  };

  const alPresionarCelda = (fila: number, columna: number, evento: PointerEvent<SVGElement>) => {
    if (evento.button !== 0 || modo === "mano") return;
    const k = clave(fila, columna);
    if (!editable || modo === "seleccionar") {
      setSeleccion(e.celdas[k] ? k : null);
      return;
    }
    evento.preventDefault();
    historial.iniciarTrazo();
    trabajo.current = e;
    ultima.current = null;
    aplicarEn(k);
  };

  const alMoverSobreGrilla = (evento: PointerEvent<SVGSVGElement>) => {
    if (!trabajo.current) return;
    const k = document.elementFromPoint(evento.clientX, evento.clientY)?.closest("[data-celda]")?.getAttribute("data-celda");
    if (k) aplicarEn(k);
  };

  useEffect(() => {
    const terminar = () => {
      if (trabajo.current) {
        trabajo.current = null;
        ultima.current = null;
        historial.terminarTrazo();
      }
      arrastre.current = null;
    };
    window.addEventListener("pointerup", terminar);
    window.addEventListener("pointercancel", terminar);
    return () => {
      window.removeEventListener("pointerup", terminar);
      window.removeEventListener("pointercancel", terminar);
    };
  }, [historial.terminarTrazo]);

  // ── Mover la vista (mano, botón central o Espacio) ──
  const alPresionarLienzo = (evento: PointerEvent<HTMLDivElement>) => {
    const contenedor = lienzo.current;
    if (!contenedor || !(modo === "mano" || evento.button === 1)) return;
    evento.preventDefault();
    arrastre.current = {
      x: evento.clientX,
      y: evento.clientY,
      izquierda: contenedor.scrollLeft,
      arriba: contenedor.scrollTop,
    };
  };

  const alMoverLienzo = (evento: PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    const contenedor = lienzo.current;
    if (!a || !contenedor) return;
    contenedor.scrollLeft = a.izquierda - (evento.clientX - a.x);
    contenedor.scrollTop = a.arriba - (evento.clientY - a.y);
  };

  // Ctrl + rueda = zoom (sin hacer zoom a toda la página).
  useEffect(() => {
    const contenedor = lienzo.current;
    if (!contenedor) return;
    const alGirar = (evento: WheelEvent) => {
      if (!evento.ctrlKey) return;
      evento.preventDefault();
      setZoom((z) => acotar(z + (evento.deltaY < 0 ? 0.1 : -0.1)));
    };
    contenedor.addEventListener("wheel", alGirar, { passive: false });
    return () => contenedor.removeEventListener("wheel", alGirar);
  }, [cargado]);

  // ── Edición de la casilla seleccionada ──
  const celdaSeleccionada = seleccion ? e.celdas[seleccion] : undefined;

  const cambiarCampo = (campo: keyof Celda, valor: Celda[keyof Celda]) => {
    if (!seleccion || !celdaSeleccionada) return;
    historial.registrar(
      { ...e, celdas: { ...e.celdas, [seleccion]: { ...celdaSeleccionada, [campo]: valor } } },
      `${seleccion}:${String(campo)}`,
    );
  };

  const quitarSeleccionada = () => {
    if (!seleccion || !e.celdas[seleccion]) return;
    const celdas = { ...e.celdas };
    delete celdas[seleccion];
    historial.registrar({ ...e, celdas });
    setSeleccion(null);
  };

  const pedirTamano = (filas: number, columnas: number) => {
    if (filas < 1 || columnas < 1 || filas > 40 || columnas > 40) return;
    const r = redimensionar(e, filas, columnas);
    if (r.quitadas > 0) setTamanoPendiente({ filas, columnas, quitadas: r.quitadas });
    else historial.registrar(r.estado, "tamano");
  };

  // ── Atajos de teclado ──
  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      const destino = evento.target as HTMLElement | null;
      if (destino?.closest("input, textarea, select, [role='dialog'], [role='menu']")) return;
      const mod = evento.ctrlKey || evento.metaKey;
      const tecla = evento.key.toLowerCase();
      if (mod && editable && (tecla === "z" || tecla === "y")) {
        evento.preventDefault();
        if (tecla === "y" || evento.shiftKey) historial.rehacer();
        else historial.deshacer();
        return;
      }
      if (mod && tecla === "s") {
        evento.preventDefault();
        if (editable && sucio && !guardar.isPending) guardar.mutate();
        return;
      }
      if (mod || evento.altKey) return;
      if (tecla === " ") {
        evento.preventDefault();
        setEspacio(true);
      } else if (tecla === "v") setHerramienta("seleccionar");
      else if (tecla === "h") setHerramienta("mano");
      else if (tecla === "e" && editable) setHerramienta("borrar");
      else if (tecla === "escape") setSeleccion(null);
      else if ((tecla === "delete" || tecla === "backspace") && editable) quitarSeleccionada();
      else if (tecla === "+" || tecla === "=") setZoom((z) => acotar(z + 0.1));
      else if (tecla === "-") setZoom((z) => acotar(z - 0.1));
      else if (tecla === "0") setZoom(1);
      else if (/^[1-9]$/.test(tecla) && editable) {
        const tipo = tiposActivos[Number(tecla) - 1];
        if (tipo) {
          setTipoActivo(tipo.id);
          setHerramienta("pintar");
        }
      }
    };
    const alSoltar = (evento: KeyboardEvent) => {
      if (evento.key === " ") setEspacio(false);
    };
    window.addEventListener("keydown", alTeclear);
    window.addEventListener("keyup", alSoltar);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      window.removeEventListener("keyup", alSoltar);
    };
  });

  // ── Salir con cambios sin guardar ──
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) => sucio && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!sucio) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  if (consulta.error && !consulta.data) {
    return <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />;
  }
  if (!cargado) {
    return <Spinner className={estilos.cargando} label="Cargando distribución…" />;
  }

  // Conteo por tipo para el resumen.
  const conteo = new Map<number, number>();
  let conFalla = 0;
  Object.values(e.celdas).forEach((c) => {
    conteo.set(c.tipo, (conteo.get(c.tipo) ?? 0) + 1);
    if (c.estado === "con_falla") conFalla++;
  });
  const ocupadas = Object.keys(e.celdas).length;
  const tiposEnGrilla = tipos.filter((t) => conteo.has(t.id));
  const cursor = modo === "mano" ? (arrastre.current ? "grabbing" : "grab") : modo === "seleccionar" ? "default" : "crosshair";

  return (
    <div className={estilos.raiz}>
      <div className={estilos.barra} role="toolbar" aria-label="Herramientas de la grilla">
        <Tooltip content="Seleccionar (V)" relationship="label">
          <ToggleButton
            appearance="subtle"
            icon={<IconoSeleccionar />}
            checked={herramienta === "seleccionar"}
            onClick={() => setHerramienta("seleccionar")}
          />
        </Tooltip>
        <Tooltip content="Mano: mover la vista (H)" relationship="label">
          <ToggleButton
            appearance="subtle"
            icon={<IconoMano />}
            checked={herramienta === "mano"}
            onClick={() => setHerramienta("mano")}
          />
        </Tooltip>
        {editable && (
          <Tooltip content="Borrador (E)" relationship="label">
            <ToggleButton
              appearance="subtle"
              icon={<IconoBorrador />}
              checked={herramienta === "borrar"}
              onClick={() => setHerramienta("borrar")}
            />
          </Tooltip>
        )}

        {editable && (
          <>
            <Divider vertical className={estilos.divisor} />
            <div className={estilos.paleta} aria-label="Elementos">
              {tiposActivos.map((t, i) => (
                <Tooltip key={t.id} content={i < 9 ? `${t.nombre} · tecla ${i + 1}` : t.nombre} relationship="label">
                  <ToggleButton
                    size="small"
                    appearance="subtle"
                    checked={herramienta === "pintar" && tipoActivo === t.id}
                    icon={<IconoElemento icono={t.icono} tamano={16} color={t.color} />}
                    onClick={() => {
                      setTipoActivo(t.id);
                      setHerramienta("pintar");
                    }}
                  >
                    {t.nombre}
                  </ToggleButton>
                </Tooltip>
              ))}
            </div>
          </>
        )}

        <span className={estilos.espacio} />

        {editable && sucio && <Caption1 className={estilos.sinGuardar}>Cambios sin guardar</Caption1>}
        {editable && (
          <>
            <Tooltip content="Deshacer (Ctrl+Z)" relationship="label">
              <Button appearance="subtle" icon={<IconoDeshacer />} disabled={!historial.puedeDeshacer} onClick={historial.deshacer} />
            </Tooltip>
            <Tooltip content="Rehacer (Ctrl+Y)" relationship="label">
              <Button appearance="subtle" icon={<IconoRehacer />} disabled={!historial.puedeRehacer} onClick={historial.rehacer} />
            </Tooltip>
          </>
        )}
        <Tooltip content="Alejar" relationship="label">
          <Button appearance="subtle" icon={<IconoAlejar />} onClick={() => setZoom((z) => acotar(z - 0.1))} />
        </Tooltip>
        <Tooltip content="Volver a 100 %" relationship="label">
          <Button appearance="subtle" className={estilos.zoom} onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)} %
          </Button>
        </Tooltip>
        <Tooltip content="Acercar" relationship="label">
          <Button appearance="subtle" icon={<IconoAcercar />} onClick={() => setZoom((z) => acotar(z + 0.1))} />
        </Tooltip>
        <Button appearance="subtle" onClick={ajustar}>
          Ajustar
        </Button>
        {editable && (
          <Button
            appearance="primary"
            icon={guardar.isPending ? <Spinner size="tiny" appearance="inverted" /> : <IconoGuardar />}
            disabled={!sucio || guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            Guardar
          </Button>
        )}
      </div>

      <div className={estilos.cuerpo}>
        <div
          ref={lienzo}
          className={estilos.lienzo}
          onPointerDown={alPresionarLienzo}
          onPointerMove={alMoverLienzo}
          style={{ cursor: modo === "mano" ? "grab" : undefined }}
        >
          <div className={estilos.lienzoInterior}>
            <GrillaLaboratorio
              filas={e.filas}
              columnas={e.columnas}
              celdas={e.celdas}
              tipos={mapa}
              zoom={zoom}
              seleccion={seleccion}
              editable={editable}
              cursor={cursor}
              onCeldaAbajo={alPresionarCelda}
              onPointerMove={alMoverSobreGrilla}
              onDobleClic={(f, c) => {
                const k = clave(f, c);
                if (e.celdas[k]) setSeleccion(k);
              }}
            />
          </div>
        </div>

        <aside className={estilos.panel} aria-label="Detalle">
          {celdaSeleccionada ? (
            <PanelCelda
              celda={celdaSeleccionada}
              tipo={mapa.get(celdaSeleccionada.tipo)}
              tipos={tipos}
              editable={editable}
              onCambiar={cambiarCampo}
              onQuitar={quitarSeleccionada}
            />
          ) : (
            <>
              {editable && tiposActivos.length === 0 && (
                <MessageBar intent="warning">
                  <MessageBarBody>
                    Primero crea elementos en el{" "}
                    <Link inline onClick={() => navegar("/elementos")}>
                      catálogo
                    </Link>
                    .
                  </MessageBarBody>
                </MessageBar>
              )}
              <div className={estilos.seccion}>
                <Caption1Strong className={estilos.tituloSeccion}>Resumen</Caption1Strong>
                <Body1Strong>
                  {ocupadas} de {e.filas * e.columnas} casillas ocupadas
                </Body1Strong>
                {conFalla > 0 && <Caption1>{conFalla} con falla (punto rojo)</Caption1>}
                {tiposEnGrilla.map((t) => (
                  <div key={t.id} className={estilos.conteo}>
                    <FichaIcono tipo={t} tamano={28} />
                    <span>{t.nombre}</span>
                    <span className={estilos.conteoNumero}>{conteo.get(t.id)}</span>
                  </div>
                ))}
                {!editable && <Caption1>Toca una casilla para ver su ficha.</Caption1>}
              </div>

              {editable && (
                <>
                  <div className={estilos.seccion}>
                    <Caption1Strong className={estilos.tituloSeccion}>Tamaño de la grilla</Caption1Strong>
                    <div className={estilos.tamano}>
                      <Field label="Filas">
                        <SpinButton
                          min={1}
                          max={40}
                          value={e.filas}
                          onChange={(_, d) => {
                            const valor = d.value ?? Number.parseInt(d.displayValue ?? "", 10);
                            if (!Number.isNaN(valor)) pedirTamano(valor, e.columnas);
                          }}
                        />
                      </Field>
                      <Field label="Columnas">
                        <SpinButton
                          min={1}
                          max={40}
                          value={e.columnas}
                          onChange={(_, d) => {
                            const valor = d.value ?? Number.parseInt(d.displayValue ?? "", 10);
                            if (!Number.isNaN(valor)) pedirTamano(e.filas, valor);
                          }}
                        />
                      </Field>
                    </div>
                  </div>
                  <div className={estilos.seccion}>
                    <Caption1Strong className={estilos.tituloSeccion}>Etiquetas</Caption1Strong>
                    <Button
                      icon={<IconoEtiqueta />}
                      disabled={tiposEnGrilla.length === 0}
                      onClick={() => setNumerarAbierto(true)}
                    >
                      Numerar elementos…
                    </Button>
                  </div>
                  <div className={estilos.seccion}>
                    <Caption1Strong className={estilos.tituloSeccion}>Atajos</Caption1Strong>
                    <div className={estilos.atajos}>
                      {ATAJOS.map(([tecla, accion]) => (
                        <Fragment key={tecla}>
                          <span className={estilos.tecla}>{tecla}</span>
                          <Caption1>{accion}</Caption1>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>

      <DialogoNumerar
        abierto={numerarAbierto}
        tipos={tiposEnGrilla}
        onCerrar={() => setNumerarAbierto(false)}
        onAplicar={({ tipo, ...opciones }) => {
          historial.registrar(numerar(e, tipo, opciones));
          setNumerarAbierto(false);
        }}
      />
      <ConfirmarDialogo
        abierto={tamanoPendiente !== null}
        titulo="¿Achicar la grilla?"
        mensaje={`Se quitarán ${tamanoPendiente?.quitadas} elementos que quedan fuera. Puedes deshacerlo con Ctrl+Z.`}
        textoConfirmar="Achicar"
        peligroso
        onCancelar={() => setTamanoPendiente(null)}
        onConfirmar={() => {
          if (tamanoPendiente) {
            historial.registrar(redimensionar(e, tamanoPendiente.filas, tamanoPendiente.columnas).estado);
          }
          setTamanoPendiente(null);
        }}
      />
      <ConfirmarDialogo
        abierto={bloqueo.state === "blocked"}
        titulo="Hay cambios sin guardar"
        mensaje="Si sales ahora, se pierden los cambios en la distribución."
        textoConfirmar="Salir sin guardar"
        peligroso
        onCancelar={() => bloqueo.reset?.()}
        onConfirmar={() => bloqueo.proceed?.()}
      />
    </div>
  );
}
