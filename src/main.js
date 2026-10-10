/* global Office */
import './estilos.css';
import { icono, ICONO_NIVEL } from './ui/iconos.js';
import * as G from './ui/graficos.js';
import { calcular } from './motor/modelo.js';
import { analizarSensibilidad, escenarios } from './motor/sensibilidad.js';
import { responder, SUGERIDAS, METRICAS, redondear } from './motor/preguntas.js';
import { recomendaciones, alertas, explicarIndicadores, planDelFlujo, reglasDelFlujo, tirOTur } from './motor/diagnostico.js';
import { estadisticos, histograma, proporcion } from './motor/estadistica.js';
import { validar } from './excel/leer.js';
import { hojaFlujo } from './excel/hojasCalculo.js';
import { VARIABLES, RANGO_DEFECTO } from './motor/variables.js';
import { dinero, pct, num, anios as fAnios, corto } from './motor/formato.js';
import * as P from './puente.js';
import caso5 from '../ejemplos/caso5.json';
import caso6 from '../ejemplos/caso6.json';
import caso4 from '../ejemplos/caso4.json';
import panaderia from '../ejemplos/panaderia.json';

const EJEMPLOS = {
  caso5: { nombre: 'Caso 5: Artesanías de madera', datos: caso5 },
  caso6: { nombre: 'Caso 6: Prendas (con gracia)', datos: caso6 },
  caso4: { nombre: 'Caso 4: Segundo parcial', datos: caso4 },
  panaderia: { nombre: 'Panadería: 3 productos, 12 años', datos: panaderia },
};
const clonar = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hora = () => new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

// ------------------------------------------------------------------ estado
const S = {
  tab: 'inicio', excel: false, libro: { tieneDatos: false, generado: false, plantilla: null },
  ejemplo: 'caso5',
  datos: null, val: { errores: [], avisos: [] }, R: null,
  alt: 'puro', grupo: 'rent', abierto: null,
  generado: false, visto: false, verificado: null, calculado: null, desact: false,
  sens: null, esc: null,
  sim: null, simEst: null, simCtl: null, simDesact: false, ensayos: 10000, semilla: 2026, simSt: null,
  vistaRiesgo: 'preguntas', tema: 'Factibilidad',
  q: { metrica: 'van', op: 'menor', a: 0, b: null }, resp: null, hist: [],
  ocupado: null, progreso: null, msg: null, vigilando: false, foco: null, acc: {}, mostrar: null,
};

// La moneda viene de una celda de texto libre: se escapa siempre antes de ir al HTML
// Un solo criterio para el margen hasta el punto crítico (Resultados y Sensibilidad)
const margenNivel = m => (m < 0 ? ['bad', 'VAN negativo'] : m < 0.1 ? ['bad', 'Corto'] : m < 0.25 ? ['warn', 'Medio'] : ['ok', 'Holgado']);
const moneda = () => esc(String(S.R?.D.proyecto.moneda || S.datos?.proyecto?.moneda || 'Bs').slice(0, 6));
const ctx = () => ({ tasa: S.R?.tasa ?? 0, n: S.R?.n ?? 1, moneda: moneda(), sensibilidad: S.sens });

function recomputar() {
  S.val = validar(S.datos || {});
  if (!S.datos || S.val.errores.length) { S.R = null; return; }
  S.R = calcular(S.datos);
  S.sens = analizarSensibilidad(S.datos);
  S.esc = escenarios(S.datos);
  S.calculado = hora();
  if (S.alt !== 'puro' && !S.R[S.alt]) S.alt = 'puro';
  // Ubicación de las filas en la hoja Flujo (para los vínculos "Ver en la hoja")
  if (S.excel) hojaFlujo(S.R.D, S.R.hayPrestamo);
}

// ------------------------------------------------------------------ piezas
const est = (nivel, palabra) => `<span class="est ${nivel}">${icono(ICONO_NIVEL[nivel])}${esc(palabra)}</span>`;
const mensaje = (nivel, texto, extra = '') => `<div class="mensaje ${nivel}">${icono(ICONO_NIVEL[nivel])}<div>${texto}${extra}</div></div>`;
const btn = (a, texto, { cls = '', ic = null, dis = false, data = '' } = {}) =>
  `<button class="btn ${cls}" data-a="${a}" ${data} ${dis ? 'disabled' : ''}>${ic ? icono(ic) : ''}${texto}</button>`;
const ir = (hoja, celda, texto = 'Ver en la hoja') => (S.excel && S.generado ? `<button class="link" data-a="ir" data-hoja="${esc(hoja)}" data-celda="${celda}">${icono('arrow-square-out')}${texto}</button>` : '');

function porQue(id, x, extra = '') {
  if (S.abierto !== id || !x) return '';
  return `<dl class="porque aparece" id="pq-${id}">
    <div><dt>Qué es</dt><dd>${esc(x.que)}</dd></div>
    <div><dt>Cómo se calculó</dt><dd class="formula">${esc(x.como)}</dd></div>
    <div><dt>Qué significa para ti</dt><dd>${esc(x.significa)}</dd></div>${extra}</dl>`;
}
function filaKpi(id, etiqueta, valor, nivel, palabra, x, celda) {
  const abierto = S.abierto === id;
  return `<div>
    <div class="fila"><span class="et">${etiqueta}</span><span class="val">${valor}</span>${nivel ? est(nivel, palabra) : ''}
      ${x ? `<button class="porque-btn" data-a="porque" data-id="${id}" aria-expanded="${abierto}" aria-controls="pq-${id}">${icono('question')}<span class="sr">¿Por qué?</span></button>` : ''}</div>
    ${porQue(id, x, celda ? `<div>${ir(P.DIRS.H.flujo, celda)}</div>` : '')}
  </div>`;
}

// ------------------------------------------------------------------ pestañas
const TABS = [
  ['inicio', 'Inicio', 'house-simple'], ['datos', 'Datos', 'table'], ['resultados', 'Resultados', 'chart-bar'],
  ['riesgo', 'Riesgo', 'shield-warning'], ['diagnostico', 'Diagnóstico', 'clipboard-text'],
];

function vistaInicio() {
  const pasos = [
    [!!S.R, 'Datos del proyecto', S.R ? `${esc(S.R.D.proyecto.nombre)} · ${S.R.n} años · ${S.R.D.productos.length} producto${S.R.D.productos.length > 1 ? 's' : ''}` : 'Carga un ejemplo, una plantilla vacía o tus datos.'],
    [S.generado, 'Hojas de análisis', S.generado ? (S.excel ? 'Ventas, depreciación, flujo, VAC, riesgo y diagnóstico creados con fórmulas.' : 'Cálculo listo en el panel.') : 'Se crean al pulsar Generar análisis.'],
    [S.visto, 'Lectura de resultados', S.visto ? 'Ya revisaste los indicadores.' : 'El panel te explica el porqué de cada número.'],
  ];
  return `
  <section class="seccion">
    <h2>Evalúa tu proyecto</h2>
    <div class="lista">${pasos.map(([ok, t, d]) => `<div class="check ${ok ? 'hecho' : 'pend'}">${icono(ok ? 'check-circle' : 'circle-dashed')}<div><h3>${t}</h3><p class="muted small">${d}</p></div></div>`).join('')}</div>
  </section>
  ${S.libro.plantilla ? mensaje('info', `Encontré la plantilla de clase en la hoja <b>${esc(S.libro.plantilla)}</b>. Pulsa Leer mi hoja para importarla.`) : ''}
  ${!S.excel ? mensaje('info', 'Estás viendo el panel fuera de Excel. Todo se calcula aquí, pero no se escriben hojas.') : ''}
  <section class="seccion">
    <div class="campo"><label for="ej">Ejemplo</label>
      <select id="ej" data-campo="ejemplo">${Object.entries(EJEMPLOS).map(([k, e]) => `<option value="${k}" ${S.ejemplo === k ? 'selected' : ''}>${e.nombre}</option>`).join('')}</select></div>
    <div class="botones">
      ${btn('ejemplo', 'Cargar ejemplo', { cls: 'primario ancho', ic: 'lightning' })}
      ${btn('vacia', 'Plantilla vacía', { cls: 'ancho', ic: 'file-xls' })}
      ${btn('leer', 'Leer mi hoja', { cls: 'ancho', ic: 'arrow-clockwise', dis: !S.excel })}
    </div>
    <p class="muted small">El ejemplo usa un caso del curso para que veas todo en un clic. Después cambia los datos amarillos por los tuyos.</p>
  </section>
  ${S.R ? `<section class="seccion">${btn('generar', S.generado ? 'Recalcular todo' : 'Generar análisis', { cls: 'primario ancho', ic: 'play' })}</section>` : ''}`;
}

