// Variables de riesgo. Cada una es un factor sobre el caso base (1 = 100 %).
// Se usan igual en sensibilidad, araña, escenarios y Monte Carlo.
export const VARIABLES = [
  { clave: 'precio', nombre: 'Precio de venta', corto: 'Precio', favorable: +1, porque: 'todo el ingreso depende del precio' },
  { clave: 'cantidad', nombre: 'Cantidad vendida', corto: 'Cantidad', favorable: +1, porque: 'más unidades traen más ingreso, aunque también más costo variable' },
  { clave: 'cvu', nombre: 'Costo variable unitario', corto: 'CVu', favorable: -1, porque: 'se paga por cada unidad producida' },
  { clave: 'costosFijos', nombre: 'Costos fijos', corto: 'C. fijos', favorable: -1, porque: 'se pagan aunque no vendas' },
  { clave: 'inversion', nombre: 'Inversión en activos', corto: 'Inversión', favorable: -1, porque: 'sale en el año 0, sin descuento' },
  { clave: 'tasa', nombre: 'Tasa de descuento', corto: 'Tasa', favorable: -1, porque: 'una tasa mayor castiga los flujos lejanos' },
  { clave: 'interes', nombre: 'Tasa de interés del préstamo', corto: 'Interés', favorable: -1, porque: 'solo afecta al flujo financiado', soloFinanciado: true },
];

export const variable = clave => VARIABLES.find(v => v.clave === clave);

// Rango por defecto para Monte Carlo: mínimo, más probable y máximo como % del caso base
export const RANGO_DEFECTO = { min: 0.9, moda: 1, max: 1.1, dist: 'triangular', incluir: true };

// Lee los rangos de datos.riesgo.variables (o usa los de defecto) y devuelve solo los incluidos
export function rangosActivos(datos, hayPrestamo) {
  const cfg = datos?.riesgo?.variables || {};
  return VARIABLES
    .filter(v => hayPrestamo || !v.soloFinanciado)
    .map(v => ({ ...v, ...RANGO_DEFECTO, ...(cfg[v.clave] || {}) }))
    .filter(v => v.incluir !== false && v.max > v.min);
}
