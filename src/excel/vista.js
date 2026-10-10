// Qué columnas y filas se ven según la vida útil: las hojas tienen siempre los años 0..20 con
// fórmulas vivas, pero solo se muestran los años del proyecto (lo demás se oculta y no se imprime).
import { colLetra } from './plan.js';
import { H, DATOS as R } from './mapa.js';
import { PREST } from './hojasCalculo.js';

const ULTIMA = 21; // columna V = año 20

// Oculta desde la columna siguiente al último año visible, sin tapar las tablas fijas de cada hoja.
// minimo: índice (0 = A) de la última columna que nunca se oculta.
const columnas = (n, minimo) => {
  const desde = Math.max(1 + n, minimo) + 1;
  return desde <= ULTIMA ? `${colLetra(desde)}:${colLetra(ULTIMA)}` : null;
};

// n: vida útil (1..20). periodos: periodos del préstamo (años, o meses si la tasa es nominal).
export function vista(n, periodos = 0) {
  const vida = Number.isInteger(n) && n >= 1 && n <= 20 ? n : 20;
  const desdeFila = Math.max(PREST.ini + Math.max(0, periodos), PREST.resTotal + 2);
  return {
    vida,
    [H.datos]: { columnas: columnas(vida, 5) },        // A..F: productos, activos, rangos de riesgo
    [H.ventas]: { columnas: columnas(vida, 1) },
    [H.flujo]: { columnas: columnas(vida, 1) },
    [H.dep]: { columnas: columnas(vida, 8) },          // A..I: cuadro de activos
    [H.vac]: { columnas: columnas(vida, 4) },          // A..E: comparador de alternativas
    [H.prest]: { filas: desdeFila <= PREST.fin ? `${desdeFila}:${PREST.fin}` : null },
  };
}

// Periodos del préstamo a partir de los datos normalizados
export const periodosPrestamo = D => {
  const p = D.prestamo || {};
  return (p.plazo || 0) * (p.tipoTasa === 'nominal' ? 12 : 1);
};

export const RANGO_ANIOS = { columnas: 'B:V', filas: `${PREST.ini}:${PREST.fin}`, datosFilas: R };