function campo(id, etiqueta, valor, { tipo = 'number', pct: esPct = false, unidad = '', opciones = null, ayuda = '', error = '', completo = false, paso = 'any' } = {}) {
  const v = valor === null || valor === undefined || valor === '' ? '' : esPct ? Math.round(valor * 1e6) / 1e4 : valor;
  const control = opciones
    ? `<select id="f-${id}" data-campo="${id}">${opciones.map(o => `<option ${o === valor ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
    : `<input id="f-${id}" type="${tipo}" ${tipo === 'number' ? `step="${paso}" inputmode="decimal"` : ''} value="${esc(v)}" data-campo="${id}" ${esPct ? 'data-pct="1"' : ''} ${error ? 'aria-invalid="true"' : ''}>`;
  return `<div class="campo ${completo ? 'completo' : ''}"><label for="f-${id}">${etiqueta}</label>
    ${unidad || esPct ? `<div class="unidad">${control}<span>${esPct ? '%' : unidad}</span></div>` : control}
    ${error ? `<span class="error">${esc(error)}</span>` : ayuda ? `<span class="ayuda">${ayuda}</span>` : ''}</div>`;
}

function vistaDatos() {
  if (!S.datos) return `<div class="vacio">${icono('table')}<p>Todavía no hay datos. Ve a Inicio y carga un ejemplo, una plantilla vacía o lee tu hoja.</p>${btn('tab', 'Ir a Inicio', { data: 'data-tab="inicio"' })}</div>`;
  const d = S.datos, p = d.proyecto || {}, pr = d.prestamo || {};
  const errDe = c => S.val.errores.find(e => e.campo === c)?.texto || '';
  const total = S.val.errores.length + S.val.avisos.length;
  const resumenErr = total
    ? `<details class="acc" data-acc="validacion" ${S.val.errores.length ? 'open' : ''}><summary>${icono(S.val.errores.length ? 'x-circle' : 'warning')}${S.val.errores.length ? `${S.val.errores.length} por completar` : `${S.val.avisos.length} por revisar`}<span class="chev">${icono('caret-right')}</span></summary>
      <div class="cuerpo">${[...S.val.errores.map(e => ['bad', e]), ...S.val.avisos.map(e => ['warn', e])].map(([n, e]) => mensaje(n, esc(e.texto), S.excel && S.libro.tieneDatos ? ` ${ir(P.DIRS.H.datos, `A${e.fila}`, 'Ir a la celda')}` : '')).join('')}</div></details>`
    : mensaje('ok', 'Datos completos.');
  const prods = (d.productos || []).map((x, j) => `
    <details class="acc" data-acc="prod${j}" ${j === 0 && (d.productos || []).length === 1 ? 'open' : ''}><summary>${esc(x.nombre || `Producto ${j + 1}`)}<span class="muted small num" style="margin-left:auto">${x.precio !== null && x.precio !== undefined ? dinero(x.precio, moneda(), 2) : 'sin precio'}</span><span class="chev" style="margin-left:6px">${icono('caret-right')}</span></summary>
      <div class="cuerpo"><div class="campos">
        ${campo(`prod.${j}.nombre`, 'Nombre', x.nombre, { tipo: 'text' })}
        ${campo(`prod.${j}.unidad`, 'Unidad', x.unidad, { tipo: 'text' })}
        ${campo(`prod.${j}.precio`, 'Precio año 1', x.precio, { unidad: moneda() })}
        ${campo(`prod.${j}.cvu`, 'Costo variable unitario', x.cvu, { unidad: moneda() })}
        ${campo(`prod.${j}.capacidad`, 'Capacidad al 100 %', x.capacidad, { unidad: 'u/año' })}
        ${campo(`prod.${j}.crecPrecio`, 'Crecimiento del precio', x.crecPrecio, { pct: true })}
      </div>
      ${campo(`prod.${j}.serie`, `Unidades por año (${S.datos.proyecto?.n || '?'} valores)`, serieTexto(x), { tipo: 'text', completo: true, ayuda: 'Sepáralas con punto y coma: 8000; 10000; 12000. Si el enunciado da % de capacidad, edítalo en la hoja Datos.' })}
      <p class="muted small">Ahora: ${resumenSerie(x)}</p>
      <div>${S.excel && S.libro.tieneDatos ? ir(P.DIRS.H.datos, `C${P.DIRS.R.pct.ini + j}`, 'Editar % o unidades por año') : ''}
        <button class="link" data-a="quitarProd" data-j="${j}">${icono('trash')}Quitar</button></div></div></details>`).join('');
  const R = S.R;
  return `
  ${resumenErr}
  <section class="seccion"><header><h2>Proyecto</h2>${S.excel && S.libro.tieneDatos ? ir(P.DIRS.H.datos, 'B5') : ''}</header>
    <div class="campos">
      ${campo('nombre', 'Nombre', p.nombre, { tipo: 'text', completo: true })}
      ${campo('n', 'Vida útil', p.n, { unidad: 'años', error: errDe('vida'), paso: 1 })}
      ${campo('moneda', 'Moneda', p.moneda || 'Bs', { opciones: ['Bs', '$us'] })}
      ${campo('tasa', 'Tasa de descuento', p.tasa, { pct: true, error: errDe('tasa') })}
      ${campo('iue', 'IUE', p.iue ?? 0.25, { pct: true })}
      ${campo('ctModo', 'Capital de trabajo en', p.ctModo === 'meses' ? 'Meses de costos' : '% de costos', { opciones: ['% de costos', 'Meses de costos'] })}
      ${p.ctModo === 'meses' ? campo('ct', 'Meses', p.ct, { unidad: 'meses' }) : campo('ct', 'Porcentaje', p.ct, { pct: true })}
    </div></section>
  <section class="seccion"><header><h2>Productos (${(d.productos || []).length}/10)</h2>
    <button class="link" data-a="agregarProd" ${(d.productos || []).length >= 10 ? 'disabled' : ''}>${icono('plus')}Agregar</button></header>
    <div>${prods || `<p class="muted small">${errDe('productos') || 'Sin productos.'}</p>`}</div></section>
  <section class="seccion"><header><h2>Inversión y costos</h2>${S.excel && S.libro.tieneDatos ? ir(P.DIRS.H.datos, `A${P.DIRS.R.act.ini}`, 'Editar en la hoja') : ''}</header>
    <div class="lista">
      <div class="fila"><span class="et">Activos fijos (${(d.activos || []).length})</span><span class="val">${dinero((d.activos || []).reduce((s, a) => s + (a.valor || 0), 0), moneda())}</span></div>
      <div class="fila"><span class="et">Activos diferidos</span><span class="val">${dinero((d.diferidos || []).reduce((s, a) => s + (a.monto || 0), 0), moneda())}</span></div>
      <div class="fila"><span class="et">Costos fijos anuales</span><span class="val">${dinero((d.costosFijos || []).reduce((s, a) => s + (a.monto || 0), 0), moneda())}</span></div>
      ${R ? `<div class="fila"><span class="et">Capital de trabajo total</span><span class="val">${dinero(R.ctTotal, moneda())}</span></div>` : ''}
    </div>
    ${!S.excel ? mensaje('info', 'Fuera de Excel solo puedes probar con los ejemplos o cambiar estos datos. Los activos y los costos fijos de tu propio proyecto se cargan en la hoja Datos: abre el complemento dentro de Excel.') : ''}</section>
  <section class="seccion"><h2>Préstamo</h2>
    <div class="campos">
      ${campo('pr.monto', 'Monto', pr.monto, { unidad: moneda(), ayuda: 'Vacío si no hay préstamo.' })}
      ${campo('pr.pctInversion', 'o % de la inversión', pr.pctInversion, { pct: true })}
      ${campo('pr.tasa', 'Tasa anual', pr.tasa, { pct: true })}
      ${campo('pr.tipoTasa', 'Tipo de tasa', pr.tipoTasa === 'nominal' ? 'Nominal (pagos mensuales)' : 'Efectiva anual', { opciones: ['Efectiva anual', 'Nominal (pagos mensuales)'] })}
      ${campo('pr.plazo', 'Plazo total', pr.plazo, { unidad: 'años', paso: 1, ayuda: 'Incluye la gracia.' })}
      ${campo('pr.gracia', 'Gracia', pr.gracia, { unidad: 'años', paso: 1, ayuda: 'Solo intereses.' })}
    </div></section>
  <section class="seccion fijo-abajo">${btn('generar', S.generado ? 'Recalcular todo' : 'Generar análisis', { cls: 'primario ancho', ic: 'play', dis: !!S.val.errores.length || !!S.ocupado })}
    ${S.val.errores.length ? '<p class="muted small">Completa los datos marcados arriba para generar.</p>' : ''}</section>`;
}

// Unidades por año como texto editable ("8000; 10000; 12000")
const serieTexto = x => (x.unidades || []).filter(v => v !== null && v !== undefined).join('; ');
const leerSerie = t => String(t || '').split(/[;\s]+/).map(v => v.replace(/\./g, '').replace(',', '.')).filter(v => v !== '').map(Number).filter(Number.isFinite);

function resumenSerie(x) {
  const u = (x.unidades || []).filter(v => v !== null && v !== undefined);
  if (u.length) return `${u.slice(0, 5).map(v => num(v)).join(' · ')}${u.length > 5 ? ' ...' : ''} unidades`;
  const p = (x.pct || []).filter(v => v !== null && v !== undefined);
  if (p.length && x.capacidad) return `${p.slice(0, 5).map(v => pct(v, 0)).join(' · ')}${p.length > 5 ? ' ...' : ''} de ${num(x.capacidad)}`;
  return '<span class="bad-t">faltan</span>';
}

function vistaResultados() {
  const R = S.R;
  if (!R) return `<div class="vacio">${icono('chart-bar')}<p>${S.datos ? 'Completa los datos marcados en la pestaña Datos.' : 'Carga datos para ver los resultados.'}</p>${btn('tab', S.datos ? 'Ir a Datos' : 'Ir a Inicio', { data: `data-tab="${S.datos ? 'datos' : 'inicio'}"` })}</div>`;
  S.visto = true;
  const a = R[S.alt], m = moneda(), i = R.tasa;
  const x = explicarIndicadores(R, S.alt);
  const tt = x.tirOTur;
  const blq = P.DIRS.FLUJO.bloques[S.alt];
  const celda = k => (blq ? `Y${blq.ind[k]}` : null);
  const conviene = a.van >= 0;
  const altBtns = R.hayPrestamo ? `<div class="segmento" role="group" aria-label="Alternativa">${[['puro', 'Sin préstamo'], ['constante', 'Amort. fija'], ['cuota', 'Cuota fija']].map(([k, t]) => `<button data-a="alt" data-alt="${k}" aria-pressed="${S.alt === k}">${t}</button>`).join('')}</div>
    <p class="muted tiny">Amort. fija: pagas el mismo capital cada año. Cuota fija: pagas la misma cuota cada año.</p>` : '';
  let filas = '';
  if (S.grupo === 'rent') {
    filas = filaKpi('van', 'VAN', dinero(a.van, m), conviene ? 'ok' : 'bad', conviene ? 'Conviene' : 'No conviene', x.van, celda('van'))
      + filaKpi('tir', 'TIR', a.tir === null ? 'No existe' : pct(a.tir), tt.usar === 'TIR' ? (a.tir > i ? 'ok' : 'bad') : 'warn', tt.usar === 'TIR' ? (a.tir > i ? 'Supera la tasa' : 'Bajo la tasa') : 'No usar', x.tir, celda('tir'))
      + filaKpi('tur', 'TUR', pct(a.tur), tt.usar === 'TUR' ? (a.tur > i ? 'ok' : 'bad') : 'info', tt.usar === 'TUR' ? (a.tur > i ? 'Recomendada' : 'Bajo la tasa') : 'Apoyo', x.tur, celda('tur'))
      + filaKpi('bc', 'B/C', num(a.bc, 2), a.bc >= 1 ? 'ok' : 'bad', a.bc >= 1 ? 'Mayor a 1' : 'Menor a 1', x.bc, celda('bc'));
  } else if (S.grupo === 'rec') {
    filas = filaKpi('tri', 'TRI (actualizado)', a.tri === null ? 'No recupera' : `${num(a.tri, 2)} años`, a.tri === null ? 'bad' : a.tri > R.n / 2 ? 'warn' : 'ok', a.tri === null ? 'No recupera' : a.tri > R.n / 2 ? 'Lento' : 'A tiempo', x.tri, celda('tri'))
      + filaKpi('tris', 'TRI simple', a.triSimple === null ? 'No recupera' : `${num(a.triSimple, 2)} años`, null, '', null)
      + R.ventas.map((v, j) => filaKpi(`pm${j}`, `Precio mínimo ${esc(v.nombre)}`, dinero(a.precioMin[j], m, 2), null, '', j === 0 ? x.precioMin : null)).join('')
      + (() => {
        // Margen exacto (bisección sobre el modelo completo) del flujo puro
        const c = S.alt === 'puro' ? S.sens?.criticos.find(x => x.clave === 'precio') : null;
        if (!c || c.margen === null) return '';
        const m = -c.margen;
        const [nv, pal] = margenNivel(m);
        return filaKpi('mp', m >= 0 ? 'Todos los precios pueden bajar' : 'Los precios deben subir', pct(Math.abs(m), 1), nv, pal, null);
      })();
  } else {
    filas = filaKpi('vac', 'VAC', dinero(a.vac, m), null, '', x.vac, celda('vac'))
      + filaKpi('cae', 'CAE', dinero(a.cae, m), null, '', x.vac, celda('cae'))
      + filaKpi('inv', 'Inversión inicial', dinero(R.inversionTotal, m), null, '', null)
      + filaKpi('ct', 'Capital de trabajo', dinero(R.ctTotal, m), null, '', null)
      + (R.hayPrestamo ? filaKpi('pr', 'Préstamo', dinero(R.montoPrestamo, m), null, '', null) : '');
  }
  const acum = []; let s = 0;
  a.filas.flujo.forEach((f, t) => { s += f / Math.pow(1 + i, t); acum.push(s); });
  const recs = recomendaciones(R, S.sim);
  return `
  <section class="elevada veredicto aparece" aria-live="polite">
    <div class="titulo" style="color:var(--${conviene ? 'ok' : 'bad'})">${icono(conviene ? 'check-circle' : 'x-circle')}<span>${conviene ? 'Conviene invertir' : 'No conviene invertir'}</span></div>
    <p>${conviene ? `Tu proyecto deja ${dinero(a.van, m)} por encima de lo que ganarías al ${pct(i)}.` : `Al ${pct(i)} el proyecto pierde ${dinero(-a.van, m)} de valor.`} Lee la <b>${tt.usar}</b>: ${pct(tt.valor)}.</p>
    ${altBtns}
  </section>
  ${S.verificado === false ? mensaje('warn', 'El VAN de la hoja Flujo no coincide con el del panel. Pulsa Recalcular todo.') : S.verificado ? mensaje('ok', 'Verificado: la hoja Flujo da el mismo VAN que el panel.') : ''}
  <section class="seccion">
    <div class="pills" role="group" aria-label="Grupo de indicadores">${[['rent', 'Rentabilidad'], ['rec', 'Recuperación'], ['cos', 'Costos']].map(([k, t]) => `<button class="pill" data-a="grupo" data-g="${k}" aria-pressed="${S.grupo === k}">${t}</button>`).join('')}</div>
    <div class="lista">${filas}</div>
  </section>
  <section class="seccion"><header><h2>Flujo por año</h2>${ir(P.DIRS.H.flujo, blq ? `A${blq.rows.fc}` : 'A1')}</header>
    ${G.graficoFlujo(a.filas.flujo, acum, m)}
    <div class="leyenda"><span><i style="background:var(--accent)"></i>Flujo positivo</span><span><i style="background:var(--bad)"></i>Negativo</span><span><i style="background:none;border-top:2px dashed var(--ink);height:0;border-radius:0"></i>Acumulado actualizado</span></div>
  </section>
  <section class="seccion"><h2>Recomendaciones</h2>
    <div>${recs.map(r => `<details class="acc" data-acc="rec-${r.id}"><summary>${est(r.nivel, '')}<span>${esc(r.titulo)}</span><span class="chev">${icono('caret-right')}</span></summary>
      <div class="cuerpo"><b class="small">${esc(r.resumen)}</b>${r.porque.map(t => `<p class="small">${esc(t)}</p>`).join('')}</div></details>`).join('')}</div>
  </section>`;
}

// ------------------------------------------------------------------ riesgo
const unidadDe = met => METRICAS[met].tipo; // dinero · pct · num · anios
const aVista = (met, v) => (v === null || v === undefined || v === '' ? '' : unidadDe(met) === 'pct' ? Math.round(v * 1e6) / 1e4 : v);
const deVista = (met, v) => (v === '' || v === null ? null : unidadDe(met) === 'pct' ? Number(v) / 100 : Number(v));

function vistaRiesgo() {
  if (!S.R) return `<div class="vacio">${icono('shield-warning')}<p>Primero completa los datos.</p>${btn('tab', 'Ir a Datos', { data: 'data-tab="datos"' })}</div>`;
  const seg = `<div class="segmento" role="group" aria-label="Vista de riesgo">${[['preguntas', 'Preguntas'], ['sensibilidad', 'Sensibilidad'], ['simulacion', 'Simulación']].map(([k, t]) => `<button data-a="vistaRiesgo" data-v="${k}" aria-pressed="${S.vistaRiesgo === k}">${t}</button>`).join('')}</div>`;
  const cuerpo = S.vistaRiesgo === 'sensibilidad' ? vistaSensibilidad() : S.vistaRiesgo === 'simulacion' ? vistaSimulacion() : vistaPreguntas();
  return seg + cuerpo;
}

function bloqueSimular() {
  if (S.simEst) {
    const f = S.simEst.hecho / S.simEst.N;
    return `<div class="seccion" aria-live="polite"><p class="small">Simulando ${num(S.simEst.hecho)} de ${num(S.simEst.N)} ensayos</p>
      <div class="progreso"><div style="transform:scaleX(${f})"></div></div>${btn('detener', 'Detener', { ic: 'stop' })}</div>`;
  }
  return '';
}

function vistaPreguntas() {
  if (!S.sim && !S.simEst) return `<div class="vacio">${icono('dice-five')}<p>Aún no hay simulación. Pulsa Simular (${num(S.ensayos)} ensayos, unos segundos) para responder preguntas de riesgo.</p>${btn('simular', 'Simular', { cls: 'primario', ic: 'play' })}</div>`;
  if (S.simEst) return bloqueSimular();
  const temas = [...new Set(SUGERIDAS.map(s => s.tema))];
  const q = S.q;
  const met = Object.entries(METRICAS).filter(([k]) => S.sim[k]);
  const r = S.resp;
  const st = r?.st;
  return `
  ${S.simDesact ? mensaje('warn', 'Cambiaste datos después de simular. Las respuestas son de los datos anteriores.', ` ${btn('simular', 'Simular de nuevo', { cls: 'texto' })}`) : ''}
  <section class="seccion">
    <div class="pills" role="group" aria-label="Temas">${temas.map(t => `<button class="pill" data-a="tema" data-t="${t}" aria-pressed="${S.tema === t}">${t}</button>`).join('')}</div>
    <div class="pills">${SUGERIDAS.filter(s => s.tema === S.tema).map(s => `<button class="pill" data-a="sugerida" data-id="${s.id}">${esc(s.texto)}</button>`).join('')}</div>
  </section>
  <section class="seccion">
    <div class="frase"><span>Probabilidad de que</span>
      <select data-campo="q.metrica" aria-label="Indicador">${met.map(([k, v]) => `<option value="${k}" ${q.metrica === k ? 'selected' : ''}>${v.nombre}</option>`).join('')}</select>
      <span>sea</span>
      <select data-campo="q.op" aria-label="Condición">${[['menor', 'menor que'], ['mayor', 'mayor que'], ['entre', 'entre'], ['menorIgual', 'menor o igual a'], ['seguridad', 'con seguridad de']].map(([k, t]) => `<option value="${k}" ${q.op === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </div>
    <div class="dos">
      ${campo('q.a', q.op === 'seguridad' ? 'Seguridad' : 'Valor', q.op === 'seguridad' ? q.a : aVista(q.metrica, q.a), { pct: q.op === 'seguridad', unidad: q.op === 'seguridad' ? '' : { dinero: moneda(), pct: '%', anios: 'años', num: '' }[unidadDe(q.metrica)] })}
      ${q.op === 'entre' ? campo('q.b', 'y', aVista(q.metrica, q.b), { unidad: { dinero: moneda(), pct: '%', anios: 'años', num: '' }[unidadDe(q.metrica)] }) : '<div></div>'}
    </div>
    ${btn('preguntar', 'Preguntar', { cls: 'primario ancho', ic: 'target' })}
  </section>
  ${r ? (r.error ? mensaje('bad', esc(r.error)) : `
  <section class="elevada aparece" id="respuesta" aria-live="polite">
    <div><p class="muted small">${esc(r.titulo)}</p><div class="heroe">${r.principal.texto}</div><p class="small">${esc(r.frase)}</p></div>
    ${r.nivel && r.nivel !== 'info' ? est(r.nivel, { ok: 'Riesgo bajo', warn: 'Riesgo moderado', bad: 'Riesgo alto' }[r.nivel]) : ''}
    ${graficoRespuesta(r)}
    ${r.empirica !== undefined && r.normal !== undefined ? `<div class="lista">
      <div class="fila"><span class="et small">Contando ensayos</span><span class="val">${esc(r.textos?.empirica ?? pct(r.empirica))}</span></div>
      <div class="fila"><span class="et small">Normal (método del curso)</span><span class="val">${esc(r.textos?.normal ?? pct(r.normal))}</span></div></div>` : ''}
    <dl class="porque"><div><dt>Qué se midió</dt><dd>${esc(r.porque.medido)}</dd></div>
      ${r.porque.causa ? `<div><dt>Qué lo causa</dt><dd>${esc(r.porque.causa)}</dd></div>` : ''}
      ${r.porque.hacer ? `<div><dt>Qué hacer</dt><dd>${esc(r.porque.hacer)}</dd></div>` : ''}</dl>
    ${S.excel && S.generado && r.excel ? `<div>${btn('aHoja', 'Escribir en la hoja', { cls: 'texto', ic: 'file-xls' })}</div>` : ''}
  </section>`) : ''}
  ${S.hist.length ? `<section class="seccion"><h2>Historial</h2><div class="lista">
    ${S.hist.slice(0, 5).map((h, k) => `<div class="fila ${h.viejo ? 'desactualizado' : ''}"><span class="et small">${esc(h.titulo)}</span><span class="val small">${esc(h.valor)}</span>
      <button class="porque-btn" data-a="repetir" data-k="${k}" aria-label="Repetir">${icono('arrow-clockwise')}</button></div>`).join('')}</div>
    ${S.hist.length > 5 ? `<details class="acc"><summary>Anteriores (${S.hist.length - 5})<span class="chev">${icono('caret-right')}</span></summary><div class="cuerpo">${S.hist.slice(5).map(h => `<p class="small">${esc(h.titulo)}: ${esc(h.valor)}</p>`).join('')}</div></details>` : ''}
  </section>` : ''}`;
}

function graficoRespuesta(r) {
  const g = r.grafico;
  if (!g) return '';
  const fm = v => (METRICAS[g.metrica]?.tipo === 'pct' ? pct(v, 1) : METRICAS[g.metrica]?.tipo === 'num' ? num(v, 2) : METRICAS[g.metrica]?.tipo === 'anios' ? num(v, 1) : corto(v));
  if (g.tipo === 'histograma') {
    const st = estadisticos(S.sim[g.metrica]);
    if (!st) return '';
    // La zona es "mala" (roja) cuando la pregunta es por un resultado por debajo de una meta
    return G.graficoHistograma(histograma(st.ordenado, 30), { zona: g.zona, malo: r.q?.op === 'menor', formato: fm });
  }
  if (g.tipo === 'acumulada') return G.graficoAcumulada(estadisticos(S.sim[g.metrica]).ordenado, { marca: g.marca, prob: g.prob, formato: fm });
  if (g.tipo === 'tornado' && S.sens) return G.graficoTornado(S.sens.tornado, S.sens.base);
  if (g.tipo === 'comparar') {
    const st = estadisticos(S.sim.vanF);
    return G.graficoHistograma(histograma(st.ordenado, 30), { zona: { desde: -Infinity, hasta: 0 }, malo: true });
  }
  return '';
}

function vistaSensibilidad() {
  const s = S.sens, m = moneda();
  return `
  <section class="seccion"><header><h2>Tornado (±10 %)</h2>${ir(P.DIRS.H.riesgo, 'A4')}</header>
    <p class="muted small">Cuánto cambia el VAN si cada variable se mueve 10 % hacia cada lado, con las demás fijas. Arriba, la que más pesa.</p>
    ${G.graficoTornado(s.tornado, s.base)}
  </section>
  <section class="seccion"><h2>Puntos críticos</h2>
    <div class="lista">${s.criticos.map(c => `<div class="fila"><span class="et small">${esc(c.nombre)}</span>${c.margen === null ? '<span class="val small muted">No llega</span>' : `<span class="val small">${c.margen > 0 ? '+' : ''}${pct(c.margen, 1)}</span>${est(...margenNivel(Math.abs(c.margen)))}`}</div>`).join('')}</div>
    <p class="muted small">Cambio que deja el VAN en 0. Ejemplo: "${esc(s.criticos[0]?.nombre || '')}" puede ${s.criticos[0]?.margen < 0 ? 'bajar' : 'subir'} ${s.criticos[0]?.margen === null ? 'sin límite' : pct(Math.abs(s.criticos[0]?.margen || 0), 1)} antes de que el proyecto deje de convenir.</p>
  </section>
  <section class="seccion"><header><h2>Análisis de araña</h2>${ir(P.DIRS.H.riesgo, 'A15')}</header>
    <p class="muted small">Cada línea mueve una sola variable de -30 % a +30 %. Más inclinada = más sensible. La línea roja es VAN = 0.</p>
    ${G.graficoArana(s.arana, s.pasos)}${G.leyendaArana(s.arana)}
  </section>
  <section class="seccion"><h2>Escenarios</h2>
    <table class="tabla"><thead><tr><th>Escenario</th><th class="n">VAN</th><th class="n">TIR</th><th class="n">B/C</th></tr></thead><tbody>
    ${S.esc.map(e => `<tr><td>${{ pesimista: 'Pesimista', base: 'Más probable', optimista: 'Optimista' }[e.tipo]}</td><td class="n ${e.van < 0 ? 'bad-t' : ''}">${corto(e.van, m)}</td><td class="n">${pct(e.tir, 1)}</td><td class="n">${num(e.bc, 2)}</td></tr>`).join('')}</tbody></table>
    <p class="muted small">El pesimista pone todas las variables en su peor valor a la vez. Es posible pero muy improbable, por eso su VAN puede ser negativo aunque el riesgo de la simulación sea bajo.</p>
  </section>`;
}

function vistaSimulacion() {
  const cfg = S.datos.riesgo?.variables || {};
  const vars = VARIABLES.filter(v => S.R.hayPrestamo || !v.soloFinanciado);
  const st = S.simSt;
  const m = moneda();
  return `
  <section class="seccion"><h2>Rangos de cada variable</h2>
    <p class="muted small">Como % del valor base: 90 % significa 10 % menos. Distribución triangular (mínimo, más probable, máximo).</p>
    <table class="tabla"><thead><tr><th>Variable</th><th class="n">Mín.</th><th class="n">Más prob.</th><th class="n">Máx.</th><th>Incluir</th></tr></thead><tbody>
    ${vars.map(v => { const c = { ...RANGO_DEFECTO, ...(cfg[v.clave] || {}) }; return `<tr><td class="small">${v.corto}</td>
      ${['min', 'moda', 'max'].map(k => `<td class="n"><input type="number" step="1" style="width:56px;height:28px" aria-label="${v.corto} ${k}" value="${Math.round(c[k] * 100)}" data-campo="rg.${v.clave}.${k}"></td>`).join('')}
      <td><input type="checkbox" aria-label="Incluir ${v.corto}" ${c.incluir !== false ? 'checked' : ''} data-campo="rg.${v.clave}.incluir"></td></tr>`; }).join('')}
    </tbody></table>
    <div class="dos">${campo('ensayos', 'Ensayos', String(S.ensayos), { opciones: ['1000', '5000', '10000', '20000'] })}${campo('semilla', 'Semilla', S.semilla, { paso: 1 })}</div>
    ${S.simEst ? bloqueSimular() : btn('simular', S.sim ? 'Simular de nuevo' : 'Simular', { cls: 'primario ancho', ic: 'play' })}
  </section>
  ${st ? `<section class="seccion ${S.simDesact ? 'desactualizado' : ''}"><header><h2>Resultado (${num(st.n)} ensayos)</h2>${ir(P.DIRS.H.riesgo, 'A44')}</header>
    <div class="lista">
      <div class="fila"><span class="et">VAN medio</span><span class="val">${dinero(st.media, m)}</span></div>
      <div class="fila"><span class="et">Desviación estándar</span><span class="val">${dinero(st.sd, m)}</span></div>
      <div class="fila"><span class="et">Coeficiente de variación</span><span class="val">${num(st.cv, 2)}</span></div>
      <div class="fila"><span class="et">90 % central</span><span class="val small">${corto(st.p5, m)} a ${corto(st.p95, m)}</span></div>
      <div class="fila"><span class="et">P(VAN &lt; 0)</span><span class="val">${pct(proporcion(S.sim.van, v => v < 0).p)}</span></div>
      <div class="fila"><span class="et">Precisión de la media</span><span class="val">${pct(st.errorPrecision)}</span></div>
    </div>
    ${G.graficoHistograma(histograma(st.ordenado, 30), { zona: { desde: -Infinity, hasta: 0 }, malo: true })}
    <p class="muted small">En rojo, los ensayos con VAN negativo.</p></section>` : ''}`;
}

function vistaDiagnostico() {
  const R = S.R;
  if (!R) return `<div class="vacio">${icono('clipboard-text')}<p>Primero completa los datos.</p>${btn('tab', 'Ir a Datos', { data: 'data-tab="datos"' })}</div>`;
  const al = alertas(R, S.sim);
  const recs = recomendaciones(R, S.sim);
  const fuertes = [...recs, ...al].filter(x => x.nivel === 'ok').length;
  const malas = al.filter(x => x.nivel === 'bad' || x.nivel === 'warn').length;
  const tt = tirOTur(R[S.alt], R.tasa);
  const plan = planDelFlujo(R, S.alt);
  const m = moneda();
  return `
  <section class="seccion"><div class="fila" style="padding:0">${est('ok', `${fuertes} fortaleza${fuertes === 1 ? '' : 's'}`)}${est(malas ? 'warn' : 'ok', `${malas} alerta${malas === 1 ? '' : 's'}`)}</div></section>
  <section class="seccion"><h2>Alertas y punto de equilibrio</h2>
    ${al.length ? al.map(a => mensaje(a.nivel, `<b>${esc(a.titulo)}</b><br>${esc(a.porque)}`)).join('') : mensaje('ok', 'Sin alertas.')}</section>
  <section class="seccion"><h2>¿TIR o TUR?</h2>
    <div class="elevada" style="box-shadow:none"><h3>Usa la ${tt.usar} (${pct(tt.valor)})</h3>${tt.razones.map(t => `<p class="small">${esc(t)}</p>`).join('')}</div></section>
  <section class="seccion"><header><h2>Plan del flujo, año por año</h2>${ir(P.DIRS.H.diag, 'A1')}</header>
    <div class="lista">${plan.map(p => `<div class="fila" style="align-items:flex-start;flex-direction:column;gap:2px">
      <div style="display:flex;width:100%;gap:8px"><b>Año ${p.anio}</b><span class="val" style="margin-left:auto">${dinero(p.flujo, m)}</span></div>
      <p class="small muted">${esc(p.texto)}</p>${p.hito ? est('ok', p.hito) : ''}</div>`).join('')}</div></section>
  <section class="seccion"><h2>Reglas del flujo</h2>
    <div>${reglasDelFlujo(R).map((x, i) => `<details class="acc" data-acc="regla${i}"><summary>${esc(x.titulo)}<span class="chev">${icono('caret-right')}</span></summary><div class="cuerpo"><p class="small">${esc(x.texto)}</p></div></details>`).join('')}</div></section>
  <section class="seccion">${btn('copiar', 'Copiar resumen', { cls: 'ancho', ic: 'copy' })}<p class="muted small">Texto listo para pegar en tu informe.</p></section>`;
}

// ------------------------------------------------------------------ render
const app = document.getElementById('app');
function render() {
  const vistas = { inicio: vistaInicio, datos: vistaDatos, resultados: vistaResultados, riesgo: vistaRiesgo, diagnostico: vistaDiagnostico };
  const foco = S.foco || document.activeElement?.dataset?.campo;
  app.innerHTML = `
  <nav class="tabs" role="tablist" aria-label="Secciones">${TABS.map(([k, t, ic]) => `<button class="tab" role="tab" data-a="tab" data-tab="${k}" aria-selected="${S.tab === k}" title="${t}">${icono(ic)}<span class="lbl">${t}</span></button>`).join('')}</nav>
  ${barraEstado()}
  <main class="main" role="tabpanel">${S.msg ? `<div id="msg">${mensaje(S.msg.nivel, esc(S.msg.texto))}</div>` : ''}${vistas[S.tab]()}</main>`;
  // Acordeones: se conservan abiertos o cerrados entre renders
  app.querySelectorAll('details[data-acc]').forEach(d => { if (S.acc[d.dataset.acc] !== undefined) d.open = S.acc[d.dataset.acc]; });
  if (foco) { const el = app.querySelector(`[data-campo="${foco}"]`); if (el) { el.focus({ preventScroll: true }); if (el.select && el.type !== 'checkbox' && el.tagName === 'INPUT') { const v = el.value; el.value = ''; el.value = v; } } }
  // Lleva a la vista lo nuevo: una respuesta de riesgo o un mensaje
  if (S.mostrar) { const el = app.querySelector(S.mostrar); S.mostrar = null; el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
}
document.addEventListener('focusin', e => { S.foco = e.target.dataset?.campo || null; });
document.addEventListener('toggle', e => { const d = e.target; if (d.dataset?.acc) S.acc[d.dataset.acc] = d.open; }, true);
function barraEstado() {
  if (S.ocupado) return `<div class="estado" aria-live="polite">${icono('circle-dashed')}<span class="grow">${esc(S.ocupado)}</span></div>`;
  if (S.desact && S.generado && S.excel) return `<div class="estado aviso">${icono('warning')}<span class="grow">Datos cambiaron. Las fórmulas ya se actualizaron; riesgo y diagnóstico no.</span>${btn('generar', 'Recalcular', { cls: 'texto' })}</div>`;
  if (!S.datos) return `<div class="estado">${icono('circle-dashed')}<span class="grow">Sin datos todavía</span></div>`;
  const ok = !S.val.errores.length;
  return `<div class="estado">${icono(ok ? 'check-circle' : 'warning')}<span class="grow">${ok ? 'Datos completos' : `${S.val.errores.length} dato${S.val.errores.length > 1 ? 's' : ''} por completar`}${S.calculado ? ` · Calculado ${S.calculado}` : ''} · ${moneda()}</span></div>`;
}

// ------------------------------------------------------------------ acciones
async function conCarga(texto, fn) {
  S.ocupado = texto; S.msg = null; render();
  try { await fn(); } catch (e) { console.error(e); S.msg = { nivel: 'bad', texto: `No se pudo completar: ${e.message || e}. Tus datos no cambiaron.` }; S.mostrar = '#msg'; }
  S.ocupado = null; render();
}

async function cargarDatos(datos, { escribir = true } = {}) {
  S.datos = clonar(datos);
  S.sim = null; S.simSt = null; S.resp = null; S.hist = []; S.verificado = null;
  // Si ya había hojas generadas, siguen enlazadas a Datos; riesgo y diagnóstico quedan por recalcular
  S.desact = S.generado;
  recomputar();
  if (S.excel && escribir) {
    await P.escribirDatos(S.datos);
    S.libro.tieneDatos = true;
    vigilar();
  }
  S.tab = 'datos';
}

// Ajusta columnas visibles solo si cambió la vida útil o el plazo (cada escritura borra el deshacer de Excel)
async function vistaSiCambio(forzar = false) {
  if (!S.excel || !S.datos) return;
  const p = S.datos.prestamo || {};
  const clave = `${S.datos.proyecto?.n}|${p.plazo}|${p.tipoTasa}`;
  if (!forzar && clave === S.vistaClave) return;
  S.vistaClave = clave;
  await P.ajustarVista(S.datos);
}

async function vigilar() {
  if (S.vigilando || !S.excel) return;
  const ok = await P.vigilarDatos(async () => {
    const d = await P.leerDatosHoja();
    if (!d) return;
    S.datos = d; recomputar();
    S.desact = true; if (S.sim) S.simDesact = true;
    await vistaSiCambio();
    S.hist.forEach(h => { h.viejo = true; });
    render();
  });
  S.vigilando = !!ok;
}

async function simular() {
  if (!S.R) return;
  const ctl = P.simularEnFondo(clonar(S.datos), { ensayos: S.ensayos, semilla: S.semilla, onProgreso: (h, N) => { S.simEst = { hecho: h, N }; render(); } });
  S.simCtl = ctl; S.simEst = { hecho: 0, N: S.ensayos }; render();
  const sim = await ctl.promesa;
  S.sim = sim; S.simEst = null; S.simCtl = null; S.simDesact = false;
  S.simSt = estadisticos(sim.van);
  if (S.resp && !S.resp.error) S.resp = responder(S.resp.q || S.q, S.sim, ctx());
  if (S.excel && S.generado) await conCarga('Escribiendo la simulación en la hoja Riesgo', () => P.escribirRiesgo(S.datos, S.sim));
  render();
}

async function generar() {
  recomputar();
  if (S.val.errores.length) { S.tab = 'datos'; render(); return; }
  if (!S.sim || S.simDesact) await simular();
  if (!S.excel) { S.generado = true; S.desact = false; S.tab = 'resultados'; render(); return; }
  await conCarga('Generando las hojas del análisis', async () => {
    await P.generarLibro(S.datos, { sim: S.sim, conservarDatos: S.libro.tieneDatos, progreso: (t) => { S.ocupado = t; render(); } });
    S.generado = true; S.desact = false; S.libro.tieneDatos = true;
    const v = await P.vanDeLaHoja();
    S.verificado = v === null ? null : Math.abs(v - S.R.puro.van) < 0.5;
    vigilar();
  });
  S.tab = 'resultados';
  render();
}

function preguntar(q = S.q) {
  if (!S.sim) return;
  if (!q.tipo) S.q = { ...q };
  const r = responder(q.tipo ? q : S.q, S.sim, ctx());
  S.resp = r;
  S.mostrar = '#respuesta';
  if (!r.error) S.hist.unshift({ titulo: r.titulo, valor: r.principal.texto, q: { ...(q.tipo ? q : S.q) }, viejo: false });
  if (S.hist.length > 30) S.hist.length = 30;
}

function textoResumen() {
  const R = S.R, m = moneda(), a = R.puro, tt = tirOTur(a, R.tasa);
  const lineas = [
    `${R.D.proyecto.nombre}. Evaluación a ${R.n} años con una tasa de descuento de ${pct(R.tasa)}.`,
    `VAN ${dinero(a.van, m)}, ${tt.usar} ${pct(tt.valor)}, B/C ${num(a.bc, 2)}, TRI ${fAnios(a.tri)}.`,
    `${a.van >= 0 ? 'El proyecto conviene' : 'El proyecto no conviene'}. Se usa la ${tt.usar} porque: ${tt.razones[0]}`,
  ];
  if (R.hayPrestamo) { const f = R.cuota.van >= R.constante.van ? R.cuota : R.constante; lineas.push(`Con financiamiento el VAN es ${dinero(f.van, m)} (${f.sistema === 'cuota' ? 'cuota fija' : 'amortización constante'}).`); }
  if (S.sim) {
    const r = responder({ metrica: 'van', op: 'menor', a: 0 }, S.sim, ctx());
    lineas.push(`Riesgo: en ${num(S.sim.N)} ensayos de Monte Carlo, la probabilidad de VAN negativo es ${pct(r.normal)} (aproximación normal) y ${pct(r.empirica)} contando ensayos. ${r.porque.causa}`);
  }
  if (S.sens?.tornado[0]) lineas.push(`La variable más sensible es ${S.sens.tornado[0].nombre.toLowerCase()}.`);
  return lineas.join('\n');
}

function setRuta(obj, ruta, v) { const k = ruta.split('.'); let o = obj; k.slice(0, -1).forEach(x => { o[x] ??= /^\d+$/.test(x) ? {} : {}; o = o[x]; }); o[k[k.length - 1]] = v; }

const CELDAS = {
  nombre: `B${P.DIRS.R.nombre}`, n: `B${P.DIRS.R.vida}`, moneda: `B${P.DIRS.R.moneda}`, tasa: `B${P.DIRS.R.tasa}`, iue: `B${P.DIRS.R.iue}`,
  ctModo: `B${P.DIRS.R.ctModo}`, ct: `B${P.DIRS.R.ct}`,
  'pr.monto': `B${P.DIRS.R.fin.monto}`, 'pr.pctInversion': `B${P.DIRS.R.fin.pct}`, 'pr.tasa': `B${P.DIRS.R.fin.tasa}`, 'pr.tipoTasa': `B${P.DIRS.R.fin.tipo}`,
  'pr.plazo': `B${P.DIRS.R.fin.plazo}`, 'pr.gracia': `B${P.DIRS.R.fin.gracia}`,
};
const COL_PROD = { nombre: 'A', unidad: 'B', precio: 'C', crecPrecio: 'D', cvu: 'E', capacidad: 'F' };
// Fila (0..9) del producto j en la tabla de Datos; leer.js la guarda por si hay filas vacías entre productos
const filaProd = j => S.datos.productos[j]?.fila ?? j;

async function cambiarCampo(el) {
  const c = el.dataset.campo;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (c === 'ejemplo') { S.ejemplo = v; return; }
  if (c === 'ensayos') { S.ensayos = Number(v); return; }
  if (c === 'semilla') { S.semilla = Number(v) || 2026; return; }
  if (c.startsWith('q.')) {
    const k = c.slice(2);
    if (k === 'metrica') { S.q.metrica = v; S.q.a = { van: 0, vanF: 0, tir: 0.18, tirF: 0.18, tur: S.R.tasa, bc: 1, tri: Math.round(S.R.n / 2) }[v]; S.q.b = null; }
    else if (k === 'op') { S.q.op = v; if (v === 'seguridad') S.q.a = 0.9; if (v === 'entre' && S.sim) { const st = estadisticos(S.sim[S.q.metrica]); if (st) { S.q.a = redondear(S.q.metrica, st.p25); S.q.b = redondear(S.q.metrica, st.p75); } } }
    else if (k === 'a') S.q.a = S.q.op === 'seguridad' ? Number(v) / 100 : deVista(S.q.metrica, v);
    else if (k === 'b') S.q.b = deVista(S.q.metrica, v);
    render(); return;
  }
  if (c.startsWith('rg.')) {
    const [, clave, k] = c.split('.');
    S.datos.riesgo ??= {}; S.datos.riesgo.variables ??= {};
    const cur = { ...RANGO_DEFECTO, ...(S.datos.riesgo.variables[clave] || {}) };
    cur[k] = k === 'incluir' ? v : Number(v) / 100;
    S.datos.riesgo.variables[clave] = cur;
    S.simDesact = !!S.sim;
    if (S.excel && S.libro.tieneDatos) {
      const i = VARIABLES.findIndex(x => x.clave === clave);
      const col = { min: 'B', moda: 'C', max: 'D', incluir: 'F' }[k];
      await P.escribirCelda(`${col}${P.DIRS.R.riesgo.ini + i}`, k === 'incluir' ? (v ? 'Sí' : 'No') : cur[k]);
    }
    recomputar(); render(); return;
  }
  // Campos de datos
  if (el.dataset.pct) v = v === '' ? null : Number(v) / 100;
  else if (el.type === 'number') v = v === '' ? null : Number(v);
  let celda = null, valorCelda = v;
  if (c.startsWith('prod.') && c.endsWith('.serie')) {
    const j = Number(c.split('.')[1]);
    const n = S.datos.proyecto?.n || 20;
    const u = leerSerie(el.value).slice(0, 20);
    S.datos.productos[j].unidades = Array.from({ length: 20 }, (_, t) => (t < u.length ? u[t] : null));
    recomputar(); if (S.sim) S.simDesact = true; render();
    if (S.excel && S.libro.tieneDatos) {
      const fila = P.DIRS.R.unid.ini + filaProd(j);
      await P.escribirRango(`C${fila}:V${fila}`, [Array.from({ length: 20 }, (_, t) => (t < u.length ? u[t] : ''))]);
    }
    if (u.length && u.length !== n) { S.msg = { nivel: 'warn', texto: `Escribiste ${u.length} valores y el proyecto dura ${n} años.` }; S.mostrar = '#msg'; render(); }
    return;
  }
  if (c.startsWith('prod.')) {
    const [, j, k] = c.split('.');
    S.datos.productos[j][k] = v;
    celda = `${COL_PROD[k]}${P.DIRS.R.prod.ini + filaProd(Number(j))}`;
  } else if (c.startsWith('pr.')) {
    const k = c.slice(3);
    S.datos.prestamo ??= {};
    if (k === 'tipoTasa') { S.datos.prestamo.tipoTasa = v.startsWith('Nominal') ? 'nominal' : 'efectiva'; }
    else S.datos.prestamo[k] = v;
    celda = CELDAS[c];
  } else {
    S.datos.proyecto ??= {};
    if (c === 'ctModo') S.datos.proyecto.ctModo = v.startsWith('Meses') ? 'meses' : 'pct';
    else S.datos.proyecto[c] = v;
    celda = CELDAS[c];
  }
  recomputar();
  if (S.sim) S.simDesact = true;
  render();
  if (S.excel && S.libro.tieneDatos && celda) await P.escribirCelda(celda, valorCelda);
}

document.addEventListener('change', e => { if (e.target.dataset?.campo) cambiarCampo(e.target); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.abierto) { S.abierto = null; render(); }
  if (e.key === 'Enter' && e.target.dataset?.campo?.startsWith('q.')) { cambiarCampo(e.target).then(() => { preguntar(); render(); }); }
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const a = el.dataset.a;
  switch (a) {
    case 'tab': S.tab = el.dataset.tab; S.msg = null; S.abierto = null; render(); window.scrollTo(0, 0); break;
    case 'ejemplo': await conCarga('Cargando el ejemplo', () => cargarDatos(EJEMPLOS[S.ejemplo].datos)); break;
    case 'vacia': await conCarga('Creando la plantilla vacía', () => cargarDatos({ proyecto: { nombre: 'Mi proyecto', moneda: 'Bs', n: 5, iue: 0.25, ctModo: 'pct' }, productos: [{ nombre: 'Producto 1', unidad: 'u' }] })); break;
    case 'leer': await conCarga('Leyendo tu hoja', async () => {
      const info = await P.explorarLibro(); S.libro = info;
      if (info.tieneDatos) { await cargarDatos(await P.leerDatosHoja(), { escribir: false }); S.generado = info.generado; vigilar(); }
      else if (info.plantilla) { await cargarDatos(await P.leerPlantillaClase(info.plantilla)); S.mostrar = '#msg'; S.msg = { nivel: 'ok', texto: `Importé la hoja ${info.plantilla} a la hoja Datos. Revisa y pulsa Generar análisis.` }; }
      else S.msg = { nivel: 'warn', texto: 'No encontré la hoja Datos ni la plantilla de clase. Usa Plantilla vacía para empezar.' };
    }); break;
    case 'generar': await generar(); break;
    case 'alt': S.alt = el.dataset.alt; S.abierto = null; render(); break;
    case 'grupo': S.grupo = el.dataset.g; S.abierto = null; render(); break;
    case 'porque': S.abierto = S.abierto === el.dataset.id ? null : el.dataset.id; render(); break;
    case 'ir': try { await P.irA(el.dataset.hoja, el.dataset.celda); } catch (err) { S.msg = { nivel: 'warn', texto: 'No encontré esa hoja. Pulsa Recalcular todo.' }; render(); } break;
    case 'agregarProd': {
      // Primera fila libre de la tabla de productos (puede haber huecos si se borró una fila en la hoja)
      const usadas = new Set(S.datos.productos.map((_, j) => filaProd(j)));
      const fila = [...Array(10).keys()].find(i => !usadas.has(i));
      if (fila === undefined) break;
      const nombre = `Producto ${S.datos.productos.length + 1}`;
      S.datos.productos.push({ nombre, unidad: 'u', pct: [], unidades: [], fila });
      if (S.excel && S.libro.tieneDatos) await P.escribirCelda(`A${P.DIRS.R.prod.ini + fila}`, nombre);
      recomputar(); render(); break;
    }
    case 'quitarProd': {
      const j = Number(el.dataset.j);
      S.datos.productos.splice(j, 1);
      S.datos.productos.forEach((x, i) => { x.fila = i; }); // escribirDatos los deja seguidos
      if (S.excel && S.libro.tieneDatos) { await conCarga('Actualizando la hoja Datos', () => P.escribirDatos(S.datos)); S.desact = S.generado; }
      recomputar(); render(); break;
    }
    case 'vistaRiesgo': S.vistaRiesgo = el.dataset.v; render(); break;
    case 'simular': await simular(); break;
    case 'detener': S.simCtl?.detener(); break;
    case 'tema': S.tema = el.dataset.t; render(); break;
    case 'sugerida': {
      const s = SUGERIDAS.find(x => x.id === el.dataset.id);
      if (s.q.tipo) { preguntar(s.q); }
      else { const q = { ...s.q }; if (typeof q.a === 'string' || typeof q.b === 'string') { const r = responder(q, S.sim, ctx()); Object.assign(q, r.q || {}); } S.q = { metrica: q.metrica, op: q.op, a: q.a, b: q.b ?? null }; preguntar(S.q); }
      render(); break;
    }
    case 'preguntar': preguntar(); render(); break;
    case 'repetir': { const h = S.hist[Number(el.dataset.k)]; preguntar(h.q); render(); break; }
    case 'aHoja': await conCarga('Escribiendo la pregunta en la hoja Riesgo', async () => {
      const r = S.resp;
      const fila = (P.DIRS.RIESGO.ultPregunta ?? (P.DIRS.RIESGO.preg + (S.R.hayPrestamo ? 7 : 6))) + 1;
      // Las fórmulas apuntan a las celdas X e Y de la misma fila: si las cambias, se recalcula
      const X_ = `B${fila}`, Y_ = `C${fila}`;
      const v = [r.titulo, r.q?.a ?? '', r.q?.op === 'entre' ? r.q.b : '', r.excel.empirica(X_, Y_), r.excel.normal(X_, Y_), ''];
      v.formato = r.excel.formato;
      const X = await import('./excel/office.js');
      await X.agregarPregunta(fila, v);
      P.DIRS.RIESGO.ultPregunta = fila;
    }); break;
    case 'copiar': {
      const texto = textoResumen();
      let ok = false;
      try { await navigator.clipboard.writeText(texto); ok = true; } catch {
        // El panel de Office a veces no deja usar el portapapeles moderno
        const ta = document.createElement('textarea'); ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        ta.remove();
      }
      S.msg = ok ? { nivel: 'ok', texto: 'Resumen copiado. Pégalo en tu informe.' } : { nivel: 'warn', texto: 'No se pudo copiar. Copia el texto de la hoja Diagnóstico.' };
      S.mostrar = '#msg'; render(); break;
    }
    default:
  }
});

// ------------------------------------------------------------------ inicio
function aplicarTema() {
  let oscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  try {
    const bg = Office?.context?.officeTheme?.bodyBackgroundColor;
    if (bg) { const h = bg.replace('#', ''); const l = (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255; oscuro = l < 0.4; }
  } catch { /* fuera de Office */ }
  const q = new URLSearchParams(location.search).get('tema');
  document.documentElement.dataset.theme = q || (oscuro ? 'dark' : 'light');
}

(async function arrancar() {
  render();
  S.excel = await P.iniciarOffice();
  aplicarTema();
  if (S.excel) {
    try {
      S.libro = await P.explorarLibro();
      if (S.libro.tieneDatos) {
        S.datos = await P.leerDatosHoja();
        recomputar();
        S.generado = S.libro.generado;
        vigilar();
        await vistaSiCambio(true); // por si la vida útil cambió con el panel cerrado
        if (S.R && S.generado) S.tab = 'resultados';
      }
    } catch (e) { console.warn(e); }
  } else {
    const ej = new URLSearchParams(location.search).get('ejemplo');
    if (ej && EJEMPLOS[ej]) { await cargarDatos(EJEMPLOS[ej].datos, { escribir: false }); }
  }
  render();
})();
