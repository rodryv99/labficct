import {
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Textarea,
  makeStyles,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { ActivoDetalle, EstadoActivo } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { PanelDictado } from "../dictado/PanelDictado";
import { type ResultadoActivo, interpretarDictadoActivo } from "./dictadoActivo";
import { type DatosActivo, ESTADOS_ACTIVO, crearActivo, editarActivo, listarLugares, listarTipos } from "./api";

const useEstilos = makeStyles({
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    "@media (max-width: 480px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
});

interface Formulario {
  codigo: string;
  descripcion: string;
  tipo: number | null;
  lugar: number | null;
  estado: EstadoActivo;
  marca: string;
  modelo: string;
  serie: string;
  fecha_adquisicion: string;
  responsable: string;
  observaciones: string;
}

const vacio = (): Formulario => ({
  codigo: "",
  descripcion: "",
  tipo: null,
  lugar: null,
  estado: "operativo",
  marca: "",
  modelo: "",
  serie: "",
  fecha_adquisicion: "",
  responsable: "",
  observaciones: "",
});

interface Props {
  abierto: boolean;
  /** null = alta de un activo nuevo. */
  activo: ActivoDetalle | null;
  onCerrar: () => void;
  onGuardado: (activo: ActivoDetalle) => void;
}

/** Alta de un activo, o corrección de sus datos (queda anotada en su historial). */
export function ActivoPanel({ abierto, activo, onCerrar, onGuardado }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<Formulario>(vacio());
  const esNuevo = activo === null;

  const tipos = useQuery({ queryKey: ["inventario", "tipos"], queryFn: listarTipos, enabled: abierto });
  const lugares = useQuery({ queryKey: ["inventario", "lugares"], queryFn: listarLugares, enabled: abierto });

  // Dictado por voz: rellena el formulario desde una frase. No guarda nada.
  const aplicarDictado = (r: ResultadoActivo) =>
    f.setValores((a) => ({
      ...a,
      descripcion: r.descripcion ?? a.descripcion,
      codigo: r.codigo ?? a.codigo,
      tipo: r.tipo ?? a.tipo,
      lugar: r.lugar ?? a.lugar,
      estado: r.estado ?? a.estado,
      marca: r.marca ?? a.marca,
      modelo: r.modelo ?? a.modelo,
      serie: r.serie ?? a.serie,
      fecha_adquisicion: r.fecha_adquisicion ?? a.fecha_adquisicion,
      observaciones: r.observaciones ?? a.observaciones,
    }));

  useEffect(() => {
    if (!abierto) return;
    f.reiniciar(
      activo
        ? {
            codigo: activo.codigo,
            descripcion: activo.descripcion,
            tipo: activo.tipo,
            lugar: activo.lugar,
            estado: activo.estado,
            marca: activo.marca,
            modelo: activo.modelo,
            serie: activo.serie,
            fecha_adquisicion: activo.fecha_adquisicion ?? "",
            responsable: activo.responsable,
            observaciones: activo.observaciones,
          }
        : vacio(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, activo]);

  const guardar = useMutation({
    mutationFn: () => {
      const v = f.valores;
      const datos: DatosActivo = {
        codigo: v.codigo.trim(),
        descripcion: v.descripcion.trim(),
        marca: v.marca.trim(),
        modelo: v.modelo.trim(),
        serie: v.serie.trim(),
        fecha_adquisicion: v.fecha_adquisicion || null,
        responsable: v.responsable.trim(),
        observaciones: v.observaciones.trim(),
        tipo: v.tipo,
      };
      return esNuevo ? crearActivo({ ...datos, lugar: v.lugar!, estado: v.estado }) : editarActivo(activo.id, datos);
    },
    onSuccess: (a) => {
      notificar.exito(esNuevo ? "Activo registrado" : "Cambios guardados", `${a.codigo} · ${a.descripcion}`);
      queryClient.setQueryData(["inventario", "activo", a.id], a);
      void queryClient.invalidateQueries({ queryKey: ["inventario"] });
      onGuardado(a);
    },
    onError: f.tomarErroresDelServidor,
  });

  const { valores: v, errores: e } = f;
  const completo = v.codigo.trim() && v.descripcion.trim() && (!esNuevo || v.lugar !== null);
  // Los desactivados solo aparecen si el activo ya los tenía.
  const tiposVisibles = (tipos.data ?? []).filter((t) => t.activo || t.id === v.tipo);
  const lugaresVisibles = (lugares.data ?? []).filter((l) => l.activo);

  return (
    <PanelFormulario
      abierto={abierto}
      titulo={esNuevo ? "Registrar activo" : `Editar ${activo.codigo}`}
      subtitulo={
        esNuevo
          ? "Entra al inventario en el lugar y con el estado que elijas."
          : "Corrige sus datos. Cada cambio queda anotado en su historial."
      }
      onCerrar={onCerrar}
      hayCambios={f.cambiado && !guardar.isPending}
      pie={
        <>
          <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending ? "Guardando…" : esNuevo ? "Registrar" : "Guardar cambios"}
          </Button>
          <Button onClick={onCerrar}>Cancelar</Button>
        </>
      }
    >
      {e.general && Object.keys(e).length <= 2 && (
        <MessageBar intent="error">
          <MessageBarBody>{e.general}</MessageBarBody>
        </MessageBar>
      )}

      {esNuevo && (
        <PanelDictado<ResultadoActivo>
          etiqueta="Dicta o escribe el activo en una frase"
          ejemplo="Ej.: Proyector Epson, código INV-120, en el depósito, operativo, comprado el 10 de marzo."
          placeholder="Qué es, código, tipo, lugar, estado y fecha"
          sustantivo="un activo"
          abierto={abierto}
          interpretar={(texto) =>
            interpretarDictadoActivo(texto, {
              hoy: new Date(),
              tipos: (tipos.data ?? []).map((t) => ({ id: t.id, nombre: t.nombre })),
              lugares: (lugares.data ?? []).map((l) => ({ id: l.id, nombre: l.nombre })),
            })
          }
          onAplicar={aplicarDictado}
        />
      )}

      <div className={estilos.fila}>
        <Field label="Código de activo" required hint="Letras y números. Ej.: A12345" {...estadoCampo(e.codigo)}>
          <Input
            value={v.codigo}
            maxLength={30}
            onChange={(_, d) => f.set("codigo", d.value.toUpperCase().replace(/\s+/g, ""))}
          />
        </Field>
        <Field label="Tipo" hint="Opcional." {...estadoCampo(e.tipo)}>
          <Select value={v.tipo ? String(v.tipo) : ""} onChange={(_, d) => f.set("tipo", d.value ? Number(d.value) : null)}>
            <option value="">Sin tipo</option>
            {tiposVisibles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Descripción" required {...estadoCampo(e.descripcion)}>
        <Input
          value={v.descripcion}
          maxLength={200}
          placeholder="Ej.: Silla giratoria negra con apoyabrazos"
          onChange={(_, d) => f.set("descripcion", d.value)}
        />
      </Field>

      {esNuevo ? (
        <div className={estilos.fila}>
          <Field label="Lugar" required {...estadoCampo(e.lugar)}>
            <Select
              value={v.lugar ? String(v.lugar) : ""}
              onChange={(_, d) => f.set("lugar", d.value ? Number(d.value) : null)}
            >
              <option value="" disabled>
                Elegir…
              </option>
              {lugaresVisibles.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado" {...estadoCampo(e.estado)}>
            <Select value={v.estado} onChange={(_, d) => f.set("estado", d.value as EstadoActivo)}>
              {ESTADOS_ACTIVO.filter((s) => s.valor !== "baja").map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.etiqueta}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : (
        <MessageBar intent="info">
          <MessageBarBody>
            El lugar y el estado no se editan aquí: usa Trasladar, Cambiar estado o Dar de baja en la ficha, y queda el
            movimiento.
          </MessageBarBody>
        </MessageBar>
      )}

      <div className={estilos.fila}>
        <Field label="Marca" {...estadoCampo(e.marca)}>
          <Input value={v.marca} maxLength={80} onChange={(_, d) => f.set("marca", d.value)} />
        </Field>
        <Field label="Modelo" {...estadoCampo(e.modelo)}>
          <Input value={v.modelo} maxLength={80} onChange={(_, d) => f.set("modelo", d.value)} />
        </Field>
      </div>
      <div className={estilos.fila}>
        <Field label="Número de serie" {...estadoCampo(e.serie)}>
          <Input value={v.serie} maxLength={80} onChange={(_, d) => f.set("serie", d.value)} />
        </Field>
        <Field label="Fecha de adquisición" hint="Opcional." {...estadoCampo(e.fecha_adquisicion)}>
          <Input type="date" value={v.fecha_adquisicion} onChange={(_, d) => f.set("fecha_adquisicion", d.value)} />
        </Field>
      </div>

      <Field label="Responsable" hint="Opcional. Custodio del bien (como en el acta de patrimonio)." {...estadoCampo(e.responsable)}>
        <Input
          value={v.responsable}
          maxLength={120}
          placeholder="Ej.: 5599-HIGUERAS HUANCA LUIS ENRIQUE"
          onChange={(_, d) => f.set("responsable", d.value)}
        />
      </Field>

      <Field label="Observaciones" {...estadoCampo(e.observaciones)}>
        <Textarea
          value={v.observaciones}
          resize="vertical"
          rows={3}
          placeholder="Detalles que ayuden a reconocerlo o a entender su estado."
          onChange={(_, d) => f.set("observaciones", d.value)}
        />
      </Field>
    </PanelFormulario>
  );
}
