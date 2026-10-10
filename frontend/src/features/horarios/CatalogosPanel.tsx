import {
  Body1Strong,
  Button,
  Caption1,
  Checkbox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  SearchBox,
  Select,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { Docente, Materia, Periodo, ResultadoClonar } from "../../api/tipos";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoAgregar, IconoCopiar, IconoEditar, IconoEliminar } from "../../components/iconos/iconos";
import { fechaCorta } from "../../lib/fechas";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import {
  clonarHorarios,
  eliminarDocente,
  eliminarMateria,
  eliminarPeriodo,
  guardarMateria,
  guardarPeriodo,
  listarDocentes,
  listarMaterias,
  listarPeriodos,
} from "./api";
import { DialogoDocente } from "./DialogoDocente";

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
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  filaSigla: {
    display: "grid",
    gridTemplateColumns: "120px minmax(0, 1fr)",
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
  omitidos: {
    margin: "4px 0 0",
    paddingLeft: "18px",
    maxHeight: "180px",
    overflowY: "auto",
  },
  cabeceraLista: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  espacio: {
    flex: 1,
  },
});

/** Resumen de un clonado: cuántas clases se copiaron y cuáles se saltaron por choque. */
function ResultadoDeClonado({ resultado, destino }: { resultado: ResultadoClonar; destino: string }) {
  const estilos = useEstilos();
  return (
    <MessageBar intent={resultado.omitidos.length ? "warning" : "success"} layout="multiline">
      <MessageBarBody>
        <MessageBarTitle>
          {resultado.creados} {resultado.creados === 1 ? "clase copiada" : "clases copiadas"} a {destino}
        </MessageBarTitle>
        {resultado.omitidos.length > 0 && (
          <>
            {resultado.omitidos.length === 1 ? "Esta no se copió" : `Estas ${resultado.omitidos.length} no se copiaron`}{" "}
            porque chocan con algo que ya está en {destino}. Regístralas a mano con otro horario o laboratorio:
            <ul className={estilos.omitidos}>
              {resultado.omitidos.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </>
        )}
      </MessageBarBody>
    </MessageBar>
  );
}

// ── Periodos académicos ──

const PERIODO_VACIO = { nombre: "", fecha_inicio: "", fecha_fin: "", vigente: true };

export function PeriodosPanel({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Periodo | null>(null);
  const f = useFormulario(PERIODO_VACIO);
  const periodos = useQuery({ queryKey: ["periodos"], queryFn: listarPeriodos, enabled: abierto });
  // Al crear: copiar las clases de otro periodo (opcional).
  const [copiarDe, setCopiarDe] = useState("");
  // Clonar desde la lista: origen elegido y destino.
  const [clonando, setClonando] = useState<Periodo | null>(null);
  const [destino, setDestino] = useState("");
  const [resultado, setResultado] = useState<{ datos: ResultadoClonar; destino: string } | null>(null);

  useEffect(() => {
    if (!abierto) {
      setResultado(null);
      setCopiarDe("");
    }
  }, [abierto]);

  const nombreDe = (id: number) => periodos.data?.find((p) => p.id === id)?.nombre ?? "";

  const clonar = useMutation({
    mutationFn: ({ origen, destino }: { origen: number; destino: number; nombre: string }) =>
      clonarHorarios(origen, destino),
    onSuccess: (datos, { nombre }) => {
      setResultado({ datos, destino: nombre });
      setClonando(null);
      setDestino("");
      void queryClient.invalidateQueries({ queryKey: ["periodos"] });
      void queryClient.invalidateQueries({ queryKey: ["horarios"] });
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: (e) => notificar.error("No se pudieron copiar las clases", mensajeDeError(e)),
  });

  useEffect(() => {
    f.reiniciar(
      editando
        ? {
            nombre: editando.nombre,
            fecha_inicio: editando.fecha_inicio,
            fecha_fin: editando.fecha_fin,
            vigente: editando.vigente,
          }
        : PERIODO_VACIO,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, abierto]);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["periodos"] });

  const guardar = useMutation({
    mutationFn: () => guardarPeriodo(f.valores, editando?.id),
    onSuccess: (p) => {
      notificar.exito(editando ? "Periodo actualizado" : "Periodo creado", p.nombre);
      if (!editando && copiarDe) clonar.mutate({ origen: Number(copiarDe), destino: p.id, nombre: p.nombre });
      setEditando(null);
      setCopiarDe("");
      f.reiniciar(PERIODO_VACIO);
      void refrescar();
    },
    onError: f.tomarErroresDelServidor,
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => eliminarPeriodo(id),
    onSuccess: () => {
      notificar.exito("Periodo eliminado");
      void refrescar();
    },
    onError: (e) => notificar.error("No se pudo eliminar", mensajeDeError(e)),
  });

  const { valores: v, errores: e } = f;

  return (
    <PanelFormulario abierto={abierto} titulo="Periodos académicos" onCerrar={onCerrar}>
      {resultado && <ResultadoDeClonado resultado={resultado.datos} destino={resultado.destino} />}
      <form
        className={estilos.formulario}
        onSubmit={(ev) => {
          ev.preventDefault();
          guardar.mutate();
        }}
      >
        <Body1Strong>{editando ? `Editar ${editando.nombre}` : "Nuevo periodo"}</Body1Strong>
        <Field label="Nombre" required hint="Ej.: 2-2026" {...estadoCampo(e.nombre)}>
          <Input value={v.nombre} onChange={(_, d) => f.set("nombre", d.value)} />
        </Field>
        <div className={estilos.fila}>
          <Field label="Inicio" required {...estadoCampo(e.fecha_inicio)}>
            <Input type="date" value={v.fecha_inicio} onChange={(_, d) => f.set("fecha_inicio", d.value)} />
          </Field>
          <Field label="Fin" required {...estadoCampo(e.fecha_fin)}>
            <Input type="date" value={v.fecha_fin} onChange={(_, d) => f.set("fecha_fin", d.value)} />
          </Field>
        </div>
        <Checkbox label="Vigente" checked={v.vigente} onChange={(_, d) => f.set("vigente", Boolean(d.checked))} />
        {!editando && (periodos.data?.length ?? 0) > 0 && (
          <Field
            label="Copiar las clases de"
            hint="Opcional. Se copian todas las clases activas; las que choquen se listan para ajustarlas."
          >
            <Select value={copiarDe} onChange={(_, d) => setCopiarDe(d.value)}>
              <option value="">No copiar, empezar vacío</option>
              {periodos.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.total_horarios} {p.total_horarios === 1 ? "clase" : "clases"})
                </option>
              ))}
            </Select>
          </Field>
        )}
        {e.general && Object.keys(e).length === 1 && <Caption1>{e.general}</Caption1>}
        <div className={estilos.acciones}>
          <Button
            appearance="primary"
            type="submit"
            disabled={!v.nombre.trim() || !v.fecha_inicio || !v.fecha_fin || guardar.isPending}
          >
            {editando ? "Guardar" : "Agregar"}
          </Button>
          {editando && <Button onClick={() => setEditando(null)}>Cancelar</Button>}
        </div>
      </form>

      <div className={estilos.lista}>
        {periodos.data?.map((p) => (
          <div key={p.id} className={estilos.item}>
            <div className={estilos.textos}>
              <Body1Strong>{p.nombre}</Body1Strong>
              <Caption1 className={estilos.secundario}>
                {fechaCorta(p.fecha_inicio)} – {fechaCorta(p.fecha_fin)}
              </Caption1>
            </div>
            {p.vigente && <EtiquetaEstado tono="exito">Vigente</EtiquetaEstado>}
            <Tooltip content={`Copiar las ${p.total_horarios} clases a otro periodo`} relationship="label">
              <Button
                size="small"
                appearance="subtle"
                icon={<IconoCopiar />}
                disabled={p.total_horarios === 0 || (periodos.data?.length ?? 0) < 2}
                onClick={() => {
                  setClonando(p);
                  setDestino("");
                }}
              />
            </Tooltip>
            <Tooltip content="Editar" relationship="label">
              <Button size="small" appearance="subtle" icon={<IconoEditar />} onClick={() => setEditando(p)} />
            </Tooltip>
            <Tooltip content="Eliminar (solo si no tiene horarios)" relationship="label">
              <Button
                size="small"
                appearance="subtle"
                icon={<IconoEliminar />}
                disabled={eliminar.isPending}
                onClick={() => eliminar.mutate(p.id)}
              />
            </Tooltip>
          </div>
        ))}
      </div>

      <ConfirmarDialogo
        abierto={clonando !== null}
        titulo={`Copiar las clases de ${clonando?.nombre ?? ""}`}
        mensaje={`Se copian las ${clonando?.total_horarios ?? 0} clases activas (materia, grupo, docente, día, horario y laboratorio). Las que choquen con algo del periodo de destino se saltan y te las muestro para ajustarlas.`}
        textoConfirmar="Copiar clases"
        cargando={clonar.isPending}
        deshabilitado={!destino}
        onCancelar={() => setClonando(null)}
        onConfirmar={() =>
          clonando && clonar.mutate({ origen: clonando.id, destino: Number(destino), nombre: nombreDe(Number(destino)) })
        }
      >
        <Field label="Periodo de destino" required hint="Si todavía no existe, créalo primero arriba.">
          <Select value={destino} onChange={(_, d) => setDestino(d.value)}>
            <option value="" disabled>
              Elige el periodo
            </option>
            {periodos.data
              ?.filter((p) => p.id !== clonando?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.total_horarios ? ` (ya tiene ${p.total_horarios})` : ""}
                </option>
              ))}
          </Select>
        </Field>
      </ConfirmarDialogo>
    </PanelFormulario>
  );
}

