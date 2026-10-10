// Formato boliviano: punto de miles, coma decimal. Sin guiones largos en ningún texto.
const nf = d => new Intl.NumberFormat('es-BO', { minimumFractionDigits: d, maximumFractionDigits: d });
const cache = {};
const fmt = (x, d) => (cache[d] ||= nf(d)).format(x);

export const num = (x, d = 0) => (x === null || x === undefined || !isFinite(x) ? 's/d' : fmt(x, d));
export const dinero = (x, moneda = 'Bs', d = 0) => (x === null || x === undefined || !isFinite(x) ? 's/d' : `${x < 0 ? '-' : ''}${moneda} ${fmt(Math.abs(x), d)}`);
export const pct = (x, d = 2) => (x === null || x === undefined || !isFinite(x) ? 's/d' : `${fmt(x * 100, d)} %`);
export const anios = x => {
  if (x === null || x === undefined || !isFinite(x)) return 'no se recupera';
  const a = Math.floor(x), m = Math.round((x - a) * 12);
  if (m === 12) return `${a + 1} años`;
  return m ? `${a} años y ${m} ${m === 1 ? 'mes' : 'meses'}` : `${a} años`;
};
// Dinero abreviado para gráficos: 312,4 mil · 1,2 M
export const corto = (x, moneda = '') => {
  const a = Math.abs(x), s = x < 0 ? '-' : '';
  const p = moneda ? moneda + ' ' : '';
  if (a >= 1e6) return `${s}${p}${fmt(a / 1e6, a >= 1e8 ? 0 : 1)} M`;
  if (a >= 1e3) return `${s}${p}${fmt(a / 1e3, a >= 1e5 ? 0 : 1)} mil`;
  return `${s}${p}${fmt(a, 0)}`;
};
