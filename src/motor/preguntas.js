// Motor de preguntas de riesgo. Cada respuesta trae: el número, la comprobación por los dos
// métodos (empírico y normal), un gráfico sugerido y el porqué en tres partes.
import { estadisticos, proporcion, normalMenor, percentil, correlacion, phiInv } from './estadistica.js';
import { dinero, pct, num, anios } from './formato.js';

export const METRICAS = {
  van: { nombre: 'VAN', largo: 'el VAN del flujo puro', tipo: 'dinero', nombreMC: 'MC_VAN' },
  tir: { nombre: 'TIR', largo: 'la TIR del flujo puro', tipo: 'pct', nombreMC: 'MC_TIR' },
  tur: { nombre: 'TUR', largo: 'la TUR del flujo puro', tipo: 'pct', nombreMC: 'MC_TUR' },
  bc: { nombre: 'B/C', largo: 'la relación B/C', tipo: 'num', nombreMC: 'MC_BC' },
  tri: { nombre: 'TRI', largo: 'el tiempo de recuperación (TRI)', tipo: 'anios', nombreMC: 'MC_TRI' },
  vanF: { nombre: 'VAN financiado', largo: 'el VAN del flujo financiado', tipo: 'dinero', nombreMC: 'MC_VANF' },
  tirF: { nombre: 'TIR financiada', largo: 'la TIR del flujo financiado', tipo: 'pct', nombreMC: 'MC_TIRF' },
};

// Atajos que llenan la frase con huecos
export const SUGERIDAS = [
  { tema: 'Factibilidad', id: 'factible', texto: '¿Riesgo de que no sea factible?', q: { metrica: 'van', op: 'menor', a: 0 } },
  { tema: 'Factibilidad', id: 'bc', texto: '¿B/C menor que 1?', q: { metrica: 'bc', op: 'menor', a: 1 } },
  { tema: 'Rentabilidad', id: 'tir18', texto: '¿Rentabilidad menor al 18 %?', q: { metrica: 'tir', op: 'menor', a: 0.18 } },
  { tema: 'Rentabilidad', id: 'tur', texto: '¿TUR menor a la tasa?', q: { metrica: 'tur', op: 'menor', a: 'tasa' } },
  { tema: 'Metas', id: 'entre', texto: '¿VAN entre X e Y?', q: { metrica: 'van', op: 'entre', a: 'p25', b: 'p75' } },
  { tema: 'Metas', id: 'seguro90', texto: '¿VAN con 90 % de seguridad?', q: { metrica: 'van', op: 'seguridad', a: 0.9 } },
  { tema: 'Metas', id: 'recupera', texto: '¿Recupero en k años?', q: { metrica: 'tri', op: 'menorIgual', a: 'mitad' } },
  { tema: 'Variables', id: 'variable', texto: '¿Qué variable es más riesgosa?', q: { tipo: 'variable' } },
  { tema: 'Variables', id: 'comparar', texto: '¿Puro o financiado, cuál arriesga más?', q: { tipo: 'comparar' } },
  { tema: 'Variables', id: 'resumen', texto: '¿Cuánto espero ganar y cuánto varía?', q: { tipo: 'resumen' } },
];

const nivelRiesgo = p => (p === null ? 'info' : p <= 0.1 ? 'ok' : p <= 0.3 ? 'warn' : 'bad');
const fmtM = (m, x, moneda) => {
  const t = METRICAS[m].tipo;
  return t === 'dinero' ? dinero(x, moneda) : t === 'pct' ? pct(x) : t === 'anios' ? anios(x) : num(x, 2);
};

// Redondeo "humano" según el tipo de indicador (para valores sugeridos)
export const redondear = (metrica, v) => {
  const t = METRICAS[metrica]?.tipo;
  return t === 'dinero' ? Math.round(v / 1000) * 1000 : t === 'pct' ? Math.round(v * 1000) / 1000 : t === 'num' ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;
};

// Resuelve los valores simbólicos ("tasa", "p25", "mitad") con los datos de la simulación
export function resolverValores(q, sim, ctx) {
  const st = estadisticos(sim[q.metrica] || []);
  const r = v => {
    if (typeof v === 'number') return v;
    if (v === 'tasa') return ctx.tasa;
    if (v === 'mitad') return Math.max(1, Math.round(ctx.n / 2));
    if (v === 'p25') return st ? redondear(q.metrica, st.p25) : 0;
    if (v === 'p75') return st ? redondear(q.metrica, st.p75) : 0;
    return v;
  };
  return { ...q, a: r(q.a), b: r(q.b) };
}

