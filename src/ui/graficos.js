// Gráficos SVG livianos para el panel. Colores por variables CSS (claro y oscuro).
import { corto, pct } from '../motor/formato.js';

const W = 336;
const PAL = ['var(--accent)', 'var(--ok)', 'var(--warn)', '#7C3AED', '#0E7490', '#BE185D', '#4D7C0F'];
const esc = (d0, d1, r0, r1) => v => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
const ticks = (min, max, k = 4) => {
  const paso = Math.pow(10, Math.floor(Math.log10((max - min) / k || 1)));
  const m = [1, 2, 2.5, 5, 10].map(x => x * paso).find(x => (max - min) / x <= k) || paso * 10;
  const out = []; for (let v = Math.ceil(min / m) * m; v <= max + 1e-9; v += m) out.push(v);
  return out;
};
const svg = (h, cuerpo, etiqueta) => `<svg class="grafico" viewBox="0 0 ${W} ${h}" role="img" aria-label="${etiqueta}">${cuerpo}</svg>`;

// Barras del flujo por año + línea del acumulado actualizado
export function graficoFlujo(flujo, acumulado, moneda = '') {
  const H = 170, L = 56, R = 8, T = 10, B = 22;
  const vals = [...flujo, ...acumulado];
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const y = esc(lo, hi, H - B, T);
  const n = flujo.length, bw = (W - L - R) / n;
  let s = ticks(lo, hi).map(v => `<line class="rej" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${corto(v)}</text>`).join('');
  s += flujo.map((f, t) => {
    const x = L + t * bw + bw * 0.18, w = bw * 0.64;
    const y0 = y(Math.max(0, f)), h = Math.abs(y(f) - y(0));
    return `<rect x="${x}" y="${y0}" width="${w}" height="${Math.max(h, 0.5)}" rx="1.5" style="fill:${f < 0 ? 'var(--bad)' : 'var(--accent)'}"><title>Año ${t}: ${corto(f, moneda)}</title></rect>`
      + (n <= 12 || t % 2 === 0 ? `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${t}</text>` : '');
  }).join('');
  const pts = acumulado.map((a, t) => `${L + t * bw + bw / 2},${y(a)}`).join(' ');
  s += `<polyline points="${pts}" fill="none" style="stroke:var(--ink)" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  s += `<line class="eje" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
  return svg(H, s, 'Flujo de caja por año y acumulado actualizado');
}

// Histograma de ensayos con una zona sombreada [desde, hasta]
export function graficoHistograma(bins, { zona = null, malo = true, formato = v => corto(v), marca = null } = {}) {
  const H = 150, L = 8, R = 8, T = 8, B = 24;
  if (!bins.length) return '';
  const max = Math.max(...bins.map(b => b.p));
  const x = esc(bins[0].desde, bins[bins.length - 1].hasta, L, W - R);
  const y = esc(0, max, H - B, T);
  const dentro = b => zona && (b.desde + b.hasta) / 2 >= zona.desde && (b.desde + b.hasta) / 2 <= zona.hasta;
  let s = bins.map(b => {
    const col = dentro(b) ? (malo ? 'var(--bad)' : 'var(--accent)') : 'var(--line-2)';
    return `<rect x="${x(b.desde) + 0.5}" y="${y(b.p)}" width="${Math.max(x(b.hasta) - x(b.desde) - 1, 0.5)}" height="${H - B - y(b.p)}" style="fill:${col}"><title>${formato(b.desde)} a ${formato(b.hasta)}: ${pct(b.p, 1)}</title></rect>`;
  }).join('');
  s += `<line class="eje" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>`;
  const marcas = [bins[0].desde, (bins[0].desde + bins[bins.length - 1].hasta) / 2, bins[bins.length - 1].hasta];
  s += marcas.map((v, i) => `<text x="${x(v)}" y="${H - 8}" text-anchor="${['start', 'middle', 'end'][i]}">${formato(v)}</text>`).join('');
  const lineas = [];
  if (zona) [zona.desde, zona.hasta].forEach(v => { if (isFinite(v) && v > bins[0].desde && v < bins[bins.length - 1].hasta) lineas.push(v); });
  if (marca !== null) lineas.push(marca);
  s += lineas.map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${T - 4}" y2="${H - B}" style="stroke:var(--ink)" stroke-width="1" stroke-dasharray="2 2"/>`).join('');
  return svg(H, s, 'Distribución de los ensayos');
}

