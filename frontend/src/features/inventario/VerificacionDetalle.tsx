import {
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  ProgressBar,
  SearchBox,
  Select,
  Spinner,
  Textarea,
  ToggleButton,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { mensajeDeError } from "../../api/errores";
import type { ItemVerificacion, ResultadoVerificacion, VerificacionDetalle as Verificacion } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { Codigo, EtiquetaEstado } from "../../components/datos/Etiquetas";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoError } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoCheck, IconoComentario, IconoVer } from "../../components/iconos/iconos";
import { fechaCorta, relativo } from "../../lib/fechas";
import {
  type DatosMarcar,
  RESULTADOS,
  TONO_RESULTADO,
  cancelarVerificacion,
  cerrarVerificacion,
  listarLugares,
  marcarItems,
  obtenerVerificacion,
} from "./api";

/** Cuántos activos se dibujan de una vez (el resto, con "Mostrar más"). */
const TANDA = 60;

const useEstilos = makeStyles({
  etiquetas: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  avance: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
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
  texto: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  filtros: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  busqueda: {
    flex: 1,
    minWidth: "200px",
  },
  lista: {
    display: "flex",
    flexDirection: "column",
    margin: "0",
    padding: "0",
    listStyleType: "none",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    padding: "10px 0",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  datos: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
    minWidth: "220px",
  },
  nombre: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  botones: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexWrap: "wrap",
  },
  nota: {
    color: tokens.colorNeutralForeground2,
    fontStyle: "italic",
  },
  espacio: {
    flex: 1,
  },
});

type Dialogo =
  | { tipo: "nota"; item: ItemVerificacion; resultado: ResultadoVerificacion }
  | { tipo: "todos" }
  | { tipo: "cerrar" }
  | { tipo: "cancelar" };

interface Props {
  id: number | null;
  onCerrar: () => void;
  /** Abrir la ficha del activo (para trasladarlo o darlo de baja según lo que se encontró). */
  onVerActivo: (id: number) => void;
}

