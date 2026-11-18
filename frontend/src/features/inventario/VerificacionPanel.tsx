import {
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { VerificacionDetalle } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import { ListaSeleccion } from "../../components/formularios/ListaSeleccion";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { ROLES, etiquetaDe } from "../../lib/constantes";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { opcionesUsuarios } from "../usuarios/api";
import { crearVerificacion, listarActivos, listarLugares, listarTipos } from "./api";

/** Cuántos activos se cargan para elegir uno por uno. */
const MAXIMO_LISTA = 500;

const useEstilos = makeStyles({
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
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    "@media (max-width: 600px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  total: {
    fontWeight: tokens.fontWeightSemibold,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
});

type Modo = "todos" | "filtros" | "seleccion";

interface Formulario {
  titulo: string;
  instrucciones: string;
  fecha_limite: string;
  responsables: number[];
  modo: Modo;
  tipos: number[];
  lugares: number[];
  activos: number[];
}

const vacio = (): Formulario => ({
  titulo: "",
  instrucciones: "",
  fecha_limite: "",
  responsables: [],
  modo: "filtros",
  tipos: [],
  lugares: [],
  activos: [],
});

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCreada: (verificacion: VerificacionDetalle) => void;
}

/**
 * Pedir una verificación: todos los activos, los de ciertos tipos o lugares, o una selección.
 * Se copia la lista como está ahora, aparece una tarea en el pizarrón y se avisa.
 */
