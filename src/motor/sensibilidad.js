// Sensibilidad determinística: tornado ±10 %, araña −30..+30 %, valor crítico y escenarios.
import { calcular, normalizar } from './modelo.js';
import { VARIABLES, rangosActivos } from './variables.js';

const PASOS_ARANA = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];

// metrica(r) elige qué se mide: por defecto el VAN del flujo puro
const vanPuro = r => r.puro.van;
const vanFin = r => (r.cuota && r.constante ? Math.max(r.cuota.van, r.constante.van) : null);

export function analizarSensibilidad(datos, { delta = 0.1, financiado = false } = {}) {
  const D = normalizar(datos);
  const base = calcular(D, null, true);
  const metrica = financiado && base.hayPrestamo ? vanFin : vanPuro;
  const vBase = metrica(base);
  const vars = VARIABLES.filter(v => base.hayPrestamo || !v.soloFinanciado)
    .filter(v => !(v.soloFinanciado && !financiado));
  const evalF = (clave, f) => metrica(calcular(D, { [clave]: f }, true));

  const tornado = vars.map(v => {
    const bajo = evalF(v.clave, 1 - delta), alto = evalF(v.clave, 1 + delta);
    return { ...v, bajo, alto, rango: Math.abs(alto - bajo), impacto10: (alto - bajo) / 2 };
  }).sort((a, b) => b.rango - a.rango);

  const arana = vars.map(v => ({
    ...v,
    puntos: PASOS_ARANA.map(p => ({ cambio: p, valor: p === 0 ? vBase : evalF(v.clave, 1 + p) })),
  }));

  // Valor crítico: factor que lleva el VAN a 0 (bisección), con el resto en el caso base
  const criticos = vars.map(v => {
    const f = x => evalF(v.clave, x);
    let lo, hi;
    // Busca el lado donde el VAN cambia de signo
    if (vBase >= 0) { if (v.favorable > 0) { lo = 0; hi = 1; } else { lo = 1; hi = 20; } }
    else { if (v.favorable > 0) { lo = 1; hi = 20; } else { lo = 0; hi = 1; } }
    const fl = f(lo), fh = f(hi);
    if (fl === null || fh === null || fl * fh > 0) return { ...v, factor: null, margen: null };
    let a = lo, b = hi, fa = fl;
    for (let k = 0; k < 80; k++) {
      const m = (a + b) / 2, fm = f(m);
      if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
    }
    const factor = (a + b) / 2;
    return { ...v, factor, margen: factor - 1 };
  });

  return { base: vBase, delta, tornado, arana, criticos, pasos: PASOS_ARANA, financiado: metrica === vanFin };
}

// Escenarios con los extremos de los rangos de riesgo
export function escenarios(datos) {
  const D = normalizar(datos);
  const base = calcular(D, null, true);
  const vars = rangosActivos(datos, base.hayPrestamo);
  const armar = tipo => Object.fromEntries(vars.map(v => {
    const malo = v.favorable > 0 ? v.min : v.max, bueno = v.favorable > 0 ? v.max : v.min;
    return [v.clave, tipo === 'pesimista' ? malo : tipo === 'optimista' ? bueno : v.moda];
  }));
  return ['pesimista', 'base', 'optimista'].map(tipo => {
    const fac = armar(tipo);
    const r = calcular(D, tipo === 'base' ? fac : fac, true);
    return { tipo, factores: fac, van: r.puro.van, tir: r.puro.tir, bc: r.puro.bc, tri: r.puro.tri, vanF: vanFin(r) };
  });
}
