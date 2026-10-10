import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simular } from '../src/motor/montecarlo.js';
import { analizarSensibilidad, escenarios } from '../src/motor/sensibilidad.js';
import { responder, SUGERIDAS } from '../src/motor/preguntas.js';
import { phi, phiInv, estadisticos } from '../src/motor/estadistica.js';
import { calcular } from '../src/motor/modelo.js';

const caso = f => JSON.parse(readFileSync(new URL(`../ejemplos/${f}.json`, import.meta.url)));

test('normal: Φ y su inversa', () => {
  assert.ok(Math.abs(phi(-1.6449) - 0.05) < 1e-4);
  assert.ok(Math.abs(phiInv(0.975) - 1.95996) < 1e-4);
});

test('pregunta con distribución conocida: P(VAN<0) ≈ Φ(−2)', () => {
  const N = 20000;
  const van = Float64Array.from({ length: N }, (_, i) => 100 + 50 * phiInv((i + 0.5) / N));
  const sim = { van, variables: [], entradas: {}, base: { van: 100 } };
  const r = responder({ metrica: 'van', op: 'menor', a: 0 }, sim, { tasa: 0.1, n: 5, moneda: 'Bs' });
  assert.ok(Math.abs(r.normal - 0.02275) < 1e-3, r.normal);
  assert.ok(Math.abs(r.empirica - 0.02275) < 1e-3, r.empirica);
  assert.equal(r.titulo, 'Riesgo de que el proyecto no sea factible');
  const e = responder({ metrica: 'van', op: 'entre', a: 50, b: 150 }, sim, { tasa: 0.1, n: 5 });
  assert.ok(Math.abs(e.normal - 0.6827) < 1e-3);
  const s = responder({ metrica: 'van', op: 'seguridad', a: 0.9 }, sim, { tasa: 0.1, n: 5 });
  assert.ok(Math.abs(s.normal - (100 - 50 * 1.28155)) < 0.1);
});

test('Monte Carlo reproducible y coherente con el caso base (Caso 5)', () => {
  const d = caso('caso5');
  const a = simular(d, { ensayos: 2000, semilla: 7 });
  const b = simular(d, { ensayos: 2000, semilla: 7 });
  assert.deepEqual(Array.from(a.van.slice(0, 50)), Array.from(b.van.slice(0, 50)));
  const st = estadisticos(a.van);
  const base = calcular(d).puro.van;
  assert.ok(Math.abs(st.media - base) / base < 0.05, `media ${st.media} vs base ${base}`);
  assert.ok(a.vanF, 'hay flujo financiado');
});

test('todas las preguntas sugeridas responden sin errores ni guiones largos', () => {
  const d = caso('caso5');
  const sim = simular(d, { ensayos: 1500 });
  const sens = analizarSensibilidad(d);
  const ctx = { tasa: 0.13, n: 6, moneda: '$us', sensibilidad: sens };
  for (const s of SUGERIDAS) {
    const r = responder(s.q, sim, ctx);
    assert.ok(!r.error, `${s.id}: ${r.error}`);
    const textos = JSON.stringify([r.titulo, r.frase, r.porque]);
    assert.ok(!/[–—]/.test(textos), `${s.id} tiene guion largo`);
    assert.ok(r.porque.medido && r.porque.causa !== undefined, `${s.id} sin porqué`);
  }
});

test('sensibilidad: precio es la más influyente y su valor crítico deja VAN = 0', () => {
  const d = caso('caso5');
  const s = analizarSensibilidad(d);
  assert.equal(s.tornado[0].clave, 'precio');
  const c = s.criticos.find(x => x.clave === 'precio');
  assert.ok(c.margen < 0 && c.margen > -0.5);
  const r = calcular(d, { precio: c.factor });
  assert.ok(Math.abs(r.puro.van) < 1, r.puro.van);
  assert.equal(s.arana[0].puntos.length, 7);
  const esc = escenarios(d);
  assert.ok(esc[0].van < esc[1].van && esc[1].van < esc[2].van);
});
