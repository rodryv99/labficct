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

import type { CategoriaObjeto, ObjetoPerdido } from "../../api/tipos";
import { useNotificar } from "../../components/feedback/notificaciones";
import { CampoImagen } from "../../components/formularios/CampoImagen";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { CATEGORIAS_OBJETO } from "../../lib/constantes";
import { ahoraLocalInput } from "../../lib/fechas";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import { listarLaboratoriosTodos } from "../laboratorios/api";
import { PanelDictado } from "../dictado/PanelDictado";
import { type ResultadoObjeto, interpretarDictadoObjeto } from "./dictadoObjeto";
import { type DatosObjeto, registrarObjeto } from "./api";

const useEstilos = makeStyles({
  fila: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
});

const vacio = (): DatosObjeto => ({
  descripcion: "",
  categoria: "otro",
  caracteristicas: "",
  laboratorio: null,
  lugar: "",
  fecha_hallazgo: ahoraLocalInput(),
  encontrado_por: "",
  foto: null,
  quitar_foto: false,
});

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onGuardado: (objeto: ObjetoPerdido) => void;
}

/** Alta de un objeto perdido. Una vez guardado no se edita: solo se entrega o se anula. */
export function ObjetoPanel({ abierto, onCerrar, onGuardado }: Props) {
  const estilos = useEstilos();
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const f = useFormulario<DatosObjeto>(vacio());

  const laboratorios = useQuery({ queryKey: ["laboratorios", "todos"], queryFn: listarLaboratoriosTodos, enabled: abierto });

  // Dictado por voz: rellena el formulario desde una frase. No guarda nada.
  const aplicarDictado = (r: ResultadoObjeto) =>
    f.setValores((a) => ({
      ...a,
      descripcion: r.descripcion ?? a.descripcion,
      caracteristicas: r.caracteristicas ?? a.caracteristicas,
      categoria: r.categoria ?? a.categoria,
      encontrado_por: r.encontrado_por ?? a.encontrado_por,
      fecha_hallazgo: r.fecha_hallazgo ? `${r.fecha_hallazgo}T09:00` : a.fecha_hallazgo,
      laboratorio: r.laboratorio ?? a.laboratorio,
      lugar: r.lugar ?? a.lugar,
    }));

  useEffect(() => {
    if (!abierto) return;
    f.reiniciar(vacio());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const guardar = useMutation({
    mutationFn: () => registrarObjeto(f.valores),
    onSuccess: (o) => {
      notificar.exito(`Registrado como ${o.codigo}`, o.descripcion);
      void queryClient.invalidateQueries({ queryKey: ["objetos"] });
      onGuardado(o);
    },
    onError: f.tomarErroresDelServidor,
  });

  const { valores: v, errores: e } = f;
  const completo = v.descripcion.trim() && (v.laboratorio || v.lugar.trim()) && v.fecha_hallazgo;

  return (
    <PanelFormulario
      abierto={abierto}
      titulo="Registrar objeto perdido"
      subtitulo="Una foto ayuda mucho a que su dueño lo reconozca. Después de guardar no se podrá editar."
      onCerrar={onCerrar}
      hayCambios={f.cambiado && !guardar.isPending}
      pie={
        <>
          <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending ? "Guardando…" : "Registrar"}
          </Button>
          <Button onClick={onCerrar}>Cancelar</Button>
        </>
      }
    >
      {e.general && Object.keys(e).length === 1 && (
        <MessageBar intent="error">
          <MessageBarBody>{e.general}</MessageBarBody>
        </MessageBar>
      )}

      <PanelDictado<ResultadoObjeto>
        etiqueta="Dicta o escribe el objeto en una frase"
        ejemplo="Ej.: Un celular negro con funda roja, encontrado en el laboratorio 41 hoy, lo entregó Juan."
        placeholder="Qué objeto es, cómo es, dónde y cuándo se encontró"
        sustantivo="un objeto perdido"
        abierto={abierto}
        interpretar={(texto) =>
          interpretarDictadoObjeto(texto, {
            hoy: new Date(),
            laboratorios: (laboratorios.data ?? [])
              .filter((l) => l.activo)
              .map((l) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre })),
          })
        }
        onAplicar={aplicarDictado}
      />

      <Field label="Foto">
        <CampoImagen
          actual={null}
          archivo={v.foto ?? null}
          quitada={Boolean(v.quitar_foto)}
          onArchivo={(archivo) => {
            f.set("foto", archivo);
            if (archivo) f.set("quitar_foto", false);
          }}
          onQuitar={() => f.set("quitar_foto", true)}
          textoBoton="Tomar o subir foto"
          camara
        />
      </Field>

      <Field label="¿Qué es?" required {...estadoCampo(e.descripcion)}>
        <Input
          value={v.descripcion}
          placeholder="Ej.: Mochila negra con cuadernos"
          onChange={(_, d) => f.set("descripcion", d.value)}
        />
      </Field>
      <div className={estilos.fila}>
        <Field label="Categoría" {...estadoCampo(e.categoria)}>
          <Select value={v.categoria} onChange={(_, d) => f.set("categoria", d.value as CategoriaObjeto)}>
            {CATEGORIAS_OBJETO.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha y hora del hallazgo" required {...estadoCampo(e.fecha_hallazgo)}>
          <Input
            type="datetime-local"
            value={v.fecha_hallazgo}
            max={ahoraLocalInput()}
            onChange={(_, d) => f.set("fecha_hallazgo", d.value)}
          />
        </Field>
      </div>
      <Field label="Características" hint="Color, marca, detalles para reconocerlo." {...estadoCampo(e.caracteristicas)}>
        <Textarea value={v.caracteristicas} resize="vertical" onChange={(_, d) => f.set("caracteristicas", d.value)} />
      </Field>
      <div className={estilos.fila}>
        <Field label="Laboratorio" {...estadoCampo(e.laboratorio)}>
          <Select
            value={v.laboratorio ? String(v.laboratorio) : ""}
            onChange={(_, d) => f.set("laboratorio", d.value ? Number(d.value) : null)}
          >
            <option value="">Fuera de un laboratorio</option>
            {laboratorios.data?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} · {l.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lugar exacto" {...estadoCampo(e.lugar)}>
          <Input value={v.lugar} placeholder="Ej.: debajo de la PC-12" onChange={(_, d) => f.set("lugar", d.value)} />
        </Field>
      </div>
      <Field label="Encontrado por" hint="Opcional: quién lo entregó a la oficina." {...estadoCampo(e.encontrado_por)}>
        <Input value={v.encontrado_por} onChange={(_, d) => f.set("encontrado_por", d.value)} />
      </Field>
    </PanelFormulario>
  );
}