// ── Materias ──

const MATERIA_VACIA = { sigla: "", nombre: "" };

export function MateriasPanel({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Materia | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const f = useFormulario(MATERIA_VACIA);
  const materias = useQuery({ queryKey: ["materias"], queryFn: listarMaterias, enabled: abierto });

  useEffect(() => {
    f.reiniciar(editando ? { sigla: editando.sigla, nombre: editando.nombre } : MATERIA_VACIA);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, abierto]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (materias.data ?? []).filter((m) => !q || `${m.sigla} ${m.nombre}`.toLowerCase().includes(q));
  }, [materias.data, busqueda]);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["materias"] });

  const guardar = useMutation({
    mutationFn: () => guardarMateria(f.valores, editando?.id),
    onSuccess: (m) => {
      notificar.exito(editando ? "Materia actualizada" : "Materia agregada", `${m.sigla} · ${m.nombre}`);
      setEditando(null);
      f.reiniciar(MATERIA_VACIA);
      void refrescar();
    },
    onError: f.tomarErroresDelServidor,
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => eliminarMateria(id),
    onSuccess: () => {
      notificar.exito("Materia eliminada");
      void refrescar();
    },
    onError: (e) => notificar.error("No se pudo eliminar", mensajeDeError(e)),
  });

  const { valores: v, errores: e } = f;

  return (
    <PanelFormulario abierto={abierto} titulo="Materias" onCerrar={onCerrar}>
      <form
        className={estilos.formulario}
        onSubmit={(ev) => {
          ev.preventDefault();
          guardar.mutate();
        }}
      >
        <Body1Strong>{editando ? `Editar ${editando.sigla}` : "Nueva materia"}</Body1Strong>
        <div className={estilos.filaSigla}>
          <Field label="Sigla" required {...estadoCampo(e.sigla)}>
            <Input value={v.sigla} onChange={(_, d) => f.set("sigla", d.value.toUpperCase())} />
          </Field>
          <Field label="Nombre" required {...estadoCampo(e.nombre)}>
            <Input value={v.nombre} onChange={(_, d) => f.set("nombre", d.value)} />
          </Field>
        </div>
        <div className={estilos.acciones}>
          <Button appearance="primary" type="submit" disabled={!v.sigla.trim() || !v.nombre.trim() || guardar.isPending}>
            {editando ? "Guardar" : "Agregar"}
          </Button>
          {editando && <Button onClick={() => setEditando(null)}>Cancelar</Button>}
        </div>
      </form>

      <SearchBox placeholder="Buscar materia" value={busqueda} onChange={(_, d) => setBusqueda(d.value)} />
      <div className={estilos.lista}>
        {filtradas.map((m) => (
          <div key={m.id} className={estilos.item}>
            <div className={estilos.textos}>
              <Body1Strong>{m.sigla}</Body1Strong>
              <Caption1 className={estilos.secundario}>{m.nombre}</Caption1>
            </div>
            <Tooltip content="Editar" relationship="label">
              <Button size="small" appearance="subtle" icon={<IconoEditar />} onClick={() => setEditando(m)} />
            </Tooltip>
            <Tooltip content="Eliminar (solo si no tiene horarios)" relationship="label">
              <Button
                size="small"
                appearance="subtle"
                icon={<IconoEliminar />}
                disabled={eliminar.isPending}
                onClick={() => eliminar.mutate(m.id)}
              />
            </Tooltip>
          </div>
        ))}
      </div>
    </PanelFormulario>
  );
}

