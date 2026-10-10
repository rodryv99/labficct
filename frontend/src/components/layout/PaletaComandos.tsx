import { Caption1, Dialog, DialogSurface, Input, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { navegacionPermitida } from "../../app/navegacion";
import { useSesion } from "../../app/sesion";
import { listarLaboratoriosTodos } from "../../features/laboratorios/api";
import { IconoAgregar, IconoBuscar, IconoLaboratorios } from "../iconos/iconos";

const useEstilos = makeStyles({
  superficie: {
    padding: "0",
    maxWidth: "560px",
    width: "calc(100vw - 32px)",
    overflow: "hidden",
    alignSelf: "flex-start",
    marginTop: "12vh",
  },
  entrada: {
    padding: "12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  lista: {
    maxHeight: "50vh",
    overflowY: "auto",
    padding: "6px",
  },
  seccion: {
    display: "block",
    padding: "8px 10px 4px",
    color: tokens.colorNeutralForeground3,
  },
  item: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 10px",
    border: "none",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground1,
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase300,
    textAlign: "left",
    cursor: "pointer",
  },
  itemActivo: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
  icono: {
    display: "flex",
    fontSize: "20px",
    color: tokens.colorNeutralForeground3,
  },
  secundario: {
    marginLeft: "auto",
    color: tokens.colorNeutralForeground3,
  },
  vacio: {
    padding: "16px",
    color: tokens.colorNeutralForeground3,
  },
});

interface Comando {
  id: string;
  seccion: string;
  titulo: string;
  secundario?: string;
  claves?: string;
  icono: ReactNode;
  ir: string;
}

interface Props {
  abierta: boolean;
  onCerrar: () => void;
}

/** Ctrl+K: ir a cualquier pantalla, laboratorio o acción escribiendo. */
export function PaletaComandos({ abierta, onCerrar }: Props) {
  const estilos = useEstilos();
  const navegar = useNavigate();
  const { puede } = useSesion();
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);

  const laboratorios = useQuery({
    queryKey: ["laboratorios", "todos"],
    queryFn: listarLaboratoriosTodos,
    enabled: abierta && puede("laboratorios.ver"),
    staleTime: 60_000,
  });

  const comandos = useMemo<Comando[]>(() => {
    const lista: Comando[] = [];
    navegacionPermitida(puede).forEach((g) =>
      g.items.forEach((i) => {
        const Icono = i.icono;
        lista.push({ id: i.ruta, seccion: "Ir a", titulo: i.etiqueta, claves: i.claves, icono: <Icono />, ir: i.ruta });
      }),
    );
    const acciones: [string, string, string][] = [
      ["asistencia.solicitar", "Solicitar asistencia", "/asistencia?nuevo=1"],
      ["tareas.gestionar", "Nueva tarea", "/tareas?nuevo=1"],
      ["reservas.gestionar", "Nueva reserva", "/reservas?nuevo=1"],
      ["bitacora.gestionar", "Registrar en la bitácora", "/bitacora?nuevo=1"],
      ["revisiones.gestionar", "Programar revisión", "/revisiones?nuevo=1"],
      ["objetos.registrar", "Registrar objeto perdido", "/objetos-perdidos?nuevo=1"],
      ["horarios.gestionar", "Nuevo horario", "/horarios?nuevo=1"],
      ["laboratorios.gestionar", "Nuevo laboratorio", "/laboratorios?nuevo=1"],
      ["usuarios.gestionar", "Nuevo usuario", "/usuarios?nuevo=1"],
      ["elementos.gestionar", "Nuevo elemento", "/elementos?nuevo=1"],
    ];
    acciones
      .filter(([permiso]) => puede(permiso))
      .forEach(([, titulo, ir]) => lista.push({ id: ir, seccion: "Acciones", titulo, icono: <IconoAgregar />, ir }));
    (laboratorios.data ?? []).forEach((l) =>
      lista.push({
        id: `lab-${l.id}`,
        seccion: "Laboratorios",
        titulo: `${l.codigo} · ${l.nombre}`,
        secundario: l.ubicacion,
        icono: <IconoLaboratorios />,
        ir: `/laboratorios/${l.id}`,
      }),
    );
    return lista;
  }, [puede, laboratorios.data]);

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return comandos.filter((c) => c.seccion !== "Laboratorios");
    return comandos.filter((c) => `${c.titulo} ${c.secundario ?? ""} ${c.claves ?? ""}`.toLowerCase().includes(q));
  }, [comandos, texto]);

  useEffect(() => {
    setActivo(0);
  }, [texto, abierta]);

  useEffect(() => {
    if (!abierta) setTexto("");
  }, [abierta]);

  const elegir = (c: Comando | undefined) => {
    if (!c) return;
    onCerrar();
    navegar(c.ir);
  };

  const alTeclear = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((a) => Math.min(a + 1, filtrados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      elegir(filtrados[activo]);
    }
  };

  let seccionAnterior = "";
  return (
    <Dialog open={abierta} onOpenChange={(_, d) => !d.open && onCerrar()}>
      <DialogSurface className={estilos.superficie} aria-label="Buscar o ir a">
        <div className={estilos.entrada}>
          <Input
            autoFocus
            size="large"
            appearance="underline"
            contentBefore={<IconoBuscar />}
            placeholder="Escribe una pantalla, un laboratorio o una acción"
            value={texto}
            onChange={(_, d) => setTexto(d.value)}
            onKeyDown={alTeclear}
            style={{ width: "100%" }}
          />
        </div>
        <div className={estilos.lista} role="listbox">
          {filtrados.length === 0 && <Caption1 className={estilos.vacio}>Sin resultados para “{texto}”.</Caption1>}
          {filtrados.map((c, i) => {
            const mostrarSeccion = c.seccion !== seccionAnterior;
            seccionAnterior = c.seccion;
            return (
              <div key={c.id}>
                {mostrarSeccion && <Caption1 className={estilos.seccion}>{c.seccion}</Caption1>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activo}
                  className={mergeClasses(estilos.item, i === activo && estilos.itemActivo)}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => elegir(c)}
                >
                  <span className={estilos.icono}>{c.icono}</span>
                  {c.titulo}
                  {c.secundario && <Caption1 className={estilos.secundario}>{c.secundario}</Caption1>}
                </button>
              </div>
            );
          })}
        </div>
      </DialogSurface>
    </Dialog>
  );
}
