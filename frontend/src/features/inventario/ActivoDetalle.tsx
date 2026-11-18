import {
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { ActivoDetalle as Activo, CambioInventario, EstadoActivo, MovimientoActivo } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoError } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoEditar, IconoEliminar, IconoTrasladar } from "../../components/iconos/iconos";
import { aISO, fechaCorta, relativo } from "../../lib/fechas";
import {
  ESTADOS_ACTIVO,
  TONO_ESTADO,
  TONO_MOVIMIENTO,
  cambiarEstadoActivo,
  corregirMovimiento,
  darDeBaja,
  listarLugares,
  obtenerActivo,
  trasladarActivo,
} from "./api";

const useEstilos = makeStyles({
  etiquetas: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  cuadro: {
    display: "grid",
    gridTemplateColumns: "140px minmax(0, 1fr)",
    gap: "8px 16px",
  },
  clave: {
    color: tokens.colorNeutralForeground3,
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
  texto: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  historial: {
    display: "flex",
    flexDirection: "column",
    margin: "0",
    padding: "0",
    listStyleType: "none",
  },
  evento: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px 0",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  cabeceraEvento: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  correccion: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "6px 10px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  tachado: {
    textDecorationLine: "line-through",
    color: tokens.colorNeutralForeground3,
  },
  espacio: {
    flex: 1,
  },
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
});

type Dialogo =
  | { tipo: "trasladar" }
  | { tipo: "estado" }
  | { tipo: "baja" }
  | { tipo: "corregir"; movimiento: MovimientoActivo };

interface DatosDialogo {
  lugar: string;
  estado: string;
  fecha: string;
  motivo: string;
  documento: string;
}

const hoy = () => aISO(new Date());

/** Qué pasó en un movimiento, en una frase. */
function resumenDe(m: MovimientoActivo): string {
  switch (m.tipo) {
    case "alta":
      return `Entró al inventario en ${m.lugar_destino_nombre || "—"} (${m.estado_nuevo_nombre.toLowerCase()}).`;
    case "traslado":
      return `De ${m.lugar_origen_nombre || "—"} a ${m.lugar_destino_nombre || "—"}.`;
    case "estado":
      return `De «${m.estado_anterior_nombre}» a «${m.estado_nuevo_nombre}».`;
    default:
      return `Dado de baja. Estaba en ${m.lugar_origen_nombre || "—"} (${m.estado_anterior_nombre.toLowerCase()}).`;
  }
}

/** Una corrección: "Marca: HP → Dell". */
function Correccion({ cambio }: { cambio: CambioInventario }) {
  const estilos = useEstilos();
  return (
    <div className={estilos.correccion}>
      <span>
        Corregido por {cambio.usuario_nombre}, {relativo(cambio.creado_en)}
      </span>
      {cambio.cambios.map((c) => (
        <span key={c.campo}>
          {c.campo}: <span className={estilos.tachado}>{c.antes || "vacío"}</span> → {c.despues || "vacío"}
        </span>
      ))}
    </div>
  );
}

interface Props {
  id: number | null;
  onCerrar: () => void;
  onEditar: (activo: Activo) => void;
}

/** Ficha de un activo: sus datos, dónde está y todo lo que le pasó. */
export function ActivoDetalle({ id, onCerrar, onEditar }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede } = useSesion();
  const gestionar = puede("inventario.gestionar");
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [d, setD] = useState<DatosDialogo>({ lugar: "", estado: "", fecha: hoy(), motivo: "", documento: "" });

  const consulta = useQuery({
    queryKey: ["inventario", "activo", id],
    queryFn: () => obtenerActivo(id!),
    enabled: id !== null,
  });
  const a: Activo | undefined = consulta.data;
  const lugares = useQuery({
    queryKey: ["inventario", "lugares"],
    queryFn: listarLugares,
    enabled: id !== null && gestionar,
  });

  const abrir = (nuevo: Dialogo) => {
    setD(
      nuevo.tipo === "corregir"
        ? {
            lugar: "",
            estado: "",
            fecha: nuevo.movimiento.fecha,
            motivo: nuevo.movimiento.motivo,
            documento: nuevo.movimiento.documento,
          }
        : { lugar: "", estado: "", fecha: hoy(), motivo: "", documento: "" },
    );
    setDialogo(nuevo);
  };

  const actualizar = (res: Activo, titulo: string) => {
    queryClient.setQueryData(["inventario", "activo", res.id], res);
    void queryClient.invalidateQueries({ queryKey: ["inventario"] });
    notificar.exito(titulo, `${res.codigo} · ${res.descripcion}`);
    setDialogo(null);
  };

  const comunes = () => ({ fecha: d.fecha || null, motivo: d.motivo.trim(), documento: d.documento.trim() });

  const mover = useMutation({
    mutationFn: async (tipo: "trasladar" | "estado" | "baja"): Promise<[Activo, string]> => {
      if (tipo === "trasladar") {
        return [await trasladarActivo(id!, { ...comunes(), lugar: Number(d.lugar) }), "Activo trasladado"];
      }
      if (tipo === "estado") {
        return [await cambiarEstadoActivo(id!, { ...comunes(), estado: d.estado as EstadoActivo }), "Estado cambiado"];
      }
      return [await darDeBaja(id!, comunes()), "Activo dado de baja"];
    },
    onSuccess: ([res, titulo]) => actualizar(res, titulo),
    onError: (e) => notificar.error("No se pudo registrar el movimiento", mensajeDeError(e)),
  });

  const corregir = useMutation({
    mutationFn: (movimiento: number) =>
      corregirMovimiento(movimiento, { fecha: d.fecha, motivo: d.motivo.trim(), documento: d.documento.trim() }),
    onSuccess: () => {
      notificar.exito("Movimiento corregido", "La corrección quedó en el historial.");
      setDialogo(null);
      void queryClient.invalidateQueries({ queryKey: ["inventario"] });
    },
    onError: (e) => notificar.error("No se pudo corregir", mensajeDeError(e)),
  });

  const deBaja = a?.estado === "baja";
  const ocupado = mover.isPending || corregir.isPending;
  const destinos = (lugares.data ?? []).filter((l) => l.activo && l.id !== a?.lugar);
  const estadosPosibles = ESTADOS_ACTIVO.filter((s) => s.valor !== "baja" && s.valor !== a?.estado);
  // Correcciones a los datos del activo (las de un movimiento se muestran dentro de ese movimiento).
  const correcciones = (a?.cambios ?? []).filter((c) => c.movimiento === null);
  const correccionesDe = (m: MovimientoActivo) => (a?.cambios ?? []).filter((c) => c.movimiento === m.id);

  const camposComunes = (
    <>
      <div className={estilos.fila}>
        <Field label="Fecha">
          <Input type="date" value={d.fecha} max={hoy()} onChange={(_, x) => setD({ ...d, fecha: x.value })} />
        </Field>
        <Field label="Documento" hint="Opcional. Acta, nota o informe.">
          <Input value={d.documento} maxLength={100} onChange={(_, x) => setD({ ...d, documento: x.value })} />
        </Field>
      </div>
      <Field label="Motivo" required={dialogo?.tipo === "baja"}>
        <Textarea value={d.motivo} resize="vertical" rows={3} onChange={(_, x) => setD({ ...d, motivo: x.value })} />
      </Field>
    </>
  );

  return (
    <>
      <PanelFormulario
        abierto={id !== null}
        tamano="medium"
        titulo={a ? a.descripcion : "Activo"}
        subtitulo={a ? `${a.codigo} · ${a.tipo_nombre}` : undefined}
        onCerrar={onCerrar}
        pie={
          a && gestionar ? (
            <>
              {!deBaja && (
                <Button appearance="primary" icon={<IconoTrasladar />} onClick={() => abrir({ tipo: "trasladar" })}>
                  Trasladar
                </Button>
              )}
              <Button appearance={deBaja ? "primary" : "secondary"} onClick={() => abrir({ tipo: "estado" })}>
                {deBaja ? "Reincorporar" : "Cambiar estado"}
              </Button>
              <Button icon={<IconoEditar />} onClick={() => onEditar(a)}>
                Editar
              </Button>
              {!deBaja && (
                <>
                  <span className={estilos.espacio} />
                  <Button appearance="subtle" icon={<IconoEliminar />} onClick={() => abrir({ tipo: "baja" })}>
                    Dar de baja
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {consulta.isLoading && <Spinner label="Cargando…" />}
        {consulta.error && !a && <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />}
        {a && (
          <>
            <div className={estilos.etiquetas}>
              <EtiquetaEstado tono={TONO_ESTADO[a.estado]}>{a.estado_nombre}</EtiquetaEstado>
            </div>

            <div className={estilos.cuadro}>
              <Caption1 className={estilos.clave}>Código</Caption1>
              <Body1Strong>{a.codigo}</Body1Strong>
              <Caption1 className={estilos.clave}>Tipo</Caption1>
              <Body1>{a.tipo_nombre}</Body1>
              <Caption1 className={estilos.clave}>{deBaja ? "Último lugar" : "Lugar"}</Caption1>
              <Body1>{a.lugar_nombre}</Body1>
              <Caption1 className={estilos.clave}>Marca y modelo</Caption1>
              <Body1>{[a.marca, a.modelo].filter(Boolean).join(" · ") || "Sin registrar"}</Body1>
              <Caption1 className={estilos.clave}>Número de serie</Caption1>
              <Body1>{a.serie || "Sin registrar"}</Body1>
              <Caption1 className={estilos.clave}>Adquisición</Caption1>
              <Body1>{a.fecha_adquisicion ? fechaCorta(a.fecha_adquisicion) : "Sin registrar"}</Body1>
              <Caption1 className={estilos.clave}>Responsable</Caption1>
              <Body1>{a.responsable || "Sin registrar"}</Body1>
              {a.en_mapa.length > 0 && (
                <>
                  <Caption1 className={estilos.clave}>En el mapa</Caption1>
                  <Body1>{a.en_mapa.map((c) => `${c.laboratorio_codigo} · ${c.etiqueta}`).join(", ")}</Body1>
                </>
              )}
            </div>

            {a.observaciones && (
              <div className={estilos.seccion}>
                <Caption1 className={estilos.tituloSeccion}>Observaciones</Caption1>
                <Body1 className={estilos.texto}>{a.observaciones}</Body1>
              </div>
            )}

            <div className={estilos.seccion}>
              <Caption1 className={estilos.tituloSeccion}>Historial</Caption1>
              <ul className={estilos.historial}>
                {a.movimientos.map((m) => (
                  <li key={m.id} className={estilos.evento}>
                    <div className={estilos.cabeceraEvento}>
                      <EtiquetaEstado tono={TONO_MOVIMIENTO[m.tipo]}>{m.tipo_nombre}</EtiquetaEstado>
                      <Body1Strong>{fechaCorta(m.fecha)}</Body1Strong>
                      <Caption1 className={estilos.secundario}>Registró {m.registrado_por}</Caption1>
                      <span className={estilos.espacio} />
                      {gestionar && (
                        <Tooltip content="Corregir fecha, motivo o documento" relationship="label">
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<IconoEditar />}
                            onClick={() => abrir({ tipo: "corregir", movimiento: m })}
                          />
                        </Tooltip>
                      )}
                    </div>
                    <Body1>{resumenDe(m)}</Body1>
                    {m.motivo && <Body1 className={estilos.texto}>{m.motivo}</Body1>}
                    {m.documento && <Caption1 className={estilos.secundario}>Documento: {m.documento}</Caption1>}
                    {correccionesDe(m).map((c) => (
                      <Correccion key={c.id} cambio={c} />
                    ))}
                  </li>
                ))}
              </ul>
            </div>

            {correcciones.length > 0 && (
              <div className={estilos.seccion}>
                <Caption1 className={estilos.tituloSeccion}>Correcciones a sus datos</Caption1>
                {correcciones.map((c) => (
                  <Correccion key={c.id} cambio={c} />
                ))}
              </div>
            )}
          </>
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={dialogo?.tipo === "trasladar"}
        titulo={`Trasladar ${a?.codigo ?? ""}`}
        mensaje={`Ahora está en ${a?.lugar_nombre ?? "—"}.`}
        textoConfirmar="Trasladar"
        cargando={mover.isPending}
        deshabilitado={!d.lugar}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => mover.mutate("trasladar")}
      >
        <Field label="Nuevo lugar" required>
          <Select value={d.lugar} onChange={(_, x) => setD({ ...d, lugar: x.value })}>
            <option value="" disabled>
              Elegir…
            </option>
            {destinos.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </Select>
        </Field>
        {camposComunes}
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={dialogo?.tipo === "estado"}
        titulo={deBaja ? `Reincorporar ${a?.codigo ?? ""}` : `Cambiar el estado de ${a?.codigo ?? ""}`}
        mensaje={
          deBaja
            ? "Vuelve al inventario con el estado que elijas. La baja queda en el historial."
            : `Ahora está como «${a?.estado_nombre ?? ""}».`
        }
        textoConfirmar={deBaja ? "Reincorporar" : "Cambiar estado"}
        cargando={mover.isPending}
        deshabilitado={!d.estado}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => mover.mutate("estado")}
      >
        <Field label="Nuevo estado" required>
          <Select value={d.estado} onChange={(_, x) => setD({ ...d, estado: x.value })}>
            <option value="" disabled>
              Elegir…
            </option>
            {estadosPosibles.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
        {camposComunes}
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={dialogo?.tipo === "baja"}
        titulo={`¿Dar de baja ${a?.codigo ?? ""}?`}
        mensaje="No se borra: queda en el inventario como «De baja», con su historial. Si fue un error, se puede reincorporar."
        textoConfirmar="Dar de baja"
        peligroso
        cargando={mover.isPending}
        deshabilitado={!d.motivo.trim()}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => mover.mutate("baja")}
      >
        {camposComunes}
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={dialogo?.tipo === "corregir"}
        titulo="Corregir el movimiento"
        mensaje="Se guarda quién lo corrigió y qué decía antes."
        textoConfirmar="Guardar corrección"
        cargando={corregir.isPending}
        deshabilitado={!d.fecha || ocupado}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => dialogo?.tipo === "corregir" && corregir.mutate(dialogo.movimiento.id)}
      >
        {camposComunes}
      </ConfirmarDialogo>
    </>
  );
}
