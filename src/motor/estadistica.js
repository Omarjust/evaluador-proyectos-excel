// Estadística de los ensayos (formato de la Tabla 32 del proyecto) y la normal (Tabla 33).

// Función de distribución normal estándar (erf de Abramowitz y Stegun 7.1.26, error < 1,5e-7)
export function phi(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

// P(X < x) con aproximación normal
export const normalMenor = (x, media, sd) => (sd > 0 ? phi((x - media) / sd) : x > media ? 1 : 0);

// Inversa de la normal estándar (Acklam), para "con X % de seguridad" en modo normal
export function phiInv(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export const validos = arr => Array.from(arr).filter(x => x !== null && isFinite(x));
export const ordenar = arr => Float64Array.from(validos(arr)).sort();

// Percentil como PERCENTILE.INC de Excel (sobre un arreglo ya ordenado)
export function percentil(ord, p) {
  const n = ord.length;
  if (!n) return null;
  const i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return ord[lo] + (ord[hi] - ord[lo]) * (i - lo);
}

export function estadisticos(arr) {
  const a = ordenar(arr);
  const n = a.length;
  if (n < 2) return null;
  let s = 0; for (const x of a) s += x;
  const media = s / n;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const x of a) { const d = x - media; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d; }
  const sd = Math.sqrt(m2 / (n - 1));
  // Asimetría y curtosis en exceso como SKEW y KURT de Excel
  const asimetria = sd ? (n / ((n - 1) * (n - 2))) * (m3 / Math.pow(sd, 3)) : 0;
  const curtosis = sd && n > 3
    ? (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * (m4 / Math.pow(sd, 4)) - 3 * (n - 1) ** 2 / ((n - 2) * (n - 3))
    : 0;
  const q = p => percentil(a, p);
  return {
    n, media, sd, cv: media ? sd / Math.abs(media) : null,
    min: a[0], max: a[n - 1], mediana: q(0.5),
    p5: q(0.05), p10: q(0.1), p25: q(0.25), p75: q(0.75), p90: q(0.9), p95: q(0.95),
    asimetria, curtosis,
    // Error de precisión al 95 % de la media: 1,96·σ/(√n·|μ|)
    errorPrecision: media ? 1.96 * sd / (Math.sqrt(n) * Math.abs(media)) : null,
    ordenado: a,
  };
}

// Proporción empírica de ensayos que cumplen una condición
export function proporcion(arr, cond) {
  let k = 0, n = 0;
  for (const x of arr) { if (x === null || !isFinite(x)) continue; n++; if (cond(x)) k++; }
  return { k, n, p: n ? k / n : null };
}

export function correlacion(x, y) {
  let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < x.length; i++) { if (!isFinite(y[i]) || y[i] === null) continue; n++; sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    if (!isFinite(y[i]) || y[i] === null) continue;
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

// Histograma de `k` intervalos iguales entre mín y máx (igual que COUNTIFS en la hoja Riesgo)
export function histograma(ord, k = 25) {
  const n = ord.length;
  if (!n) return [];
  const min = ord[0], max = ord[n - 1];
  const ancho = (max - min) / k || 1;
  const bins = Array.from({ length: k }, (_, j) => ({ desde: min + j * ancho, hasta: min + (j + 1) * ancho, k: 0 }));
  for (const x of ord) bins[Math.min(k - 1, Math.floor((x - min) / ancho))].k++;
  bins.forEach(b => { b.p = b.k / n; });
  return bins;
}
