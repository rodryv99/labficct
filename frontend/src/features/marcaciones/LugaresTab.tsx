import {
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  SpinButton,
  Switch,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { mensajeDeError } from "../../api/errores";
import type { LugarAsistencia } from "../../api/tipos";
import { EtiquetaEstado } from "../../components/datos/Etiquetas";
import { type Columna, TablaDatos } from "../../components/datos/TablaDatos";
import { ConfirmarDialogo } from "../../components/feedback/ConfirmarDialogo";
import { EstadoVacio } from "../../components/feedback/Estados";
import { useNotificar } from "../../components/feedback/notificaciones";
import { PanelFormulario } from "../../components/formularios/PanelFormulario";
import { IconoEliminar, IconoUbicacion } from "../../components/iconos/iconos";
import { estadoCampo, useFormulario } from "../../lib/useFormulario";
import {
  type DatosLugar,
  RADIO_MAXIMO_M,
  RADIO_MINIMO_M,
  RADIO_POR_DEFECTO_M,
  crearLugar,
  editarLugar,
  eliminarLugar,
  leerCoordenadas,
  textoCoordenadas,
} from "./api";
import { MapaLugar } from "./MapaLugar";

const useEstilos = makeStyles({
  celda: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  nombre: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
    fontWeight: tokens.fontWeightSemibold,
  },
  secundario: {
    color: tokens.colorNeutralForeground3,
  },
  numeros: {
    fontVariantNumeric: "tabular-nums",
  },
  ubicacion: {
    alignSelf: "flex-start",
  },
  espacio: {
    flex: 1,
  },
});

interface Formulario {
  nombre: string;
  referencia: string;
  /** Lo que la persona pega o escribe: "-17.7762, -63.1950" o un enlace de Google Maps. */
  coordenadas: string;
  radio_m: number;
  predeterminado: boolean;
  activo: boolean;
}

const vacio = (predeterminado: boolean): Formulario => ({
  nombre: "",
  referencia: "",
  coordenadas: "",
  radio_m: RADIO_POR_DEFECTO_M,
  predeterminado,
  activo: true,
});

interface Props {
  lugares: LugarAsistencia[] | undefined;
  cargando: boolean;
  error: unknown;
  onReintentar: () => void;
  /** null = cerrado; "nuevo" o el lugar a editar. */
  panel: LugarAsistencia | "nuevo" | null;
  onPanel: (panel: LugarAsistencia | "nuevo" | null) => void;
}

