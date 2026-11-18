import {
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  Switch,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { mensajeDeError } from "../../api/errores";
import type { AtributoMapa, EntradaBitacora, MarcaMapa, TipoBitacora } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { TIPOS_BITACORA } from "../../lib/constantes";
import { aInputLocal, ahoraLocalInput, localAIso } from "../../lib/fechas";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { ATRIBUTOS_INICIALES, crearEntrada, editarEntrada, obtenerPlantilla } from "./api";
import { MapaBitacora } from "./MapaBitacora";

const useEstilos = makeStyles({
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    "@media (max-width: 480px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  mapa: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    paddingTop: "12px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
});

interface Formulario {
  laboratorio: number | null;
  tipo: TipoBitacora;
  titulo: string;
  fecha: string;
  elementos: string;
  descripcion: string;
  /** Mapa pintado estilo OrganiLab. */
  conMapa: boolean;
  pintado: { atributos: AtributoMapa[]; marcas: MarcaMapa[] };
}

const vacio = (laboratorio: number | null): Formulario => ({
  laboratorio,
  tipo: "mantenimiento",
  titulo: "",
  fecha: ahoraLocalInput(),
  elementos: "",
  descripcion: "",
  conMapa: false,
  pintado: { atributos: ATRIBUTOS_INICIALES, marcas: [] },
});

interface Props {
  abierto: boolean;
  entrada: EntradaBitacora | null;
  /** Laboratorio ya elegido (desde la ficha del laboratorio). */
  laboratorioId?: number;
  onCerrar: () => void;
  onGuardada: (entrada: EntradaBitacora) => void;
}

export function EntradaPanel({ abierto, entrada, laboratorioId, onCerrar, onGuardada }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<Formulario>(vacio(laboratorioId ?? null));
  const esNueva = entrada === null;

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos, enabled: abierto });

  // Laboratorio de la última vez: si el usuario lo cambia, lo pintado era de otra grilla.
  const labAnterior = useRef(f.valores.laboratorio);

  useEffect(() => {
    if (!abierto) return;
    // Al cargar la entrada (o una nueva) no se borra lo pintado: no es un cambio de laboratorio.
    labAnterior.current = entrada ? entrada.laboratorio : (laboratorioId ?? null);
    f.reiniciar(
      entrada
        ? {
            laboratorio: entrada.laboratorio,
            tipo: entrada.tipo,
            titulo: entrada.titulo,
            fecha: aInputLocal(entrada.fecha),
            elementos: entrada.elementos,
            descripcion: entrada.descripcion,
            conMapa: entrada.mapa !== null,
            pintado: {
              atributos: entrada.mapa?.atributos ?? ATRIBUTOS_INICIALES,
              marcas: entrada.mapa?.marcas ?? [],
            },
          }
        : vacio(laboratorioId ?? null),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, entrada]);

  // La grilla del mapa: la copia guardada si la entrada ya tenía mapa de este laboratorio;
  // si no, la distribución actual del laboratorio elegido.
  const usaCopia = entrada?.mapa != null && entrada.laboratorio === f.valores.laboratorio;
  const plantilla = useQuery({
    queryKey: ["bitacora", "plantilla", f.valores.laboratorio],
    queryFn: () => obtenerPlantilla(f.valores.laboratorio!),
    enabled: abierto && f.valores.conMapa && !usaCopia && f.valores.laboratorio !== null,
    staleTime: 30_000,
    retry: false,
  });
  const base = usaCopia ? entrada!.mapa : (plantilla.data ?? null);

  // Al cambiar de laboratorio, lo pintado era de otra grilla.
  useEffect(() => {
    if (labAnterior.current !== f.valores.laboratorio && f.valores.pintado.marcas.length) {
      f.set("pintado", { ...f.valores.pintado, marcas: [] });
    }
    labAnterior.current = f.valores.laboratorio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.valores.laboratorio]);

  const guardar = useMutation({
    mutationFn: () => {
      const v = f.valores;
      const ocupadas = new Set(base?.celdas.map((c) => `${c.fila},${c.columna}`));
      const datos = {
        laboratorio: v.laboratorio!,
        tipo: v.tipo,
        titulo: v.titulo.trim(),
        fecha: localAIso(v.fecha),
        elementos: v.elementos.trim(),
        descripcion: v.descripcion.trim(),
        mapa: v.conMapa
          ? {
              atributos: v.pintado.atributos.map((a, i) => ({ ...a, nombre: a.nombre.trim() || `Atributo ${i + 1}` })),
              marcas: v.pintado.marcas.filter((m) => ocupadas.has(`${m.fila},${m.columna}`)),
            }
          : null,
      };
      return esNueva ? crearEntrada(datos) : editarEntrada(entrada.id, datos);
    },
    onSuccess: (res) => {
      notificar.exito(esNueva ? "Registrado en la bitácora" : "Cambios guardados", res.titulo);
      void queryClient.invalidateQueries({ queryKey: ["bitacora"] });
      onGuardada(res);
    },
    onError: f.tomarErroresDelServidor,
  });

  const { valores: v, errores: e } = f;
  const mapaListo = !v.conMapa || base !== null;
  const completo = v.laboratorio !== null && v.titulo.trim() && v.fecha && mapaListo;
  // Los laboratorios inactivos solo aparecen si la entrada ya era de uno.
  const opcionesLab = (laboratorios.data ?? []).filter((l) => l.activo || l.id === v.laboratorio);

  return (
    <PanelFormulario
      abierto={abierto}
      titulo={esNueva ? "Registrar en la bitácora" : "Editar entrada"}
      subtitulo="Lo que se hizo o pasó en el laboratorio: instalaciones, fallas, mantenimiento."
      onCerrar={onCerrar}
      tamano={v.conMapa ? "large" : "medium"}
      hayCambios={f.cambiado && !guardar.isPending}
      pie={
        <>
          <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending ? "Guardando…" : esNueva ? "Registrar" : "Guardar cambios"}
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

      <div className={estilos.fila}>
        <Field label="Laboratorio" required {...estadoCampo(e.laboratorio)}>
          <Select
            value={v.laboratorio ? String(v.laboratorio) : ""}
            onChange={(_, d) => f.set("laboratorio", d.value ? Number(d.value) : null)}
          >
            <option value="" disabled>
              Elegir…
            </option>
            {opcionesLab.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} · {l.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo" {...estadoCampo(e.tipo)}>
          <Select value={v.tipo} onChange={(_, d) => f.set("tipo", d.value as TipoBitacora)}>
            {TIPOS_BITACORA.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Título" required {...estadoCampo(e.titulo)}>
        <Input
          value={v.titulo}
          maxLength={150}
          placeholder="Ej.: Se instaló Docker Desktop"
          onChange={(_, d) => f.set("titulo", d.value)}
        />
      </Field>

      <div className={estilos.fila}>
        <Field label="Fecha y hora" required {...estadoCampo(e.fecha)}>
          <Input
            type="datetime-local"
            value={v.fecha}
            max={ahoraLocalInput()}
            onChange={(_, d) => f.set("fecha", d.value)}
          />
        </Field>
        <Field label="Elementos" hint="Ej.: PC-01, PC-07" {...estadoCampo(e.elementos)}>
          <Input value={v.elementos} maxLength={200} onChange={(_, d) => f.set("elementos", d.value)} />
        </Field>
      </div>

      <Field label="Descripción" {...estadoCampo(e.descripcion)}>
        <Textarea
          value={v.descripcion}
          resize="vertical"
          rows={4}
          placeholder="Qué se hizo, qué se encontró, qué falta."
          onChange={(_, d) => f.set("descripcion", d.value)}
        />
      </Field>

      <div className={estilos.mapa}>
        <Switch
          label="Agregar mapa del laboratorio (pintar los equipos, como en OrganiLab)"
          checked={v.conMapa}
          disabled={v.laboratorio === null}
          onChange={(_, d) => f.set("conMapa", d.checked)}
        />
        {v.conMapa &&
          (base ? (
            <>
              {usaCopia && (
                <Caption1 className={estilos.secundario}>
                  Se usa la grilla como estaba cuando se hizo este mapa.
                </Caption1>
              )}
              <MapaBitacora
                mapa={base}
                atributos={v.pintado.atributos}
                marcas={v.pintado.marcas}
                onCambiar={(atributos, marcas) => f.set("pintado", { atributos, marcas })}
              />
            </>
          ) : plantilla.isError ? (
            <MessageBar intent="warning">
              <MessageBarBody>{mensajeDeError(plantilla.error)}</MessageBarBody>
            </MessageBar>
          ) : (
            <Spinner size="small" label="Cargando la grilla del laboratorio…" />
          ))}
        {!v.conMapa && !esNueva && entrada.mapa && (
          <Caption1 className={estilos.secundario}>Al guardar se quitará el mapa de esta entrada.</Caption1>
        )}
      </div>
    </PanelFormulario>
  );
}
