// Cada hoja se describe como una lista de operaciones (escribir, dar formato, nombrar,
// graficar). office.js las ejecuta con Office.js y test/xlsx las convierte a un .xlsx
// para recalcular con LibreOffice y comparar con el motor.

export const C = {
  entrada: '#FFF2CC', encabezado: '#DDEBF7', total: '#D9D9D9',
  ok: '#C6EFCE', warn: '#FFEB9C', bad: '#FFC7CE',
  tabResumen: '#70AD47', tabDatos: '#FFC000', tabCalculo: '#5B9BD5', tabRiesgo: '#ED7D31', tabOculta: '#A6A6A6',
};

export const SEMAFORO_DECISION = [['NO', '#FFC7CE', 'beginsWith'], ['CONVIENE', '#C6EFCE', 'beginsWith']];

export const FMT = {
  dinero: '#,##0;[Red]-#,##0;"-"',
  dinero2: '#,##0.00;[Red]-#,##0.00;"-"',
  unidades: '#,##0;[Red]-#,##0;"-"',
  pct: '0.00%',
  pct0: '0%',
  factor: '0.0000',
  dec2: '0.00',
  anio: '"Año "0',
  entero: '0',
};

// Letras de columna
export const colLetra = c => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
export const colIndice = l => l.split('').reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1;
// Año t (0..20) → columna B..V
export const Y = t => colLetra(1 + t);
export const ANIOS = Array.from({ length: 21 }, (_, t) => t);

export class Hoja {
  constructor(nombre, { color = null, oculta = false, zoom = null } = {}) {
    this.nombre = nombre;
    this.color = color;
    this.oculta = oculta;
    this.ops = [];
  }
  // datos: matriz 2D; las cadenas que empiezan con "=" son fórmulas
  set(addr, datos) {
    const m = Array.isArray(datos[0]) ? datos : [datos];
    // El tamaño de la matriz debe coincidir con el rango (Office.js rechaza la escritura si no)
    const [a, b = a] = addr.split(':');
    const p = x => /^([A-Z]+)(\d+)$/.exec(x);
    const pa = p(a), pb = p(b);
    if (pa && pb) {
      const filas = Number(pb[2]) - Number(pa[2]) + 1, cols = colIndice(pb[1]) - colIndice(pa[1]) + 1;
      if (m.length !== filas || m.some(f => f.length !== cols)) throw new Error(`${this.nombre}!${addr}: se esperaban ${filas}×${cols} y llegaron ${m.length}×${Math.max(...m.map(f => f.length))}`);
    }
    this.ops.push({ op: 'set', addr, datos: m });
    return this;
  }
  // Una sola celda
  val(addr, v) { return this.set(addr, [[v]]); }
  // Fila de fórmulas por año: fn(t, colLetra) → fórmula; escribe B..V en la fila r
  filaAnios(r, fn, { desde = 0 } = {}) {
    const fila = ANIOS.map(t => (t < desde ? '' : fn(t, Y(t))));
    return this.set(`B${r}:V${r}`, [fila]);
  }
  fmt(addr, f) { this.ops.push({ op: 'fmt', addr, f }); return this; }
  ancho(cols, pts) { this.ops.push({ op: 'ancho', cols, pts }); return this; }
  nombre_(nombre, ref) { this.ops.push({ op: 'nombre', nombre, ref }); return this; }
  grafico(g) { this.ops.push({ op: 'grafico', g }); return this; }
  inmovilizar(filas, cols = 0) { this.ops.push({ op: 'inmovilizar', filas, cols }); return this; }
  validacion(addr, v) { this.ops.push({ op: 'validacion', addr, v }); return this; }
  vinculo(addr, destino, texto) { this.ops.push({ op: 'vinculo', addr, destino, texto }); return this; }
  // Formato condicional por texto: [[texto, color, 'beginsWith'|'contains']]
  semaforo(addr, reglas = SEMAFORO_DECISION) { this.ops.push({ op: 'semaforo', addr, reglas }); return this; }

  // Atajos de estilo de clase
  titulo(addr, texto) { this.val(addr, texto); return this.fmt(addr, { bold: true, size: 14 }); }
  seccion(addr, texto) { this.val(addr, texto); return this.fmt(addr, { bold: true }); }
  encabezado(addr) { return this.fmt(addr, { fill: C.encabezado, bold: true, align: 'Center', borde: true, wrap: true }); }
  entrada(addr) { return this.fmt(addr, { fill: C.entrada, borde: true }); }
  totalFila(addr) { return this.fmt(addr, { fill: C.total, bold: true, borde: true }); }
  nota(addr, texto) { this.val(addr, texto); return this.fmt(addr, { size: 9, italic: true, color: '#595959' }); }
  // Encabezado AÑO en la fila r (B = 0, luego hasta la vida del proyecto)
  filaAnio(r, etiqueta = 'AÑO') {
    this.val(`A${r}`, etiqueta);
    this.filaAnios(r, (t, c) => (t === 0 ? 0 : `=IF(${Y(t - 1)}${r}="","",IF(${Y(t - 1)}${r}+1<=VidaProy,${Y(t - 1)}${r}+1,""))`));
    this.encabezado(`A${r}:V${r}`);
    return this.fmt(`B${r}:V${r}`, { numFmt: FMT.anio });
  }
}

// Fórmula protegida por el encabezado de años: IF(X$r="","",expr)
export const siAnio = (c, r, expr) => `=IF(${c}$${r}="","",${expr})`;
