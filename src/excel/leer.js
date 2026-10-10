// Convierte los valores leídos de Excel en el objeto de datos del motor.
// Funciones puras (se prueban sin Excel).
import { DATOS as R, MODOS_CT, TIPOS_TASA } from './mapa.js';
import { VARIABLES } from '../motor/variables.js';

const vacio = v => v === '' || v === null || v === undefined;
const num = v => (vacio(v) || isNaN(Number(v)) ? null : Number(v));

export const RANGO_DATOS = 'A1:V120';

// vals: matriz de Datos!A1:V120
export function parsearDatos(vals) {
  const c = (r, col) => vals[r - 1]?.[col] ?? '';
  const n = num(c(R.vida, 1));
  const productos = [];
  for (let j = 0; j < 10; j++) {
    const r = R.prod.ini + j;
    const nombre = String(c(r, 0) || '').trim();
    if (!nombre && num(c(r, 2)) === null) continue;
    productos.push({
      fila: j, // posición real en la tabla (puede haber filas vacías entre productos)
      nombre: nombre || `Producto ${j + 1}`,
      unidad: String(c(r, 1) || 'u'),
      precio: num(c(r, 2)), crecPrecio: num(c(r, 3)) ?? 0, cvu: num(c(r, 4)) ?? 0, capacidad: num(c(r, 5)),
      pct: Array.from({ length: 20 }, (_, t) => num(c(R.pct.ini + j, 2 + t))),
      unidades: Array.from({ length: 20 }, (_, t) => num(c(R.unid.ini + j, 2 + t))),
    });
  }
  const costosFijos = [];
  for (let r = R.cf.ini; r <= R.cf.fin; r++) if (num(c(r, 1)) !== null) costosFijos.push({ nombre: String(c(r, 0) || 'Costo fijo'), monto: num(c(r, 1)) });
  const activos = [];
  for (let r = R.act.ini; r <= R.act.fin; r++) {
    if (num(c(r, 1)) === null) continue;
    activos.push({ nombre: String(c(r, 0) || 'Activo'), valor: num(c(r, 1)), vida: num(c(r, 2)), anio: num(c(r, 3)) ?? 0, pctMercado: num(c(r, 4)), montoMercado: num(c(r, 5)) });
  }
  const diferidos = [];
  for (let r = R.dif.ini; r <= R.dif.fin; r++) if (num(c(r, 1)) !== null) diferidos.push({ nombre: String(c(r, 0) || 'Diferido'), monto: num(c(r, 1)) });
  const dist = { Triangular: 'triangular', PERT: 'pert', Uniforme: 'uniforme', Normal: 'normal' };
  const variables = {};
  VARIABLES.forEach((v, i) => {
    const r = R.riesgo.ini + i;
    const min = num(c(r, 1)), moda = num(c(r, 2)), max = num(c(r, 3));
    if (min === null && moda === null && max === null) return;
    variables[v.clave] = { min: min ?? 0.9, moda: moda ?? 1, max: max ?? 1.1, dist: dist[c(r, 4)] || 'triangular', incluir: String(c(r, 5)).toLowerCase() !== 'no' };
  });
  return {
    proyecto: {
      nombre: String(c(R.nombre, 1) || ''), caso: String(c(R.caso, 1) || ''), moneda: String(c(R.moneda, 1) || 'Bs').replace(/[<>&"']/g, '').slice(0, 6) || 'Bs',
      n, tasa: num(c(R.tasa, 1)), iue: num(c(R.iue, 1)) ?? 0,
      ctModo: c(R.ctModo, 1) === MODOS_CT[1] ? 'meses' : 'pct', ct: num(c(R.ct, 1)) ?? 0, pctVentas: num(c(R.pctVentas, 1)) ?? 0,
    },
    productos, costosFijos,
    otrosCostos: Array.from({ length: 20 }, (_, t) => num(c(R.otros.fila, 2 + t)) ?? 0),
    activos, diferidos,
    prestamo: {
      monto: num(c(R.fin.monto, 1)), pctInversion: num(c(R.fin.pct, 1)), tasa: num(c(R.fin.tasa, 1)) ?? 0,
      tipoTasa: c(R.fin.tipo, 1) === TIPOS_TASA[1] ? 'nominal' : 'efectiva',
      plazo: num(c(R.fin.plazo, 1)) ?? 0, gracia: num(c(R.fin.gracia, 1)) ?? 0,
    },
    riesgo: { variables, ensayos: num(c(R.riesgo.ensayos, 1)) ?? 10000, semilla: num(c(R.riesgo.semilla, 1)) ?? 2026 },
  };
}

// Validación con mensajes para el estudiante: errores bloquean, avisos no
export function validar(d) {
  const errores = [], avisos = [];
  const p = d.proyecto || {};
  if (!p.n || p.n < 1 || p.n > 20) errores.push({ campo: 'vida', fila: R.vida, texto: 'Falta la vida útil del proyecto (entre 1 y 20 años).' });
  if (p.tasa === null || p.tasa === undefined || p.tasa === '') errores.push({ campo: 'tasa', fila: R.tasa, texto: 'Falta la tasa de descuento.' });
  else if (p.tasa > 1) avisos.push({ campo: 'tasa', fila: R.tasa, texto: `La tasa de descuento quedó en ${Math.round(p.tasa * 100)} %. ¿Quisiste decir ${Math.round(p.tasa * 100) / 100} %? En el panel escribe solo el número (13); en la hoja, 13 %.` });
  else if (p.tasa > 0 && p.tasa < 0.01) avisos.push({ campo: 'tasa', fila: R.tasa, texto: `La tasa de descuento quedó en ${(p.tasa * 100).toFixed(2)} %. ¿Quisiste decir ${Math.round(p.tasa * 10000) / 100} %? En el panel escribe solo el número (13).` });
  if (!d.productos?.length) errores.push({ campo: 'productos', fila: R.prod.ini, texto: 'Agrega al menos un producto con su precio.' });
  (d.productos || []).forEach((x, j) => {
    if (x.precio === null || x.precio === undefined) errores.push({ campo: 'productos', fila: R.prod.ini + j, texto: `${x.nombre}: falta el precio.` });
    const tieneCant = (x.unidades || []).some(u => u !== null) || (x.capacidad && (x.pct || []).some(u => u !== null));
    if (!tieneCant) errores.push({ campo: 'productos', fila: R.pct.ini + j, texto: `${x.nombre}: faltan las cantidades por año (unidades, o capacidad y %).` });
    if (x.precio !== null && x.cvu >= x.precio) avisos.push({ campo: 'productos', fila: R.prod.ini + j, texto: `${x.nombre}: el costo variable (${x.cvu}) es mayor o igual al precio (${x.precio}).` });
  });
  if (!d.activos?.length && !d.diferidos?.length) avisos.push({ campo: 'activos', fila: R.act.ini, texto: 'No hay inversión en activos: el VAN, la TIR y el B/C pierden sentido.' });
  (d.activos || []).forEach((a, j) => {
    if (p.n && (a.anio || 0) >= p.n) errores.push({ campo: 'activos', fila: R.act.ini + j, texto: `"${a.nombre}" se compra en el año ${a.anio}, pero el proyecto dura ${p.n} años: debe comprarse antes del año ${p.n}.` });
    if (/terreno/i.test(a.nombre) && a.vida) avisos.push({ campo: 'activos', fila: R.act.ini + j, texto: `"${a.nombre}" tiene vida útil: el terreno no se deprecia, deja la vida útil vacía.` });
  });
  const pr = d.prestamo || {};
  if ((pr.monto || pr.pctInversion) && !pr.plazo) errores.push({ campo: 'prestamo', fila: R.fin.plazo, texto: 'El préstamo no tiene plazo.' });
  if (pr.plazo && pr.gracia >= pr.plazo) errores.push({ campo: 'prestamo', fila: R.fin.gracia, texto: 'Los años de gracia deben ser menos que el plazo total.' });
  if (pr.tasa > 1) avisos.push({ campo: 'prestamo', fila: R.fin.tasa, texto: 'La tasa del préstamo parece escrita como número entero: usa porcentaje (12 %).' });
  Object.entries(d.riesgo?.variables || {}).forEach(([k, v]) => {
    if (v.incluir !== false && !(v.min <= v.moda && v.moda <= v.max)) avisos.push({ campo: 'riesgo', fila: R.riesgo.ini, texto: `Rango de riesgo de ${k}: el más probable debe estar entre el mínimo y el máximo.` });
  });
  return { errores, avisos };
}

// Detecta la plantilla de clase ("Plantilla Flujo de Caja VAC CAE": datos en B18:B31, activos A6:I13)
// vals: matriz A1:L46 de esa hoja
export function esPlantillaClase(vals) {
  const a = String(vals?.[17]?.[0] || '');
  return /vida útil del proyecto/i.test(a) && /precio/i.test(String(vals?.[18]?.[0] || ''));
}

export function parsearPlantillaClase(vals, nombreHoja = '') {
  const c = (r, col) => vals[r - 1]?.[col] ?? '';
  const n = num(c(18, 1));
  const activos = [];
  for (let r = 6; r <= 13; r++) {
    if (num(c(r, 1)) === null) continue;
    activos.push({ nombre: String(c(r, 0) || 'Activo'), valor: num(c(r, 1)), vida: num(c(r, 2)), pctMercado: num(c(r, 5)), montoMercado: num(c(r, 6)) });
  }
  const pct = Array.from({ length: 20 }, (_, t) => num(c(35, 2 + t)));
  const prod = Array.from({ length: 20 }, (_, t) => num(c(36, 2 + t)));
  const usaPct = pct.some(x => x !== null);
  return {
    proyecto: { nombre: String(c(2, 0) || nombreHoja), caso: nombreHoja, moneda: '$us', n, tasa: num(c(25, 1)), iue: num(c(24, 1)) ?? 0.25, ctModo: 'pct', ct: num(c(23, 1)) ?? 0 },
    productos: [{ nombre: 'Producto', unidad: 'u', precio: num(c(19, 1)), cvu: num(c(21, 1)) ?? 0, capacidad: num(c(22, 1)), pct: usaPct ? pct : [], unidades: usaPct ? [] : prod }],
    costosFijos: [{ nombre: 'Costo fijo anual', monto: num(c(20, 1)) ?? 0 }],
    activos,
    prestamo: { monto: num(c(28, 1)), tasa: num(c(29, 1)) ?? 0, plazo: num(c(30, 1)) ?? 0, gracia: num(c(31, 1)) ?? 0 },
  };
}
