/**
 * Gráficos del módulo de reportes, dibujados como SVG propio (sin dependencias
 * nuevas). Combinan con el tema (usan los tokens de Fluent para texto y rejilla,
 * así se ven bien en claro y oscuro) y la misma paleta FICCT del backend.
 *
 * Cada forma lleva un <title> para que el navegador muestre el dato al pasar el
 * mouse, y un realce al pasar por encima.
 */
import { Subtitle2, makeStyles, tokens } from "@fluentui/react-components";

import type { GraficoDTO } from "./api";

export const PALETA = [
  "#0969c3",
  "#22A34A",
  "#F89000",
  "#E3001B",
  "#8E44AD",
  "#16A6A6",
  "#E86A17",
  "#7F8C8D",
  "#2F7DE1",
  "#B5179E",
];

export function colorSerie(i: number): string {
  return PALETA[i % PALETA.length];
}

const W = 760;
const H = 430;
const M = { izq: 56, arriba: 16, der: 20, abajo: 56 };

const useEstilos = makeStyles({
  tarjeta: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
  },
  titulo: {
    color: tokens.colorNeutralForeground1,
  },
  svg: {
    width: "100%",
    height: "auto",
    display: "block",
  },
  forma: {
    transition: "opacity 120ms ease",
    ":hover": { opacity: 0.82 },
  },
  vacio: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "180px",
    color: tokens.colorNeutralForeground3,
  },
});

export function Grafico({ grafico }: { grafico: GraficoDTO }) {
  const estilos = useEstilos();
  const vacio = estaVacio(grafico);
  return (
    <div className={estilos.tarjeta}>
      <Subtitle2 className={estilos.titulo}>{grafico.titulo}</Subtitle2>
      {vacio ? (
        <div className={estilos.vacio}>Sin datos para mostrar.</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className={estilos.svg} role="img" aria-label={grafico.titulo}>
          <Cuerpo grafico={grafico} clase={estilos.forma} />
        </svg>
      )}
    </div>
  );
}

function estaVacio(g: GraficoDTO): boolean {
  if (g.tipo === "heatmap") return !g.matriz.some((fila) => fila.some((v) => v > 0));
  const total = g.series.reduce((s, serie) => s + serie.datos.reduce((a, b) => a + b, 0), 0);
  return total === 0;
}

function Cuerpo({ grafico, clase }: { grafico: GraficoDTO; clase: string }) {
  switch (grafico.tipo) {
    case "pastel":
    case "dona":
      return <Pastel g={grafico} clase={clase} dona={grafico.tipo === "dona"} />;
    case "lineas":
      return <Lineas g={grafico} clase={clase} />;
    case "heatmap":
      return <Heatmap g={grafico} clase={clase} />;
    default:
      return <Barras g={grafico} clase={clase} apiladas={grafico.tipo === "barras_apiladas"} />;
  }
}

// ── Ejes y utilidades ───────────────────────────────────

function maxBonito(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  for (const paso of [1, 2, 2.5, 5, 10]) {
    if (v <= paso * base) return paso * base;
  }
  return 10 * base;
}

const COLOR_TEXTO = tokens.colorNeutralForeground2;
const COLOR_TENUE = tokens.colorNeutralForeground3;
const COLOR_REJILLA = tokens.colorNeutralStroke2;

function EjesY({ max, x0, x1, y0, y1 }: { max: number; x0: number; x1: number; y0: number; y1: number }) {
  const pasos = 4;
  const lineas = [];
  for (let i = 0; i <= pasos; i++) {
    const y = y1 - ((y1 - y0) * i) / pasos;
    lineas.push(
      <g key={i}>
        <line x1={x0} y1={y} x2={x1} y2={y} stroke={COLOR_REJILLA} strokeWidth={1} />
        <text x={x0 - 8} y={y + 4} textAnchor="end" fontSize={12} fill={COLOR_TENUE}>
          {redondear((max * i) / pasos)}
        </text>
      </g>,
    );
  }
  return <>{lineas}</>;
}

