/* global Excel, Office */
// Ejecuta el plan de hojas con Office.js (Excel Mac, Windows y web). Mínimo ExcelApi 1.7; lo de 1.8+ se usa solo si está disponible.
import { colIndice, colLetra } from './plan.js';
import { H, NOMBRES } from './mapa.js';
import { ORDEN } from './libro.js';
import { PREST } from './hojasCalculo.js';

const PREST_FILAS = `${PREST.ini}:${PREST.fin}`;

const GENERADAS = [H.resumen, H.ventas, H.dep, H.prest, H.flujo, H.vac, H.riesgo, H.diag, H.mc];
const BLOQUE_FILAS = 2000;

// Tamaño de una dirección A1 ("B5:V20" → 16 filas × 21 columnas)
function dims(addr) {
  const [a, b = a] = addr.split(':');
  const p = s => { const m = /^([A-Z]+)(\d+)$/.exec(s); return m ? [colIndice(m[1]), Number(m[2])] : null; };
  const pa = p(a), pb = p(b);
  if (!pa || !pb) return null;
  return { filas: pb[1] - pa[1] + 1, cols: pb[0] - pa[0] + 1, c0: pa[0], r0: pa[1] };
}
const matriz = (d, v) => Array.from({ length: d.filas }, () => Array(d.cols).fill(v));

export const disponible = () => typeof Office !== 'undefined' && typeof Excel !== 'undefined' && !!Office.context?.requirements;
export const soporta = v => disponible() && Office.context.requirements.isSetSupported('ExcelApi', v);

// Hojas generadas que ya existen en el libro
export async function hojasExistentes() {
  return Excel.run(async ctx => {
    const ws = ctx.workbook.worksheets;
    ws.load('items/name');
    await ctx.sync();
    return ws.items.map(w => w.name);
  });
}

// Escribe las hojas del plan. Una hoja que ya existe se LIMPIA y se reutiliza (no se borra ni se
// renombra): así las fórmulas de otras hojas que apuntan a ella (por ejemplo 'Datos'!B8) no quedan en #REF!.
// parcial: solo toca las hojas del plan; si no, borra además las hojas generadas que ya no hacen falta.
export async function escribirLibro(hojas, { progreso = () => {}, parcial = false } = {}) {
  const nombres = hojas.map(h => h.nombre);
  await Excel.run(async ctx => {
    const wb = ctx.workbook;
    const ws = wb.worksheets;
    ws.load('items/name');
    await ctx.sync();
    const existentes = new Map(ws.items.map(w => [w.name, w]));
    for (const h of hojas) {
      const w = existentes.get(h.nombre);
      if (w) {
        w.visibility = 'Visible';
        w.charts.load('items');
      } else {
        const nueva = ws.add(h.nombre);
        if (h.color) nueva.tabColor = h.color;
      }
    }
    await ctx.sync();
    for (const h of hojas) {
      const w = existentes.get(h.nombre);
      if (!w) continue;
      w.charts.items.forEach(c => c.delete());
      const todo = w.getRange();
      if (soporta('1.6')) todo.conditionalFormats.clearAll();
      if (soporta('1.8')) todo.dataValidation.clear();
      todo.clear('All');
      w.freezePanes.unfreeze();
      if (h.color) w.tabColor = h.color;
    }
    // Hojas generadas que ya no hacen falta (por ejemplo Préstamo si se quitó el préstamo)
    if (!parcial) ws.items.filter(w => GENERADAS.includes(w.name) && !nombres.includes(w.name)).forEach(w => w.delete());
    await ctx.sync();
  });
  await recrearNombres(hojas);

  // 2) Escribe cada hoja
  let k = 0;
  for (const h of hojas) {
    progreso(`Escribiendo ${h.nombre}`, k / hojas.length);
    await escribirHoja(h);
    k++;
  }
  // 3) Orden, visibilidad y hoja activa
  await Excel.run(async ctx => {
    const ws = ctx.workbook.worksheets;
    ws.load('items/name');
    await ctx.sync();
    let pos = 0;
    for (const n of ORDEN) {
      const w = ws.items.find(x => x.name === n);
      if (w) { w.position = pos++; }
    }
    await ctx.sync();
    hojas.filter(h => h.oculta).forEach(h => { ws.getItem(h.nombre).visibility = 'Hidden'; });
    const flujo = ws.items.find(x => x.name === H.flujo);
    if (flujo && !parcial) flujo.activate();
    await ctx.sync();
  });
  progreso('Listo', 1);
}

