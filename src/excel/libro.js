// Arma todas las hojas del libro a partir de los datos (y la simulación, si existe).
import { normalizar, calcular } from '../motor/modelo.js';
import { analizarSensibilidad, escenarios } from '../motor/sensibilidad.js';
import { recomendaciones, alertas, planDelFlujo, reglasDelFlujo, tirOTur } from '../motor/diagnostico.js';
import { histograma, ordenar } from '../motor/estadistica.js';
import { hojaDatos } from './hojaDatos.js';
import { hojaVentas, hojaDepreciacion, hojaPrestamo, hojaFlujo, hojaVacCae } from './hojasCalculo.js';
import { hojaRiesgo, hojaMC } from './hojaRiesgo.js';
import { hojaDiagnostico, hojaResumen } from './hojaDiagnostico.js';
import { H } from './mapa.js';

export const ORDEN = [H.resumen, H.datos, H.ventas, H.dep, H.prest, H.flujo, H.vac, H.riesgo, H.diag, H.mc];

export function fechaHoy() {
  const d = new Date();
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

// incluirDatos: false cuando la hoja Datos ya existe y es la fuente (no se sobrescribe)
export function construirLibro(datos, { sim = null, incluirDatos = true, comparador = null, previas = {}, fecha = fechaHoy() } = {}) {
  const D = normalizar(datos);
  const R = calcular(D, null, true);
  const sens = analizarSensibilidad(datos);
  const esc = escenarios(datos);
  if (sim) sim.hist = histograma(ordenar(sim.van), 25);
  const hojas = [];
  if (incluirDatos) hojas.push(hojaDatos(D));
  hojas.push(hojaVentas(D), hojaDepreciacion());
  if (R.hayPrestamo) hojas.push(hojaPrestamo());
  // Flujo antes que VAC-CAE: VAC-CAE usa las filas auxiliares que define Flujo
  const flujo = hojaFlujo(D, R.hayPrestamo);
  hojas.push(flujo, hojaVacCae(R.hayPrestamo, comparador));
  hojas.push(hojaRiesgo({ R, sens, esc, sim, previas, fecha, moneda: D.proyecto.moneda }));
  if (sim) hojas.push(hojaMC(sim));
  hojas.push(hojaDiagnostico({
    R, recs: recomendaciones(R, sim), alertas: alertas(R, sim), plan: planDelFlujo(R), reglas: reglasDelFlujo(R),
    tt: tirOTur(R.puro, R.tasa), hayMC: !!sim, fecha,
  }));
  hojas.push(hojaResumen({ R, hayPrestamo: R.hayPrestamo }));
  return { hojas, R, sens, esc, D };
}