// Curva acumulada (probabilidad de no superar cada valor)
export function graficoAcumulada(ordenado, { marca = null, prob = null, formato = v => corto(v) } = {}) {
  const H = 150, L = 34, R = 8, T = 8, B = 24;
  const n = ordenado.length;
  if (!n) return '';
  const x = esc(ordenado[0], ordenado[n - 1], L, W - R);
  const y = esc(0, 1, H - B, T);
  const pasos = 60;
  const pts = Array.from({ length: pasos + 1 }, (_, i) => { const p = i / pasos; const v = ordenado[Math.min(n - 1, Math.round(p * (n - 1)))]; return `${x(v)},${y(p)}`; }).join(' ');
  let s = [0, 0.5, 1].map(p => `<line class="rej" x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}"/><text x="${L - 4}" y="${y(p) + 3}" text-anchor="end">${p * 100}%</text>`).join('');
  s += `<polyline points="${pts}" fill="none" style="stroke:var(--accent)" stroke-width="2"/>`;
  if (marca !== null) s += `<line x1="${x(marca)}" x2="${x(marca)}" y1="${T}" y2="${H - B}" style="stroke:var(--bad)" stroke-dasharray="3 3"/>`;
  if (prob !== null) s += `<line x1="${L}" x2="${W - R}" y1="${y(prob)}" y2="${y(prob)}" style="stroke:var(--bad)" stroke-dasharray="3 3"/>`;
  s += [ordenado[0], ordenado[n - 1]].map((v, i) => `<text x="${x(v)}" y="${H - 8}" text-anchor="${i ? 'end' : 'start'}">${formato(v)}</text>`).join('');
  return svg(H, s, 'Probabilidad acumulada');
}

// Tornado: barras horizontales del cambio del VAN alrededor del caso base
export function graficoTornado(items, base) {
  const fila = 24, L = 74, R = 8, T = 6;
  const H = T + items.length * fila + 18;
  const ext = Math.max(...items.flatMap(i => [Math.abs(i.bajo - base), Math.abs(i.alto - base)]), 1);
  const x = esc(-ext, ext, L, W - R);
  let s = items.map((it, k) => {
    const yy = T + k * fila;
    const a = it.bajo - base, b = it.alto - base;
    const barra = (v, col) => `<rect x="${Math.min(x(0), x(v))}" y="${yy + 4}" width="${Math.max(Math.abs(x(v) - x(0)), 0.5)}" height="${fila - 8}" rx="1.5" style="fill:${col}"><title>${corto(v)}</title></rect>`;
    return `<text x="${L - 6}" y="${yy + fila / 2 + 3}" text-anchor="end">${it.corto}</text>${barra(a, a < 0 ? 'var(--bad)' : 'var(--ok)')}${barra(b, b < 0 ? 'var(--bad)' : 'var(--ok)')}`;
  }).join('');
  s += `<line class="eje" x1="${x(0)}" x2="${x(0)}" y1="${T}" y2="${H - 18}"/>`;
  s += `<text x="${L}" y="${H - 4}">${corto(-ext)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">+${corto(ext)}</text>`;
  return svg(H, s, 'Tornado de sensibilidad del VAN');
}

// Araña: VAN según el % de cambio de cada variable
export function graficoArana(series, pasos) {
  const H = 190, L = 56, R = 8, T = 8, B = 22;
  const vals = series.flatMap(s => s.puntos.map(p => p.valor));
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const x = esc(pasos[0], pasos[pasos.length - 1], L, W - R);
  const y = esc(lo, hi, H - B, T);
  let s = ticks(lo, hi).map(v => `<line class="rej" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${corto(v)}</text>`).join('');
  s += pasos.map((p, i) => `<text x="${x(p)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === pasos.length - 1 ? 'end' : 'middle'}">${p > 0 ? '+' : ''}${Math.round(p * 100)}%</text>`).join('');
  s += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" style="stroke:var(--bad)" stroke-width="1" stroke-dasharray="3 3"/>`;
  s += series.map((se, i) => `<polyline points="${se.puntos.map(p => `${x(p.cambio)},${y(p.valor)}`).join(' ')}" fill="none" style="stroke:${PAL[i % PAL.length]}" stroke-width="1.75"><title>${se.nombre}</title></polyline>`).join('');
  return svg(H, s, 'Gráfico de araña del VAN');
}
export const leyendaArana = series => `<div class="leyenda">${series.map((s, i) => `<span><i style="background:${PAL[i % PAL.length]}"></i>${s.corto}</span>`).join('')}</div>`;