// Crea o actualiza los nombres definidos sin borrarlos (borrar un nombre deja #NAME? en las fórmulas que lo usan).
// Uno por uno, para que un fallo no corte a los demás.
async function recrearNombres(hojas) {
  const defs = [...Object.entries(NOMBRES).map(([nombre, r]) => ({ nombre, ref: r })),
    ...hojas.flatMap(h => h.ops.filter(o => o.op === 'nombre' && !NOMBRES[o.nombre]))];
  for (const d of defs) {
    try {
      await Excel.run(async ctx => {
        const item = ctx.workbook.names.getItemOrNullObject(d.nombre);
        item.load('isNullObject');
        await ctx.sync();
        if (item.isNullObject) ctx.workbook.names.add(d.nombre, `=${d.ref}`);
        else item.formula = `=${d.ref}`;
        await ctx.sync();
      });
    } catch (e) { console.warn('nombre', d.nombre, e.message); }
  }
}

async function escribirHoja(h) {
  // Escrituras grandes (por ejemplo _MC) en bloques de 2.000 filas
  const grandes = h.ops.filter(o => o.op === 'set' && o.datos.length > BLOQUE_FILAS);
  const resto = h.ops.filter(o => !grandes.includes(o));
  const graficos = [];
  try {
    await Excel.run(async ctx => {
      const sh = ctx.workbook.worksheets.getItem(h.nombre);
      if (soporta('1.6')) ctx.application.suspendApiCalculationUntilNextSync();
      for (const o of resto) aplicar(ctx, sh, o, graficos);
      await ctx.sync();
    });
  } catch (e) {
    // Alguna operación no es compatible con esta versión de Excel: se reintenta una por una
    console.warn('Reintento por operación en', h.nombre, e);
    graficos.length = 0;
    try { await Excel.run(async ctx => { const sh = ctx.workbook.worksheets.getItem(h.nombre); if (soporta('1.6')) sh.getRange().conditionalFormats.clearAll(); await ctx.sync(); }); } catch (err) { /* sin formatos condicionales */ }
    for (const o of resto) {
      try {
        await Excel.run(async ctx => { aplicar(ctx, ctx.workbook.worksheets.getItem(h.nombre), o, graficos); await ctx.sync(); });
      } catch (err) { console.warn('op omitida', h.nombre, o.op, o.addr || o.nombre, err.message); }
    }
  }
  // Los gráficos al final, cada uno protegido: si una opción no existe en esta versión de Excel, se omite
  for (const g of graficos) {
    try { await Excel.run(async ctx => crearGrafico(ctx, ctx.workbook.worksheets.getItem(h.nombre), g)); } catch (e) { console.warn('gráfico', h.nombre, g.titulo, e); }
  }
  for (const o of grandes) {
    const d = dims(o.addr);
    for (let i = 0; i < o.datos.length; i += BLOQUE_FILAS) {
      const parte = o.datos.slice(i, i + BLOQUE_FILAS);
      await Excel.run(async ctx => {
        const sh = ctx.workbook.worksheets.getItem(h.nombre);
        if (soporta('1.6')) ctx.application.suspendApiCalculationUntilNextSync();
        const addr = `${colLetra(d.c0)}${d.r0 + i}:${colLetra(d.c0 + d.cols - 1)}${d.r0 + i + parte.length - 1}`;
        sh.getRange(addr).values = parte;
        await ctx.sync();
      });
    }
  }
}

