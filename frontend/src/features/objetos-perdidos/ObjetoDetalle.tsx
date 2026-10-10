import {
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Field,
  Spinner,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { mensajeDeError } from "../../api/errores";
import { ENDPOINTS } from "../../api/endpoints";
import type { FotoEntrega, ObjetoPerdido } from "../../api/tipos";
import { useSesion } from "../../app/sesion";
import { Codigo, EtiquetaEstado } from "../../components/datos/Etiquetas";
import { VisorImagen } from "../../components/datos/VisorImagen";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoError } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoAcercar, IconoCandado, IconoEditar } from "../../components/iconos/iconos";
import { fechaHora } from "../../lib/fechas";
import { useImagenProtegida } from "../../lib/useImagenProtegida";
import { type DatosEntrega, anularObjeto, entregarObjeto, obtenerObjeto } from "./api";
import { DialogoEntrega } from "./DialogoEntrega";
import { TONO_OBJETO } from "./ObjetosPerdidosPage";

const useEstilos = makeStyles({
  marcoFoto: {
    position: "relative",
    display: "block",
    width: "100%",
    padding: 0,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: "hidden",
    cursor: "zoom-in",
    ":hover": {
      borderColor: tokens.colorBrandStroke1,
    },
  },
  foto: {
    display: "block",
    width: "100%",
    height: "260px",
    // Se ve completa (sin recortes); el fondo rellena los costados.
    objectFit: "contain",
  },
  ampliar: {
    position: "absolute",
    right: "8px",
    bottom: "8px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 8px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    boxShadow: tokens.shadow4,
  },
  fotosEntrega: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginTop: "10px",
  },
  miniatura: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: 0,
    border: "none",
    background: "none",
    cursor: "zoom-in",
    textAlign: "left",
    fontFamily: "inherit",
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  imagenMiniatura: {
    width: "100%",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  cargandoMiniatura: {
    width: "100%",
    aspectRatio: "4 / 3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  cabecera: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
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
  texto: {
    whiteSpace: "pre-wrap",
  },
  entrega: {
    padding: "12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorStatusSuccessBackground1,
  },
  anulado: {
    padding: "12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  tituloSeccion: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  linea: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    paddingLeft: "20px",
    borderLeft: `2px solid ${tokens.colorNeutralStroke2}`,
    marginLeft: "6px",
  },
  evento: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    "::before": {
      content: '""',
      position: "absolute",
      left: "-27px",
      top: "4px",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      backgroundColor: tokens.colorBrandForeground1,
      border: `2px solid ${tokens.colorNeutralBackground1}`,
    },
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  nota: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: tokens.colorNeutralForeground3,
  },
  campos: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
});

const NOMBRE_FOTO: Record<FotoEntrega, string> = {
  "ci-anverso": "CI · anverso",
  "ci-reverso": "CI · reverso",
  persona: "Quien recibió",
};

/** Miniatura de una foto de la entrega. Se descarga con sesión (no tiene URL pública). */
function FotoDeEntrega({
  objeto,
  nombre,
  onVer,
}: {
  objeto: number;
  nombre: FotoEntrega;
  onVer: (url: string, titulo: string) => void;
}) {
  const estilos = useEstilos();
  const { url, cargando } = useImagenProtegida(ENDPOINTS.objetosPerdidos.fotoEntrega(objeto, nombre));
  return (
    <button
      type="button"
      className={estilos.miniatura}
      disabled={!url}
      onClick={() => url && onVer(url, NOMBRE_FOTO[nombre])}
    >
      {url ? (
        <img src={url} alt={NOMBRE_FOTO[nombre]} className={estilos.imagenMiniatura} />
      ) : (
        <span className={estilos.cargandoMiniatura}>{cargando ? <Spinner size="tiny" /> : "—"}</span>
      )}
      {NOMBRE_FOTO[nombre]}
    </button>
  );
}

interface Props {
  id: number | null;
  onCerrar: () => void;
  onEditar: (objeto: ObjetoPerdido) => void;
}

