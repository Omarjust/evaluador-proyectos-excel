// Indicadores financieros con las mismas definiciones que las plantillas de clase.
// VAN = NPV(i; años 1..n) + F0 · TIR = IRR · TUR = MIRR(f; i; i)
// B/C = VP(+)/|VP(−)| · TRI con el flujo actualizado acumulado.

export const factor = (i, t) => 1 / Math.pow(1 + i, t);

export function van(flujos, i) {
  return flujos.reduce((s, f, t) => s + f * factor(i, t), 0);
}

// Cuántas veces cambia de signo el flujo (ignora ceros). Más de 1 → puede haber varias TIR.
export function cambiosDeSigno(flujos) {
  let prev = 0, n = 0;
  for (const f of flujos) {
    if (Math.abs(f) < 1e-9) continue;
    const s = Math.sign(f);
    if (prev && s !== prev) n++;
    prev = s;
  }
  return n;
}

// TIR por Newton con respaldo de bisección; null si no existe una raíz real en (-99 %, 1000 %).
export function tir(flujos) {
  if (!flujos.some(f => f > 0) || !flujos.some(f => f < 0)) return null;
  let r = 0.1;
  for (let k = 0; k < 60; k++) {
    let v = 0, d = 0;
    flujos.forEach((f, t) => { v += f / Math.pow(1 + r, t); d -= t * f / Math.pow(1 + r, t + 1); });
    if (Math.abs(v) < 1e-7) return r;
    if (!isFinite(d) || d === 0) break;
    const nr = r - v / d;
    if (!isFinite(nr) || nr <= -0.99) break;
    if (Math.abs(nr - r) < 1e-12) return nr;
    r = nr;
  }
  // Bisección: busca un tramo con cambio de signo
  const puntos = [-0.99, -0.5, 0, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 3, 10];
  for (let k = 0; k < puntos.length - 1; k++) {
    let lo = puntos[k], hi = puntos[k + 1];
    if (van(flujos, lo) * van(flujos, hi) > 0) continue;
    for (let j = 0; j < 200; j++) {
      const m = (lo + hi) / 2;
      if (van(flujos, lo) * van(flujos, m) <= 0) hi = m; else lo = m;
    }
    return (lo + hi) / 2;
  }
  return null;
}

// TUR = MIRR(f; i; i): positivos capitalizados al año n, negativos actualizados al año 0.
export function tur(flujos, i) {
  const n = flujos.length - 1;
  let S = 0, I = 0;
  flujos.forEach((f, t) => {
    if (f > 0) S += f * Math.pow(1 + i, n - t);
    else I += -f * factor(i, t);
  });
  if (I === 0 || S === 0 || n === 0) return null;
  return Math.pow(S / I, 1 / n) - 1;
}

export function bc(flujos, i) {
  let pos = 0, neg = 0;
  flujos.forEach((f, t) => { const a = f * factor(i, t); if (a > 0) pos += a; else neg -= a; });
  return neg === 0 ? null : pos / neg;
}

// TRI: primer año en que el acumulado pasa de negativo a ≥ 0, con interpolación lineal
// (misma fórmula que la fila "TRI" de la plantilla: año anterior + faltante / flujo del año).
export function triDesde(serie) {
  let acum = 0;
  for (let t = 0; t < serie.length; t++) {
    const prev = acum;
    acum += serie[t];
    if (t > 0 && prev < 0 && acum >= 0) return (t - 1) + (-prev) / serie[t];
  }
  return null;
}

export const triDescontado = (flujos, i) => triDesde(flujos.map((f, t) => f * factor(i, t)));
export const triSimple = flujos => triDesde(flujos);

export function indicadores(flujos, i) {
  return {
    van: van(flujos, i),
    tir: tir(flujos),
    tur: tur(flujos, i),
    bc: bc(flujos, i),
    tri: triDescontado(flujos, i),
    triSimple: triSimple(flujos),
    cambios: cambiosDeSigno(flujos),
    negativos: flujos.filter(f => f < -1e-9).length,
  };
}

// CAE a partir de un VAC: VAC × i(1+i)^n / ((1+i)^n − 1)
export function cae(vac, i, n) {
  if (i === 0) return vac / n;
  const q = Math.pow(1 + i, n);
  return vac * (i * q) / (q - 1);
}

// Comparador de alternativas (hoja "VAC y CAE" de clase)
export function vacAlternativa({ inversion, costoAnual, vida, residual = 0, veces = 1 }, i) {
  const vac1 = inversion + costoAnual * (1 - Math.pow(1 + i, -vida)) / i - residual / Math.pow(1 + i, vida);
  const horizonte = vida * veces;
  const vacTotal = vac1 * (1 - Math.pow(1 + i, -horizonte)) / (1 - Math.pow(1 + i, -vida));
  return { vac1, horizonte, vacTotal, cae: cae(vac1, i, vida) };
}
