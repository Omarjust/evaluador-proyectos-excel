import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcular } from '../src/motor/modelo.js';
import { vacAlternativa } from '../src/motor/financiero.js';

const caso = f => JSON.parse(readFileSync(new URL(`../ejemplos/${f}.json`, import.meta.url)));
const cerca = (a, b, tol = 0.01, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b}`);

// Valores de la hoja Caso5/Caso6 de "Plantilla Flujo de Caja VAC CAE.xlsx" (recalculada)
const ESPERADO = {
  caso5: {
    puro: [203499.374783123, 0.231486788754109, 0.192039468671053, 1.37807594014514, 5.0632080263463, 13.2056002088729, 869256.213537036, 217447.251297334],
    constante: [236245.752076284, 0.308704884035305, 0.252245059346215, 1.8521037045132, 4.7026128197897, 12.5950192314436, 851394.553195312, 212979.099233042],
    cuota: [238029.491741979, 0.314352756292878, 0.252969003355543, 1.85853739131462, 4.64064055404516, 12.5617600559687, 850421.604286751, 212735.712918944],
    flujoPuro: [-538250, 113425, 130925, 173925, 173925, 173925, 452262.5],
  },
  caso6: {
    puro: [144690.914408306, 0.221231625371749, 0.208791580104766, 1.22876033898546, 4.64492436978764, 154.384793311678, 5189707.96650641, 1584985.50082807],
    constante: [174213.611613128, 0.25118725011599, 0.236586408134057, 1.37667807916352, 4.54801049250571, 153.239067973776, 5172837.85381794, 1579833.21014406],
    cuota: [175144.290294823, 0.252224612781724, 0.236947698451463, 1.37869035739421, 4.54097721787461, 153.202949927391, 5172306.0374284, 1579670.78842939],
  },
};

for (const nombre of ['caso5', 'caso6']) {
  test(`${nombre}: indicadores iguales a la plantilla`, () => {
    const r = calcular(caso(nombre));
    for (const alt of ['puro', 'constante', 'cuota']) {
      const [vanE, tirE, turE, bcE, triE, pminE, vacE, caeE] = ESPERADO[nombre][alt];
      const a = r[alt];
      cerca(a.van, vanE, 0.01, `${alt} VAN`);
      cerca(a.tir, tirE, 1e-6, `${alt} TIR`);
      cerca(a.tur, turE, 1e-9, `${alt} TUR`);
      cerca(a.bc, bcE, 1e-9, `${alt} B/C`);
      cerca(a.tri, triE, 1e-9, `${alt} TRI`);
      cerca(a.precioMin[0], pminE, 1e-6, `${alt} precio mínimo`);
      cerca(a.vac, vacE, 0.01, `${alt} VAC`);
      cerca(a.cae, caeE, 0.01, `${alt} CAE`);
    }
  });
}

test('caso5: flujo puro año por año', () => {
  const r = calcular(caso('caso5'));
  ESPERADO.caso5.flujoPuro.forEach((f, t) => cerca(r.puro.filas.flujo[t], f, 0.01, `año ${t}`));
});

test('caso4 (Segundo Parcial): VAN puro y financiado', () => {
  const r = calcular(caso('caso4'));
  cerca(r.puro.van, 263755.44, 0.01, 'VAN puro');
  cerca(r.constante.van, 287483.90, 0.01, 'VAN financiado');
  cerca(r.puro.filas.flujo[0], -736666.67, 0.01, 'F0');
  cerca(r.constante.filas.flujo[1], -12583.33, 0.01, 'F1 financiado');
  assert.equal(r.constante.cambios, 1);
  assert.equal(r.constante.negativos, 2);
});

test('VAC y CAE de alternativas (fórmulas de la hoja VAC y CAE)', () => {
  const a = vacAlternativa({ inversion: 10000, costoAnual: 2000, vida: 5, residual: 1000, veces: 2 }, 0.1);
  const vac1 = 10000 + 2000 * (1 - 1.1 ** -5) / 0.1 - 1000 / 1.1 ** 5;
  cerca(a.vac1, vac1, 1e-9, 'VAC1');
  cerca(a.vacTotal, vac1 + vac1 / 1.1 ** 5, 1e-6, 'VAC total');
  cerca(a.cae, vac1 * 0.1 * 1.1 ** 5 / (1.1 ** 5 - 1), 1e-9, 'CAE');
});
