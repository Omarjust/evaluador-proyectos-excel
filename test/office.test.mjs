// Ejecuta la capa Office.js contra un Excel simulado: detecta errores de código (no de API).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const registro = [];
function falso(ruta = 'ctx') {
  const f = function () {};
  return new Proxy(f, {
    get(_, k) {
      if (k === 'then') return undefined;
      if (k === 'items') return [];
      if (k === 'isNullObject') return false;
      if (k === 'count') return 2;
      if (k === 'values') return [['']];
      return falso(`${ruta}.${String(k)}`);
    },
    set(_, k, v) { registro.push([`${ruta}.${String(k)}`, v]); return true; },
    apply(_, __, args) { registro.push([`${ruta}()`, args.length]); return falso(`${ruta}()`); },
  });
}
globalThis.Office = { context: { requirements: { isSetSupported: () => true } } };
globalThis.Excel = { run: async fn => fn(Object.assign(falso(), { sync: async () => {} })) };

test('escribirLibro recorre todas las operaciones sin errores de código', async () => {
  const { escribirLibro } = await import('../src/excel/office.js');
  const { construirLibro } = await import('../src/excel/libro.js');
  const { simular } = await import('../src/motor/montecarlo.js');
  const datos = JSON.parse(readFileSync(new URL('../ejemplos/panaderia.json', import.meta.url)));
  const sim = simular(datos, { ensayos: 3000 });
  const { hojas } = construirLibro(datos, { sim });
  const avisos = [];
  const warn = console.warn; console.warn = (...a) => avisos.push(a.map(String).join(' '));
  await escribirLibro(hojas, { progreso: () => {} });
  console.warn = warn;
  assert.deepEqual(avisos, [], avisos.join('\n'));
  assert.ok(registro.some(([k]) => k.endsWith('.formulas')));
  assert.ok(registro.some(([k]) => k.includes('charts.add()')));
});

test('ajustarVista recorre las hojas sin errores de código', async () => {
  const { ajustarVista } = await import('../src/excel/office.js');
  const { vista } = await import('../src/excel/vista.js');
  await ajustarVista(vista(3, 5));
});
