import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPagos } from '../src/motor/prestamo.js';

test('tasa nominal mensual igual al motor del proyecto final (Tabla 11)', () => {
  const monto = 150000, tasa = 0.129;
  const mio = planPagos({ monto, tasa, plazo: 3, tipoTasa: 'nominal' }, 'cuota').anual;
  // Valores de planPagos(150000, 0.129, 36) de proyectoFinal/simulador/modelo.js
  const doc = [[16823.850558484017, 43738.60014960107], [10835.723203451287, 49726.727504633796], [4027.77836232057, 56534.67234576451]];
  doc.forEach(([interes, amortizacion], k) => {
    assert.ok(Math.abs(mio[k].interes - interes) < 1e-6);
    assert.ok(Math.abs(mio[k].amortizacion - amortizacion) < 1e-6);
  });
});

test('gracia: solo intereses y el plazo la incluye', () => {
  const p = planPagos({ monto: 170000, tasa: 0.12, plazo: 5, gracia: 1 }, 'constante').anual;
  assert.equal(p[0].amortizacion, 0);
  assert.ok(Math.abs(p[0].interes - 20400) < 1e-9);
  assert.ok(Math.abs(p[1].amortizacion - 42500) < 1e-9);
  assert.ok(Math.abs(p[4].saldoFinal) < 1e-6);
});