// ── Docentes ──

export function DocentesPanel({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [dialogo, setDialogo] = useState<{ docente: Docente | null } | null>(null);
  const [eliminando, setEliminando] = useState<Docente | null>(null);
  const docentes = useQuery({ queryKey: ["docentes"], queryFn: () => listarDocentes(), enabled: abierto });

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (docentes.data ?? []).filter(
      (d) => !q || `${d.nombre_completo} ${d.email} ${d.usuario_email}`.toLowerCase().includes(q),
    );
  }, [docentes.data, busqueda]);
  const sinUsuario = (docentes.data ?? []).filter((d) => !d.tiene_usuario).length;

  const eliminar = useMutation({
    mutationFn: (id: number) => eliminarDocente(id),
    onSuccess: () => {
      notificar.exito("Docente eliminado");
      setEliminando(null);
      void queryClient.invalidateQueries({ queryKey: ["docentes"] });
    },
    onError: (e) => {
      setEliminando(null);
      notificar.error("No se pudo eliminar", mensajeDeError(e));
    },
  });

  return (
    <PanelFormulario
      abierto={abierto}
      titulo="Docentes"
      subtitulo="Quienes dictan las clases. Pueden registrarse sin usuario y vincularse después."
      onCerrar={onCerrar}
    >
      <div className={estilos.cabeceraLista}>
        <SearchBox
          className={estilos.espacio}
          placeholder="Buscar por nombre o correo"
          value={busqueda}
          onChange={(_, d) => setBusqueda(d.value)}
        />
        <Button appearance="primary" icon={<IconoAgregar />} onClick={() => setDialogo({ docente: null })}>
          Nuevo docente
        </Button>
      </div>
      {sinUsuario > 0 && (
        <Caption1 className={estilos.secundario}>
          {sinUsuario} {sinUsuario === 1 ? "docente todavía no tiene" : "docentes todavía no tienen"} usuario. Para
          vincularlo, crea el usuario en Usuarios con rol Docente y elige su ficha (o usa el mismo correo).
        </Caption1>
      )}

      <div className={estilos.lista}>
        {filtrados.map((d) => (
          <div key={d.id} className={estilos.item}>
            <div className={estilos.textos}>
              <Body1Strong>{d.nombre_completo}</Body1Strong>
              <Caption1 className={estilos.secundario}>
                {[d.tiene_usuario ? d.usuario_email : d.email, d.telefono, `${d.total_horarios} clases`]
                  .filter(Boolean)
                  .join(" · ")}
              </Caption1>
            </div>
            {d.tiene_usuario ? (
              <EtiquetaEstado tono="exito">Con usuario</EtiquetaEstado>
            ) : (
              <EtiquetaEstado tono="neutro">Sin usuario</EtiquetaEstado>
            )}
            {!d.activo && <EtiquetaEstado tono="aviso">Inactivo</EtiquetaEstado>}
            <Tooltip content="Editar" relationship="label">
              <Button size="small" appearance="subtle" icon={<IconoEditar />} onClick={() => setDialogo({ docente: d })} />
            </Tooltip>
            <Tooltip
              content={d.total_horarios ? "Tiene clases asignadas: quítaselas antes de eliminarlo" : "Eliminar"}
              relationship="label"
            >
              <Button
                size="small"
                appearance="subtle"
                icon={<IconoEliminar />}
                disabled={d.total_horarios > 0 || eliminar.isPending}
                onClick={() => setEliminando(d)}
              />
            </Tooltip>
          </div>
        ))}
        {docentes.data && filtrados.length === 0 && (
          <Caption1 className={estilos.secundario}>
            {busqueda ? "Ningún docente coincide con la búsqueda." : "Todavía no hay docentes registrados."}
          </Caption1>
        )}
      </div>

      <DialogoDocente
        abierto={dialogo !== null}
        docente={dialogo?.docente ?? null}
        onCerrar={() => setDialogo(null)}
      />
      <ConfirmarDialogo
        abierto={eliminando !== null}
        titulo={`¿Eliminar a ${eliminando?.nombre_completo ?? ""}?`}
        mensaje="Solo se puede eliminar un docente sin clases asignadas. Su usuario, si tiene, no se borra."
        textoConfirmar="Eliminar"
        peligroso
        cargando={eliminar.isPending}
        onCancelar={() => setEliminando(null)}
        onConfirmar={() => eliminando && eliminar.mutate(eliminando.id)}
      />
    </PanelFormulario>
  );
}
