// Hoja Datos: todas las entradas en amarillo. Es la fuente de verdad del libro.
import { Hoja, C, FMT, Y } from './plan.js';
import { H, DATOS as R, NOMBRES, DISTRIBUCIONES, TIPOS_TASA, MODOS_CT } from './mapa.js';
import { VARIABLES, RANGO_DEFECTO } from '../motor/variables.js';
import { LIMITES } from '../motor/modelo.js';

const v = x => (x === null || x === undefined ? '' : x);

export function hojaDatos(D) {
  const h = new Hoja(H.datos, { color: C.tabDatos });
  const p = D.proyecto;
  h.titulo('A1', 'EVALUACIÓN DE PROYECTOS: DATOS');
  h.nota('A2', 'Llena solo las celdas amarillas. Todas las demás hojas se calculan solas a partir de esta. Solo se muestran los años de la vida útil: si la cambias con el panel cerrado, ábrelo para ver los años nuevos.');
  h.ancho('A', 230).ancho('B', 90).ancho('C:V', 70);

  // ---- Proyecto ----
  h.seccion('A4', 'DATOS DEL PROYECTO');
  const filasP = [
    [R.nombre, 'Nombre del proyecto', v(p.nombre)],
    [R.caso, 'Caso o enunciado', v(p.caso)],
    [R.moneda, 'Moneda', v(p.moneda)],
    [R.vida, 'Vida útil del proyecto (años, 1 a 20)', v(p.n)],
    [R.tasa, 'Tasa de descuento (TMAR)', v(p.tasa)],
    [R.iue, 'IUE (impuesto a las utilidades)', v(p.iue)],
    [R.ctModo, 'Capital de trabajo: se da en', p.ctModo === 'meses' ? MODOS_CT[1] : MODOS_CT[0]],
    [R.ct, 'Capital de trabajo: valor (% o meses)', v(p.ct)],
    [R.pctVentas, 'Costos como % de ventas (IT, comisiones)', v(p.pctVentas)],
  ];
  filasP.forEach(([r, et, val]) => { h.val(`A${r}`, et); h.val(`B${r}`, val); h.entrada(`B${r}`); });
  h.val(`A${R.ctPct}`, 'Capital de trabajo (% de costos de operación)');
  h.val(`B${R.ctPct}`, `=IF(B${R.ctModo}="${MODOS_CT[1]}",N(B${R.ct})/12,N(B${R.ct}))`);
  h.fmt(`B${R.ctPct}`, { numFmt: FMT.pct, borde: true });
  h.fmt(`B${R.tasa}:B${R.iue}`, { numFmt: FMT.pct });
  h.fmt(`B${R.pctVentas}`, { numFmt: FMT.pct });
  h.validacion(`B${R.vida}`, { entero: [1, 20], aviso: 'Entre 1 y 20 años.' });
  h.validacion(`B${R.moneda}`, { lista: ['Bs', '$us'] });
  h.validacion(`B${R.ctModo}`, { lista: MODOS_CT });
  h.validacion(`B${R.tasa}`, { decimal: [0, 1], aviso: 'Escribe la tasa como porcentaje, por ejemplo 13 %.' });
  h.nota(`C${R.ct}`, 'Si es en meses, escribe los meses (por ejemplo 2); si es %, el porcentaje.');

  // ---- Productos ----
  const P = R.prod;
  h.seccion(`A${P.titulo}`, `PRODUCTOS (hasta ${LIMITES.productos})`);
  h.set(`A${P.enc}:F${P.enc}`, [['Producto', 'Unidad', 'Precio año 1', 'Crecimiento anual del precio', 'Costo variable unitario', 'Capacidad al 100 % (unidades/año)']]);
  h.encabezado(`A${P.enc}:F${P.enc}`);
  const filasProd = Array.from({ length: 10 }, (_, j) => {
    const x = D.productos[j];
    return x ? [x.nombre, x.unidad, x.precio, x.crecPrecio || '', x.cvu, v(x.capacidad)] : ['', '', '', '', '', ''];
  });
  h.set(`A${P.ini}:F${P.fin}`, filasProd);
  h.entrada(`A${P.ini}:F${P.fin}`);
  h.fmt(`C${P.ini}:C${P.fin}`, { numFmt: FMT.dinero2 });
  h.fmt(`D${P.ini}:D${P.fin}`, { numFmt: FMT.pct });
  h.fmt(`E${P.ini}:E${P.fin}`, { numFmt: FMT.dinero2 });
  h.fmt(`F${P.ini}:F${P.fin}`, { numFmt: FMT.unidades });

  // ---- Programa de producción (% de capacidad y unidades) ----
  const bloqueAnual = (B, titulo, nota, valores, fmt) => {
    h.seccion(`A${B.titulo}`, titulo);
    h.nota(`D${B.titulo}`, nota);
    h.val(`A${B.enc}`, 'Producto');
    h.set(`B${B.enc}:V${B.enc}`, [Array.from({ length: 21 }, (_, t) => (t === 0 ? 'Año 0' : `Año ${t}`))]);
    h.encabezado(`A${B.enc}:V${B.enc}`);
    const filas = Array.from({ length: 10 }, (_, j) => [`=IF($A${P.ini + j}="","",$A${P.ini + j})`, '', ...Array.from({ length: 20 }, (_, t) => v(valores(j, t)))]);
    h.set(`A${B.ini}:V${B.fin}`, filas);
    h.fmt(`B${B.ini}:B${B.fin}`, { fill: C.total });
    h.entrada(`C${B.ini}:V${B.fin}`);
    h.fmt(`C${B.ini}:V${B.fin}`, { numFmt: fmt });
  };
  bloqueAnual(R.pct, 'PROGRAMA DE PRODUCCIÓN: % DE LA CAPACIDAD', 'Úsalo si el enunciado da la producción en % de la capacidad.',
    (j, t) => (t < D.proyecto.n ? D.productos[j]?.pct[t] : null), FMT.pct0);
  bloqueAnual(R.unid, 'PROGRAMA DE PRODUCCIÓN: UNIDADES (reemplaza al %)', 'Si escribes unidades en un año, se usan en lugar del %.',
    (j, t) => (t < D.proyecto.n ? D.productos[j]?.unidades[t] : null), FMT.unidades);

  // ---- Costos fijos ----
  const CF = R.cf;
  h.seccion(`A${CF.titulo}`, 'COSTOS FIJOS ANUALES');
  h.set(`A${CF.enc}:B${CF.enc}`, [['Concepto', 'Monto anual']]);
  h.encabezado(`A${CF.enc}:B${CF.enc}`);
  h.set(`A${CF.ini}:B${CF.fin}`, Array.from({ length: 10 }, (_, j) => { const c = D.costosFijos[j]; return c ? [c.nombre, c.monto] : ['', '']; }));
  h.entrada(`A${CF.ini}:B${CF.fin}`);
  h.set(`A${CF.total}:B${CF.total}`, [['TOTAL COSTOS FIJOS', `=SUM(B${CF.ini}:B${CF.fin})`]]);
  h.totalFila(`A${CF.total}:B${CF.total}`);
  h.fmt(`B${CF.ini}:B${CF.total}`, { numFmt: FMT.dinero });

  // ---- Otros costos dados año por año ----
  const O = R.otros;
  h.seccion(`A${O.titulo}`, 'OTROS COSTOS DE OPERACIÓN DADOS AÑO POR AÑO (opcional)');
  h.val(`A${O.enc}`, 'Concepto');
  h.set(`B${O.enc}:V${O.enc}`, [Array.from({ length: 21 }, (_, t) => (t === 0 ? 'Año 0' : `Año ${t}`))]);
  h.encabezado(`A${O.enc}:V${O.enc}`);
  h.set(`A${O.fila}:V${O.fila}`, [['Otros costos', '', ...Array.from({ length: 20 }, (_, t) => (t < D.proyecto.n && D.otrosCostos[t] ? D.otrosCostos[t] : ''))]]);
  h.fmt(`B${O.fila}`, { fill: C.total });
  h.entrada(`C${O.fila}:V${O.fila}`);
  h.fmt(`C${O.fila}:V${O.fila}`, { numFmt: FMT.dinero });

  // ---- Activos ----
  const A = R.act;
  h.seccion(`A${A.titulo}`, `ACTIVOS FIJOS (hasta ${LIMITES.activos})`);
  h.nota(`D${A.titulo}`, 'Vida útil vacía = no se deprecia (terreno). Sin % ni monto comercial, se vende al valor en libros.');
  h.set(`A${A.enc}:F${A.enc}`, [['Activo', 'Valor de compra', 'Vida útil (años)', 'Año de compra', '% valor comercial', 'Valor comercial (monto)']]);
  h.encabezado(`A${A.enc}:F${A.enc}`);
  h.set(`A${A.ini}:F${A.fin}`, Array.from({ length: 15 }, (_, j) => {
    const a = D.activos[j];
    return a ? [a.nombre, a.valor, v(a.vida), a.anio || '', v(a.pctMercado), v(a.montoMercado)] : ['', '', '', '', '', ''];
  }));
  h.entrada(`A${A.ini}:F${A.fin}`);
  h.fmt(`B${A.ini}:B${A.fin}`, { numFmt: FMT.dinero });
  h.fmt(`E${A.ini}:E${A.fin}`, { numFmt: FMT.pct0 });
  h.fmt(`F${A.ini}:F${A.fin}`, { numFmt: FMT.dinero });
  h.validacion(`D${A.ini}:D${A.fin}`, { entero: [0, '=VidaProy-1'], aviso: 'Año en que se compra el activo (antes del último año). Vacío o 0 = al inicio.' });

  // ---- Diferidos ----
  const DF = R.dif;
  h.seccion(`A${DF.titulo}`, 'ACTIVOS DIFERIDOS (se amortizan en la vida del proyecto)');
  h.set(`A${DF.enc}:B${DF.enc}`, [['Concepto', 'Monto']]);
  h.encabezado(`A${DF.enc}:B${DF.enc}`);
  h.set(`A${DF.ini}:B${DF.fin}`, Array.from({ length: 5 }, (_, j) => { const x = D.diferidos[j]; return x ? [x.nombre, x.monto] : ['', '']; }));
  h.entrada(`A${DF.ini}:B${DF.fin}`);
  h.set(`A${DF.total}:B${DF.total}`, [['TOTAL DIFERIDOS', `=SUM(B${DF.ini}:B${DF.fin})`]]);
  h.totalFila(`A${DF.total}:B${DF.total}`);
  h.fmt(`B${DF.ini}:B${DF.total}`, { numFmt: FMT.dinero });

  // ---- Financiamiento ----
  const F = R.fin;
  const pr = D.prestamo;
  h.seccion(`A${F.titulo}`, 'FINANCIAMIENTO (déjalo vacío si no hay préstamo)');
  const filasF = [
    [F.monto, 'Monto del préstamo', v(pr.monto), FMT.dinero],
    [F.pct, 'o % de la inversión inicial', v(pr.pctInversion), FMT.pct0],
    [F.tasa, 'Tasa de interés anual', pr.tasa || '', FMT.pct],
    [F.tipo, 'Tipo de tasa', pr.tipoTasa === 'nominal' ? TIPOS_TASA[1] : TIPOS_TASA[0], null],
    [F.plazo, 'Plazo total (años, incluye la gracia)', pr.plazo || '', FMT.entero],
    [F.gracia, 'Años de gracia (solo intereses)', pr.gracia || '', FMT.entero],
  ];
  filasF.forEach(([r, et, val, fmt]) => { h.val(`A${r}`, et); h.val(`B${r}`, val); h.entrada(`B${r}`); if (fmt) h.fmt(`B${r}`, { numFmt: fmt }); });
  h.validacion(`B${F.tipo}`, { lista: TIPOS_TASA });
  h.val(`A${F.efectivo}`, 'Monto que se presta (calculado)');
  h.val(`B${F.efectivo}`, `=IF(B${F.monto}<>"",N(B${F.monto}),IF(B${F.pct}<>"",N(B${F.pct})*(SUM(B${A.ini}:B${A.fin})-SUMIF(D${A.ini}:D${A.fin},">0",B${A.ini}:B${A.fin})+B${DF.total}),0))`);
  h.fmt(`B${F.efectivo}`, { numFmt: FMT.dinero, borde: true, bold: true });

  // ---- Rangos de riesgo ----
  const RG = R.riesgo;
  const cfg = D.riesgo?.variables || {};
  h.seccion(`A${RG.titulo}`, 'RANGOS DE RIESGO (como % del valor base: 90 % = 10 % menos)');
  h.set(`A${RG.enc}:F${RG.enc}`, [['Variable', 'Mínimo', 'Más probable', 'Máximo', 'Distribución', 'Incluir']]);
  h.encabezado(`A${RG.enc}:F${RG.enc}`);
  h.set(`A${RG.ini}:F${RG.fin}`, VARIABLES.map(x => {
    const c = { ...RANGO_DEFECTO, ...(cfg[x.clave] || {}) };
    const dist = { triangular: 'Triangular', pert: 'PERT', uniforme: 'Uniforme', normal: 'Normal' }[c.dist] || 'Triangular';
    return [x.nombre, c.min, c.moda, c.max, dist, c.incluir === false ? 'No' : 'Sí'];
  }));
  h.entrada(`B${RG.ini}:F${RG.fin}`);
  h.fmt(`B${RG.ini}:D${RG.fin}`, { numFmt: FMT.pct0 });
  h.validacion(`E${RG.ini}:E${RG.fin}`, { lista: DISTRIBUCIONES });
  h.validacion(`F${RG.ini}:F${RG.fin}`, { lista: ['Sí', 'No'] });
  h.set(`A${RG.ensayos}:B${RG.semilla}`, [['Número de ensayos', D.riesgo?.ensayos || 10000], ['Semilla (misma semilla = mismos resultados)', D.riesgo?.semilla || 2026]]);
  h.entrada(`B${RG.ensayos}:B${RG.semilla}`);
  h.fmt(`B${RG.ensayos}`, { numFmt: '#,##0' });

  Object.entries(NOMBRES).forEach(([n, r]) => h.nombre_(n, r));
  h.inmovilizar(0, 1);
  return h;
}
