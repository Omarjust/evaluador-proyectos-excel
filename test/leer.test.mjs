import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hojaDatos } from '../src/excel/hojaDatos.js';
import { parsearDatos, validar, esPlantillaClase, parsearPlantillaClase } from '../src/excel/leer.js';
import { normalizar, calcular } from '../src/motor/modelo.js';
import { colIndice } from '../src/excel/plan.js';

const leerJSON = f => JSON.parse(readFileSync(new URL(f, import.meta.url)));

// Simula los valores que Excel tendría en Datos!A1:V120 a partir de las operaciones del plan
function valoresDe(hoja) {
  const m = Array.from({ length: 120 }, () => Array(22).fill(''));
  for (const o of hoja.ops) {
    if (o.op !== 'set') continue;
    const [a] = o.addr.split(':');
    const [, col, fila] = /^([A-Z]+)(\d+)$/.exec(a);
    o.datos.forEach((f, i) => f.forEach((v, j) => {
      const r = Number(fila) - 1 + i, c = colIndice(col) + j;
      if (r < 120 && c < 22) m[r][c] = typeof v === 'string' && v.startsWith('=') ? '' : v;
    }));
  }
  return m;
}

for (const caso of ['caso4', 'caso5', 'caso6', 'panaderia', 'cafeteria']) {
  test(`Datos ida y vuelta: ${caso}`, () => {
    const d = leerJSON(`../ejemplos/${caso}.json`);
    const vals = valoresDe(hojaDatos(normalizar(d)));
    const leido = parsearDatos(vals);
    assert.equal(validar(leido).errores.length, 0, JSON.stringify(validar(leido).errores));
    const a = calcular(d), b = calcular(leido);
    assert.ok(Math.abs(a.puro.van - b.puro.van) < 1e-6, `${a.puro.van} vs ${b.puro.van}`);
    if (a.cuota) assert.ok(Math.abs(a.cuota.van - b.cuota.van) < 1e-6);
  });
}

test('importa la plantilla de clase (Caso 5 y Caso 6)', () => {
  const esperado = { caso5: 203499.374783123, caso6: 144690.914408306 };
  for (const [k, van] of Object.entries(esperado)) {
    const vals = leerJSON(`./fixtures/plantilla_${k}.json`);
    assert.ok(esPlantillaClase(vals));
    const r = calcular(parsearPlantillaClase(vals, k));
    assert.ok(Math.abs(r.puro.van - van) < 0.01, `${k}: ${r.puro.van}`);
  }
});

test('validación con mensajes claros', () => {
  const v = validar({ proyecto: { n: 0, tasa: 13 }, productos: [{ nombre: 'A', precio: 5, cvu: 6, pct: [], unidades: [] }], activos: [{ nombre: 'Terreno', valor: 1, vida: 10 }] });
  assert.ok(v.errores.some(e => e.campo === 'vida'));
  assert.ok(v.avisos.some(e => /Quisiste decir/.test(e.texto)));
  assert.ok(v.avisos.some(e => /terreno/i.test(e.texto)));
  assert.ok(v.errores.some(e => /cantidades/.test(e.texto)));
});
