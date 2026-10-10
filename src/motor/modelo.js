// Réplica en JS del libro que arma el complemento. Calcula exactamente lo mismo que las
// fórmulas de las hojas Ventas, Depreciación, Préstamo, Flujo y VAC-CAE, para que la
// sensibilidad, el Monte Carlo y el diagnóstico no tengan que recalcular Excel.
import { indicadores, factor, van, cae } from './financiero.js';
import { seriesPrestamo } from './prestamo.js';

export const LIMITES = { anios: 20, productos: 10, activos: 15, costosFijos: 10, diferidos: 5 };

const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const n0 = v => num(v) ?? 0;

// Completa valores por defecto y recorta a los límites. Acepta datos parciales.
export function normalizar(d = {}) {
  const p = d.proyecto || {};
  const n = Math.max(1, Math.min(LIMITES.anios, Math.round(n0(p.n) || 5)));
  const serie = (arr, def = null) => Array.from({ length: n }, (_, t) => num(arr?.[t]) ?? def);
  const productos = (d.productos || []).filter(x => x && (x.nombre || num(x.precio))).slice(0, LIMITES.productos).map(x => ({
    nombre: x.nombre || 'Producto',
    unidad: x.unidad || 'u',
    precio: n0(x.precio),
    cvu: n0(x.cvu),
    capacidad: num(x.capacidad),
    pct: serie(x.pct),
    unidades: serie(x.unidades),
    crecPrecio: n0(x.crecPrecio),
  }));
  const activos = (d.activos || []).filter(x => x && num(x.valor)).slice(0, LIMITES.activos).map(x => ({
    nombre: x.nombre || 'Activo',
    valor: n0(x.valor),
    vida: num(x.vida) && num(x.vida) > 0 ? num(x.vida) : null, // vacío = no se deprecia (terreno)
    anio: Math.max(0, Math.min(n - 1, Math.round(n0(x.anio)))),
    pctMercado: num(x.pctMercado),
    montoMercado: num(x.montoMercado),
  }));
  const ctModo = p.ctModo === 'meses' ? 'meses' : 'pct';
  const pr = d.prestamo || {};
  return {
    proyecto: {
      nombre: p.nombre || 'Mi proyecto',
      caso: p.caso || '',
      moneda: p.moneda || 'Bs',
      n,
      tasa: n0(p.tasa),
      iue: num(p.iue) ?? 0.25,
      ctModo,
      ct: n0(p.ct),
      ctPct: ctModo === 'meses' ? n0(p.ct) / 12 : n0(p.ct),
      pctVentas: n0(p.pctVentas),
    },
    productos,
    costosFijos: (d.costosFijos || []).filter(x => x && num(x.monto)).slice(0, LIMITES.costosFijos).map(x => ({ nombre: x.nombre || 'Costo fijo', monto: n0(x.monto) })),
    otrosCostos: serie(d.otrosCostos, 0),
    activos,
    diferidos: (d.diferidos || []).filter(x => x && num(x.monto)).slice(0, LIMITES.diferidos).map(x => ({ nombre: x.nombre || 'Diferido', monto: n0(x.monto) })),
    prestamo: {
      monto: num(pr.monto),
      pctInversion: num(pr.pctInversion),
      tasa: n0(pr.tasa),
      tipoTasa: pr.tipoTasa === 'nominal' ? 'nominal' : 'efectiva',
      plazo: Math.round(n0(pr.plazo)),
      gracia: Math.round(n0(pr.gracia)),
    },
    riesgo: d.riesgo || {},
    preguntas: d.preguntas || {},
  };
}

// Factores de escenario: multiplican supuestos del caso base (1 = sin cambio).
// precio, cantidad, cvu, costosFijos, inversion, tasa (descuento), interes (préstamo)
const F = (f, k) => (f && f[k] !== undefined ? f[k] : 1);