export function ObjetoDetalle({ id, onCerrar, onEditar }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const { puede } = useSesion();
  const [dialogo, setDialogo] = useState<"entregar" | "anular" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [visor, setVisor] = useState<{ url: string; titulo: string } | null>(null);

  const consulta = useQuery({
    queryKey: ["objetos", "detalle", id],
    queryFn: () => obtenerObjeto(id!),
    enabled: id !== null,
  });
  const o = consulta.data;

  const actualizar = (titulo: string) => {
    notificar.exito(titulo);
    setDialogo(null);
    setMotivo("");
    void queryClient.invalidateQueries({ queryKey: ["objetos"] });
  };

  const entregar = useMutation({
    mutationFn: (datos: DatosEntrega) => entregarObjeto(id!, datos),
    onSuccess: () => actualizar("Entrega registrada"),
    onError: (e) => notificar.error("No se pudo registrar la entrega", mensajeDeError(e)),
  });
  const anular = useMutation({
    mutationFn: () => anularObjeto(id!, motivo),
    onSuccess: () => actualizar("Registro anulado"),
    onError: (e) => notificar.error("No se pudo anular", mensajeDeError(e)),
  });

  const enCustodia = o?.estado === "en_custodia";
  const puedeRegistrar = puede("objetos.registrar");

  return (
    <>
      <PanelFormulario
        abierto={id !== null}
        titulo={o?.descripcion ?? "Objeto perdido"}
        subtitulo={o ? o.codigo : undefined}
        onCerrar={onCerrar}
        pie={
          o && enCustodia && puedeRegistrar ? (
            <>
              <Button appearance="primary" onClick={() => setDialogo("entregar")}>
                Entregar a su dueño
              </Button>
              <Button icon={<IconoEditar />} onClick={() => onEditar(o)}>
                Editar
              </Button>
              {puede("objetos.anular") && (
                <Button appearance="subtle" onClick={() => setDialogo("anular")}>
                  Anular
                </Button>
              )}
            </>
          ) : o && o.estado === "entregado" && puede("objetos.anular") ? (
            <Button appearance="subtle" onClick={() => setDialogo("anular")}>
              Anular registro
            </Button>
          ) : undefined
        }
      >
        {consulta.isLoading && <Spinner label="Cargando…" />}
        {consulta.error && <EstadoError error={consulta.error} onReintentar={() => void consulta.refetch()} />}
        {o && (
          <>
            {o.foto && (
              <button
                type="button"
                className={estilos.marcoFoto}
                onClick={() => setVisor({ url: o.foto!, titulo: `${o.codigo} · ${o.descripcion}` })}
                aria-label="Ver la foto completa"
              >
                <img src={o.foto} alt={o.descripcion} className={estilos.foto} />
                <span className={estilos.ampliar}>
                  <IconoAcercar /> Ver completa
                </span>
              </button>
            )}
            <div className={estilos.cabecera}>
              <Codigo>{o.codigo}</Codigo>
              <EtiquetaEstado tono={TONO_OBJETO[o.estado]}>{o.estado_nombre}</EtiquetaEstado>
            </div>

            {o.estado === "entregado" && (
              <div className={estilos.entrega}>
                <Body1Strong>Entregado a {o.entregado_a}</Body1Strong>
                <Caption1 as="p">
                  {o.entregado_ci && `CI ${o.entregado_ci} · `}
                  {o.entregado_en && fechaHora(o.entregado_en)}
                  {o.entregado_por_nombre && ` · por ${o.entregado_por_nombre}`}
                </Caption1>
                {o.fotos_entrega.length > 0 && (
                  <div className={estilos.fotosEntrega}>
                    {o.fotos_entrega.map((nombre) => (
                      <FotoDeEntrega
                        key={nombre}
                        objeto={o.id}
                        nombre={nombre}
                        onVer={(url, titulo) => setVisor({ url, titulo: `${o.codigo} · ${titulo}` })}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            {o.estado === "anulado" && (
              <div className={estilos.anulado}>
                <Body1Strong>Registro anulado</Body1Strong>
                <Caption1 as="p">{o.motivo_anulacion}</Caption1>
              </div>
            )}

            <div className={estilos.cuadro}>
              <Caption1 className={estilos.clave}>Categoría</Caption1>
              <Body1>{o.categoria_nombre}</Body1>
              {o.caracteristicas && (
                <>
                  <Caption1 className={estilos.clave}>Características</Caption1>
                  <Body1 className={estilos.texto}>{o.caracteristicas}</Body1>
                </>
              )}
              <Caption1 className={estilos.clave}>Dónde</Caption1>
              <Body1>{[o.laboratorio_codigo, o.lugar].filter(Boolean).join(" · ") || "—"}</Body1>
              <Caption1 className={estilos.clave}>Hallado</Caption1>
              <Body1>{fechaHora(o.fecha_hallazgo)}</Body1>
              {o.encontrado_por && (
                <>
                  <Caption1 className={estilos.clave}>Encontrado por</Caption1>
                  <Body1>{o.encontrado_por}</Body1>
                </>
              )}
              <Caption1 className={estilos.clave}>Registrado por</Caption1>
              <Body1>{o.registrado_por_nombre || "—"}</Body1>
            </div>

            <Caption1 className={estilos.tituloSeccion}>Historial</Caption1>
            <div className={estilos.linea}>
              {o.eventos.map((ev) => (
                <div key={ev.id} className={estilos.evento}>
                  <Body1Strong>{ev.tipo_nombre}</Body1Strong>
                  {ev.detalle && <Body1 className={estilos.texto}>{ev.detalle}</Body1>}
                  <Caption1 className={estilos.secundario}>
                    {fechaHora(ev.fecha)}
                    {ev.usuario_nombre && ` · ${ev.usuario_nombre}`}
                  </Caption1>
                </div>
              ))}
            </div>

            <Caption1 className={estilos.nota}>
              <IconoCandado /> Los registros de objetos perdidos no se pueden eliminar.
            </Caption1>
          </>
        )}
      </PanelFormulario>

      <DialogoEntrega
        abierto={dialogo === "entregar"}
        descripcion={o?.descripcion ?? ""}
        cargando={entregar.isPending}
        onCancelar={() => setDialogo(null)}
        onConfirmar={(datos) => entregar.mutate(datos)}
      />

      <ConfirmarDialogo
        abierto={dialogo === "anular"}
        titulo={`¿Anular ${o?.codigo}?`}
        mensaje="Usa esto solo para corregir un registro equivocado o duplicado. El registro no se borra: queda anulado con el motivo."
        textoConfirmar="Anular"
        peligroso
        cargando={anular.isPending}
        deshabilitado={!motivo.trim()}
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => anular.mutate()}
      >
        <Field label="Motivo" required>
          <Textarea value={motivo} onChange={(_, d) => setMotivo(d.value)} />
        </Field>
      </ConfirmarDialogo>

      <VisorImagen src={visor?.url ?? null} titulo={visor?.titulo ?? ""} onCerrar={() => setVisor(null)} />
    </>
  );
}
