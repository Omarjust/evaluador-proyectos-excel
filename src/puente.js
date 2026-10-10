/* global Office */
// Puente entre el panel y Excel. Sin Excel (navegador o vista previa) funciona en modo demostración.
import * as X from './excel/office.js';
import { construirLibro } from './excel/libro.js';
import { hojaDatos } from './excel/hojaDatos.js';
import { parsearDatos, RANGO_DATOS, esPlantillaClase, parsearPlantillaClase } from './excel/leer.js';
import { H, DATOS as R } from './excel/mapa.js';
import { FLUJO, VACCAE, COMPARADOR } from './excel/hojasCalculo.js';
import { RIESGO } from './excel/hojaRiesgo.js';
import { normalizar } from './motor/modelo.js';
import { prepararSimulacion } from './motor/montecarlo.js';

export const enExcel = () => X.disponible();

export async function iniciarOffice() {
  if (typeof Office === 'undefined') return false;
  return new Promise(res => {
    // Excel web o Mac pueden tardar en el primer arranque: se espera hasta 20 s antes de pasar a modo demostración
    const t = setTimeout(() => res(false), 20000);
    Office.onReady(info => { clearTimeout(t); res(info.host === Office.HostType.Excel); });
  });
}

// ¿Hay hoja Datos? ¿Hay una plantilla de clase en el libro?
export async function explorarLibro() {
  const nombres = await X.hojasExistentes();
  const tieneDatos = nombres.includes(H.datos);
  const generado = nombres.includes(H.flujo);
  let plantilla = null;
  if (!tieneDatos) {
    for (const n of nombres) {
      const v = await X.leerRango(n, 'A1:L46');
      if (v && esPlantillaClase(v)) { plantilla = n; break; }
    }
  }
  return { nombres, tieneDatos, generado, plantilla };
}

export async function leerDatosHoja() {
  const v = await X.leerRango(H.datos, RANGO_DATOS);
  return v ? parsearDatos(v) : null;
}
export async function leerPlantillaClase(nombre) {
  const v = await X.leerRango(nombre, 'A1:L46');
  return parsearPlantillaClase(v, nombre);
}

// Escribe solo la hoja Datos (ejemplo, plantilla vacía o importación)
export async function escribirDatos(datos) {
  await X.escribirLibro([hojaDatos(normalizar(datos))], { parcial: true });
  await X.irA(H.datos, 'B5');
}

// Escribe una celda de Datos (formulario del panel → hoja)
export async function escribirCelda(addr, valor) {
  return Excel.run(async ctx => {
    ctx.workbook.worksheets.getItem(H.datos).getRange(addr).values = [[valor === null || valor === undefined ? '' : valor]];
    await ctx.sync();
  });
}

// Genera todas las hojas (Datos se conserva si ya existe)
export async function generarLibro(datos, { sim, conservarDatos, progreso }) {
  // Conserva lo que el estudiante escribió en el comparador VAC y en las preguntas
  const [comp, preg] = await X.leerVarios([
    { hoja: H.vac, addr: COMPARADOR.entradas() },
    { hoja: H.riesgo, addr: `B${RIESGO.preg}:C${RIESGO.preg + 7}` },
  ]);
  const previas = {};
  if (preg) preg.forEach((f, i) => { if (f[0] !== '') previas[`${RIESGO.preg + i}B`] = f[0]; if (f[1] !== '') previas[`${RIESGO.preg + i}C`] = f[1]; });
  // Filas 1 a 6 del comparador (la tasa se vuelve a enlazar con la de Datos)
  const comparador = comp ? comp.slice(0, 6).map(f => f.map(v => (v === '' ? undefined : v))) : null;
  const hayComp = comparador?.some((f, i) => i < 5 && f.some(v => v !== undefined));
  const libro = construirLibro(datos, { sim, incluirDatos: !conservarDatos, comparador: hayComp ? comparador : null, previas });
  await X.escribirLibro(libro.hojas, { progreso });
  return libro;
}

// Reescribe solo Riesgo, _MC y Diagnóstico (después de simular)
export async function escribirRiesgo(datos, sim) {
  const libro = construirLibro(datos, { sim, incluirDatos: false });
  const parte = libro.hojas.filter(h => [H.riesgo, H.mc, H.diag].includes(h.nombre));
  const [preg] = await X.leerVarios([{ hoja: H.riesgo, addr: `B${RIESGO.preg}:C${RIESGO.preg + 7}` }]);
  if (preg) {
    const previas = {};
    preg.forEach((f, i) => { if (f[0] !== '') previas[`${RIESGO.preg + i}B`] = f[0]; if (f[1] !== '') previas[`${RIESGO.preg + i}C`] = f[1]; });
    const l2 = construirLibro(datos, { sim, incluirDatos: false, previas });
    parte.splice(0, parte.length, ...l2.hojas.filter(h => [H.riesgo, H.mc, H.diag].includes(h.nombre)));
  }
  await X.escribirLibro(parte, { parcial: true });
}

// VAN que calculó Excel (para verificar que la hoja y el motor coinciden)
export async function vanDeLaHoja() {
  const fila = FLUJO.bloques.puro?.ind.van;
  if (!fila) return null;
  const v = await X.leerRango(H.flujo, `Y${fila}`);
  return v && typeof v[0][0] === 'number' ? v[0][0] : null;
}

export const irA = X.irA;
export const vigilarDatos = X.vigilarDatos;
export const DIRS = { R, FLUJO, VACCAE, RIESGO, H };

// Monte Carlo: Web Worker si existe; si no, por bloques en el hilo principal
export function simularEnFondo(datos, { ensayos, semilla, onProgreso }) {
  let worker = null, parar = false;
  const promesa = new Promise((resolve, reject) => {
    try {
      worker = new Worker(new URL('./motor/mc.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = e => {
        if (e.data.tipo === 'progreso') onProgreso(e.data.hecho, e.data.N);
        else if (e.data.tipo === 'fin') { worker.terminate(); resolve(recortar(e.data.salida)); }
      };
      worker.onerror = () => { worker.terminate(); worker = null; enHilo().then(resolve, reject); };
      worker.postMessage({ datos, ensayos, semilla });
    } catch (e) { enHilo().then(resolve, reject); }
  });
  function enHilo() {
    return new Promise(resolve => {
      const { salida, correr } = prepararSimulacion(datos, { ensayos, semilla });
      const ciclo = () => {
        const fin = correr(500);
        onProgreso(salida.hecho, salida.N);
        if (fin || parar) resolve(recortar(salida)); else setTimeout(ciclo, 0);
      };
      ciclo();
    });
  }
  return { promesa, detener: () => { parar = true; worker?.postMessage({ tipo: 'parar' }); } };
}

// Si se detuvo antes, deja solo los ensayos hechos
function recortar(s) {
  if (s.hecho >= s.N) return s;
  const k = s.hecho;
  const cortar = a => (a ? a.slice(0, k) : a);
  ['van', 'tir', 'tur', 'bc', 'tri', 'vanF', 'tirF'].forEach(c => { s[c] = cortar(s[c]); });
  Object.keys(s.entradas).forEach(c => { s.entradas[c] = cortar(s.entradas[c]); });
  s.N = k;
  return s;
}
