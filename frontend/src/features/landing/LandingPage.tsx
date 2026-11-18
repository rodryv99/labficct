/**
 * Página de inicio pública. Presenta el sistema (qué hace, para quién) y lleva
 * al inicio de sesión. Se muestra en "/" cuando nadie inició sesión.
 *
 * El plano del laboratorio es de ejemplo: no consulta la API.
 */
import { Tooltip, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { useState } from "react";
import { Link } from "react-router";

import { useTema } from "../../app/TemaProvider";
import { fondoPlano, fuentes, identidad } from "../../app/tema";
import { IconoLuna, IconoSol } from "../../components/iconos/iconos";
import { env } from "../../config/env";

const ANGOSTO = "@media (max-width: 720px)";

const useEstilos = makeStyles({
  raiz: {
    height: "100%",
    overflowY: "auto",
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground2,
    ...fondoPlano,
    backgroundAttachment: "local",
    fontSize: "17px",
    lineHeight: "1.55",
  },
  ancho: {
    maxWidth: "1180px",
    marginLeft: "auto",
    marginRight: "auto",
    paddingLeft: "clamp(20px, 5vw, 48px)",
    paddingRight: "clamp(20px, 5vw, 48px)",
  },
  cabecera: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    paddingTop: "18px",
    paddingBottom: "18px",
  },
  marca: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontFamily: fuentes.titulos,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: "24px",
    letterSpacing: "0.01em",
  },
  logo: { height: "40px", width: "auto" },
  enlaces: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px 24px",
  },
  enlace: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightMedium,
    fontSize: "16px",
    textDecorationLine: "none",
    ":hover": { textDecorationLine: "underline" },
    [ANGOSTO]: { display: "none" },
  },
  botonTema: {
    width: "40px",
    height: "40px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    color: tokens.colorNeutralForeground1,
    backgroundColor: "transparent",
    border: `1.5px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
  },
  primario: {
    display: "inline-block",
    padding: "10px 18px",
    fontSize: "16px",
    fontWeight: tokens.fontWeightSemibold,
    textDecorationLine: "none",
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorBrandBackground,
    borderRadius: tokens.borderRadiusMedium,
    ":hover": { backgroundColor: tokens.colorBrandBackgroundHover },
  },
  primarioGrande: {
    padding: "15px 26px",
    fontSize: "18px",
  },

  // ── Portada ──
  portada: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "56px",
    paddingTop: "48px",
    paddingBottom: "88px",
    [ANGOSTO]: { gap: "36px", paddingTop: "24px", paddingBottom: "56px" },
  },
  portadaTexto: {
    flex: "1 1 400px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "24px",
  },
  titular: {
    margin: 0,
    fontFamily: fuentes.titulos,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: "clamp(46px, 6.4vw, 88px)",
    lineHeight: "0.94",
    letterSpacing: "-0.01em",
  },
  bajada: {
    margin: 0,
    maxWidth: "34em",
    fontSize: "19px",
    color: tokens.colorNeutralForeground3,
  },
  acciones: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "20px",
  },
  enlaceTexto: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightMedium,
  },

  // ── Plano de ejemplo ──
  plano: {
    flex: "1.25 1 460px",
    minWidth: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1.5px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
  },
  planoCuerpo: {
    padding: "20px 20px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  numeros: {
    display: "grid",
    gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
    gap: "6px",
    paddingLeft: "28px",
  },
  rotulo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: tokens.fontWeightMedium,
    color: tokens.colorNeutralForeground3,
  },
  planoFilas: { display: "flex", gap: "6px" },
  letras: {
    width: "22px",
    display: "grid",
    gridTemplateRows: "repeat(5, minmax(0, 1fr))",
    gap: "6px",
  },
  celdas: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
    gap: "6px",
  },
  celda: {
    aspectRatio: "1",
    padding: 0,
    fontFamily: fuentes.titulos,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: "15px",
    borderRadius: tokens.borderRadiusSmall,
    cursor: "pointer",
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1.5px solid ${tokens.colorNeutralStroke1}`,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `3px solid ${identidad.acento}`, outlineOffset: "2px" },
    [ANGOSTO]: { fontSize: "12px" },
  },
  celdaFalla: {
    color: "#ffffff",
    backgroundColor: tokens.colorPaletteRedBackground3,
    border: `1.5px solid ${tokens.colorPaletteRedBackground3}`,
    ":hover": { backgroundColor: tokens.colorPaletteRedBackground3 },
  },
  celdaMantenimiento: {
    color: tokens.colorPaletteMarigoldForeground1,
    backgroundColor: "transparent",
    border: `2px dashed ${tokens.colorPaletteMarigoldForeground1}`,
  },
  celdaDocente: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorBrandBackground,
    border: `1.5px solid ${tokens.colorBrandBackground}`,
    ":hover": { backgroundColor: tokens.colorBrandBackgroundHover },
  },
  celdaProyector: {
    border: `1.5px solid ${tokens.colorNeutralForeground3}`,
  },
  celdaElegida: {
    outline: `3px solid ${identidad.acento}`,
    outlineOffset: "2px",
  },
  pasillo: { visibility: "hidden" },
  cajetin: {
    display: "flex",
    flexWrap: "wrap",
    borderTop: `1.5px solid ${tokens.colorNeutralStroke1}`,
  },
  cajetinCelda: {
    flex: "1 1 150px",
    padding: "12px 20px",
    borderRight: `1.5px solid ${tokens.colorNeutralStroke1}`,
    ":last-child": { borderRight: "none" },
  },
  cajetinAncha: { flex: "2 1 220px" },
  chico: { fontSize: "13px", color: tokens.colorNeutralForeground3 },
  dato: {
    fontFamily: fuentes.titulos,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: "24px",
    lineHeight: "1.2",
  },
  estado: { fontSize: "16px", fontWeight: tokens.fontWeightSemibold },
  estadoFalla: { color: tokens.colorPaletteRedForeground1 },
  estadoMantenimiento: { color: tokens.colorPaletteMarigoldForeground1 },
  detalle: { fontSize: "15px", color: tokens.colorNeutralForeground3 },

  // ── Secciones ──
  banda: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `1.5px solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `1.5px solid ${tokens.colorNeutralStroke2}`,
  },
  seccion: {
    paddingTop: "80px",
    paddingBottom: "80px",
    [ANGOSTO]: { paddingTop: "56px", paddingBottom: "56px" },
  },
  tituloSeccion: {
    margin: 0,
    fontFamily: fuentes.titulos,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: "clamp(34px, 4vw, 52px)",
    lineHeight: "1",
  },
  textoSeccion: {
    margin: "12px 0 0",
    maxWidth: "44em",
    fontSize: "18px",
    color: tokens.colorNeutralForeground3,
  },
  grupos: {
    marginTop: "48px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))",
    gap: "40px 32px",
  },
  grupo: { display: "flex", flexDirection: "column", gap: "20px" },
  tituloGrupo: {
    margin: 0,
    paddingBottom: "10px",
    borderBottom: `1.5px solid ${tokens.colorNeutralForeground1}`,
    fontSize: "16px",
    fontWeight: tokens.fontWeightSemibold,
  },
  modulo: {
    fontFamily: fuentes.titulos,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: "23px",
    lineHeight: "1.2",
  },
  moduloTexto: {
    margin: "2px 0 0",
    fontSize: "16px",
    lineHeight: "1.5",
    color: tokens.colorNeutralForeground3,
  },
  dosColumnas: {
    display: "flex",
    flexWrap: "wrap",
    gap: "48px",
  },
  columnaTitulo: { flex: "1 1 320px", minWidth: 0 },
  columnaContenido: {
    flex: "1.6 1 440px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  pestanas: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 28px",
    borderBottom: `1.5px solid ${tokens.colorNeutralStroke2}`,
  },
  pestana: {
    padding: "10px 0",
    marginBottom: "-1.5px",
    fontFamily: "inherit",
    fontSize: "18px",
    fontWeight: tokens.fontWeightMedium,
    color: tokens.colorNeutralForeground1,
    backgroundColor: "transparent",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: "4px solid transparent",
    cursor: "pointer",
    ":focus-visible": { outline: `3px solid ${identidad.acento}`, outlineOffset: "2px" },
  },
  pestanaActiva: {
    fontWeight: tokens.fontWeightSemibold,
    borderBottom: `4px solid ${identidad.acento}`,
  },
  fraseRol: {
    margin: 0,
    fontFamily: fuentes.titulos,
    fontWeight: tokens.fontWeightMedium,
    fontSize: "28px",
    lineHeight: "1.15",
  },
  puntos: { margin: 0, padding: 0, listStyleType: "none" },
  punto: {
    padding: "12px 0",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  avisos: {
    flex: "1 1 340px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  aviso: {
    padding: "16px 18px",
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1.5px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
  },
  avisoCabecera: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "14px",
    color: tokens.colorNeutralForeground3,
  },
  avisoTitulo: { marginTop: "4px", fontWeight: tokens.fontWeightSemibold },
  avisoTexto: { fontSize: "16px", lineHeight: "1.45", color: tokens.colorNeutralForeground3 },

  // ── Cierre ──
  cierre: {
    backgroundColor: identidad.barra,
    color: "#e4eefa",
  },
  cierreFila: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "24px",
    paddingTop: "72px",
    paddingBottom: "56px",
  },
  botonCierre: {
    display: "inline-block",
    padding: "15px 26px",
    fontSize: "18px",
    fontWeight: tokens.fontWeightSemibold,
    textDecorationLine: "none",
    color: "#062b54",
    backgroundColor: "#e4eefa",
    borderRadius: tokens.borderRadiusMedium,
    ":hover": { backgroundColor: "#ffffff" },
  },
  pie: {
    margin: 0,
    paddingTop: "20px",
    paddingBottom: "40px",
    borderTop: "1px solid rgba(255, 255, 255, 0.25)",
    fontSize: "15px",
  },
});

// ── El plano de ejemplo ─────────────────────────────────

type Clase = "operativo" | "falla" | "mantenimiento" | "docente" | "proyector";

interface Equipo {
  coord: string;
  texto: string;
  etiqueta: string;
  tipo: string;
  clase: Clase;
  estado: string;
  detalle: string;
}

const LETRAS = ["A", "B", "C", "D", "E"];
// P: computadora, F: con falla, M: en mantenimiento, D: PC del docente, X: proyector, punto: pasillo.
const MAPA = ["PPPP.PPP", "PPFP.PPP", "PPPP.PMP", "PPPP.PPP", "D...X..."];

function armarPlano(): (Equipo | null)[] {
  const celdas: (Equipo | null)[] = [];
  let numero = 0;
  MAPA.forEach((fila, f) => {
    fila.split("").forEach((letra, c) => {
      const coord = `${LETRAS[f]}${c + 1}`;
      if (letra === ".") {
        celdas.push(null);
      } else if (letra === "D") {
        celdas.push({ coord, texto: "D", etiqueta: "PC-DOC", tipo: "PC del docente", clase: "docente", estado: "Operativo", detalle: "Conectada al proyector." });
      } else if (letra === "X") {
        celdas.push({ coord, texto: "PR", etiqueta: "PROY-1", tipo: "Proyector", clase: "proyector", estado: "Operativo", detalle: "Sin novedades." });
      } else {
        numero += 1;
        const texto = String(numero).padStart(2, "0");
        const base = { coord, texto, etiqueta: `PC-${texto}`, tipo: "Computadora" };
        if (letra === "F") {
          celdas.push({ ...base, clase: "falla", estado: "Con falla", detalle: "La pantalla no da señal." });
        } else if (letra === "M") {
          celdas.push({ ...base, clase: "mantenimiento", estado: "En mantenimiento", detalle: "Se está reinstalando el sistema." });
        } else {
          celdas.push({ ...base, clase: "operativo", estado: "Operativo", detalle: "Sin novedades." });
        }
      }
    });
  });
  return celdas;
}

const PLANO = armarPlano();

// ── Contenido ───────────────────────────────────────────

const GRUPOS: { titulo: string; modulos: { nombre: string; texto: string }[] }[] = [
  {
    titulo: "Operación",
    modulos: [
      { nombre: "Pizarra", texto: "Qué pasa en cada laboratorio hoy, esta semana y en las próximas dos horas." },
      { nombre: "Reservas", texto: "Eventos y cursos por bloques. Si una reserva choca con una clase, el jefe decide y la clase se suspende sola ese día." },
      { nombre: "Asistencia", texto: "El docente pide ayuda desde el aula y un auxiliar la toma." },
      { nombre: "Tareas", texto: "Pizarrón de pendientes con responsables, fecha límite y avances." },
      { nombre: "Objetos perdidos", texto: "Registro con foto y entrega con constancia. Nada se borra." },
    ],
  },
  {
    titulo: "Planificación",
    modulos: [
      { nombre: "Horarios", texto: "Las clases de cada periodo. Dos clases no pueden caer en el mismo laboratorio a la misma hora." },
      { nombre: "Preferencias docentes", texto: "Cada docente dice cómo quiere encontrar el aula, y el auxiliar lo ve al alistarla." },
    ],
  },
  {
    titulo: "Recursos",
    modulos: [
      { nombre: "Laboratorios", texto: "El plano de cada sala, equipo por equipo, con su software y sus credenciales cifradas." },
      { nombre: "Bitácora", texto: "Lo que se hizo en cada laboratorio, pintado sobre su plano. Se exporta a PDF o imagen." },
      { nombre: "Revisiones", texto: "Mantenimientos que se repiten solos y avisan cuando vencen." },
      { nombre: "Inventario", texto: "Activos, traslados, bajas y verificaciones." },
    ],
  },
  {
    titulo: "Administración",
    modulos: [
      { nombre: "Usuarios", texto: "Cuentas y roles: cada persona ve solo lo que le toca." },
      { nombre: "Control de asistencia", texto: "Entrada y salida de los auxiliares, con ubicación y horario de trabajo." },
      { nombre: "Reportes", texto: "Tablero y reportes de todo el sistema, exportables a PDF, Excel, CSV y Word." },
      { nombre: "Respaldos", texto: "Copias de seguridad de la base de datos, a mano o automáticas." },
    ],
  },
];

const ROLES: { id: string; nombre: string; frase: string; puntos: string[] }[] = [
  {
    id: "jefe",
    nombre: "Jefe de laboratorios",
    frase: "Decide, programa y ve el panorama completo.",
    puntos: [
      "Aprueba las reservas que chocan con clases.",
      "Programa revisiones periódicas y reparte tareas.",
      "Consulta reportes y la puntualidad de los auxiliares.",
      "Gestiona usuarios, horarios y respaldos.",
    ],
  },
  {
    id: "auxiliar",
    nombre: "Auxiliar",
    frase: "Tiene el día ordenado desde que empieza su turno.",
    puntos: [
      "Recibe avisos para alistar y cerrar cada aula.",
      "Atiende las solicitudes de asistencia de los docentes.",
      "Lleva la bitácora y sus tareas del pizarrón.",
      "Marca su entrada y su salida desde el celular.",
    ],
  },
  {
    id: "docente",
    nombre: "Docente",
    frase: "Llega al aula y la encuentra como la pidió.",
    puntos: [
      "Ve sus clases y el estado de sus laboratorios.",
      "Deja sus preferencias para cada clase.",
      "Pide asistencia sin salir del aula.",
      "Consulta sus reservas.",
    ],
  },
  {
    id: "administrativo",
    nombre: "Administrativo",
    frase: "Consulta lo que necesita sin pedirle a nadie.",
    puntos: ["Revisa horarios y laboratorios.", "Pide asistencia cuando hace falta."],
  },
];

export function LandingPage() {
  const estilos = useEstilos();
  const { oscuro, cambiarModo } = useTema();
  const [elegida, setElegida] = useState("B3");
  const [rolId, setRolId] = useState("jefe");

  const equipo = PLANO.find((e) => e?.coord === elegida) ?? null;
  const rol = ROLES.find((r) => r.id === rolId) ?? ROLES[0];

  const claseCelda: Record<Clase, string | undefined> = {
    operativo: undefined,
    falla: estilos.celdaFalla,
    mantenimiento: estilos.celdaMantenimiento,
    docente: estilos.celdaDocente,
    proyector: estilos.celdaProyector,
  };

  return (
    <div className={estilos.raiz}>
      <header className={mergeClasses(estilos.ancho, estilos.cabecera)}>
        <div className={estilos.marca}>
          <img src="/logo-ficct.png" alt="Escudo de la FICCT" className={estilos.logo} />
          <span>{env.appName}</span>
        </div>
        <nav aria-label="Secciones" className={estilos.enlaces}>
          <a href="#funciones" className={estilos.enlace}>
            Funciones
          </a>
          <a href="#roles" className={estilos.enlace}>
            Roles
          </a>
          <a href="#app" className={estilos.enlace}>
            App móvil
          </a>
          <Tooltip content={oscuro ? "Usar tema claro" : "Usar tema oscuro"} relationship="label">
            <button type="button" className={estilos.botonTema} onClick={() => cambiarModo(oscuro ? "claro" : "oscuro")}>
              {oscuro ? <IconoSol /> : <IconoLuna />}
            </button>
          </Tooltip>
          <Link to="/login" className={estilos.primario}>
            Iniciar sesión
          </Link>
        </nav>
      </header>

      <main>
        <section className={mergeClasses(estilos.ancho, estilos.portada)}>
          <div className={estilos.portadaTexto}>
            <h1 className={estilos.titular}>Cada laboratorio de la FICCT, en un solo plano.</h1>
            <p className={estilos.bajada}>
              Horarios, reservas, equipos, tareas y bitácora de los laboratorios de cómputo, para quienes los cuidan y
              para quienes dan clases en ellos.
            </p>
            <div className={estilos.acciones}>
              <Link to="/login" className={mergeClasses(estilos.primario, estilos.primarioGrande)}>
                Iniciar sesión
              </Link>
              <a href="#funciones" className={estilos.enlaceTexto}>
                Ver qué puede hacer
              </a>
            </div>
          </div>

          <div className={estilos.plano}>
            <div className={estilos.planoCuerpo}>
              <div className={estilos.numeros} aria-hidden="true">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <div key={n} className={estilos.rotulo}>
                    {n}
                  </div>
                ))}
              </div>
              <div className={estilos.planoFilas}>
                <div className={estilos.letras} aria-hidden="true">
                  {LETRAS.map((l) => (
                    <div key={l} className={estilos.rotulo}>
                      {l}
                    </div>
                  ))}
                </div>
                <div className={estilos.celdas}>
                  {PLANO.map((e, i) =>
                    e ? (
                      <button
                        key={e.coord}
                        type="button"
                        aria-label={`${e.coord}, ${e.etiqueta}, ${e.estado}`}
                        aria-pressed={e.coord === elegida}
                        onClick={() => setElegida(e.coord)}
                        className={mergeClasses(
                          estilos.celda,
                          claseCelda[e.clase],
                          e.coord === elegida && estilos.celdaElegida,
                        )}
                      >
                        {e.texto}
                      </button>
                    ) : (
                      <div key={`pasillo-${i}`} className={estilos.pasillo} />
                    ),
                  )}
                </div>
              </div>
            </div>
            <div className={estilos.cajetin}>
              <div className={estilos.cajetinCelda}>
                <div className={estilos.chico}>Elemento {equipo?.coord}</div>
                <div className={estilos.dato}>{equipo?.etiqueta}</div>
              </div>
              <div className={mergeClasses(estilos.cajetinCelda, estilos.cajetinAncha)} aria-live="polite">
                <div className={estilos.chico}>{equipo?.tipo}</div>
                <div
                  className={mergeClasses(
                    estilos.estado,
                    equipo?.clase === "falla" && estilos.estadoFalla,
                    equipo?.clase === "mantenimiento" && estilos.estadoMantenimiento,
                  )}
                >
                  {equipo?.estado}
                </div>
                <div className={estilos.detalle}>{equipo?.detalle}</div>
              </div>
              <div className={estilos.cajetinCelda}>
                <div className={estilos.chico}>Plano de ejemplo</div>
                <div className={estilos.dato}>Laboratorio 41</div>
              </div>
            </div>
          </div>
        </section>

        <section id="funciones" className={estilos.banda}>
          <div className={mergeClasses(estilos.ancho, estilos.seccion)}>
            <h2 className={estilos.tituloSeccion}>Lo que hace, módulo por módulo</h2>
            <p className={estilos.textoSeccion}>
              Está organizado igual que el trabajo en los laboratorios: lo del día, lo que se planifica, lo que hay en
              cada sala y lo que administra el jefe.
            </p>
            <div className={estilos.grupos}>
              {GRUPOS.map((grupo) => (
                <div key={grupo.titulo} className={estilos.grupo}>
                  <h3 className={estilos.tituloGrupo}>{grupo.titulo}</h3>
                  {grupo.modulos.map((m) => (
                    <div key={m.nombre}>
                      <div className={estilos.modulo}>{m.nombre}</div>
                      <p className={estilos.moduloTexto}>{m.texto}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="roles" className={mergeClasses(estilos.ancho, estilos.seccion, estilos.dosColumnas)}>
          <div className={estilos.columnaTitulo}>
            <h2 className={estilos.tituloSeccion}>Cada quien ve lo suyo</h2>
            <p className={estilos.textoSeccion}>
              El menú y las pantallas cambian según tu rol. Elige uno para ver qué puede hacer.
            </p>
          </div>
          <div className={estilos.columnaContenido}>
            <div className={estilos.pestanas}>
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={r.id === rol.id}
                  onClick={() => setRolId(r.id)}
                  className={mergeClasses(estilos.pestana, r.id === rol.id && estilos.pestanaActiva)}
                >
                  {r.nombre}
                </button>
              ))}
            </div>
            <p className={estilos.fraseRol}>{rol.frase}</p>
            <ul className={estilos.puntos}>
              {rol.puntos.map((p) => (
                <li key={p} className={estilos.punto}>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="app" className={estilos.banda}>
          <div className={mergeClasses(estilos.ancho, estilos.seccion, estilos.dosColumnas)}>
            <div className={estilos.columnaTitulo}>
              <h2 className={estilos.tituloSeccion}>En el celular, lo de todos los días</h2>
              <p className={estilos.textoSeccion}>
                La app avisa al auxiliar cuándo alistar o cerrar un aula y cuándo empieza su turno, aunque esté
                cerrada. También sirve para marcar asistencia, atender solicitudes y llenar la bitácora pintando el
                plano con el dedo.
              </p>
            </div>
            <div className={estilos.avisos}>
              <div className={estilos.aviso}>
                <div className={estilos.avisoCabecera}>
                  <span>{env.appName}</span>
                  <span>10:30</span>
                </div>
                <div className={estilos.avisoTitulo}>Alista el Laboratorio 41</div>
                <div className={estilos.avisoTexto}>
                  Programación I empieza a las 10:45. El docente quiere el proyector encendido.
                </div>
              </div>
              <div className={estilos.aviso}>
                <div className={estilos.avisoCabecera}>
                  <span>{env.appName}</span>
                  <span>13:45</span>
                </div>
                <div className={estilos.avisoTitulo}>Tu turno empieza a las 14:00</div>
                <div className={estilos.avisoTexto}>Ya puedes marcar tu entrada.</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={estilos.cierre}>
        <div className={estilos.ancho}>
          <div className={estilos.cierreFila}>
            <h2 className={estilos.tituloSeccion}>Entra con tu cuenta de la FICCT</h2>
            <Link to="/login" className={estilos.botonCierre}>
              Iniciar sesión
            </Link>
          </div>
          <p className={estilos.pie}>
            Facultad de Ingeniería en Ciencias de la Computación y Telecomunicaciones, UAGRM. Santa Cruz de la Sierra,
            Bolivia.
          </p>
        </div>
      </footer>
    </div>
  );
}