/** Los lugares donde se puede marcar: un punto en el mapa y un radio en metros. */
export function LugaresTab({ lugares, cargando, error, onReintentar, panel, onPanel }: Props) {
  const estilos = useEstilos();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [eliminando, setEliminando] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  const lugar = panel && panel !== "nuevo" ? panel : null;
  const f = useFormulario<Formulario>(vacio(false));

  useEffect(() => {
    if (!panel) return;
    f.reiniciar(
      lugar
        ? {
            nombre: lugar.nombre,
            referencia: lugar.referencia,
            coordenadas: textoCoordenadas(lugar.latitud, lugar.longitud),
            radio_m: lugar.radio_m,
            predeterminado: lugar.predeterminado,
            activo: lugar.activo,
          }
        : // El primer lugar que se crea queda como predeterminado: así todos los auxiliares ya pueden marcar.
          vacio((lugares ?? []).length === 0),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  const { valores: v, errores: e } = f;
  const punto = leerCoordenadas(v.coordenadas);

  const guardar = useMutation({
    mutationFn: () => {
      const datos: DatosLugar = {
        nombre: v.nombre.trim(),
        referencia: v.referencia.trim(),
        latitud: Number(punto!.latitud.toFixed(6)),
        longitud: Number(punto!.longitud.toFixed(6)),
        radio_m: v.radio_m,
        predeterminado: v.predeterminado,
        activo: v.predeterminado ? true : v.activo,
      };
      return lugar ? editarLugar(lugar.id, datos) : crearLugar(datos);
    },
    onSuccess: (guardado) => {
      notificar.exito(lugar ? "Lugar actualizado" : "Lugar agregado", guardado.nombre);
      void queryClient.invalidateQueries({ queryKey: ["marcaciones"] });
      onPanel(null);
    },
    onError: f.tomarErroresDelServidor,
  });

  const borrar = useMutation({
    mutationFn: () => eliminarLugar(lugar!.id),
    onSuccess: () => {
      notificar.exito("Lugar eliminado");
      setEliminando(false);
      void queryClient.invalidateQueries({ queryKey: ["marcaciones"] });
      onPanel(null);
    },
    onError: (falla) => {
      setEliminando(false);
      notificar.error("No se pudo eliminar", mensajeDeError(falla));
    },
  });

  const usarMiUbicacion = () => {
    if (!("geolocation" in navigator)) {
      notificar.error("Este navegador no da la ubicación", "Copia las coordenadas desde Google Maps.");
      return;
    }
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setUbicando(false);
        f.set("coordenadas", textoCoordenadas(posicion.coords.latitude, posicion.coords.longitude));
      },
      () => {
        setUbicando(false);
        notificar.error("No se pudo leer tu ubicación", "Revisa el permiso de ubicación del navegador o pega las coordenadas.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const columnas: Columna<LugarAsistencia>[] = [
    {
      clave: "nombre",
      titulo: "Lugar",
      render: (l) => (
        <div className={estilos.celda}>
          <span className={estilos.nombre}>
            {l.nombre}
            {l.predeterminado && <EtiquetaEstado tono="marca">Predeterminado</EtiquetaEstado>}
          </span>
          {l.referencia && <Caption1 className={estilos.secundario}>{l.referencia}</Caption1>}
        </div>
      ),
    },
    {
      clave: "coordenadas",
      titulo: "Coordenadas",
      ancho: "210px",
      render: (l) => <span className={estilos.numeros}>{textoCoordenadas(l.latitud, l.longitud)}</span>,
    },
    { clave: "radio", titulo: "Radio", ancho: "90px", render: (l) => `${l.radio_m} m` },
    {
      clave: "asignados",
      titulo: "Auxiliares",
      ancho: "170px",
      render: (l) =>
        l.predeterminado ? (
          <Caption1 className={estilos.secundario}>
            {l.asignados ? `${l.asignados} propios + los que no tienen lugar` : "Los que no tienen lugar propio"}
          </Caption1>
        ) : l.asignados ? (
          `${l.asignados}`
        ) : (
          <Caption1 className={estilos.secundario}>Ninguno</Caption1>
        ),
    },
    {
      clave: "activo",
      titulo: "Estado",
      ancho: "100px",
      render: (l) => <EtiquetaEstado tono={l.activo ? "exito" : "neutro"}>{l.activo ? "Activo" : "Inactivo"}</EtiquetaEstado>,
    },
  ];

  const radioValido = v.radio_m >= RADIO_MINIMO_M && v.radio_m <= RADIO_MAXIMO_M;
  const completo = v.nombre.trim() && punto !== null && radioValido;
  const errorCoordenadas =
    e.latitud ?? e.longitud ?? (v.coordenadas.trim() && !punto ? "No reconozco esas coordenadas. Ej.: -17.776200, -63.195000" : undefined);

  return (
    <>
      <TablaDatos
        etiqueta="Lugares de asistencia"
        columnas={columnas}
        filas={lugares}
        claveFila={(l) => l.id}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        onFila={(l) => onPanel(l)}
        vacio={
          <EstadoVacio
            icono={<IconoUbicacion />}
            titulo="Todavía no hay lugares"
            descripcion="Agrega el lugar donde los auxiliares marcan su asistencia (por ejemplo, el módulo de laboratorios). Sin un lugar no pueden marcar."
          />
        }
      />

      <PanelFormulario
        abierto={panel !== null}
        titulo={lugar ? "Editar lugar" : "Nuevo lugar"}
        subtitulo="Los auxiliares solo pueden marcar si su teléfono los ubica dentro del radio."
        onCerrar={() => onPanel(null)}
        hayCambios={f.cambiado && !guardar.isPending}
        pie={
          <>
            <Button appearance="primary" disabled={!completo || guardar.isPending} onClick={() => guardar.mutate()}>
              {guardar.isPending ? "Guardando…" : lugar ? "Guardar cambios" : "Agregar"}
            </Button>
            <Button onClick={() => onPanel(null)}>Cancelar</Button>
            {lugar && (
              <>
                <span className={estilos.espacio} />
                <Button appearance="subtle" icon={<IconoEliminar />} onClick={() => setEliminando(true)}>
                  Eliminar
                </Button>
              </>
            )}
          </>
        }
      >
        {e.general && Object.keys(e).length <= 2 && (
          <MessageBar intent="error">
            <MessageBarBody>{e.general}</MessageBarBody>
          </MessageBar>
        )}

        <Field label="Nombre" required {...estadoCampo(e.nombre)}>
          <Input
            value={v.nombre}
            maxLength={100}
            placeholder="Ej.: Módulo 236 · Laboratorios FICCT"
            onChange={(_, d) => f.set("nombre", d.value)}
          />
        </Field>

        <Field label="Referencia" hint="Opcional. Ayuda a reconocer el lugar." {...estadoCampo(e.referencia)}>
          <Input
            value={v.referencia}
            maxLength={200}
            placeholder="Ej.: Planta alta, al lado de la jefatura"
            onChange={(_, d) => f.set("referencia", d.value)}
          />
        </Field>

        <Field
          label="Coordenadas"
          required
          hint="En Google Maps, haz clic derecho sobre el punto y luego clic en las coordenadas para copiarlas. También puedes pegar el enlace."
          {...estadoCampo(errorCoordenadas)}
        >
          <Input
            value={v.coordenadas}
            placeholder="-17.776200, -63.195000"
            onChange={(_, d) => f.set("coordenadas", d.value)}
          />
        </Field>
        <Button
          className={estilos.ubicacion}
          size="small"
          icon={<IconoUbicacion />}
          disabled={ubicando}
          onClick={usarMiUbicacion}
        >
          {ubicando ? "Buscando tu ubicación…" : "Usar mi ubicación actual"}
        </Button>
        <Caption1 className={estilos.secundario}>
          En una computadora la ubicación suele ser imprecisa. Lo más exacto es copiar el punto desde Google Maps, o
          crear el lugar desde la app estando en el sitio.
        </Caption1>

        {punto && <MapaLugar latitud={punto.latitud} longitud={punto.longitud} radioM={v.radio_m} />}

        <Field
          label="Radio permitido (metros)"
          required
          hint={`Entre ${RADIO_MINIMO_M} y ${RADIO_MAXIMO_M} m. Dentro de un edificio el GPS falla por 20 a 50 m: con menos de 80 m puede rechazar marcas válidas.`}
          {...estadoCampo(e.radio_m ?? (radioValido ? undefined : `Debe estar entre ${RADIO_MINIMO_M} y ${RADIO_MAXIMO_M} m.`))}
        >
          <SpinButton
            min={RADIO_MINIMO_M}
            max={RADIO_MAXIMO_M}
            step={10}
            value={v.radio_m}
            onChange={(_, d) =>
              f.set("radio_m", d.value ?? (Number.parseInt(d.displayValue ?? "", 10) || RADIO_POR_DEFECTO_M))
            }
          />
        </Field>

        <Switch
          label={
            v.predeterminado
              ? "Predeterminado: aquí marcan los auxiliares sin lugar propio"
              : "Solo para los auxiliares que lo tengan asignado"
          }
          checked={v.predeterminado}
          onChange={(_, d) => f.set("predeterminado", d.checked)}
        />
        {!v.predeterminado && (
          <Switch
            label={v.activo ? "Activo" : "Inactivo: nadie puede marcar aquí"}
            checked={v.activo}
            onChange={(_, d) => f.set("activo", d.checked)}
          />
        )}
        {e.activo && (
          <MessageBar intent="error">
            <MessageBarBody>{e.activo}</MessageBarBody>
          </MessageBar>
        )}
      </PanelFormulario>

      <ConfirmarDialogo
        abierto={eliminando}
        titulo={`¿Eliminar «${lugar?.nombre ?? ""}»?`}
        mensaje="Los auxiliares que lo tenían asignado pasan al lugar predeterminado. Si ya tiene marcaciones no se puede eliminar: desactívalo."
        textoConfirmar="Eliminar"
        peligroso
        cargando={borrar.isPending}
        onCancelar={() => setEliminando(false)}
        onConfirmar={() => borrar.mutate()}
      />
    </>
  );
}