function redondear(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function recortar(texto: string, max = 16): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

/** Parte una etiqueta en hasta 2 líneas según el ancho disponible, sin cortar palabras si se puede. */
function partirEtiqueta(texto: string, maxChars: number): string[] {
  if (texto.length <= maxChars) return [texto];
  const palabras = texto.split(" ");
  let l1 = "";
  let i = 0;
  while (i < palabras.length && (l1 ? `${l1} ${palabras[i]}` : palabras[i]).length <= maxChars) {
    l1 = l1 ? `${l1} ${palabras[i]}` : palabras[i];
    i++;
  }
  if (!l1) return [`${texto.slice(0, Math.max(maxChars - 1, 1))}…`];
  let l2 = palabras.slice(i).join(" ");
  if (l2.length > maxChars) l2 = `${l2.slice(0, Math.max(maxChars - 1, 1))}…`;
  return l2 ? [l1, l2] : [l1];
}

/** Etiqueta del eje X, centrada y en hasta 2 líneas según el ancho de su categoría. */
function EtiquetaX({ cx, y, texto, ancho }: { cx: number; y: number; texto: string; ancho: number }) {
  const maxChars = Math.max(6, Math.floor(ancho / 6.6));
  const lineas = partirEtiqueta(texto, maxChars);
  return (
    <text x={cx} y={y} textAnchor="middle" fontSize={12} fill={COLOR_TENUE}>
      {lineas.map((ln, i) => (
        <tspan key={i} x={cx} dy={i === 0 ? 0 : 13}>
          {ln}
        </tspan>
      ))}
    </text>
  );
}

// ── Barras (agrupadas o apiladas) ───────────────────────

function Barras({ g, clase, apiladas }: { g: GraficoDTO; clase: string; apiladas: boolean }) {
  const x0 = M.izq;
  const x1 = W - M.der;
  const y0 = M.arriba + 20;
  const y1 = H - M.abajo;
  const etiquetas = g.etiquetas.length ? g.etiquetas : [""];
  const series = g.series.length ? g.series : [{ nombre: "", datos: etiquetas.map(() => 0), color: null }];

  const max = maxBonito(
    apiladas
      ? Math.max(...etiquetas.map((_, j) => series.reduce((s, serie) => s + (serie.datos[j] ?? 0), 0)), 1)
      : Math.max(...series.flatMap((s) => s.datos), 1),
  );

  const n = etiquetas.length;
  const anchoGrupo = (x1 - x0) / n;
  const hueco = anchoGrupo * 0.22;
  const conLeyenda = series.filter((s) => s.nombre).length > 1;

  return (
    <>
      <EjesY max={max} x0={x0} x1={x1} y0={y0} y1={y1} />
      {etiquetas.map((etq, j) => {
        const baseX = x0 + anchoGrupo * j + hueco / 2;
        const anchoUtil = anchoGrupo - hueco;
        if (apiladas) {
          const anchoBarra = Math.min(anchoUtil, 90);
          const bx = baseX + (anchoUtil - anchoBarra) / 2;
          let acum = 0;
          return (
            <g key={j}>
              {series.map((s, k) => {
                const val = s.datos[j] ?? 0;
                const alto = ((y1 - y0) * val) / max;
                const y = y1 - acum - alto;
                acum += alto;
                return (
                  <rect key={k} className={clase} x={bx} y={y} width={anchoBarra} height={Math.max(alto, 0)} fill={colorSerie(k)}>
                    <title>{`${s.nombre}: ${val}`}</title>
                  </rect>
                );
              })}
              <EtiquetaX cx={baseX + anchoUtil / 2} y={y1 + 16} texto={etq} ancho={anchoGrupo} />
            </g>
          );
        }
        const m = series.length;
        const anchoBarra = Math.min(anchoUtil / m, 90);
        const offset = (anchoUtil - anchoBarra * m) / 2;
        return (
          <g key={j}>
            {series.map((s, k) => {
              const val = s.datos[j] ?? 0;
              const alto = ((y1 - y0) * val) / max;
              const bx = baseX + offset + anchoBarra * k;
              return (
                <g key={k}>
                  <rect className={clase} x={bx} y={y1 - alto} width={anchoBarra * 0.9} height={Math.max(alto, 0)} fill={colorSerie(k)} rx={2}>
                    <title>{`${s.nombre || etq}: ${val}`}</title>
                  </rect>
                  {m === 1 && val > 0 && (
                    <text x={bx + anchoBarra * 0.45} y={y1 - alto - 5} textAnchor="middle" fontSize={11} fill={COLOR_TENUE}>
                      {val}
                    </text>
                  )}
                </g>
              );
            })}
            <EtiquetaX cx={baseX + anchoUtil / 2} y={y1 + 16} texto={etq} ancho={anchoGrupo} />
          </g>
        );
      })}
      {conLeyenda && <Leyenda nombres={series.map((s) => s.nombre)} y={H - 24} />}
    </>
  );
}

function Leyenda({ nombres, y }: { nombres: string[]; y: number }) {
  let x = M.izq;
  return (
    <>
      {nombres.map((nombre, i) => {
        const el = (
          <g key={i}>
            <rect x={x} y={y} width={14} height={14} rx={2} fill={colorSerie(i)} />
            <text x={x + 20} y={y + 12} fontSize={12} fill={COLOR_TEXTO}>
              {recortar(nombre, 18)}
            </text>
          </g>
        );
        x += 20 + 8 * recortar(nombre, 18).length + 24;
        return el;
      })}
    </>
  );
}

// ── Líneas ──────────────────────────────────────────────

function Lineas({ g, clase }: { g: GraficoDTO; clase: string }) {
  const x0 = M.izq;
  const x1 = W - M.der;
  const y0 = M.arriba + 20;
  const y1 = H - M.abajo;
  const etiquetas = g.etiquetas.length ? g.etiquetas : [""];
  const n = etiquetas.length;
  const max = maxBonito(Math.max(...g.series.flatMap((s) => s.datos), 1));
  const paso = n > 1 ? (x1 - x0) / (n - 1) : 0;
  const px = (j: number) => x0 + paso * j;
  const py = (v: number) => y1 - ((y1 - y0) * v) / max;
  const conLeyenda = g.series.filter((s) => s.nombre).length > 1;

  return (
    <>
      <EjesY max={max} x0={x0} x1={x1} y0={y0} y1={y1} />
      {g.series.map((s, k) => {
        const puntos = s.datos.slice(0, n).map((v, j) => `${px(j)},${py(v)}`).join(" ");
        return (
          <g key={k}>
            <polyline points={puntos} fill="none" stroke={colorSerie(k)} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            {s.datos.slice(0, n).map((v, j) => (
              <circle key={j} className={clase} cx={px(j)} cy={py(v)} r={4} fill={colorSerie(k)} stroke={tokens.colorNeutralBackground1} strokeWidth={1.5}>
                <title>{`${etiquetas[j]} · ${s.nombre || ""}: ${v}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {etiquetas.map((etq, j) =>
        j % Math.ceil(n / 8) === 0 ? (
          <EtiquetaX key={j} cx={px(j)} y={y1 + 16} texto={etq} ancho={Math.max(paso, 54)} />
        ) : null,
      )}
      {conLeyenda && <Leyenda nombres={g.series.map((s) => s.nombre)} y={H - 24} />}
    </>
  );
}

// ── Pastel / Dona ───────────────────────────────────────

function Pastel({ g, clase, dona }: { g: GraficoDTO; clase: string; dona: boolean }) {
  const datos = g.series[0]?.datos ?? [];
  const total = datos.reduce((a, b) => a + b, 0) || 1;
  const cx = W * 0.34;
  const cy = H * 0.52;
  const r = Math.min(W * 0.2, H * 0.36);
  let ang = -Math.PI / 2;

  const polar = (radio: number, a: number) => ({ x: cx + radio * Math.cos(a), y: cy + radio * Math.sin(a) });

  return (
    <>
      {datos.map((val, i) => {
        const barrido = (2 * Math.PI * val) / total;
        const a0 = ang;
        const a1 = ang + barrido;
        ang = a1;
        if (val === 0) return null;
        const p0 = polar(r, a0);
        const p1 = polar(r, a1);
        const grande = barrido > Math.PI ? 1 : 0;
        const d = `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${grande} 1 ${p1.x} ${p1.y} Z`;
        return (
          <path key={i} className={clase} d={d} fill={colorSerie(i)} stroke={tokens.colorNeutralBackground1} strokeWidth={2}>
            <title>{`${g.etiquetas[i] ?? ""}: ${val} (${Math.round((100 * val) / total)}%)`}</title>
          </path>
        );
      })}
      {dona && (
        <>
          <circle cx={cx} cy={cy} r={r * 0.56} fill={tokens.colorNeutralBackground1} />
          <text x={cx} y={cy + 6} textAnchor="middle" fontSize={22} fontWeight={700} fill={COLOR_TEXTO}>
            {redondear(total)}
          </text>
        </>
      )}
      {datos.map((val, i) => {
        const y = H * 0.24 + i * 26;
        return (
          <g key={i}>
            <rect x={W * 0.62} y={y} width={14} height={14} rx={2} fill={colorSerie(i)} />
            <text x={W * 0.62 + 20} y={y + 12} fontSize={13} fill={COLOR_TEXTO}>
              {`${recortar(g.etiquetas[i] ?? "", 20)}  ·  ${val} (${Math.round((100 * val) / total)}%)`}
            </text>
          </g>
        );
      })}
    </>
  );
}

// ── Heatmap ─────────────────────────────────────────────

function Heatmap({ g, clase }: { g: GraficoDTO; clase: string }) {
  const filas = g.filas;
  const columnas = g.columnas;
  const izq = M.izq + 14;
  const arriba = 40;
  const x1 = W - M.der;
  const y1 = H - 24;
  const cw = (x1 - izq) / Math.max(columnas.length, 1);
  const ch = (y1 - arriba) / Math.max(filas.length, 1);
  const max = Math.max(...g.matriz.flat(), 1);

  return (
    <>
      {columnas.map((col, ci) => (
        <text key={`c${ci}`} x={izq + cw * ci + cw / 2} y={arriba - 6} textAnchor="middle" fontSize={11} fill={COLOR_TENUE}>
          {recortar(String(col), 6)}
        </text>
      ))}
      {filas.map((fila, fi) => (
        <g key={fi}>
          <text x={izq - 8} y={arriba + ch * fi + ch / 2 + 4} textAnchor="end" fontSize={12} fill={COLOR_TEXTO}>
            {recortar(String(fila), 8)}
          </text>
          {columnas.map((_, ci) => {
            const val = g.matriz[fi]?.[ci] ?? 0;
            const intensidad = val / max;
            return (
              <g key={ci}>
                <rect
                  className={clase}
                  x={izq + cw * ci + 1}
                  y={arriba + ch * fi + 1}
                  width={cw - 2}
                  height={ch - 2}
                  rx={3}
                  fill={val ? "#0969c3" : tokens.colorNeutralBackground3}
                  fillOpacity={val ? 0.2 + intensidad * 0.8 : 1}
                >
                  <title>{`${fila} · ${columnas[ci]}: ${val}`}</title>
                </rect>
                {val > 0 && (
                  <text
                    x={izq + cw * ci + cw / 2}
                    y={arriba + ch * fi + ch / 2 + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fill={intensidad > 0.5 ? "#ffffff" : COLOR_TEXTO}
                  >
                    {val}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </>
  );
}