function aplicar(ctx, sh, o, graficos) {
  switch (o.op) {
    case 'set': {
      const r = sh.getRange(o.addr);
      r.formulas = o.datos.map(f => f.map(v => (v === null || v === undefined ? '' : v)));
      break;
    }
    case 'fmt': {
      const r = sh.getRange(o.addr), f = o.f, fmt = r.format;
      if (f.fill) fmt.fill.color = f.fill;
      if (f.bold !== undefined) fmt.font.bold = f.bold;
      if (f.italic) fmt.font.italic = true;
      if (f.size) fmt.font.size = f.size;
      if (f.color) fmt.font.color = f.color;
      if (f.align) fmt.horizontalAlignment = f.align;
      if (f.wrap) { fmt.wrapText = true; fmt.verticalAlignment = 'Top'; }
      if (f.numFmt) { const d = dims(o.addr); if (d) r.numberFormat = matriz(d, f.numFmt); }
      if (f.borde) {
        ['EdgeTop', 'EdgeBottom', 'EdgeLeft', 'EdgeRight', 'InsideVertical', 'InsideHorizontal'].forEach(b => {
          const d = dims(o.addr);
          if (d && d.filas === 1 && b === 'InsideHorizontal') return;
          if (d && d.cols === 1 && b === 'InsideVertical') return;
          const x = fmt.borders.getItem(b); x.style = 'Continuous'; x.color = '#808080';
        });
      }
      break;
    }
    case 'ancho': {
      const cols = o.cols.includes(':') ? o.cols : `${o.cols}:${o.cols}`;
      sh.getRange(cols).format.columnWidth = o.pts;
      break;
    }
    case 'nombre': // se crean en recrearNombres
      break;
    case 'grafico':
      graficos.push(o.g);
      break;
    case 'inmovilizar':
      if (o.filas && o.cols) sh.freezePanes.freezeAt(sh.getRange(`A1:${colLetra(o.cols - 1)}${o.filas}`));
      else if (o.filas) sh.freezePanes.freezeRows(o.filas);
      else if (o.cols) sh.freezePanes.freezeColumns(o.cols);
      break;
    case 'validacion': {
      if (!soporta('1.8')) break;
      const r = sh.getRange(o.addr), v = o.v;
      r.dataValidation.clear();
      if (v.lista) r.dataValidation.rule = { list: { inCellDropDown: true, source: v.lista.join(',') } };
      else if (v.entero) r.dataValidation.rule = { wholeNumber: { formula1: v.entero[0], formula2: v.entero[1], operator: 'Between' } };
      else if (v.decimal) r.dataValidation.rule = { decimal: { formula1: v.decimal[0], formula2: v.decimal[1], operator: 'Between' } };
      if (v.aviso) r.dataValidation.prompt = { showPrompt: true, title: 'Ayuda', message: v.aviso };
      break;
    }
    case 'vinculo':
      sh.getRange(o.addr).hyperlink = { documentReference: o.destino, textToDisplay: o.texto };
      break;
    case 'semaforo': {
      const r = sh.getRange(o.addr);
      for (const [texto, color, op = 'Contains'] of o.reglas) {
        const cf = r.conditionalFormats.add('ContainsText');
        cf.textComparison.format.fill.color = color;
        cf.textComparison.rule = { operator: op === 'beginsWith' ? 'BeginsWith' : 'Contains', text: texto };
      }
      break;
    }
    default:
  }
}

async function crearGrafico(ctx, sh, g) {
  const ch = sh.charts.add(g.tipo, sh.getRange(g.datos), g.por || 'Auto');
  ch.title.text = g.titulo;
  ch.title.format.font.size = 12;
  ch.setPosition(g.pos[0], g.pos[1]);
  if (g.leyenda === 'None') ch.legend.visible = false;
  else { ch.legend.visible = true; ch.legend.position = g.leyenda || 'Bottom'; }
  await ctx.sync();
  const s = ch.series;
  s.load('count');
  await ctx.sync();
  const seguro = async fn => { try { fn(); await ctx.sync(); } catch (e) { /* opción no disponible */ } };
  if (g.formatoEje) await seguro(() => { ch.axes.valueAxis.numberFormat = g.formatoEje; });
  if (g.formatoEjeX) await seguro(() => { ch.axes.categoryAxis.numberFormat = g.formatoEjeX; });
  if (g.tornado) {
    await seguro(() => {
      const s0 = s.getItemAt(0);
      s0.overlap = 100; s0.gapWidth = 40;
      s0.format.fill.setSolidColor('#B91C1C');
      if (s.count > 1) s.getItemAt(1).format.fill.setSolidColor('#2F6DB5');
    });
    await seguro(() => { ch.axes.categoryAxis.reversePlotOrder = true; });
    await seguro(() => { ch.axes.categoryAxis.tickLabelPosition = 'Low'; });
  }
  if (g.gap !== undefined) await seguro(() => { s.getItemAt(0).gapWidth = g.gap; });
  if (g.tipo === 'ColumnClustered' || g.tipo === 'ColumnStacked') {
    const paleta = ['#2F6DB5', '#15803D', '#B45309', '#7C3AED', '#0E7490', '#BE185D', '#4D7C0F', '#9A3412', '#1D4ED8', '#525252'];
    await seguro(() => { for (let i = 0; i < s.count; i++) s.getItemAt(i).format.fill.setSolidColor(paleta[i % paleta.length]); });
  }
  if (g.rojos && g.rojos.length) {
    await seguro(() => { g.rojos.forEach(i => s.getItemAt(0).points.getItemAt(i).format.fill.setSolidColor('#B91C1C')); });
  }
}