// Variable que más mueve el VAN (correlación ensayo a ensayo)
export function influencias(sim, metrica = 'van') {
  const y = sim[metrica];
  return sim.variables.map(v => ({ ...v, r: correlacion(sim.entradas[v.clave], y) }))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

function causaYAccion(sim, ctx, metrica) {
  const inf = influencias(sim, metrica === 'vanF' || metrica === 'tirF' ? 'vanF' : 'van');
  const top = inf[0];
  if (!top) return { causa: 'No hay variables de riesgo activas.', hacer: '' };
  const dir = top.r > 0 ? 'cuando sube, el resultado mejora' : 'cuando sube, el resultado empeora';
  const causa = `La variable que más explica el resultado es ${top.nombre.toLowerCase()} (correlación ${num(top.r, 2)}): ${dir}. Le sigue ${inf[1] ? inf[1].nombre.toLowerCase() : 'ninguna otra'}.`;
  const crit = ctx.sensibilidad?.criticos?.find(c => c.clave === top.clave);
  let hacer = 'Reduce la incertidumbre de esa variable: contratos, precios pactados o estudios de mercado más precisos.';
  if (crit && crit.margen !== null) {
    const m = Math.abs(crit.margen);
    hacer = `${top.nombre} puede ${crit.margen < 0 ? 'bajar' : 'subir'} hasta ${pct(m, 1)} antes de que el VAN llegue a 0. ${m < 0.1 ? 'Es un margen corto: asegura esa variable antes de invertir.' : 'Es un margen razonable, pero vigílalo.'}`;
  }
  return { causa, hacer, influencias: inf };
}

// Pregunta principal: P(métrica op valor) o percentil con seguridad
export function responder(qCruda, sim, ctx) {
  const moneda = ctx.moneda || 'Bs';
  if (qCruda.tipo === 'variable') return responderVariable(sim, ctx);
  if (qCruda.tipo === 'comparar') return responderComparar(sim, ctx);
  if (qCruda.tipo === 'resumen') return responderResumen(sim, ctx);

  const q = resolverValores(qCruda, sim, ctx);
  const M = METRICAS[q.metrica];
  const serieCruda = sim[q.metrica];
  if (!serieCruda) return { error: `No hay datos de ${M.nombre}. ${q.metrica.endsWith('F') ? 'Agrega un préstamo en Datos.' : ''}` };
  if (q.a === null || q.a === undefined || Number.isNaN(q.a) || (q.op === 'entre' && (q.b === null || q.b === undefined || Number.isNaN(q.b)))) {
    return { error: 'Escribe el valor de la pregunta.' };
  }
  const esTri = q.metrica === 'tri';
  // TRI: un ensayo que no recupera la inversión cuenta como "infinito" (nunca recupera)
  const serie = esTri ? Array.from(serieCruda, x => (Number.isFinite(x) ? x : Infinity)) : serieCruda;
  const st = estadisticos(serieCruda);
  const N = serieCruda.length;
  if (!st && !esTri) return { error: `Ningún ensayo tiene ${M.nombre}: el flujo no cambia de signo en ninguno. Usa el VAN o la TUR.` };
  const sinValor = N - (st ? st.n : 0); // TIR que no existe o TRI que no se recupera
  const f = x => (x === Infinity ? 'no recupera' : fmtM(q.metrica, x, moneda));
  const nm = M.nombreMC;
  // Denominador en Excel: para TRI todos los ensayos (ROWS); para el resto, los que tienen valor (COUNT)
  const den = esTri ? `ROWS(${nm})` : `COUNT(${nm})`;
  const NOR = x => `NORM.DIST(${x},AVERAGE(${nm}),STDEV.S(${nm}),TRUE)`;

  if (q.op === 'seguridad') {
    const s = q.a;
    let emp, nor, frase, medido, excel = null;
    if (esTri) {
      // Menos es mejor: plazo que NO se supera en s de los ensayos
      const ord = Float64Array.from(serie).sort();
      emp = percentil(ord, s);
      nor = st ? st.media + st.sd * phiInv(s) : null;
      frase = emp === Infinity || !Number.isFinite(emp)
        ? `Con ${pct(s, 0)} de seguridad no se puede asegurar que recuperes la inversión dentro del horizonte.`
        : `Con ${pct(s, 0)} de seguridad recuperas la inversión en a lo sumo ${f(emp)}.`;
      medido = `Es el percentil ${num(s * 100, 0)}: en ${pct(s, 0)} de los ${num(N)} ensayos el TRI fue menor o igual a ese valor. ${sinValor ? `${num(sinValor)} ensayos no recuperan y cuentan como el peor caso.` : ''}`;
    } else {
      emp = percentil(st.ordenado, 1 - s);
      nor = st.media + st.sd * phiInv(1 - s);
      frase = `Con ${pct(s, 0)} de seguridad, ${M.largo} será de al menos ${f(nor)}.`;
      medido = `Es el percentil ${num((1 - s) * 100, 0)} de la distribución: solo ${pct(1 - s, 0)} de los ${num(N)} ensayos quedaron por debajo. Por la normal (media ${f(st.media)}, desviación ${f(st.sd)}) da ${f(nor)}; contando ensayos da ${f(emp)}.`;
      excel = {
        empirica: X => `=PERCENTILE.INC(${nm},1-${X})`,
        normal: X => `=NORM.INV(1-${X},AVERAGE(${nm}),STDEV.S(${nm}))`,
        formato: M.tipo,
      };
    }
    const principal = esTri ? emp : nor;
    return {
      titulo: `${M.nombre} con ${pct(s, 0)} de seguridad`,
      principal: { valor: principal, texto: f(principal) },
      empirica: emp, normal: nor, metodo: esTri ? 'empirica' : 'normal',
      textos: { empirica: f(emp), normal: nor === null ? 'No aplica' : f(nor) },
      frase,
      porque: { medido, ...causaYAccion(sim, ctx, q.metrica) },
      nivel: q.metrica.startsWith('van') ? (nor < 0 ? 'bad' : 'ok') : 'info',
      grafico: st ? { tipo: 'acumulada', metrica: q.metrica, marca: Number.isFinite(principal) ? principal : null, prob: esTri ? s : 1 - s } : null,
      excel,
      q, st,
    };
  }

  let cond, condN, texto, zona, excelEmp, excelNor;
  const a = q.a, b = q.b;
  switch (q.op) {
    case 'mayor':
      cond = x => x > a; texto = `mayor que ${f(a)}`; zona = { desde: a, hasta: Infinity };
      condN = () => 1 - normalMenor(a, st.media, st.sd);
      excelEmp = X => (esTri ? `=(ROWS(${nm})-COUNTIF(${nm},"<="&${X}))/ROWS(${nm})` : `=COUNTIF(${nm},">"&${X})/${den}`);
      excelNor = X => `=1-${NOR(X)}`;
      break;
    case 'entre': {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      cond = x => x >= lo && x <= hi; texto = `entre ${f(lo)} y ${f(hi)}`; zona = { desde: lo, hasta: hi };
      condN = () => normalMenor(hi, st.media, st.sd) - normalMenor(lo, st.media, st.sd);
      excelEmp = (X, Yv) => `=COUNTIFS(${nm},">="&MIN(${X},${Yv}),${nm},"<="&MAX(${X},${Yv}))/${den}`;
      excelNor = (X, Yv) => `=${NOR(`MAX(${X},${Yv})`)}-${NOR(`MIN(${X},${Yv})`)}`;
      break;
    }
    case 'menorIgual':
      cond = x => x <= a; texto = esTri ? `de ${num(a)} años o menos` : `menor o igual a ${f(a)}`; zona = { desde: -Infinity, hasta: a };
      condN = () => normalMenor(a, st.media, st.sd);
      excelEmp = X => `=COUNTIF(${nm},"<="&${X})/${den}`;
      excelNor = X => `=${NOR(X)}`;
      break;
    default:
      cond = x => x < a; texto = `menor que ${f(a)}`; zona = { desde: -Infinity, hasta: a };
      condN = () => normalMenor(a, st.media, st.sd);
      excelEmp = X => `=COUNTIF(${nm},"<"&${X})/${den}`;
      excelNor = X => `=${NOR(X)}`;
  }
  // Conteo: TRI sobre todos los ensayos (los que no recuperan son infinito); el resto, sobre los que tienen valor
  let k = 0, base = 0;
  for (const x of serie) {
    if (!esTri && (x === null || !Number.isFinite(x))) continue;
    base++; if (cond(x)) k++;
  }
  const empirica = base ? k / base : null;
  const normal = st ? condN() : null;
  // TRI: la normal no representa a los que no recuperan → manda la empírica
  const metodo = esTri ? 'empirica' : 'normal';
  const p = metodo === 'normal' ? normal : empirica;
  const difiere = normal !== null && Math.abs(normal - empirica) > 0.02;
  const malo = (q.metrica.startsWith('van') && q.op === 'menor' && a <= 0)
    || (['tir', 'tur', 'tirF'].includes(q.metrica) && q.op === 'menor')
    || (q.metrica === 'bc' && q.op === 'menor' && a <= 1);
  const bueno = esTri && q.op === 'menorIgual';
  const nivel = malo ? nivelRiesgo(p) : bueno ? nivelRiesgo(1 - p) : 'info';
  // Etiqueta del semáforo: riesgo para eventos malos; probabilidad para eventos buenos (recuperar)
  const etiqueta = malo ? { ok: 'Riesgo bajo', warn: 'Riesgo moderado', bad: 'Riesgo alto' }[nivel]
    : bueno ? (p >= 0.9 ? 'Muy probable' : p >= 0.6 ? 'Probable' : 'Poco probable') : null;

  const titulos = {
    'van-menor-0': 'Riesgo de que el proyecto no sea factible',
    'vanF-menor-0': 'Riesgo de que el proyecto financiado no sea factible',
    'bc-menor-1': 'Riesgo de que los beneficios no cubran los costos',
  };
  const titulo = titulos[`${q.metrica}-${q.op}-${a}`] || `Probabilidad de que ${M.largo} sea ${texto}`;

  let medido = `En ${num(k)} de ${num(base)} ensayos, ${M.largo} fue ${texto} (${pct(empirica)} contando ensayos).`;
  if (normal !== null) medido += ` Con la aproximación normal del curso (media ${f(st.media)}, desviación ${f(st.sd)}) da ${pct(normal)}.`;
  if (difiere && metodo === 'normal') {
    medido += ` Los dos métodos difieren en ${num(Math.abs(normal - empirica) * 100, 1)} puntos porque la distribución no es simétrica (asimetría ${num(st.asimetria, 2)}): la normal supone una campana perfecta.`;
  }
  if (sinValor > 0 && !esTri) medido += ` ${num(sinValor)} ensayos no tuvieron ${M.nombre} y se excluyeron.`;
  if (esTri && sinValor > 0) medido += ` ${num(sinValor)} ensayos no recuperan la inversión dentro del horizonte y cuentan como "no recupera".`;
  if (q.metrica === 'tir' && q.op === 'menor' && Math.abs(a - ctx.tasa) < 1e-9) medido += ' Como la tasa es la de descuento, esta probabilidad es casi igual a la de VAN negativo: describen el mismo evento.';
  if (q.metrica === 'tir' && q.op === 'menor' && a > ctx.tasa) medido += ` La meta de ${pct(a)} es más exigente que tu tasa de descuento (${pct(ctx.tasa)}), por eso este riesgo es mayor que el de VAN negativo.`;

  return {
    titulo,
    principal: { valor: p, texto: pct(p) },
    empirica, normal, metodo, difiere, k, base,
    textos: { empirica: pct(empirica), normal: normal === null ? 'No aplica' : pct(normal) },
    frase: `Hay ${pct(p)} de probabilidad de que ${M.largo} sea ${texto}.`,
    porque: { medido, ...causaYAccion(sim, ctx, q.metrica) },
    nivel, etiqueta,
    grafico: st ? { tipo: 'histograma', metrica: q.metrica, zona } : null,
    excel: { pregunta: titulo, empirica: excelEmp, normal: esTri ? () => 'No aplica' : excelNor, formato: 'pct' },
    q, st,
  };
}

function responderVariable(sim, ctx) {
  const inf = influencias(sim, 'van');
  const top = inf[0];
  const tor = ctx.sensibilidad?.tornado?.[0];
  const crit = ctx.sensibilidad?.criticos?.find(c => c.clave === top?.clave);
  return {
    titulo: 'Variable más riesgosa',
    principal: { valor: null, texto: top ? top.nombre : 's/d' },
    frase: top ? `${top.nombre} es la variable que más mueve el VAN.` : 'Sin variables activas.',
    porque: {
      medido: `Medido de dos formas: en la simulación, ${top?.nombre.toLowerCase()} tiene la mayor correlación con el VAN (${num(top?.r, 2)}). ${tor ? `En el tornado, ±${pct(ctx.sensibilidad.delta, 0)} en ${tor.nombre.toLowerCase()} mueve el VAN ${dinero(tor.rango / 2, ctx.moneda)} hacia cada lado, el mayor rango de todas.` : ''}`,
      causa: top ? `Pesa tanto porque ${top.porque || 'afecta todos los años'}.` : '',
      hacer: crit && crit.margen !== null ? `Su punto crítico está a ${pct(Math.abs(crit.margen), 1)} del caso base. Concentra ahí tus estudios de mercado y negociaciones.` : 'Revisa su rango en Datos.',
    },
    nivel: crit && crit.margen !== null && Math.abs(crit.margen) < 0.1 ? 'bad' : 'warn',
    grafico: { tipo: 'tornado' },
    influencias: inf,
  };
}

function responderComparar(sim, ctx) {
  if (!sim.vanF) return { error: 'No hay préstamo: no hay flujo financiado que comparar. Agrega el préstamo en Datos.' };
  const pP = proporcion(sim.van, x => x < 0).p, pF = proporcion(sim.vanF, x => x < 0).p;
  const sP = estadisticos(sim.van), sF = estadisticos(sim.vanF);
  const masRiesgo = pF > pP ? 'financiado' : 'puro';
  return {
    titulo: 'Puro frente a financiado',
    principal: { valor: null, texto: `${pct(pP)} vs ${pct(pF)}` },
    frase: `Riesgo de VAN negativo: puro ${pct(pP)}, financiado ${pct(pF)}.`,
    porque: {
      medido: `Puro: media ${dinero(sP.media, ctx.moneda)} y CV ${num(sP.cv, 2)}. Financiado: media ${dinero(sF.media, ctx.moneda)} y CV ${num(sF.cv, 2)}.`,
      causa: masRiesgo === 'financiado'
        ? 'El préstamo obliga a pagar cuotas fijas aunque las ventas bajen. Eso es apalancamiento: amplifica las ganancias y también las pérdidas.'
        : 'El préstamo es barato frente a tu tasa de descuento y sus intereses ahorran impuesto, así que mejora el VAN más de lo que añade riesgo.',
      hacer: masRiesgo === 'financiado' ? 'Si tus ventas son inciertas, busca más periodo de gracia o un monto menor.' : 'Financiarte conviene; elige el sistema de pago con mayor VAN.',
    },
    nivel: pF > 0.3 || pP > 0.3 ? 'bad' : pF > 0.1 || pP > 0.1 ? 'warn' : 'ok',
    grafico: { tipo: 'comparar' },
  };
}

function responderResumen(sim, ctx) {
  const st = estadisticos(sim.van);
  const moneda = ctx.moneda;
  const sesgo = st.media < sim.base.van ? 'menor' : 'mayor';
  return {
    titulo: 'VAN esperado y dispersión',
    principal: { valor: st.media, texto: dinero(st.media, moneda) },
    frase: `En promedio el VAN sería ${dinero(st.media, moneda)}, con una desviación de ${dinero(st.sd, moneda)}.`,
    porque: {
      medido: `El 90 % central de los ensayos cae entre ${dinero(st.p5, moneda)} y ${dinero(st.p95, moneda)}. El coeficiente de variación es ${num(st.cv, 2)}${st.cv > 0.5 ? ', una dispersión alta' : ', una dispersión moderada'}.`,
      causa: `El VAN medio es ${sesgo} que el del caso base (${dinero(sim.base.van, moneda)}) porque los rangos no son simétricos alrededor del valor más probable: la media de una triangular es (mín + moda + máx) / 3.`,
      hacer: `Con ${num(st.n)} ensayos el error de precisión de la media es ${pct(st.errorPrecision)}${st.errorPrecision < 0.02 ? ', suficiente' : '; sube los ensayos para afinar'}.`,
    },
    nivel: 'info',
    grafico: { tipo: 'histograma', metrica: 'van', zona: { desde: st.p5, hasta: st.p95 } },
  };
}