/** Una verificación: la lista de activos para marcar uno por uno, y su cierre. */
export function VerificacionDetalle({ id, onCerrar, onVerActivo }: Props) {
  const estilos = useEstilos();
  const navegar = useNavigate();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede } = useSesion();
  const gestionar = puede("inventario.gestionar");

  const [busqueda, setBusqueda] = useState("");
  const [lugar, setLugar] = useState("");
  const [resultado, setResultado] = useState("");
  const [visibles, setVisibles] = useState(TANDA);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [nota, setNota] = useState("");
  const [lugarEncontrado, setLugarEncontrado] = useState("");
  const [conclusion, setConclusion] = useState("");
  // Activos con una marca en camino al servidor.
  const [enviando, setEnviando] = useState<number[]>([]);

  const consulta = useQuery({
    queryKey: ["inventario", "verificacion", id],
    queryFn: () => obtenerVerificacion(id!),
    enabled: id !== null,
  });
  const v: Verificacion | undefined = consulta.data;
  const lugares = useQuery({
    queryKey: ["inventario", "lugares"],
    queryFn: listarLugares,
    enabled: id !== null && Boolean(v?.puede_marcar),
  });

  useEffect(() => {
    setBusqueda("");
    setLugar("");
    setResultado("");
    setVisibles(TANDA);
    setDialogo(null);
  }, [id]);
  useEffect(() => setVisibles(TANDA), [busqueda, lugar, resultado]);

  const actualizar = (res: Verificacion) => {
    queryClient.setQueryData(["inventario", "verificacion", res.id], res);
    void queryClient.invalidateQueries({ queryKey: ["inventario", "verificaciones"] });
    void queryClient.invalidateQueries({ queryKey: ["tareas"] });
  };

  const marcar = useMutation({
    mutationFn: (datos: DatosMarcar) => marcarItems(id!, datos),
    onMutate: (datos) => setEnviando((actual) => [...actual, ...datos.items]),
    onSuccess: (res, datos) => {
      actualizar(res);
      if (datos.items.length > 1) notificar.exito(`${datos.items.length} activos marcados`);
      if (res.conteo.pendientes === 0 && res.conteo.total > 0) {
        notificar.exito("Todo revisado", gestionar ? "Ya puedes cerrar la verificación." : "Avisamos al jefe de laboratorio.");
      }
      setDialogo(null);
    },
    onError: (e) => notificar.error("No se pudo marcar", mensajeDeError(e)),
    onSettled: (_res, _error, datos) => setEnviando((actual) => actual.filter((i) => !datos.items.includes(i))),
  });

  const cerrar = useMutation({
    mutationFn: () => cerrarVerificacion(id!, conclusion.trim()),
    onSuccess: (res) => {
      actualizar(res);
      notificar.exito("Verificación cerrada", "Su tarea del pizarrón quedó hecha.");
      setDialogo(null);
      setConclusion("");
    },
    onError: (e) => notificar.error("No se pudo cerrar", mensajeDeError(e)),
  });

  const cancelar = useMutation({
    mutationFn: () => cancelarVerificacion(id!),
    onSuccess: (res) => {
      actualizar(res);
      notificar.exito("Verificación cancelada", "Su tarea salió del pizarrón.");
      setDialogo(null);
    },
    onError: (e) => notificar.error("No se pudo cancelar", mensajeDeError(e)),
  });

  const items = useMemo(() => v?.items ?? [], [v]);
  const lugaresDeLaLista = useMemo(() => [...new Set(items.map((i) => i.lugar_nombre))].sort(), [items]);
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!lugar || i.lugar_nombre === lugar) &&
        (!resultado || i.resultado === resultado) &&
        (!q || `${i.codigo} ${i.descripcion} ${i.tipo_nombre}`.toLowerCase().includes(q)),
    );
  }, [items, busqueda, lugar, resultado]);
  const pendientesVisibles = filtrados.filter((i) => i.resultado === "pendiente");

  const alElegir = (item: ItemVerificacion, elegido: ResultadoVerificacion) => {
    if (item.resultado === elegido) {
      // Tocar de nuevo el mismo resultado lo deja sin revisar.
      marcar.mutate({ items: [item.id], resultado: "pendiente", lugar_encontrado: null, nota: "" });
    } else if (elegido === "otro_lugar") {
      abrirNota(item, elegido);
    } else {
      marcar.mutate({ items: [item.id], resultado: elegido, lugar_encontrado: null, nota: item.nota });
    }
  };

  const abrirNota = (item: ItemVerificacion, elegido: ResultadoVerificacion) => {
    setNota(item.nota);
    setLugarEncontrado(item.lugar_encontrado ? String(item.lugar_encontrado) : "");
    setDialogo({ tipo: "nota", item, resultado: elegido });
  };

  const c = v?.conteo;
  const abierta = v?.estado === "abierta";

  return (
    <>
      <PanelFormulario
        abierto={id !== null}
        tamano="large"
        titulo={v?.titulo ?? "Verificación"}
        subtitulo={v ? `${v.alcance} · pedida por ${v.creado_por_nombre}, ${relativo(v.creado_en)}` : undefined}
        onCerrar={onCerrar}
        pie={
          v && abierta && gestionar ? (
            <>
              <Button appearance="primary" icon={<IconoCheck />} onClick={() => setDialogo({ tipo: "cerrar" })}>
                Cerrar verificación
              </Button>
              <span className={estilos.espacio} />
              <Button appearance="subtle" onClick={() => setDialogo({ tipo: "cancelar" })}>
                Cancelar verificación
              </Button>
            </>
          ) : undefined
        }
      >
        {consulta.isLoading && <Spinner label="Cargando…" />}
        {consulta.error && !v && <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />}
        {v && c && (
          <>
            <div className={estilos.etiquetas}>
              <EtiquetaEstado tono={abierta ? "marca" : v.estado === "cerrada" ? "exito" : "neutro"}>
                {v.estado_nombre}
              </EtiquetaEstado>
              {v.fecha_limite && <Caption1 className={estilos.secundario}>Hasta el {fechaCorta(v.fecha_limite)}</Caption1>}
              <Caption1 className={estilos.secundario}>
                {v.responsables_detalle.length
                  ? `Responsables: ${v.responsables_detalle.map((r) => r.nombre_completo).join(", ")}`
                  : "Para todos los auxiliares"}
              </Caption1>
            </div>

            <div className={estilos.avance}>
              <ProgressBar
                value={v.progreso / 100}
                thickness="large"
                color={v.estado === "cerrada" ? "success" : "brand"}
                aria-label={`Avance: ${v.progreso}%`}
              />
              <div className={estilos.etiquetas}>
                <Body1>
                  {c.revisados} de {c.total} revisados ({v.progreso}%)
                </Body1>
                {c.esta > 0 && <EtiquetaEstado tono="exito">{c.esta} están</EtiquetaEstado>}
                {c.falta > 0 && <EtiquetaEstado tono="peligro">{c.falta} faltan</EtiquetaEstado>}
                {c.otro_lugar > 0 && <EtiquetaEstado tono="aviso">{c.otro_lugar} en otro lugar</EtiquetaEstado>}
                {c.danado > 0 && <EtiquetaEstado tono="aviso">{c.danado} dañados</EtiquetaEstado>}
              </div>
            </div>

            {abierta && !v.puede_marcar && (
              <MessageBar intent="info">
                <MessageBarBody>Esta verificación está asignada a otras personas: puedes verla, pero no marcarla.</MessageBarBody>
              </MessageBar>
            )}
            {v.tarea !== null && puede("tareas.ver") && (
              <MessageBar intent="info" layout="multiline">
                <MessageBarBody>
                  Está en el pizarrón de tareas. Su avance se calcula solo con lo que se marca aquí.
                </MessageBarBody>
                <MessageBarActions>
                  <Button size="small" onClick={() => navegar(`/tareas?id=${v.tarea}`)}>
                    Ver en el pizarrón
                  </Button>
                </MessageBarActions>
              </MessageBar>
            )}

            {v.instrucciones && (
              <div className={estilos.seccion}>
                <Caption1 className={estilos.tituloSeccion}>Instrucciones</Caption1>
                <Body1 className={estilos.texto}>{v.instrucciones}</Body1>
              </div>
            )}
            {v.estado !== "abierta" && (
              <div className={estilos.seccion}>
                <Caption1 className={estilos.tituloSeccion}>
                  {v.estado === "cerrada" ? "Cierre" : "Cancelación"}
                </Caption1>
                <Body1 className={estilos.texto}>
                  {v.cerrada_por_nombre || "—"}
                  {v.cerrada_en ? `, ${relativo(v.cerrada_en)}` : ""}
                  {v.conclusion ? `\n${v.conclusion}` : ""}
                </Body1>
              </div>
            )}

            <div className={estilos.seccion}>
              <Caption1 className={estilos.tituloSeccion}>Activos</Caption1>
              <div className={estilos.filtros}>
                <SearchBox
                  className={estilos.busqueda}
                  placeholder="Buscar por código o descripción"
                  value={busqueda}
                  onChange={(_, d) => setBusqueda(d.value)}
                />
                {lugaresDeLaLista.length > 1 && (
                  <Select aria-label="Lugar" value={lugar} onChange={(_, d) => setLugar(d.value)}>
                    <option value="">Todos los lugares</option>
                    {lugaresDeLaLista.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                )}
                <Select aria-label="Resultado" value={resultado} onChange={(_, d) => setResultado(d.value)}>
                  <option value="">Todos</option>
                  <option value="pendiente">Sin revisar ({c.pendientes})</option>
                  {RESULTADOS.map((r) => (
                    <option key={r.valor} value={r.valor}>
                      {r.etiqueta} ({c[r.valor as "esta" | "falta" | "otro_lugar" | "danado"]})
                    </option>
                  ))}
                </Select>
              </div>
              {v.puede_marcar && pendientesVisibles.length > 1 && (
                <div>
                  <Button size="small" icon={<IconoCheck />} onClick={() => setDialogo({ tipo: "todos" })}>
                    Marcar «Está» los {pendientesVisibles.length} sin revisar de esta lista
                  </Button>
                </div>
              )}

              <ul className={estilos.lista}>
                {filtrados.slice(0, visibles).map((i) => {
                  const ocupado = enviando.includes(i.id);
                  return (
                    <li key={i.id} className={estilos.item}>
                      <div className={estilos.datos}>
                        <div className={estilos.nombre}>
                          <Codigo>{i.codigo}</Codigo>
                          <span>{i.descripcion}</span>
                        </div>
                        <Caption1 className={estilos.secundario}>
                          {i.tipo_nombre} · {i.lugar_nombre}
                          {i.verificado_por_nombre ? ` · marcó ${i.verificado_por_nombre}` : ""}
                        </Caption1>
                        {(i.nota || i.lugar_encontrado_nombre) && (
                          <Caption1 className={estilos.nota}>
                            {[i.lugar_encontrado_nombre && `Está en ${i.lugar_encontrado_nombre}`, i.nota]
                              .filter(Boolean)
                              .join(" · ")}
                          </Caption1>
                        )}
                      </div>
                      <div className={estilos.botones}>
                        {v.puede_marcar ? (
                          <>
                            {RESULTADOS.map((r) => (
                              <ToggleButton
                                key={r.valor}
                                size="small"
                                checked={i.resultado === r.valor}
                                disabled={ocupado}
                                onClick={() => alElegir(i, r.valor)}
                              >
                                {r.etiqueta}
                              </ToggleButton>
                            ))}
                            {i.resultado !== "pendiente" && (
                              <Tooltip content="Agregar o cambiar la nota" relationship="label">
                                <Button
                                  size="small"
                                  appearance="subtle"
                                  icon={<IconoComentario />}
                                  disabled={ocupado}
                                  onClick={() => abrirNota(i, i.resultado)}
                                />
                              </Tooltip>
                            )}
                          </>
                        ) : (
                          <EtiquetaEstado tono={TONO_RESULTADO[i.resultado]}>{i.resultado_nombre}</EtiquetaEstado>
                        )}
                        <Tooltip content="Ver la ficha del activo" relationship="label">
                          <Button size="small" appearance="subtle" icon={<IconoVer />} onClick={() => onVerActivo(i.activo)} />
                        </Tooltip>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {filtrados.length === 0 && <Caption1 className={estilos.secundario}>Ningún activo coincide.</Caption1>}
              {filtrados.length > visibles && (
                <div>
                  <Button size="small" onClick={() => setVisibles((n) => n + TANDA)}>
                    Mostrar más ({filtrados.length - visibles} restantes)
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={dialogo?.tipo === "nota"}
        titulo={
          dialogo?.tipo === "nota"
            ? `${dialogo.item.codigo}: ${RESULTADOS.find((r) => r.valor === dialogo.resultado)?.etiqueta ?? ""}`
            : ""
        }
        mensaje={dialogo?.tipo === "nota" ? dialogo.item.descripcion : undefined}
        textoConfirmar="Guardar"
        cargando={marcar.isPending}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() =>
          dialogo?.tipo === "nota" &&
          marcar.mutate({
            items: [dialogo.item.id],
            resultado: dialogo.resultado,
            lugar_encontrado: dialogo.resultado === "otro_lugar" && lugarEncontrado ? Number(lugarEncontrado) : null,
            nota: nota.trim(),
          })
        }
      >
        {dialogo?.tipo === "nota" && dialogo.resultado === "otro_lugar" && (
          <Field label="¿Dónde está?" hint="Opcional, si lo sabes.">
            <Select value={lugarEncontrado} onChange={(_, d) => setLugarEncontrado(d.value)}>
              <option value="">No lo sé</option>
              {(lugares.data ?? [])
                .filter((l) => l.activo && l.id !== dialogo.item.lugar)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <Field label="Nota" hint="Opcional. Ej.: le falta una rueda; lo tiene la secretaría.">
          <Input value={nota} maxLength={300} onChange={(_, d) => setNota(d.value)} />
        </Field>
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={dialogo?.tipo === "todos"}
        titulo={`¿Marcar «Está» en ${pendientesVisibles.length} activos?`}
        mensaje="Son los que siguen sin revisar en la lista que estás viendo (con sus filtros). Los que ya marcaste no cambian."
        textoConfirmar="Marcar todos"
        cargando={marcar.isPending}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() =>
          marcar.mutate({ items: pendientesVisibles.map((i) => i.id), resultado: "esta", lugar_encontrado: null, nota: "" })
        }
      />

      <ConfirmarDialogo
        abierto={dialogo?.tipo === "cerrar"}
        titulo={`¿Cerrar «${v?.titulo ?? ""}»?`}
        mensaje={
          c && c.pendientes > 0
            ? `Todavía hay ${c.pendientes} ${c.pendientes === 1 ? "activo" : "activos"} sin revisar: quedarán así. Ya no se podrá marcar y la tarea del pizarrón quedará hecha.`
            : "Ya no se podrá marcar y la tarea del pizarrón quedará hecha. Los traslados o bajas que correspondan los registras tú en cada activo."
        }
        textoConfirmar="Cerrar verificación"
        cargando={cerrar.isPending}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => cerrar.mutate()}
      >
        <Field label="Conclusión" hint="Opcional. Qué se encontró y qué se hará.">
          <Textarea value={conclusion} resize="vertical" rows={3} onChange={(_, d) => setConclusion(d.value)} />
        </Field>
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={dialogo?.tipo === "cancelar"}
        titulo={`¿Cancelar «${v?.titulo ?? ""}»?`}
        mensaje="Úsalo si se pidió por error. Queda como cancelada y su tarea sale del pizarrón."
        textoConfirmar="Sí, cancelarla"
        peligroso
        cargando={cancelar.isPending}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => cancelar.mutate()}
      />
    </>
  );
}
