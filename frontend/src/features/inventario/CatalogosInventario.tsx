import {
  Body1Strong,
  Button,
  Caption1,
  Checkbox,
  Field,
  Input,
  Select,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { Lugar, TipoActivo, TipoLugar } from "../../api/tipos";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoEditar, IconoEliminar } from "../../components/iconos/iconos";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { TIPOS_LUGAR, eliminarLugar, eliminarTipo, guardarLugar, guardarTipo, listarLugares, listarTipos } from "./api";

const useEstilos = makeStyles({
  formulario: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px",
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  fila: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 160px",
    gap: "10px",
  },
  acciones: {
    display: "flex",
    gap: "8px",
  },
  lista: {
    display: "flex",
    flexDirection: "column",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 4px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  textos: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
});

const cuantos = (n: number) => `${n} ${n === 1 ? "activo" : "activos"}`;

// ── Tipos de activo ──

const TIPO_VACIO = { nombre: "", descripcion: "", activo: true };

export function TiposPanel({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<TipoActivo | null>(null);
  const f = useFormulario(TIPO_VACIO);
  const tipos = useQuery({ queryKey: ["inventario", "tipos"], queryFn: listarTipos, enabled: abierto });

  useEffect(() => {
    f.reiniciar(
      editando ? { nombre: editando.nombre, descripcion: editando.descripcion, activo: editando.activo } : TIPO_VACIO,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, abierto]);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["inventario"] });

  const guardar = useMutation({
    mutationFn: () => guardarTipo({ ...f.valores, nombre: f.valores.nombre.trim() }, editando?.id),
    onSuccess: (t) => {
      notificar.exito(editando ? "Tipo actualizado" : "Tipo agregado", t.nombre);
      setEditando(null);
      f.reiniciar(TIPO_VACIO);
      void refrescar();
    },
    onError: f.tomarErroresDelServidor,
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => eliminarTipo(id),
    onSuccess: () => {
      notificar.exito("Tipo eliminado");
      void refrescar();
    },
    onError: (e) => notificar.error("No se pudo eliminar", mensajeDeError(e)),
  });

  const { valores: v, errores: e } = f;

  return (
    <PanelFormulario
      abierto={abierto}
      titulo="Tipos de activo"
      subtitulo="Silla, mesa, computadora, estabilizador… Sirven para filtrar y para pedir verificaciones."
      onCerrar={onCerrar}
    >
      <form
        className={estilos.formulario}
        onSubmit={(ev) => {
          ev.preventDefault();
          guardar.mutate();
        }}
      >
        <Body1Strong>{editando ? `Editar ${editando.nombre}` : "Nuevo tipo"}</Body1Strong>
        <Field label="Nombre" required {...estadoCampo(e.nombre)}>
          <Input value={v.nombre} maxLength={80} onChange={(_, d) => f.set("nombre", d.value)} />
        </Field>
        {editando && (
          <Checkbox
            label="Activo (se puede elegir al registrar)"
            checked={v.activo}
            onChange={(_, d) => f.set("activo", Boolean(d.checked))}
          />
        )}
        {e.general && Object.keys(e).length === 1 && <Caption1>{e.general}</Caption1>}
        <div className={estilos.acciones}>
          <Button appearance="primary" type="submit" disabled={!v.nombre.trim() || guardar.isPending}>
            {editando ? "Guardar" : "Agregar"}
          </Button>
          {editando && <Button onClick={() => setEditando(null)}>Cancelar</Button>}
        </div>
      </form>

      <div className={estilos.lista}>
        {tipos.data?.map((t) => (
          <div key={t.id} className={estilos.item}>
            <div className={estilos.textos}>
              <Body1Strong>{t.nombre}</Body1Strong>
              <Caption1 className={estilos.secundario}>{cuantos(t.total_activos)}</Caption1>
            </div>
            {!t.activo && <EtiquetaEstado tono="neutro">Desactivado</EtiquetaEstado>}
            <Tooltip content="Editar" relationship="label">
              <Button size="small" appearance="subtle" icon={<IconoEditar />} onClick={() => setEditando(t)} />
            </Tooltip>
            <Tooltip content="Eliminar (solo si ningún activo lo usa)" relationship="label">
              <Button
                size="small"
                appearance="subtle"
                icon={<IconoEliminar />}
                disabled={eliminar.isPending}
                onClick={() => eliminar.mutate(t.id)}
              />
            </Tooltip>
          </div>
        ))}
      </div>
    </PanelFormulario>
  );
}

