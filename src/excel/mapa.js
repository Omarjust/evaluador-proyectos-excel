// Direcciones fijas de la hoja Datos (las usan el generador, el lector y las fórmulas).
export const H = {
  datos: 'Datos', ventas: 'Ventas', dep: 'Depreciación', prest: 'Préstamo', flujo: 'Flujo',
  vac: 'VAC-CAE', riesgo: 'Riesgo', diag: 'Diagnóstico', resumen: 'Resumen', mc: '_MC', meta: '_Meta',
};
// Referencia a otra hoja con comillas: 'Préstamo'!B4
export const ref = (hoja, addr) => `'${hoja}'!${addr}`;

export const DATOS = {
  nombre: 5, caso: 6, moneda: 7, vida: 8, tasa: 9, iue: 10, ctModo: 11, ct: 12, ctPct: 13, pctVentas: 14,
  prod: { titulo: 16, enc: 17, ini: 18, fin: 27 },        // A nombre · B unidad · C precio · D crec. precio · E CVu · F capacidad
  pct: { titulo: 29, enc: 30, ini: 31, fin: 40 },         // % de capacidad, C..V = años 1..20
  unid: { titulo: 42, enc: 43, ini: 44, fin: 53 },        // unidades manuales, C..V
  cf: { titulo: 55, enc: 56, ini: 57, fin: 66, total: 67 },
  otros: { titulo: 69, enc: 70, fila: 71 },
  act: { titulo: 73, enc: 74, ini: 75, fin: 89 },         // A nombre · B valor · C vida · D año · E % mercado · F monto mercado
  dif: { titulo: 91, enc: 92, ini: 93, fin: 97, total: 98 },
  fin: { titulo: 100, monto: 101, pct: 102, tasa: 103, tipo: 104, plazo: 105, gracia: 106, efectivo: 107 },
  riesgo: { titulo: 109, enc: 110, ini: 111, fin: 117, ensayos: 119, semilla: 120 },
};

export const NOMBRES = {
  VidaProy: `${H.datos}!$B$${DATOS.vida}`,
  TasaDesc: `${H.datos}!$B$${DATOS.tasa}`,
  TasaIUE: `${H.datos}!$B$${DATOS.iue}`,
  PctCT: `${H.datos}!$B$${DATOS.ctPct}`,
  PctVentas: `${H.datos}!$B$${DATOS.pctVentas}`,
  CFTotal: `${H.datos}!$B$${DATOS.cf.total}`,
  MontoPrestamo: `${H.datos}!$B$${DATOS.fin.efectivo}`,
};

export const DISTRIBUCIONES = ['Triangular', 'PERT', 'Uniforme', 'Normal'];
export const TIPOS_TASA = ['Efectiva anual', 'Nominal (pagos mensuales)'];
export const MODOS_CT = ['% de costos', 'Meses de costos'];
