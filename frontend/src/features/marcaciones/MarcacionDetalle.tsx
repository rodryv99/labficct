import {
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  Link,
  MessageBar,
  MessageBarBody,
  Spinner,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { Marcacion } from "../../api/tipos";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoError } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoReloj } from "../../components/iconos/iconos";
import { aInputLocal, ahoraLocalInput, desdeISO, fechaLarga, localAIso } from "../../lib/fechas";
import { cerrarMarcacion, duracion, enlaceMapa, hhmm, horaDe, metros, obtenerMarcacion } from "./api";
import { MapaLugar } from "./MapaLugar";

const useEstilos = makeStyles({
  etiquetas: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  cuadro: {
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr)",
    gap: "8px 16px",
  },
  clave: {
    color: tokens.colorNeutralForeground3,
  },
  marca: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  hora: {
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  seccion: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  tituloSeccion: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
});

interface MarcaProps {
  hora: string;
  latitud: number;
  longitud: number;
  distancia: number | null;
  precision: number | null;
  radio: number;
}

/** Una marca (entrada o salida): la hora, a cuántos metros del lugar y con qué precisión de GPS. */
function Marca({ hora, latitud, longitud, distancia, precision, radio }: MarcaProps) {
  const estilos = useEstilos();
  return (
    <div className={estilos.marca}>
      <span className={estilos.hora}>{horaDe(hora)}</span>
      <Caption1 className={estilos.secundario}>
        A {metros(distancia)} del lugar (se permite hasta {radio} m)
        {precision !== null && ` · GPS ± ${Math.round(precision)} m`}
      </Caption1>
      <Caption1>
        <Link href={enlaceMapa(latitud, longitud)} target="_blank" rel="noreferrer">
          Ver dónde estaba
        </Link>
      </Caption1>
    </div>
  );
}

interface Props {
  id: number | null;
  onCerrar: () => void;
}

