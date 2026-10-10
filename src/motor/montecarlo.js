// Monte Carlo: muestrea los factores de riesgo y recalcula el modelo en cada ensayo.
// Reproducible con semilla (mulberry32), igual que el simulador del proyecto final.
import { calcular, normalizar, resumenEnsayo } from './modelo.js';
import { rangosActivos } from './variables.js';
import { phiInv } from './estadistica.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function triangular(u, a, m, b) {
  const c = (m - a) / (b - a);
  return u < c ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m));
}

// PERT con λ = 4 vía Beta(α, β); se muestrea con dos gammas (Marsaglia-Tsang)
function gamma(k, r) {
  if (k < 1) return gamma(k + 1, r) * Math.pow(r(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = phiInv(Math.min(Math.max(r(), 1e-12), 1 - 1e-12)); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}
function pert(a, m, b, r) {
  const al = 1 + 4 * (m - a) / (b - a), be = 1 + 4 * (b - m) / (b - a);
  const x = gamma(al, r), y = gamma(be, r);
  return a + (b - a) * x / (x + y);
}

export function muestra(v, r) {
  const u = r();
  switch (v.dist) {
    case 'uniforme': return v.min + (v.max - v.min) * u;
    case 'normal': { // min y max como ±2σ alrededor de la moda, recortada a [min, max]
      const sd = (v.max - v.min) / 4;
      const x = v.moda + sd * phiInv(Math.min(Math.max(u, 1e-12), 1 - 1e-12));
      return Math.min(v.max, Math.max(v.min, x));
    }
    case 'pert': return pert(v.min, v.moda, v.max, r);
    default: return triangular(u, v.min, v.moda, v.max);
  }
}

// Prepara la simulación; devuelve una función que corre un bloque de ensayos
export function prepararSimulacion(datos, { ensayos = 10000, semilla = 2026 } = {}) {
  const D = normalizar(datos);
  const base = calcular(D, null, true);
  const vars = rangosActivos(datos, base.hayPrestamo);
  const r = rng(semilla);
  const N = ensayos;
  const salida = {
    N, semilla, variables: vars.map(({ clave, nombre, corto, min, moda, max, dist, favorable }) => ({ clave, nombre, corto, min, moda, max, dist, favorable })),
    entradas: Object.fromEntries(vars.map(v => [v.clave, new Float64Array(N)])),
    van: new Float64Array(N), tir: new Float64Array(N), tur: new Float64Array(N),
    bc: new Float64Array(N), tri: new Float64Array(N),
    vanF: base.hayPrestamo ? new Float64Array(N) : null,
    tirF: base.hayPrestamo ? new Float64Array(N) : null,
    hecho: 0,
    base: resumenEnsayo(base),
  };
  function correr(cuantos) {
    const fin = Math.min(N, salida.hecho + cuantos);
    for (let i = salida.hecho; i < fin; i++) {
      const fac = {};
      for (const v of vars) { const x = muestra(v, r); fac[v.clave] = x; salida.entradas[v.clave][i] = x; }
      const e = resumenEnsayo(calcular(D, fac, true));
      salida.van[i] = e.van;
      salida.tir[i] = e.tir ?? NaN;
      salida.tur[i] = e.tur ?? NaN;
      salida.bc[i] = e.bc ?? NaN;
      salida.tri[i] = e.tri ?? NaN; // NaN = no se recupera en el horizonte
      if (salida.vanF) { salida.vanF[i] = e.vanF; salida.tirF[i] = e.tirF ?? NaN; }
    }
    salida.hecho = fin;
    return salida.hecho >= N;
  }
  return { salida, correr };
}

export function simular(datos, opciones) {
  const { salida, correr } = prepararSimulacion(datos, opciones);
  while (!correr(1000));
  return salida;
}
