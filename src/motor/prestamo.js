// Planes de pago del préstamo, igual que las tablas de la plantilla (filas 48–61).
// Plazo total incluye la gracia; en gracia solo se pagan intereses.
// tipoTasa 'efectiva' → periodos anuales; 'nominal' → tasa/12 con pagos mensuales sumados por año.

function planPeriodos(monto, i, periodos, gracia, sistema) {
  const filas = [];
  let saldo = monto;
  const resto = periodos - gracia;
  const cuotaFija = resto <= 0 ? 0 : i === 0 ? monto / resto : monto * i / (1 - Math.pow(1 + i, -resto));
  for (let p = 1; p <= periodos; p++) {
    const interes = saldo * i;
    let amort;
    if (p <= gracia) amort = 0;
    else if (sistema === 'constante') amort = monto / resto;
    else amort = cuotaFija - interes;
    const inicial = saldo;
    saldo = inicial - amort;
    if (Math.abs(saldo) < 1e-6) saldo = 0;
    filas.push({ periodo: p, saldoInicial: inicial, amortizacion: amort, interes, cuota: amort + interes, saldoFinal: saldo });
  }
  return filas;
}

// Devuelve el plan agrupado por año (1..plazo) y, si es nominal, también el detalle mensual.
export function planPagos({ monto, tasa, plazo, gracia = 0, tipoTasa = 'efectiva' }, sistema) {
  if (!monto || !plazo) return { anual: [], mensual: [] };
  if (tipoTasa === 'nominal') {
    const mensual = planPeriodos(monto, tasa / 12, plazo * 12, gracia * 12, sistema);
    const anual = [];
    for (let a = 1; a <= plazo; a++) {
      const ms = mensual.slice((a - 1) * 12, a * 12);
      const s = k => ms.reduce((x, m) => x + m[k], 0);
      anual.push({ periodo: a, saldoInicial: ms[0].saldoInicial, amortizacion: s('amortizacion'), interes: s('interes'), cuota: s('cuota'), saldoFinal: ms[ms.length - 1].saldoFinal });
    }
    return { anual, mensual };
  }
  return { anual: planPeriodos(monto, tasa, plazo, gracia, sistema), mensual: [] };
}

// Serie por año 0..n de intereses y amortizaciones (0 fuera del plazo).
export function seriesPrestamo(prest, sistema, n) {
  const { anual } = planPagos(prest, sistema);
  const interes = Array(n + 1).fill(0), amortizacion = Array(n + 1).fill(0), cuota = Array(n + 1).fill(0);
  anual.forEach(f => {
    if (f.periodo <= n) { interes[f.periodo] = f.interes; amortizacion[f.periodo] = f.amortizacion; cuota[f.periodo] = f.cuota; }
  });
  // Préstamo más largo que el proyecto: el saldo pendiente se cancela en el año n
  const saldoN = anual.length > n ? Math.round(anual[n - 1].saldoFinal * 100) / 100 : 0;
  if (saldoN > 0) { amortizacion[n] += saldoN; cuota[n] += saldoN; }
  return { interes, amortizacion, cuota, plan: anual, saldoN };
}
