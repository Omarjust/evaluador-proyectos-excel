// Hoja Riesgo (sensibilidad, araña, escenarios, Monte Carlo y preguntas con fórmulas vivas)
// y hoja oculta _MC con los ensayos.
import { Hoja, C, FMT, colLetra } from './plan.js';
import { H } from './mapa.js';

const r6 = x => (x === null || x === undefined || !isFinite(x) ? '' : Math.round(x * 1e6) / 1e6);
const r2 = x => (x === null || x === undefined || !isFinite(x) ? '' : Math.round(x * 100) / 100);

// Columnas de _MC
export const MC_COLS = [
  ['van', 'VAN', 'MC_VAN', r2], ['tir', 'TIR', 'MC_TIR', r6], ['tur', 'TUR', 'MC_TUR', r6], ['bc', 'B/C', 'MC_BC', r6],
  ['tri', 'TRI', 'MC_TRI', r6], ['vanF', 'VAN financiado', 'MC_VANF', r2], ['tirF', 'TIR financiada', 'MC_TIRF', r6],
];

export function hojaMC(sim) {
  const h = new Hoja(H.mc, { color: C.tabOculta, oculta: true });
  const N = sim.N;
  const cols = MC_COLS.filter(([k]) => sim[k]);
  const ent = sim.variables;
  const enc = [...cols.map(c => c[1]), ...ent.map(v => `Factor ${v.corto}`)];
  const ultima = colLetra(enc.length - 1);
  h.set(`A1:${ultima}1`, [enc]);
  const filas = new Array(N);
  for (let i = 0; i < N; i++) {
    filas[i] = [...cols.map(([k, , , f]) => f(sim[k][i])), ...ent.map(v => r6(sim.entradas[v.clave][i]))];
  }
  h.set(`A2:${ultima}${N + 1}`, filas);
  cols.forEach(([, , nombre], j) => h.nombre_(nombre, `'${H.mc}'!$${colLetra(j)}$2:$${colLetra(j)}$${N + 1}`));
  ent.forEach((v, j) => h.nombre_(`MC_in_${v.clave}`, `'${H.mc}'!$${colLetra(cols.length + j)}$2:$${colLetra(cols.length + j)}$${N + 1}`));
  return h;
}

export const RIESGO = { sens: 6, arana: 17, crit: 28, esc: 39, mc: 45, est: 51, preg: 68, hist: 92, corr: 122 };