export function VerificacionPanel({ abierto, onCerrar, onCreada }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<Formulario>(vacio());
  const { valores: v, errores: e } = f;

  useEffect(() => {
    if (abierto) f.reiniciar(vacio());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const tipos = useQuery({ queryKey: ["inventario", "tipos"], queryFn: listarTipos, enabled: abierto });
  const lugares = useQuery({ queryKey: ["inventario", "lugares"], queryFn: listarLugares, enabled: abierto });
  const personas = useQuery({
    queryKey: ["usuarios", "opciones", "auxiliar,admin"],
    queryFn: () => opcionesUsuarios("auxiliar,admin"),
    enabled: abierto,
  });

  // Los filtros de tipo y lugar sirven en dos modos: para definir qué se verifica
  // ("filtros") o para acortar la lista de la que se elige ("seleccion").
  const filtroTipos = v.modo === "todos" ? "" : v.tipos.join(",");
  const filtroLugares = v.modo === "todos" ? "" : v.lugares.join(",");
  const candidatos = useQuery({
    queryKey: ["inventario", "activos", "para-verificar", v.modo === "seleccion", filtroTipos, filtroLugares],
    queryFn: () =>
      listarActivos({
        page: 1,
        page_size: v.modo === "seleccion" ? MAXIMO_LISTA : 1,
        tipos: filtroTipos || undefined,
        lugares: filtroLugares || undefined,
        vigentes: true,
        ordering: "lugar__nombre",
      }),
    enabled: abierto,
  });
  const coinciden = candidatos.data?.count ?? 0;
  const total = v.modo === "seleccion" ? v.activos.length : coinciden;

  const guardar = useMutation({
    mutationFn: () =>
      crearVerificacion({
        titulo: v.titulo.trim(),
        instrucciones: v.instrucciones.trim(),
        fecha_limite: v.fecha_limite || null,
        responsables: v.responsables,
        tipos: v.modo === "filtros" ? v.tipos : [],
        lugares: v.modo === "filtros" ? v.lugares : [],
        activos: v.modo === "seleccion" ? v.activos : [],
      }),
    onSuccess: (res) => {
      notificar.exito(
        "Verificación pedida",
        `${res.conteo.total} ${res.conteo.total === 1 ? "activo" : "activos"}. Ya está en el pizarrón de tareas.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["inventario"] });
      void queryClient.invalidateQueries({ queryKey: ["tareas"] });
      onCreada(res);
    },
    onError: f.tomarErroresDelServidor,
  });

  const completo = v.titulo.trim() && total > 0 && !candidatos.isLoading;

  return (
    <PanelFormulario
      abierto={abierto}
      tamano="large"
      titulo="Pedir verificación de inventario"
      subtitulo="Los auxiliares revisan si cada activo está donde debería. Verificar no mueve nada: tú decides después qué trasladar o dar de baja."
      onCerrar={onCerrar}
      hayCambios={f.cambiado && !guardar.isPending}
      pie={
        <>
          <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending
              ? "Creando…"
              : total > 0
                ? `Mandar a verificar ${total} ${total === 1 ? "activo" : "activos"}`
                : "Mandar a verificar"}
          </Button>
          <Button onClick={onCerrar}>Cancelar</Button>
        </>
      }
    >
      {e.general && (
        <MessageBar intent="error">
          <MessageBarBody>{e.general}</MessageBarBody>
        </MessageBar>
      )}

      <Field label="Título" required {...estadoCampo(e.titulo)}>
        <Input
          value={v.titulo}
          maxLength={150}
          placeholder="Ej.: Sillas y mesas del LAB-41"
          onChange={(_, d) => f.set("titulo", d.value)}
        />
      </Field>

      <div className={estilos.seccion}>
        <Caption1 className={estilos.tituloSeccion}>Qué verificar</Caption1>
        <RadioGroup value={v.modo} onChange={(_, d) => f.set("modo", d.value as Modo)}>
          <Radio value="filtros" label="Los activos de ciertos tipos o lugares" />
          <Radio value="seleccion" label="Activos que elijo uno por uno" />
          <Radio value="todos" label="Absolutamente todos los activos" />
        </RadioGroup>

        {v.modo !== "todos" && (
          <div className={estilos.fila}>
            <Field label="Tipos" hint={v.modo === "filtros" ? "Sin marcar ninguno = todos los tipos." : "Para acortar la lista."}>
              <ListaSeleccion
                opciones={(tipos.data ?? []).map((t) => ({ id: t.id, etiqueta: t.nombre, secundaria: `${t.total_activos} activos` }))}
                seleccionados={v.tipos}
                onCambio={(ids) => f.set("tipos", ids)}
                placeholder="Buscar tipo"
                alto={170}
              />
            </Field>
            <Field
              label="Lugares"
              hint={v.modo === "filtros" ? "Sin marcar ninguno = todos los lugares." : "Para acortar la lista."}
            >
              <ListaSeleccion
                opciones={(lugares.data ?? []).map((l) => ({ id: l.id, etiqueta: l.nombre, secundaria: `${l.total_activos} activos` }))}
                seleccionados={v.lugares}
                onCambio={(ids) => f.set("lugares", ids)}
                placeholder="Buscar lugar"
                alto={170}
              />
            </Field>
          </div>
        )}

        {v.modo === "seleccion" && (
          <Field
            label="Activos"
            hint={
              coinciden > MAXIMO_LISTA
                ? `Se muestran los primeros ${MAXIMO_LISTA} de ${coinciden}. Usa los filtros de arriba para acortar la lista.`
                : "Lo que marques se conserva aunque cambies los filtros."
            }
            {...estadoCampo(e.activos)}
          >
            <ListaSeleccion
              opciones={(candidatos.data?.results ?? []).map((a) => ({
                id: a.id,
                etiqueta: `${a.codigo} · ${a.descripcion}`,
                secundaria: `${a.tipo_nombre} · ${a.lugar_nombre}`,
              }))}
              seleccionados={v.activos}
              onCambio={(ids) => f.set("activos", ids)}
              placeholder="Buscar por código o descripción"
              alto={260}
            />
          </Field>
        )}

        <Caption1 className={total > 0 ? estilos.total : estilos.secundario}>
          {candidatos.isLoading
            ? "Contando activos…"
            : total > 0
              ? `Se ${total === 1 ? "verificará 1 activo" : `verificarán ${total} activos`}. Los dados de baja no entran.`
              : v.modo === "seleccion"
                ? "Marca al menos un activo."
                : "No hay activos con esos filtros."}
        </Caption1>
      </div>

      <Field label="Instrucciones" hint="Opcional. Se muestran en la verificación y en la tarea." {...estadoCampo(e.instrucciones)}>
        <Textarea
          value={v.instrucciones}
          resize="vertical"
          rows={3}
          placeholder="Ej.: Revisar el código pegado en cada silla. Si falta la etiqueta, anotarlo."
          onChange={(_, d) => f.set("instrucciones", d.value)}
        />
      </Field>

      <div className={estilos.fila}>
        <Field
          label="Responsables"
          hint="Si no eliges a nadie, se avisa a todos los auxiliares y cualquiera puede marcarla."
          {...estadoCampo(e.responsables)}
        >
          <ListaSeleccion
            opciones={(personas.data ?? []).map((p) => ({
              id: p.id,
              etiqueta: p.nombre_completo,
              secundaria: etiquetaDe(ROLES, p.rol),
            }))}
            seleccionados={v.responsables}
            onCambio={(ids) => f.set("responsables", ids)}
            placeholder="Buscar auxiliar"
            alto={170}
          />
        </Field>
        <Field label="Fecha límite" hint="Opcional." {...estadoCampo(e.fecha_limite)}>
          <Input type="date" value={v.fecha_limite} onChange={(_, d) => f.set("fecha_limite", d.value)} />
        </Field>
      </div>
    </PanelFormulario>
  );
}