export function calcular(datosCrudos, fac = null, yaNormalizado = false) {
  const D = yaNormalizado ? datosCrudos : normalizar(datosCrudos);
  const { n, iue, ctPct, pctVentas } = D.proyecto;
  const tasa = D.proyecto.tasa * F(fac, 'tasa');
  const anios = Array.from({ length: n + 1 }, (_, t) => t);
  const cero = () => Array(n + 1).fill(0);

  // ---- Programa de ventas ----
  const ventas = D.productos.map(p => {
    const unidades = cero(), precio = cero(), ingresos = cero(), cv = cero();
    for (let t = 1; t <= n; t++) {
      const manual = p.unidades[t - 1];
      const u = (manual !== null ? manual : (p.capacidad ?? 0) * (p.pct[t - 1] ?? 0)) * F(fac, 'cantidad');
      unidades[t] = u;
      precio[t] = p.precio * Math.pow(1 + p.crecPrecio, t - 1) * F(fac, 'precio');
      ingresos[t] = u * precio[t];
      cv[t] = u * p.cvu * F(fac, 'cvu');
    }
    return { nombre: p.nombre, unidades, precio, ingresos, cv };
  });
  const suma = (lista, k) => anios.map(t => lista.reduce((s, x) => s + x[k][t], 0));
  const ingresos = suma(ventas, 'ingresos');
  const costosVariables = suma(ventas, 'cv');
  const fijoAnual = D.costosFijos.reduce((s, c) => s + c.monto, 0) * F(fac, 'costosFijos');
  const costosFijos = anios.map(t => (t === 0 ? 0 : fijoAnual));
  const otros = anios.map(t => (t === 0 ? 0 : D.otrosCostos[t - 1] || 0));
  const costosVentas = anios.map(t => ingresos[t] * pctVentas);
  const costosOp = anios.map(t => costosFijos[t] + costosVariables[t] + otros[t] + costosVentas[t]);

  // ---- Capital de trabajo: requerimiento, incremento un periodo antes, recuperación en n ----
  const ctReq = costosOp.map(c => c * ctPct);
  const ctInv = anios.map(t => (t === n ? 0 : ctReq[t + 1] - ctReq[t]));
  const ctTotal = ctInv.reduce((s, x) => s + x, 0);
  const ctRecup = anios.map(t => (t === n ? ctTotal : 0));

  // ---- Activos: depreciación, valor en libros, mercado ----
  const fInv = F(fac, 'inversion');
  const activos = D.activos.map(a => {
    const valor = a.valor * fInv;
    const dep = a.vida ? valor / a.vida : 0;
    const serie = anios.map(t => (a.vida && t > a.anio && t <= a.anio + a.vida ? dep : 0));
    const usados = a.vida ? Math.min(n - a.anio, a.vida) : 0;
    const libro = valor - dep * usados;
    const mercado = a.montoMercado !== null ? a.montoMercado * fInv : a.pctMercado !== null ? valor * a.pctMercado : libro;
    return { ...a, valor, depAnual: dep, serie, libro, mercado, ganancia: mercado - libro };
  });
  const depreciacion = anios.map(t => activos.reduce((s, a) => s + a.serie[t], 0));
  const inversionActivos = anios.map(t => activos.reduce((s, a) => s + (a.anio === t ? a.valor : 0), 0));
  const diferidos = D.diferidos.reduce((s, x) => s + x.monto, 0) * fInv;
  const amortDiferidos = anios.map(t => (t === 0 ? 0 : diferidos / n));
  const inversion = anios.map(t => inversionActivos[t] + (t === 0 ? diferidos : 0));
  const libroTotal = activos.reduce((s, a) => s + a.libro, 0);
  const mercadoTotal = activos.reduce((s, a) => s + a.mercado, 0);
  const gananciaVenta = mercadoTotal - libroTotal;
  const otrosIngresos = anios.map(t => (t === n ? gananciaVenta : 0));
  const valorLibro = anios.map(t => (t === n ? libroTotal : 0));

  // ---- Préstamo ----
  const inversionTotal = inversion[0];
  const pr = D.prestamo;
  const montoPrestamo = pr.monto !== null ? pr.monto : pr.pctInversion !== null ? pr.pctInversion * inversionTotal : 0;
  const hayPrestamo = montoPrestamo > 0 && pr.plazo > 0;
  const prest = { ...pr, monto: montoPrestamo, tasa: pr.tasa * F(fac, 'interes') };

  // ---- Flujos ----
  function flujo(sistema) {
    const fin = sistema ? seriesPrestamo(prest, sistema, n) : null;
    const filas = {
      ingresos, otrosIngresos,
      totalIngresos: anios.map(t => ingresos[t] + otrosIngresos[t]),
      costosOp,
      interes: fin ? fin.interes : cero(),
      depreciacion, amortDiferidos,
    };
    filas.totalCostos = anios.map(t => costosOp[t] + filas.interes[t] + depreciacion[t] + amortDiferidos[t]);
    filas.utilidad = anios.map(t => filas.totalIngresos[t] - filas.totalCostos[t]);
    filas.iue = filas.utilidad.map(u => Math.max(0, u * iue));
    filas.utilidadNeta = anios.map(t => filas.utilidad[t] - filas.iue[t]);
    filas.prestamo = anios.map(t => (fin && t === 0 ? montoPrestamo : 0));
    filas.amortizacion = fin ? fin.amortizacion.map(x => -x) : cero();
    filas.flujo = anios.map(t =>
      filas.utilidadNeta[t] + depreciacion[t] + amortDiferidos[t] + valorLibro[t] + ctRecup[t]
      - inversion[t] - ctInv[t] + filas.prestamo[t] + filas.amortizacion[t]);
    const ind = indicadores(filas.flujo, tasa);
    // Precio mínimo (VAN = 0) por producto, misma fórmula lineal que la plantilla:
    // P − VAN / ((1 − IUE)(1 − %ventas) · Σ q_t · (1+g)^(t−1) · factor_t)
    const precioMin = ventas.map((v, j) => {
      const g = D.productos[j].crecPrecio;
      const den = (1 - iue) * (1 - pctVentas) * anios.reduce((s, t) => s + (t ? v.unidades[t] * Math.pow(1 + g, t - 1) * factor(tasa, t) : 0), 0);
      return den ? D.productos[j].precio * F(fac, 'precio') - ind.van / den : null;
    });
    // Variación uniforme de todos los precios que deja el VAN en 0
    const denTodos = (1 - iue) * (1 - pctVentas) * anios.reduce((s, t) => s + ingresos[t] * factor(tasa, t), 0);
    const margenPrecio = denTodos ? -ind.van / denTodos : null;
    // VAC / CAE (flujo de costos sin impuestos, filas 144–157 de la plantilla)
    const costoNeto = anios.map(t =>
      inversion[t] + (ctInv[t] - ctRecup[t]) + costosOp[t] - (t === n ? mercadoTotal : 0)
      - filas.prestamo[t] + (fin ? fin.cuota[t] : 0));
    const vac = van(costoNeto, tasa);
    return { sistema: sistema || 'puro', filas, ...ind, precioMin, margenPrecio, costoNeto, vac, cae: cae(vac, tasa, n), plan: fin ? fin.plan : [] };
  }

  const puro = flujo(null);
  const constante = hayPrestamo ? flujo('constante') : null;
  const cuota = hayPrestamo ? flujo('cuota') : null;

  return {
    D, n, tasa, anios, ventas,
    ingresos, costosFijos, costosVariables, otros, costosVentas, costosOp,
    ctReq, ctInv, ctRecup, ctTotal,
    activos, depreciacion, amortDiferidos, diferidos, inversion, inversionTotal,
    libroTotal, mercadoTotal, gananciaVenta,
    montoPrestamo, hayPrestamo,
    puro, constante, cuota,
    alternativas: [puro, constante, cuota].filter(Boolean),
  };
}

// Atajo para la simulación: solo los números que se guardan por ensayo.
export function resumenEnsayo(r) {
  const fin = r.cuota && r.constante ? (r.cuota.van >= r.constante.van ? r.cuota : r.constante) : null;
  return {
    van: r.puro.van, tir: r.puro.tir, tur: r.puro.tur, bc: r.puro.bc, tri: r.puro.tri,
    vanF: fin ? fin.van : null, tirF: fin ? fin.tir : null,
  };
}