export function hojaRiesgo({ R, sens, esc, sim, previas = {}, fecha, moneda }) {
  const h = new Hoja(H.riesgo, { color: C.tabRiesgo });
  const P = RIESGO;
  h.titulo('A1', 'ANÁLISIS DE RIESGO');
  h.nota('A2', `Sensibilidad, escenarios y ensayos calculados por el complemento el ${fecha}. Si cambias los datos, pulsa Recalcular en el panel. Las preguntas (amarillas) se recalculan solas.`);
  h.ancho('A', 280).ancho('B:F', 92).ancho('G', 10).ancho('H', 120).ancho('I:J', 88).ancho('K', 10);

  // ---- Sensibilidad ±10 % ----
  const d = Math.round(sens.delta * 100);
  h.seccion(`A${P.sens - 2}`, `SENSIBILIDAD DEL VAN ${sens.financiado ? 'FINANCIADO' : 'PURO'} (±${d} % EN CADA VARIABLE)`);
  h.set(`A${P.sens - 1}:F${P.sens - 1}`, [['Variable', `VAN con -${d} %`, 'VAN base', `VAN con +${d} %`, 'Rango', 'Cambio del VAN por cada 1 %']]);
  h.encabezado(`A${P.sens - 1}:F${P.sens - 1}`);
  const k = sens.tornado.length;
  h.set(`A${P.sens}:F${P.sens + k - 1}`, sens.tornado.map(t => [t.nombre, r2(t.bajo), r2(sens.base), r2(t.alto), r2(t.rango), r2(t.impacto10 / d)]));
  h.fmt(`A${P.sens}:F${P.sens + k - 1}`, { borde: true });
  h.fmt(`B${P.sens}:F${P.sens + k - 1}`, { numFmt: FMT.dinero });
  // Datos del tornado: diferencia contra el caso base
  h.set(`H${P.sens - 1}:J${P.sens - 1}`, [['Variable', `-${d} %`, `+${d} %`]]);
  h.encabezado(`H${P.sens - 1}:J${P.sens - 1}`);
  h.set(`H${P.sens}:J${P.sens + k - 1}`, sens.tornado.map(t => [t.corto, r2(t.bajo - sens.base), r2(t.alto - sens.base)]));
  h.fmt(`I${P.sens}:J${P.sens + k - 1}`, { numFmt: FMT.dinero });
  h.grafico({ tipo: 'BarClustered', datos: `H${P.sens - 1}:J${P.sens + k - 1}`, por: 'Columns', titulo: `Tornado: cambio del VAN con ±${d} %`, pos: ['L3', 'T16'], leyenda: 'Bottom', tornado: true, formatoEje: FMT.dinero });

  // ---- Araña ----
  const ar = sens.arana;
  h.seccion(`A${P.arana - 2}`, 'ANÁLISIS DE ARAÑA: VAN SI CAMBIA UNA SOLA VARIABLE');
  h.set(`A${P.arana - 1}:${colLetra(ar.length)}${P.arana - 1}`, [['Cambio', ...ar.map(a => a.corto)]]);
  h.encabezado(`A${P.arana - 1}:${colLetra(ar.length)}${P.arana - 1}`);
  h.set(`A${P.arana}:${colLetra(ar.length)}${P.arana + sens.pasos.length - 1}`, sens.pasos.map((p, i) => [p, ...ar.map(a => r2(a.puntos[i].valor))]));
  h.fmt(`A${P.arana}:A${P.arana + 6}`, { numFmt: '+0%;-0%;0%' });
  h.fmt(`B${P.arana}:${colLetra(ar.length)}${P.arana + 6}`, { numFmt: FMT.dinero });
  h.fmt(`A${P.arana}:${colLetra(ar.length)}${P.arana + 6}`, { borde: true });
  h.nota(`A${P.arana + 7}`, 'Cada línea mueve una variable y deja las demás en el caso base. Más inclinada = más sensible. Donde cruza el VAN = 0 está su punto crítico.');
  h.grafico({ tipo: 'XYScatterLines', datos: `A${P.arana - 1}:${colLetra(ar.length)}${P.arana + 6}`, por: 'Columns', titulo: 'Gráfico de araña (VAN)', pos: ['L18', 'T38'], leyenda: 'Bottom', formatoEje: FMT.dinero, formatoEjeX: '+0%;-0%;0%' });

  // ---- Valores críticos ----
  h.seccion(`A${P.crit - 2}`, 'VALORES CRÍTICOS (cambio que deja el VAN en 0)');
  h.set(`A${P.crit - 1}:C${P.crit - 1}`, [['Variable', 'Cambio crítico', 'Lectura']]);
  h.encabezado(`A${P.crit - 1}:C${P.crit - 1}`);
  h.set(`A${P.crit}:C${P.crit + sens.criticos.length - 1}`, sens.criticos.map(c => [c.nombre, c.margen === null ? 'No llega' : r6(c.margen),
    c.margen === null ? 'Ni con cambios grandes el VAN llega a 0' : `${c.nombre} puede ${c.margen < 0 ? 'bajar' : 'subir'} hasta ${Math.abs(c.margen * 100).toFixed(1).replace('.', ',')} %`]));
  h.fmt(`B${P.crit}:B${P.crit + sens.criticos.length - 1}`, { numFmt: '+0.0%;-0.0%' });
  h.fmt(`A${P.crit}:C${P.crit + sens.criticos.length - 1}`, { borde: true });

  // ---- Escenarios ----
  h.seccion(`A${P.esc - 2}`, 'ESCENARIOS (extremos de los rangos de riesgo)');
  h.set(`A${P.esc - 1}:F${P.esc - 1}`, [['Escenario', 'VAN', 'TIR', 'B/C', 'TRI (años)', 'VAN financiado']]);
  h.encabezado(`A${P.esc - 1}:F${P.esc - 1}`);
  const nomEsc = { pesimista: 'Pesimista', base: 'Más probable', optimista: 'Optimista' };
  h.set(`A${P.esc}:F${P.esc + 2}`, esc.map(e => [nomEsc[e.tipo], r2(e.van), r6(e.tir), r6(e.bc), r6(e.tri), r2(e.vanF)]));
  h.fmt(`A${P.esc}:F${P.esc + 2}`, { borde: true });
  h.fmt(`B${P.esc}:B${P.esc + 2}`, { numFmt: FMT.dinero });
  h.fmt(`C${P.esc}:C${P.esc + 2}`, { numFmt: FMT.pct });
  h.fmt(`D${P.esc}:E${P.esc + 2}`, { numFmt: FMT.dec2 });
  h.fmt(`F${P.esc}:F${P.esc + 2}`, { numFmt: FMT.dinero });

  if (!sim) return h;

  // ---- Monte Carlo ----
  h.seccion(`A${P.mc - 1}`, 'SIMULACIÓN DE MONTE CARLO');
  h.set(`A${P.mc}:B${P.mc + 2}`, [
    ['Ensayos', '=ROWS(MC_VAN)'],
    ['Semilla', sim.semilla],
    ['Variables simuladas (mín · más probable · máx)', sim.variables.map(v => `${v.corto} ${Math.round(v.min * 100)}·${Math.round(v.moda * 100)}·${Math.round(v.max * 100)} %`).join('; ')],
  ]);
  h.fmt(`A${P.mc}:B${P.mc + 2}`, { borde: true });

  // Estadísticos (fórmulas vivas sobre los ensayos)
  const met = [['MC_VAN', 'VAN', FMT.dinero], ['MC_TIR', 'TIR', FMT.pct], ['MC_TUR', 'TUR', FMT.pct], ['MC_BC', 'B/C', FMT.dec2]];
  if (sim.vanF) met.push(['MC_VANF', 'VAN financiado', FMT.dinero]);
  const est = [
    ['Media', m => `AVERAGE(${m})`], ['Mediana', m => `MEDIAN(${m})`], ['Desviación estándar', m => `STDEV.S(${m})`],
    ['Coeficiente de variación', m => `STDEV.S(${m})/ABS(AVERAGE(${m}))`, FMT.dec2], ['Mínimo', m => `MIN(${m})`],
    ['Percentil 5', m => `PERCENTILE.INC(${m},0.05)`], ['Percentil 25', m => `PERCENTILE.INC(${m},0.25)`],
    ['Percentil 75', m => `PERCENTILE.INC(${m},0.75)`], ['Percentil 95', m => `PERCENTILE.INC(${m},0.95)`], ['Máximo', m => `MAX(${m})`],
    ['Asimetría', m => `SKEW(${m})`, FMT.dec2], ['Curtosis', m => `KURT(${m})`, FMT.dec2],
    ['Error de precisión de la media (95 %)', m => `1.96*STDEV.S(${m})/(SQRT(COUNT(${m}))*ABS(AVERAGE(${m})))`, FMT.pct],
  ];
  const ce = colLetra(met.length);
  h.seccion(`A${P.est - 2}`, 'ESTADÍSTICOS DE LA SIMULACIÓN');
  h.set(`A${P.est - 1}:${ce}${P.est - 1}`, [['Estadístico', ...met.map(m => m[1])]]);
  h.encabezado(`A${P.est - 1}:${ce}${P.est - 1}`);
  h.set(`A${P.est}:${ce}${P.est + est.length - 1}`, est.map(([et, f]) => [et, ...met.map(m => `=IFERROR(${f(m[0])},"")`)]));
  h.fmt(`A${P.est}:${ce}${P.est + est.length - 1}`, { borde: true });
  met.forEach((m, j) => {
    const c = colLetra(j + 1);
    est.forEach(([, , fmt], i) => h.fmt(`${c}${P.est + i}`, { numFmt: fmt || m[2] }));
  });

  // ---- Preguntas con fórmulas vivas ----
  const pv = (fila, k2, def) => previas[`${fila}${k2}`] ?? def;
  const q = P.preg;
  h.seccion(`A${q - 2}`, 'PREGUNTAS DE RIESGO (cambia los valores amarillos y la probabilidad se recalcula)');
  h.set(`A${q - 1}:F${q - 1}`, [['Pregunta', 'Valor X', 'Valor Y', 'Probabilidad (contando ensayos)', 'Probabilidad (normal, método del curso)', 'Lectura']]);
  h.encabezado(`A${q - 1}:F${q - 1}`);
  const N_ = (m, x) => `NORM.DIST(${x},AVERAGE(${m}),STDEV.S(${m}),TRUE)`;
  const riesgoTxt = c => `=IF(NOT(ISNUMBER(${c})),"",IF(${c}<=0.1,"Riesgo bajo",IF(${c}<=0.3,"Riesgo moderado","Riesgo alto")))`;
  const preguntas = [
    ['¿Riesgo de que el proyecto no sea factible? P(VAN < X)', pv(q, 'B', 0), '', `=COUNTIF(MC_VAN,"<"&B${q})/COUNT(MC_VAN)`, `=${N_('MC_VAN', `B${q}`)}`, riesgoTxt(`E${q}`)],
    ['¿Riesgo de que la rentabilidad (TIR) sea menor a X?', pv(q + 1, 'B', 0.18), '', `=COUNTIF(MC_TIR,"<"&B${q + 1})/COUNT(MC_TIR)`, `=${N_('MC_TIR', `B${q + 1}`)}`, riesgoTxt(`E${q + 1}`)],
    ['¿Probabilidad de que el VAN esté entre X e Y?', pv(q + 2, 'B', previas.x ?? 0), pv(q + 2, 'C', previas.y ?? 0), `=COUNTIFS(MC_VAN,">="&B${q + 2},MC_VAN,"<="&C${q + 2})/COUNT(MC_VAN)`, `=${N_('MC_VAN', `C${q + 2}`)}-${N_('MC_VAN', `B${q + 2}`)}`, `=IFERROR(FIXED(E${q + 2}*100,1)&" % de probabilidad","")`],
    ['¿Probabilidad de que el VAN supere X?', pv(q + 3, 'B', previas.meta ?? 0), '', `=COUNTIF(MC_VAN,">"&B${q + 3})/COUNT(MC_VAN)`, `=1-${N_('MC_VAN', `B${q + 3}`)}`, `=IFERROR(FIXED(E${q + 3}*100,1)&" % de probabilidad","")`],
    ['¿Riesgo de que B/C sea menor a X?', pv(q + 4, 'B', 1), '', `=COUNTIF(MC_BC,"<"&B${q + 4})/COUNT(MC_BC)`, `=${N_('MC_BC', `B${q + 4}`)}`, riesgoTxt(`E${q + 4}`)],
    ['¿Probabilidad de recuperar la inversión en X años o menos?', pv(q + 5, 'B', Math.max(1, Math.round(R.n / 2))), '', `=COUNTIF(MC_TRI,"<="&B${q + 5})/ROWS(MC_TRI)`, 'No aplica', `=IF(D${q + 5}>=0.9,"Muy probable",IF(D${q + 5}>=0.6,"Probable","Poco probable"))`],
    ['VAN que se alcanza con X de seguridad', pv(q + 6, 'B', 0.9), '', `=PERCENTILE.INC(MC_VAN,1-B${q + 6})`, `=NORM.INV(1-B${q + 6},AVERAGE(MC_VAN),STDEV.S(MC_VAN))`, `="En el "&FIXED(B${q + 6}*100,0)&" % de los ensayos el VAN es mayor"`],
  ];
  if (sim.vanF) preguntas.push(['¿Riesgo de que el proyecto financiado no sea factible? P(VAN financiado < X)', pv(q + 7, 'B', 0), '', `=COUNTIF(MC_VANF,"<"&B${q + 7})/COUNT(MC_VANF)`, `=${N_('MC_VANF', `B${q + 7}`)}`, riesgoTxt(`E${q + 7}`)]);
  const ult = q + preguntas.length - 1;
  // Sin ensayos válidos (por ejemplo ninguna TIR) o sin variación: "s/d" en vez de #DIV/0! o #VALUE!
  preguntas.forEach(f => [3, 4].forEach(k => { if (typeof f[k] === 'string' && f[k].startsWith('=')) f[k] = `=IFERROR(${f[k].slice(1)},"s/d")`; }));
  h.set(`A${q}:F${ult}`, preguntas);
  h.fmt(`A${q}:F${ult}`, { borde: true, wrap: true });
  h.entrada(`B${q}:B${ult}`);
  h.entrada(`C${q + 2}`);
  h.fmt(`B${q}`, { numFmt: FMT.dinero });
  h.fmt(`B${q + 1}`, { numFmt: FMT.pct });
  h.fmt(`B${q + 2}:C${q + 3}`, { numFmt: FMT.dinero });
  h.fmt(`B${q + 4}`, { numFmt: FMT.dec2 });
  h.fmt(`B${q + 5}`, { numFmt: '0' });
  h.fmt(`B${q + 6}`, { numFmt: FMT.pct0 });
  h.fmt(`D${q}:E${q + 5}`, { numFmt: FMT.pct });
  h.fmt(`D${q + 6}:E${q + 6}`, { numFmt: FMT.dinero });
  if (sim.vanF) { h.fmt(`B${q + 7}`, { numFmt: FMT.dinero }); h.fmt(`D${q + 7}:E${q + 7}`, { numFmt: FMT.pct }); }
  h.semaforo(`F${q}:F${ult}`, [['Riesgo alto', C.bad], ['Riesgo moderado', C.warn], ['Riesgo bajo', C.ok], ['Muy probable', C.ok], ['Poco probable', C.bad]]);
  h.nota(`A${ult + 1}`, 'Contando ensayos = proporción de ensayos que cumplen la condición. Normal = aproximación con la media y la desviación estándar (Tabla 33 del curso). Si difieren mucho, la distribución es asimétrica.');
  h.nota(`A${ult + 2}`, 'Para la TIR y la rentabilidad escribe la tasa como porcentaje (18 %). Para la seguridad, el nivel (90 %).');
  RIESGO.ultPregunta = ult;

  // ---- Histograma (25 intervalos) ----
  const g = P.hist;
  h.seccion(`A${g - 2}`, 'HISTOGRAMA DEL VAN (25 intervalos)');
  h.set(`A${g - 1}:F${g - 1}`, [['Marca de clase', 'Frecuencia relativa', 'Desde', 'Hasta', 'Frecuencia', 'Acumulada']]);
  h.encabezado(`A${g - 1}:F${g - 1}`);
  h.set(`H${g - 1}:I${g - 1}`, [['Ancho del intervalo', '=(MAX(MC_VAN)-MIN(MC_VAN))/25']]);
  h.fmt(`I${g - 1}`, { numFmt: FMT.dinero });
  const filasH = [];
  for (let i = 0; i < 25; i++) {
    const r = g + i;
    const ultimo = i === 24;
    filasH.push([
      `=FIXED((C${r}+D${r})/2,0)`,
      `=E${r}/COUNT(MC_VAN)`,
      i === 0 ? '=MIN(MC_VAN)' : `=D${r - 1}`,
      `=C${r}+$I$${g - 1}`,
      ultimo ? `=COUNTIFS(MC_VAN,">="&C${r},MC_VAN,"<="&D${r})` : `=COUNTIFS(MC_VAN,">="&C${r},MC_VAN,"<"&D${r})`,
      `=SUM($B$${g}:B${r})`,
    ]);
  }
  h.set(`A${g}:F${g + 24}`, filasH);
  h.fmt(`A${g}:F${g + 24}`, { borde: true });
  h.fmt(`B${g}:B${g + 24}`, { numFmt: FMT.pct });
  h.fmt(`C${g}:D${g + 24}`, { numFmt: FMT.dinero });
  h.fmt(`F${g}:F${g + 24}`, { numFmt: FMT.pct });
  // Barras en rojo donde el VAN es negativo (según los ensayos actuales)
  const st = sim.hist || [];
  h.grafico({ tipo: 'ColumnClustered', datos: `A${g - 1}:B${g + 24}`, por: 'Columns', titulo: 'Distribución del VAN (en rojo, VAN negativo)', pos: ['L40', 'T60'], leyenda: 'None', gap: 2, rojos: st.map((b, i) => (b.hasta <= 0 ? i : null)).filter(x => x !== null), formatoEje: '0%' });

  // Curva acumulada: VAN para cada probabilidad
  h.set(`H${g + 1}:I${g + 1}`, [['VAN', 'Probabilidad acumulada']]);
  h.encabezado(`H${g + 1}:I${g + 1}`);
  h.set(`H${g + 2}:I${g + 22}`, Array.from({ length: 21 }, (_, i) => [`=PERCENTILE.INC(MC_VAN,I${g + 2 + i})`, i * 0.05]));
  h.fmt(`H${g + 2}:H${g + 22}`, { numFmt: FMT.dinero });
  h.fmt(`I${g + 2}:I${g + 22}`, { numFmt: FMT.pct0 });
  h.fmt(`H${g + 2}:I${g + 22}`, { borde: true });
  h.grafico({ tipo: 'XYScatterLines', datos: `H${g + 1}:I${g + 22}`, por: 'Columns', titulo: 'Probabilidad acumulada del VAN', pos: ['L62', 'T82'], leyenda: 'None', formatoEje: '0%', formatoEjeX: FMT.dinero });

  // ---- Correlaciones ----
  const cr = P.corr;
  h.seccion(`A${cr - 2}`, 'QUÉ VARIABLE EXPLICA MÁS EL VAN (correlación ensayo a ensayo)');
  h.set(`A${cr - 1}:B${cr - 1}`, [['Variable', 'Correlación con el VAN']]);
  h.encabezado(`A${cr - 1}:B${cr - 1}`);
  h.set(`A${cr}:B${cr + sim.variables.length - 1}`, sim.variables.map(v => [v.nombre, `=CORREL(MC_in_${v.clave},MC_VAN)`]));
  h.fmt(`A${cr}:B${cr + sim.variables.length - 1}`, { borde: true });
  h.fmt(`B${cr}:B${cr + sim.variables.length - 1}`, { numFmt: FMT.dec2 });
  h.nota(`A${cr + sim.variables.length}`, 'Cerca de 1 o -1 = esa variable mueve mucho el VAN. Positiva: si sube, el VAN sube. Negativa: si sube, el VAN baja.');
  return h;
}
