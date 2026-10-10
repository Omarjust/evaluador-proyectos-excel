// Exporta el plan de operaciones del libro a JSON (para armar un .xlsx de prueba con openpyxl).
// Uso: node tools/plan-json.mjs ejemplos/caso5.json salida.json [ensayos]
import { readFileSync, writeFileSync } from 'node:fs';
import { construirLibro } from '../src/excel/libro.js';
import { simular } from '../src/motor/montecarlo.js';
import { FLUJO } from '../src/excel/hojasCalculo.js';
import { RIESGO } from '../src/excel/hojaRiesgo.js';
import { responder } from '../src/motor/preguntas.js';

const [, , entrada, salida, ensayos = '2000'] = process.argv;
const datos = JSON.parse(readFileSync(entrada, 'utf8'));
const sim = Number(ensayos) > 0 ? simular(datos, { ensayos: Number(ensayos), semilla: 2026 }) : null;
const { hojas, R } = construirLibro(datos, { sim, fecha: '01/01/2026 00:00' });
const res = a => a && { van: a.van, tir: a.tir, tur: a.tur, bc: a.bc, tri: a.tri, vac: a.vac, cae: a.cae, flujo: a.filas.flujo, precioMin: a.precioMin };
writeFileSync(salida, JSON.stringify({
  hojas: hojas.map(h => ({ nombre: h.nombre, color: h.color, oculta: h.oculta, ops: h.ops })),
  motor: { puro: res(R.puro), constante: res(R.constante), cuota: res(R.cuota), n: R.n },
  filas: FLUJO.bloques, riesgo: RIESGO,
  preguntas: sim ? [
    responder({ metrica: 'van', op: 'menor', a: 0 }, sim, { tasa: R.tasa, n: R.n }),
    responder({ metrica: 'tir', op: 'menor', a: 0.18 }, sim, { tasa: R.tasa, n: R.n }),
  ].map(r => ({ emp: r.empirica, nor: r.normal })) : [],
}));
console.log('ok', hojas.map(h => `${h.nombre}:${h.ops.length}`).join(' '));