// ── Lugares ──

interface FormularioLugar {
  nombre: string;
  tipo: TipoLugar;
  descripcion: string;
  activo: boolean;
}

const LUGAR_VACIO: FormularioLugar = { nombre: "", tipo: "deposito", descripcion: "", activo: true };

export function LugaresPanel({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Lugar | null>(null);
  const f = useFormulario<FormularioLugar>(LUGAR_VACIO);
  const lugares = useQuery({ queryKey: ["inventario", "lugares"], queryFn: listarLugares, enabled: abierto });

  useEffect(() => {
    f.reiniciar(
      editando
        ? { nombre: editando.nombre, tipo: editando.tipo, descripcion: editando.descripcion, activo: editando.activo }
        : LUGAR_VACIO,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, abierto]);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["inventario"] });

  const guardar = useMutation({
    mutationFn: () => guardarLugar({ ...f.valores, nombre: f.valores.nombre.trim() }, editando?.id),
    onSuccess: (l) => {
      notificar.exito(editando ? "Lugar actualizado" : "Lugar agregado", l.nombre);
      setEditando(null);
      f.reiniciar(LUGAR_VACIO);
      void refrescar();
    },
    onError: f.tomarErroresDelServidor,
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => eliminarLugar(id),
    onSuccess: () => {
      notificar.exito("Lugar eliminado");
      void refrescar();
    },
    onError: (e) => notificar.error("No se pudo eliminar", mensajeDeError(e)),
  });

  const { valores: v, errores: e } = f;

  return (
    <PanelFormulario
      abierto={abierto}
      titulo="Lugares"
      subtitulo="Dónde puede estar un activo. Los laboratorios aparecen solos; aquí agregas depósitos y otros ambientes."
      onCerrar={onCerrar}
    >
      <form
        className={estilos.formulario}
        onSubmit={(ev) => {
          ev.preventDefault();
          guardar.mutate();
        }}
      >
        <Body1Strong>{editando ? `Editar ${editando.nombre}` : "Nuevo lugar"}</Body1Strong>
        <div className={estilos.fila}>
          <Field label="Nombre" required {...estadoCampo(e.nombre)}>
            <Input
              value={v.nombre}
              maxLength={120}
              placeholder="Ej.: Depósito del módulo 236"
              onChange={(_, d) => f.set("nombre", d.value)}
            />
          </Field>
          <Field label="Tipo" {...estadoCampo(e.tipo)}>
            <Select value={v.tipo} onChange={(_, d) => f.set("tipo", d.value as TipoLugar)}>
              {TIPOS_LUGAR.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {editando && (
          <Checkbox
            label="Activo (se puede elegir como destino)"
            checked={v.activo}
            onChange={(_, d) => f.set("activo", Boolean(d.checked))}
          />
        )}
        {e.general && Object.keys(e).length === 1 && <Caption1>{e.general}</Caption1>}
        <div className={estilos.acciones}>
          <Button appearance="primary" type="submit" disabled={!v.nombre.trim() || guardar.isPending}>
            {editando ? "Guardar" : "Agregar"}
          </Button>
          {editando && <Button onClick={() => setEditando(null)}>Cancelar</Button>}
        </div>
      </form>

      <div className={estilos.lista}>
        {lugares.data?.map((l) => {
          const deLaboratorio = l.laboratorio !== null;
          return (
            <div key={l.id} className={estilos.item}>
              <div className={estilos.textos}>
                <Body1Strong>{l.nombre}</Body1Strong>
                <Caption1 className={estilos.secundario}>
                  {l.tipo_nombre} · {cuantos(l.total_activos)}
                </Caption1>
              </div>
              {!l.activo && <EtiquetaEstado tono="neutro">Desactivado</EtiquetaEstado>}
              {!deLaboratorio && (
                <>
                  <Tooltip content="Editar" relationship="label">
                    <Button size="small" appearance="subtle" icon={<IconoEditar />} onClick={() => setEditando(l)} />
                  </Tooltip>
                  <Tooltip content="Eliminar (solo si nunca tuvo activos)" relationship="label">
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<IconoEliminar />}
                      disabled={eliminar.isPending}
                      onClick={() => eliminar.mutate(l.id)}
                    />
                  </Tooltip>
                </>
              )}
            </div>
          );
        })}
      </div>
    </PanelFormulario>
  );
}