// Muestra solo los años de la vida útil: vuelve a mostrar todo B:V y oculta lo que indique vista().
// Se llama después de generar y cada vez que cambia la vida útil o el plazo del préstamo.
export async function ajustarVista(v) {
  return Excel.run(async ctx => {
    const ws = ctx.workbook.worksheets;
    ws.load('items/name');
    await ctx.sync();
    for (const w of ws.items) {
      const cfg = v[w.name];
      if (!cfg) continue;
      if ('columnas' in cfg) {
        w.getRange('B:V').columnHidden = false;
        if (cfg.columnas) w.getRange(cfg.columnas).columnHidden = true;
      }
      if ('filas' in cfg) {
        w.getRange(`${PREST_FILAS}`).rowHidden = false;
        if (cfg.filas) w.getRange(cfg.filas).rowHidden = true;
      }
    }
    await ctx.sync();
  });
}

// ---------- Lectura ----------

export async function leerRango(hoja, addr) {
  return Excel.run(async ctx => {
    const sh = ctx.workbook.worksheets.getItemOrNullObject(hoja);
    await ctx.sync();
    if (sh.isNullObject) return null;
    const r = sh.getRange(addr);
    r.load('values');
    await ctx.sync();
    return r.values;
  });
}

// Lee varios rangos de varias hojas en una sola llamada: [{hoja, addr}] → [valores|null]
export async function leerVarios(pedidos) {
  return Excel.run(async ctx => {
    const ws = ctx.workbook.worksheets;
    ws.load('items/name');
    await ctx.sync();
    const existentes = new Set(ws.items.map(w => w.name));
    const rangos = pedidos.map(p => (existentes.has(p.hoja) ? ws.getItem(p.hoja).getRange(p.addr) : null));
    rangos.forEach(r => r && r.load('values'));
    await ctx.sync();
    return rangos.map(r => (r ? r.values : null));
  });
}

export async function irA(hoja, addr = 'A1') {
  return Excel.run(async ctx => {
    const sh = ctx.workbook.worksheets.getItem(hoja);
    sh.activate();
    sh.getRange(addr).select();
    await ctx.sync();
  });
}

// Avisa cuando el estudiante edita la hoja Datos (para marcar resultados como desactualizados)
export async function vigilarDatos(callback) {
  if (!soporta('1.7')) return null;
  return Excel.run(async ctx => {
    const sh = ctx.workbook.worksheets.getItemOrNullObject(H.datos);
    await ctx.sync();
    if (sh.isNullObject) return null;
    let t = null;
    sh.onChanged.add(async () => { clearTimeout(t); t = setTimeout(callback, 500); });
    await ctx.sync();
    return true;
  });
}

// Agrega una fila de pregunta (con fórmulas vivas) al final de la tabla de preguntas de Riesgo
export async function agregarPregunta(fila, valores) {
  return Excel.run(async ctx => {
    const sh = ctx.workbook.worksheets.getItem(H.riesgo);
    sh.getRange(`A${fila}:F${fila}`).insert('Down');
    const r = sh.getRange(`A${fila}:F${fila}`);
    r.formulas = [valores.map(v => v ?? '')];
    r.format.fill.clear();
    sh.getRange(`D${fila}:E${fila}`).numberFormat = [[valores.formato === 'dinero' ? '#,##0' : '0.00%', valores.formato === 'dinero' ? '#,##0' : '0.00%']];
    r.select();
    await ctx.sync();
  });
}
