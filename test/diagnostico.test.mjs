import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcular } from '../src/motor/modelo.js';
import { tirOTur, recomendaciones, alertas, explicarIndicadores, planDelFlujo, reglasDelFlujo } from '../src/motor/diagnostico.js';
import { indicadores } from '../src/motor/financiero.js';

const caso = f => JSON.parse(readFileSync(new URL(`../ejemplos/${f}.json`, import.meta.url)));
const sinGuion = o => !/[–—]/.test(JSON.stringify(o));

test('TIR o TUR', () => {
  // Dos cambios de signo → TUR
  assert.equal(tirOTur(indicadores([-100, 230, -132], 0.1), 0.1).usar, 'TUR');
  // TIR 60 % con tasa 16 % → TUR
  const alto = indicadores([-100, 160], 0.16);
  assert.ok(Math.abs(alto.tir - 0.6) < 1e-9);
  assert.equal(tirOTur(alto, 0.16).usar, 'TUR');
  // Convencional y cercana → TIR
  assert.equal(tirOTur(indicadores([-100, 30, 30, 30, 30, 30], 0.12), 0.12).usar, 'TIR');
  // Caso 4 financiado: dos flujos negativos → TUR (regla del curso)
  const r = calcular(caso('caso4'));
  const t = tirOTur(r.constante, r.tasa);
  assert.equal(t.usar, 'TUR');
  assert.ok(t.razones.some(x => x.includes('más de un flujo negativo')));
});

test('diagnóstico completo de los tres casos, sin guiones largos', () => {
  for (const c of ['caso4', 'caso5', 'caso6']) {
    const R = calcular(caso(c));
    const recs = recomendaciones(R);
    assert.ok(recs.find(x => x.id === 'decision'));
    assert.ok(recs.find(x => x.id === 'sistema'));
    const todo = [recs, alertas(R), explicarIndicadores(R), planDelFlujo(R), planDelFlujo(R, 'cuota'), reglasDelFlujo(R)];
    assert.ok(sinGuion(todo), c);
    assert.equal(planDelFlujo(R).length, R.n + 1);
  }
});

test('Caso 5: cuota fija gana y financiarse conviene', () => {
  const recs = recomendaciones(calcular(caso('caso5')));
  assert.match(recs.find(x => x.id === 'sistema').titulo, /cuota fija/);
  assert.equal(recs.find(x => x.id === 'financiar').nivel, 'ok');
});
