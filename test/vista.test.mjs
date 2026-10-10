import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vista } from '../src/excel/vista.js';

test('vista: solo los años de la vida útil', () => {
  assert.equal(vista(3).Flujo.columnas, 'F:V');      // años 0..3 = B..E
  assert.equal(vista(3).Ventas.columnas, 'F:V');
  assert.equal(vista(20).Flujo.columnas, null);       // 20 años: no se oculta nada
  assert.equal(vista(19).Flujo.columnas, 'V:V');
  assert.equal(vista(1).Flujo.columnas, 'D:V');
});

test('vista: nunca tapa las tablas fijas', () => {
  for (const n of [1, 3, 5, 10, 20]) {
    const v = vista(n);
    const desde = c => (c ? c.split(':')[0] : 'W');
    assert.ok(desde(v['Depreciación'].columnas) >= 'J', `Depreciación n=${n}`);
    assert.ok(desde(v['VAC-CAE'].columnas) >= 'F', `VAC n=${n}`);
    assert.ok(desde(v.Datos.columnas) >= 'G', `Datos n=${n}`);
  }
});

test('vista: filas del préstamo', () => {
  assert.equal(vista(5, 5)['Préstamo'].filas, '37:254');   // nunca oculta el resumen (filas 15..36)
  assert.equal(vista(5, 36)['Préstamo'].filas, '51:254');  // 36 meses: filas 15..50
  assert.equal(vista(5, 240)['Préstamo'].filas, null);
});