/** Todo lo que se guardó de una marcación. Si quedó sin salida, el Admin puede ponerla. */
export function MarcacionDetalle({ id, onCerrar }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [cerrando, setCerrando] = useState(false);
  const [salida, setSalida] = useState("");
  const [nota, setNota] = useState("");

  const consulta = useQuery({
    queryKey: ["marcaciones", "detalle", id],
    queryFn: () => obtenerMarcacion(id!),
    enabled: id !== null,
  });
  const m: Marcacion | undefined = consulta.data;

  const ponerSalida = useMutation({
    mutationFn: () => cerrarMarcacion(id!, localAIso(salida), nota.trim()),
    onSuccess: (res) => {
      notificar.exito("Salida registrada", `${res.usuario_nombre} · ${horaDe(res.salida_en!)}`);
      queryClient.setQueryData(["marcaciones", "detalle", id], res);
      void queryClient.invalidateQueries({ queryKey: ["marcaciones"] });
      setCerrando(false);
      setNota("");
    },
    onError: (falla) => notificar.error("No se pudo poner la salida", mensajeDeError(falla)),
  });

  const abrirCierre = () => {
    if (!m) return;
    // Propone la hora actual si la entrada es de hoy; si no, la misma hora de entrada (para corregirla).
    const ahora = ahoraLocalInput();
    setSalida(ahora.slice(0, 10) === m.fecha ? ahora : aInputLocal(m.entrada_en));
    setNota("");
    setCerrando(true);
  };

  return (
    <>
      <PanelFormulario
        abierto={id !== null}
        titulo={m?.usuario_nombre ?? "Marcación"}
        subtitulo={m ? `${fechaLarga(desdeISO(m.fecha))} · ${m.lugar_nombre}` : undefined}
        onCerrar={onCerrar}
        pie={
          m?.abierta ? (
            <Button appearance="primary" icon={<IconoReloj />} onClick={abrirCierre}>
              Poner la salida
            </Button>
          ) : undefined
        }
      >
        {consulta.isLoading && <Spinner label="Cargando…" />}
        {consulta.error && !m && <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />}
        {m && (
          <>
            <div className={estilos.etiquetas}>
              {m.abierta ? (
                <EtiquetaEstado tono="aviso">Sin salida</EtiquetaEstado>
              ) : (
                <EtiquetaEstado tono="exito">Completa</EtiquetaEstado>
              )}
              {m.salida_manual && <EtiquetaEstado tono="info">Salida puesta por el administrador</EtiquetaEstado>}
            </div>

            {m.abierta && (
              <MessageBar intent="warning">
                <MessageBarBody>
                  Todavía no marcó la salida. Si se olvidó, puedes ponerla tú: queda anotado que fue a mano.
                </MessageBarBody>
              </MessageBar>
            )}

            <div className={estilos.cuadro}>
              <Caption1 className={estilos.clave}>Entrada</Caption1>
              <Marca
                hora={m.entrada_en}
                latitud={m.entrada_latitud}
                longitud={m.entrada_longitud}
                distancia={m.entrada_distancia_m}
                precision={m.entrada_precision_m}
                radio={m.radio_m}
              />
              <Caption1 className={estilos.clave}>Salida</Caption1>
              {m.salida_en === null ? (
                <Body1 className={estilos.secundario}>Sin marcar</Body1>
              ) : m.salida_latitud !== null && m.salida_longitud !== null ? (
                <Marca
                  hora={m.salida_en}
                  latitud={m.salida_latitud}
                  longitud={m.salida_longitud}
                  distancia={m.salida_distancia_m}
                  precision={m.salida_precision_m}
                  radio={m.radio_m}
                />
              ) : (
                <div className={estilos.marca}>
                  <span className={estilos.hora}>{horaDe(m.salida_en)}</span>
                  <Caption1 className={estilos.secundario}>Puesta a mano: sin GPS ni huella.</Caption1>
                </div>
              )}
              <Caption1 className={estilos.clave}>Tiempo</Caption1>
              <Body1>{m.minutos === null ? "En curso" : duracion(m.minutos)}</Body1>
              {m.turno_inicio && (
                <>
                  <Caption1 className={estilos.clave}>Turno</Caption1>
                  <Body1>
                    {hhmm(m.turno_inicio)}–{hhmm(m.turno_fin ?? "")}
                    {m.retraso_min > 0 ? ` · ${m.retraso_min} min tarde` : " · entró puntual"}
                    {m.salida_temprana_min > 0 ? ` · salió ${m.salida_temprana_min} min antes` : ""}
                  </Body1>
                </>
              )}
              <Caption1 className={estilos.clave}>Lugar</Caption1>
              <Body1>
                {m.lugar_nombre} · radio de {m.radio_m} m
              </Body1>
              {m.nota && (
                <>
                  <Caption1 className={estilos.clave}>Nota</Caption1>
                  <Body1>{m.nota}</Body1>
                </>
              )}
            </div>

            <div className={estilos.seccion}>
              <Caption1 className={estilos.tituloSeccion}>Dónde marcó la entrada</Caption1>
              <MapaLugar
                latitud={m.entrada_latitud}
                longitud={m.entrada_longitud}
                radioM={m.radio_m}
                titulo="Ubicación al marcar la entrada"
              />
            </div>
            <Caption1 className={estilos.secundario}>
              La huella la verifica el teléfono del auxiliar antes de enviar cada marca; el sistema guarda la
              ubicación y la hora.
            </Caption1>
          </>
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={cerrando}
        titulo={`Poner la salida de ${m?.usuario_nombre ?? ""}`}
        mensaje={m ? `Entró a las ${horaDe(m.entrada_en)}. La salida queda marcada como puesta por el administrador.` : undefined}
        textoConfirmar="Guardar salida"
        cargando={ponerSalida.isPending}
        deshabilitado={!salida || !nota.trim()}
        onCancelar={() => setCerrando(false)}
        onConfirmar={() => ponerSalida.mutate()}
      >
        <Field label="Fecha y hora de salida" required>
          <Input type="datetime-local" value={salida} onChange={(_, d) => setSalida(d.value)} />
        </Field>
        <Field label="Motivo" required hint="Ej.: olvidó marcar; salió a las 12:30 según el parte.">
          <Textarea value={nota} maxLength={300} resize="vertical" rows={2} onChange={(_, d) => setNota(d.value)} />
        </Field>
      </ConfirmarDialogo>
    </>
  );
}
