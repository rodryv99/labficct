import {
  Button,
  Caption1,
  Field,
  Input,
  Label,
  MessageBar,
  MessageBarBody,
  Select,
  Switch,
  Textarea,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { CategoriaElemento, IconoElemento as Icono, TipoElemento } from "../../api/tipos";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { useNotificar } from "../../components/feedback/notificaciones";
import { CampoImagen } from "../../components/formularios/CampoImagen";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoElemento } from "../../components/iconos/IconoElemento";
import { IconoEliminar } from "../../components/iconos/iconos";
import { CATEGORIAS_ELEMENTO, COLORES_ELEMENTO, ICONOS_ELEMENTO } from "../../lib/constantes";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { useUrlObjeto } from "../../lib/useUrlObjeto";
import { type DatosElemento, actualizarElemento, crearElemento, eliminarElemento } from "./api";
import { FichaIcono } from "./ElementosPage";

const useEstilos = makeStyles({
  vistaPrevia: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  casilla: {
    width: "64px",
    height: "64px",
    borderRadius: "10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    fontSize: "11px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  iconos: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: "6px",
  },
  opcionIcono: {
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground2,
    cursor: "pointer",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  opcionActiva: {
    border: `2px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  colores: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
  },
  color: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "2px solid transparent",
    cursor: "pointer",
    outlineOffset: "2px",
  },
  colorActivo: {
    outline: `2px solid ${tokens.colorNeutralForeground1}`,
  },
  colorPropio: {
    width: "36px",
    height: "30px",
    padding: "0",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "transparent",
    cursor: "pointer",
  },
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  espacio: {
    flex: 1,
  },
});

const VACIO: DatosElemento = {
  nombre: "",
  categoria: "equipo",
  icono: "pc",
  color: COLORES_ELEMENTO[0],
  prefijo_etiqueta: "",
  descripcion: "",
  activo: true,
  imagen: null,
  quitar_imagen: false,
};

interface Props {
  abierto: boolean;
  elemento: TipoElemento | null;
  onCerrar: () => void;
}

export function ElementoPanel({ abierto, elemento, onCerrar }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<DatosElemento>(VACIO);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const esNuevo = elemento === null;

  useEffect(() => {
    if (!abierto) return;
    f.reiniciar(
      elemento
        ? {
            nombre: elemento.nombre,
            categoria: elemento.categoria,
            icono: elemento.icono,
            color: elemento.color,
            prefijo_etiqueta: elemento.prefijo_etiqueta,
            descripcion: elemento.descripcion,
            activo: elemento.activo,
            imagen: null,
            quitar_imagen: false,
          }
        : VACIO,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, elemento]);

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["elementos"] });
    void queryClient.invalidateQueries({ queryKey: ["laboratorios"] });
  };

  const guardar = useMutation({
    mutationFn: () => (esNuevo ? crearElemento(f.valores) : actualizarElemento(elemento.id, f.valores)),
    onSuccess: (el) => {
      notificar.exito(esNuevo ? "Elemento creado" : "Cambios guardados", el.nombre);
      refrescar();
      onCerrar();
    },
    onError: f.tomarErroresDelServidor,
  });

  const eliminar = useMutation({
    mutationFn: () => eliminarElemento(elemento!.id),
    onSuccess: () => {
      notificar.exito("Elemento eliminado");
      setConfirmarEliminar(false);
      refrescar();
      onCerrar();
    },
    onError: (e) => {
      setConfirmarEliminar(false);
      notificar.error("No se pudo eliminar", mensajeDeError(e));
    },
  });

  const { valores: v, errores: e } = f;
  const imagenActual = !v.quitar_imagen ? elemento?.imagen ?? null : null;
  const urlNueva = useUrlObjeto(v.imagen);
  const prefijo = v.prefijo_etiqueta.trim();

  return (
    <>
      <PanelFormulario
        abierto={abierto}
        titulo={esNuevo ? "Nuevo elemento" : elemento.nombre}
        subtitulo="Así se verá en la grilla de los laboratorios."
        onCerrar={onCerrar}
        hayCambios={f.cambiado && !guardar.isPending}
        pie={
          <>
            <Button
              appearance="primary"
              disabled={!v.nombre.trim() || guardar.isPending}
              onClick={() => guardar.mutate()}
            >
              {guardar.isPending ? "Guardando…" : esNuevo ? "Crear elemento" : "Guardar cambios"}
            </Button>
            <Button onClick={onCerrar}>Cancelar</Button>
            <span className={estilos.espacio} />
            {!esNuevo && (
              <Tooltip content="Eliminar elemento" relationship="label">
                <Button appearance="subtle" icon={<IconoEliminar />} onClick={() => setConfirmarEliminar(true)} />
              </Tooltip>
            )}
          </>
        }
      >
        {e.general && Object.keys(e).length === 1 && (
          <MessageBar intent="error">
            <MessageBarBody>{e.general}</MessageBarBody>
          </MessageBar>
        )}

        <div className={estilos.vistaPrevia}>
          <div className={estilos.casilla} style={{ border: `1.5px solid ${v.color}88`, backgroundColor: `${v.color}14` }}>
            {urlNueva || imagenActual ? (
              <FichaIcono tipo={{ icono: v.icono, color: v.color, imagen: urlNueva ?? imagenActual }} tamano={34} />
            ) : (
              <IconoElemento icono={v.icono} tamano={26} color={v.color} />
            )}
            <span>{prefijo ? `${prefijo}-01` : ""}</span>
          </div>
          <div>
            <Label weight="semibold">{v.nombre || "Nombre del elemento"}</Label>
            <Caption1 as="p">
              {CATEGORIAS_ELEMENTO.find((c) => c.valor === v.categoria)?.etiqueta}
            </Caption1>
          </div>
        </div>

        <Field label="Nombre" required {...estadoCampo(e.nombre)}>
          <Input value={v.nombre} placeholder="Ej.: Computadora" onChange={(_, d) => f.set("nombre", d.value)} />
        </Field>

        <div className={estilos.fila}>
          <Field label="Categoría" {...estadoCampo(e.categoria)}>
            <Select value={v.categoria} onChange={(_, d) => f.set("categoria", d.value as CategoriaElemento)}>
              {CATEGORIAS_ELEMENTO.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.etiqueta}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Prefijo de etiqueta"
            hint="Para numerar: PC → PC-01"
            {...estadoCampo(e.prefijo_etiqueta)}
          >
            <Input
              value={v.prefijo_etiqueta}
              maxLength={10}
              onChange={(_, d) => f.set("prefijo_etiqueta", d.value.toUpperCase())}
            />
          </Field>
        </div>

        <Field label="Ícono">
          <div className={estilos.iconos} role="radiogroup" aria-label="Ícono">
            {ICONOS_ELEMENTO.map((i) => (
              <Tooltip key={i.valor} content={i.etiqueta} relationship="label">
                <button
                  type="button"
                  role="radio"
                  aria-checked={v.icono === i.valor}
                  className={mergeClasses(estilos.opcionIcono, v.icono === i.valor && estilos.opcionActiva)}
                  onClick={() => f.set("icono", i.valor as Icono)}
                >
                  <IconoElemento icono={i.valor} tamano={22} />
                </button>
              </Tooltip>
            ))}
          </div>
        </Field>

        <Field label="Color" {...estadoCampo(e.color)}>
          <div className={estilos.colores}>
            {COLORES_ELEMENTO.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                className={mergeClasses(estilos.color, v.color.toUpperCase() === c.toUpperCase() && estilos.colorActivo)}
                style={{ backgroundColor: c }}
                onClick={() => f.set("color", c)}
              />
            ))}
            <Tooltip content="Otro color" relationship="label">
              <input
                type="color"
                className={estilos.colorPropio}
                value={v.color}
                onChange={(ev) => f.set("color", ev.target.value.toUpperCase())}
              />
            </Tooltip>
          </div>
        </Field>

        <Field label="Imagen propia" hint="Opcional. Reemplaza al ícono en la grilla.">
          <CampoImagen
            actual={elemento?.imagen ?? null}
            archivo={v.imagen ?? null}
            quitada={Boolean(v.quitar_imagen)}
            onArchivo={(archivo) => {
              f.set("imagen", archivo);
              if (archivo) f.set("quitar_imagen", false);
            }}
            onQuitar={() => f.set("quitar_imagen", true)}
          />
        </Field>

        <Field label="Descripción" {...estadoCampo(e.descripcion)}>
          <Textarea value={v.descripcion} resize="vertical" onChange={(_, d) => f.set("descripcion", d.value)} />
        </Field>

        {!esNuevo && (
          <Switch
            label={v.activo ? "Activo: aparece en la paleta del editor" : "Inactivo: no se ofrece al dibujar"}
            checked={v.activo}
            onChange={(_, d) => f.set("activo", d.checked)}
          />
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={confirmarEliminar}
        titulo={`¿Eliminar «${elemento?.nombre}»?`}
        mensaje={
          elemento && elemento.en_uso > 0
            ? `Está en ${elemento.en_uso} casillas, así que no se puede eliminar. Desactívalo para que deje de ofrecerse.`
            : "Esta acción no se puede deshacer."
        }
        textoConfirmar="Eliminar"
        peligroso
        deshabilitado={Boolean(elemento && elemento.en_uso > 0)}
        cargando={eliminar.isPending}
        onCancelar={() => setConfirmarEliminar(false)}
        onConfirmar={() => eliminar.mutate()}
      />
    </>
  );
}
