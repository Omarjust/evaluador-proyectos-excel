// Hojas de cálculo con fórmulas vivas: Ventas, Depreciación, Préstamo, Flujo y VAC-CAE.
// Todas apuntan a la hoja Datos: si el estudiante cambia una celda amarilla, todo se recalcula.
import { Hoja, C, FMT, Y, siAnio, colLetra } from './plan.js';
import { H, DATOS as R, TIPOS_TASA, ref } from './mapa.js';

const DT = (addr) => ref(H.datos, addr);

// ======================= VENTAS =======================
export const VENTAS = { anio: 4, cant: 7, cantTotal: 17, precio: 20, ing: 32, ingTotal: 42, cv: 45, cvTotal: 55, graf: 100 };

export function hojaVentas(D) {
  const h = new Hoja(H.ventas, { color: C.tabCalculo });
  const V = VENTAS;
  h.titulo('A1', 'PROGRAMA DE VENTAS Y PRECIOS');
  h.val('A2', `=${DT('B' + R.nombre)}`);
  h.ancho('A', 200).ancho('B:V', 72).ancho('W', 90).ancho('X', 80);
  h.filaAnio(V.anio);

  const bloque = (titulo, r0, rTotal, fn, fmt, etTotal) => {
    h.seccion(`A${r0 - 1}`, titulo);
    for (let j = 0; j < 10; j++) {
      const r = r0 + j;
      h.val(`A${r}`, `=IF(${DT('$A' + (R.prod.ini + j))}="","",${DT('$A' + (R.prod.ini + j))})`);
      h.filaAnios(r, (t, c) => (t === 0 ? '' : siAnio(c, V.anio, fn(j, t, c, r))));
    }
    h.fmt(`B${r0}:V${r0 + 9}`, { numFmt: fmt, borde: true });
    if (rTotal) {
      h.val(`A${rTotal}`, etTotal);
      h.filaAnios(rTotal, (t, c) => siAnio(c, V.anio, `SUM(${c}${r0}:${c}${r0 + 9})`));
      h.totalFila(`A${rTotal}:V${rTotal}`);
      h.fmt(`B${rTotal}:V${rTotal}`, { numFmt: fmt });
    }
  };
  bloque('PROGRAMA DE VENTAS (UNIDADES)', V.cant, V.cantTotal,
    (j, t, c) => `IF(${DT(c + (R.unid.ini + j))}<>"",N(${DT(c + (R.unid.ini + j))}),N(${DT('$F' + (R.prod.ini + j))})*N(${DT(c + (R.pct.ini + j))}))`,
    FMT.unidades, 'TOTAL UNIDADES');
  bloque('PRECIOS DE VENTA', V.precio, null,
    (j, t, c) => `N(${DT('$C' + (R.prod.ini + j))})*(1+N(${DT('$D' + (R.prod.ini + j))}))^(${c}$${V.anio}-1)`,
    FMT.dinero2);
  bloque('PROYECCIÓN DE INGRESOS POR VENTAS', V.ing, V.ingTotal,
    (j, t, c) => `${c}${V.cant + j}*${c}${V.precio + j}`, FMT.dinero, 'TOTAL INGRESOS POR VENTAS');
  bloque('COSTOS VARIABLES', V.cv, V.cvTotal,
    (j, t, c) => `${c}${V.cant + j}*N(${DT('$E' + (R.prod.ini + j))})`, FMT.dinero, 'TOTAL COSTOS VARIABLES');

  // Total por producto y participación
  h.set(`W${V.ing - 1}:X${V.ing - 1}`, [['Total', 'Participación']]);
  h.encabezado(`W${V.ing - 1}:X${V.ing - 1}`);
  for (let j = 0; j <= 10; j++) {
    const r = j < 10 ? V.ing + j : V.ingTotal;
    h.set(`W${r}:X${r}`, [[`=SUM(C${r}:V${r})`, `=IF($W$${V.ingTotal}=0,"",W${r}/$W$${V.ingTotal})`]]);
  }
  h.fmt(`W${V.ing}:W${V.ingTotal}`, { numFmt: FMT.dinero, borde: true });
  h.fmt(`X${V.ing}:X${V.ingTotal}`, { numFmt: FMT.pct, borde: true });

  // Datos del gráfico (solo productos y años actuales)
  const k = Math.max(1, D.productos.length), n = D.proyecto.n;
  const g = V.graf;
  h.seccion(`A${g - 1}`, 'DATOS DEL GRÁFICO');
  h.set(`A${g}:${colLetra(n)}${g}`, [['Producto', ...Array.from({ length: n }, (_, t) => `Año ${t + 1}`)]]);
  h.set(`A${g + 1}:${colLetra(n)}${g + k}`, Array.from({ length: k }, (_, j) => [`=A${V.ing + j}`, ...Array.from({ length: n }, (_, t) => `=N(${Y(t + 1)}${V.ing + j})`)]));
  h.fmt(`B${g + 1}:${colLetra(n)}${g + k}`, { numFmt: FMT.dinero });
  h.grafico({ tipo: 'ColumnStacked', datos: `A${g}:${colLetra(n)}${g + k}`, por: 'Rows', titulo: 'Ingresos por producto y año', pos: ['A58', 'L82'], leyenda: 'Bottom', formatoEje: FMT.dinero });
  h.inmovilizar(V.anio, 1);
  return h;
}

// ======================= DEPRECIACIÓN =======================
export const DEP = { cuadro: 6, total: 21, difTotal: 24, difAnual: 25, inv0: 26, anio: 29, serie: 30, depTotal: 45, amortDif: 46, inversion: 47 };

export function hojaDepreciacion() {
  const h = new Hoja(H.dep, { color: C.tabCalculo });
  const P = DEP;
  h.titulo('A1', 'CÁLCULO DE DEPRECIACIONES Y VALOR RESIDUAL');
  h.val('A2', `=${DT('B' + R.nombre)}`);
  h.ancho('A', 200).ancho('B:V', 78);
  h.seccion('A4', 'ACTIVOS FIJOS, DEPRECIACIÓN Y VALOR RESIDUAL');
  h.set('A5:I5', [['Activo', 'Valor compra', 'Vida útil (años)', 'Año de compra', 'Depreciación anual', 'Años depreciados', 'Valor residual libro', 'Valor comercial final', 'Ganancia / pérdida en venta']]);
  h.encabezado('A5:I5');
  const filas = Array.from({ length: 15 }, (_, j) => {
    const r = P.cuadro + j, d = R.act.ini + j;
    return [
      `=IF(${DT('A' + d)}="","",${DT('A' + d)})`,
      `=N(${DT('B' + d)})`,
      `=IF(N(${DT('C' + d)})>0,${DT('C' + d)},"")`,
      `=N(${DT('D' + d)})`,
      `=IF(C${r}="",0,B${r}/C${r})`,
      `=IF(C${r}="",0,MAX(0,MIN(VidaProy-D${r},C${r})))`,
      `=B${r}-E${r}*F${r}`,
      `=IF(B${r}=0,0,IF(${DT('F' + d)}<>"",N(${DT('F' + d)}),IF(${DT('E' + d)}<>"",B${r}*${DT('E' + d)},G${r})))`,
      `=H${r}-G${r}`,
    ];
  });
  h.set(`A${P.cuadro}:I${P.cuadro + 14}`, filas);
  h.set(`A${P.total}:I${P.total}`, [['TOTAL', `=SUM(B${P.cuadro}:B${P.total - 1})`, '', '', `=SUM(E${P.cuadro}:E${P.total - 1})`, '', `=SUM(G${P.cuadro}:G${P.total - 1})`, `=SUM(H${P.cuadro}:H${P.total - 1})`, `=SUM(I${P.cuadro}:I${P.total - 1})`]]);
  h.fmt(`A${P.cuadro}:I${P.total}`, { borde: true });
  h.fmt(`B${P.cuadro}:B${P.total}`, { numFmt: FMT.dinero });
  h.fmt(`E${P.cuadro}:E${P.total}`, { numFmt: FMT.dinero });
  h.fmt(`G${P.cuadro}:I${P.total}`, { numFmt: FMT.dinero });
  h.totalFila(`A${P.total}:I${P.total}`);
  h.nota(`A${P.total + 1}`, 'Valor residual libro = compra − depreciación anual × años depreciados. Ganancia = valor comercial − valor en libros (se grava como "Otros ingresos").');

  h.seccion(`A${P.difTotal - 1}`, 'ACTIVOS DIFERIDOS E INVERSIÓN INICIAL');
  h.set(`A${P.difTotal}:B${P.inv0}`, [
    ['Total activos diferidos', `=${DT('B' + R.dif.total)}`],
    ['Amortización anual de diferidos (en la vida del proyecto)', `=IF(N(VidaProy)>0,B${P.difTotal}/VidaProy,0)`],
    ['Inversión inicial total (año 0)', `=SUMIF(D${P.cuadro}:D${P.total - 1},0,B${P.cuadro}:B${P.total - 1})+B${P.difTotal}`],
  ]);
  h.fmt(`B${P.difTotal}:B${P.inv0}`, { numFmt: FMT.dinero, borde: true });

  h.seccion(`A${P.anio - 1}`, 'DEPRECIACIÓN ANUAL POR ACTIVO');
  h.filaAnio(P.anio);
  for (let j = 0; j < 15; j++) {
    const r = P.serie + j, c0 = P.cuadro + j;
    h.val(`A${r}`, `=A${c0}`);
    h.filaAnios(r, (t, c) => siAnio(c, P.anio, `IF($C${c0}="",0,IF(AND(${c}$${P.anio}>$D${c0},${c}$${P.anio}<=$D${c0}+$C${c0}),$E${c0},0))`));
  }
  h.fmt(`B${P.serie}:V${P.serie + 14}`, { numFmt: FMT.dinero, borde: true });
  h.val(`A${P.depTotal}`, 'DEPRECIACIÓN TOTAL');
  h.filaAnios(P.depTotal, (t, c) => siAnio(c, P.anio, `SUM(${c}${P.serie}:${c}${P.serie + 14})`));
  h.val(`A${P.amortDif}`, 'Amortización de diferidos');
  h.filaAnios(P.amortDif, (t, c) => siAnio(c, P.anio, `IF(${c}$${P.anio}=0,0,$B$${P.difAnual})`));
  h.val(`A${P.inversion}`, 'Inversión en activos y diferidos');
  h.filaAnios(P.inversion, (t, c) => siAnio(c, P.anio, `SUMIF($D$${P.cuadro}:$D$${P.total - 1},${c}$${P.anio},$B$${P.cuadro}:$B$${P.total - 1})+IF(${c}$${P.anio}=0,$B$${P.difTotal},0)`));
  h.totalFila(`A${P.depTotal}:V${P.depTotal}`);
  h.fmt(`A${P.amortDif}:V${P.inversion}`, { borde: true });
  h.fmt(`B${P.depTotal}:V${P.inversion}`, { numFmt: FMT.dinero });
  return h;
}

// ======================= PRÉSTAMO =======================
export const PREST = { monto: 4, tasa: 5, tipo: 6, plazo: 7, gracia: 8, tasaPer: 9, periodos: 10, graciaPer: 11, enc: 14, ini: 15, fin: 254, res: 15, resFin: 34, resTotal: 35 };

export function hojaPrestamo() {
  const h = new Hoja(H.prest, { color: C.tabCalculo });
  const P = PREST;
  const nominal = `B${P.tipo}="${TIPOS_TASA[1]}"`;
  h.titulo('A1', 'ESTRUCTURA FINANCIERA: PLAN DE PAGOS');
  h.val('A2', `=${DT('B' + R.nombre)}`);
  h.ancho('A:B', 62).ancho('C:G', 82).ancho('H', 14).ancho('I:J', 62).ancho('K:O', 82).ancho('P', 14).ancho('Q', 50).ancho('R:W', 82);
  h.set(`A${P.monto}:B${P.graciaPer}`, [
    ['Monto', '=MontoPrestamo'],
    ['Tasa anual', `=N(${DT('B' + R.fin.tasa)})`],
    ['Tipo de tasa', `=IF(${DT('B' + R.fin.tipo)}="","${TIPOS_TASA[0]}",${DT('B' + R.fin.tipo)})`],
    ['Plazo total (años)', `=N(${DT('B' + R.fin.plazo)})`],
    ['Gracia (años)', `=N(${DT('B' + R.fin.gracia)})`],
    ['Tasa por periodo', `=IF(${nominal},B${P.tasa}/12,B${P.tasa})`],
    ['Número de periodos', `=IF(${nominal},B${P.plazo}*12,B${P.plazo})`],
    ['Periodos de gracia', `=IF(${nominal},B${P.gracia}*12,B${P.gracia})`],
  ]);
  h.fmt(`B${P.monto}`, { numFmt: FMT.dinero });
  h.fmt(`B${P.tasa}`, { numFmt: FMT.pct });
  h.fmt(`B${P.tasaPer}`, { numFmt: '0.0000%' });
  h.fmt(`A${P.monto}:B${P.graciaPer}`, { borde: true });
  h.nota(`D${P.monto}`, 'El plazo incluye la gracia. En gracia solo se pagan intereses. Con tasa nominal se paga cada mes y se suma por año.');

  const tabla = (col0, titulo, cuota) => {
    const c = i => colLetra(colIndice0(col0) + i);
    h.seccion(`${c(0)}${P.enc - 1}`, titulo);
    h.set(`${c(0)}${P.enc}:${c(6)}${P.enc}`, [['Periodo', 'Año', 'Saldo inicial', 'Amortización', 'Interés', 'Cuota', 'Saldo final']]);
    h.encabezado(`${c(0)}${P.enc}:${c(6)}${P.enc}`);
    const filas = [];
    for (let r = P.ini; r <= P.fin; r++) {
      const per = `${c(0)}${r}`;
      const vacio = `${per}=""`;
      filas.push([
        r === P.ini ? `=IF($B$${P.periodos}>=1,1,"")` : `=IF(${c(0)}${r - 1}="","",IF(${c(0)}${r - 1}+1<=$B$${P.periodos},${c(0)}${r - 1}+1,""))`,
        `=IF(${vacio},"",ROUNDUP(${per}/IF(${nominal.replace('B', '$B$')},12,1),0))`,
        r === P.ini ? `=IF(${vacio},"",$B$${P.monto})` : `=IF(${vacio},"",${c(6)}${r - 1})`,
        cuota
          ? `=IF(${vacio},"",${c(5)}${r}-${c(4)}${r})`
          : `=IF(${vacio},"",IF(${per}<=$B$${P.graciaPer},0,$B$${P.monto}/($B$${P.periodos}-$B$${P.graciaPer})))`,
        `=IF(${vacio},"",${c(2)}${r}*$B$${P.tasaPer})`,
        cuota
          ? `=IF(${vacio},"",IF(${per}<=$B$${P.graciaPer},${c(4)}${r},PMT($B$${P.tasaPer},$B$${P.periodos}-$B$${P.graciaPer},-$B$${P.monto})))`
          : `=IF(${vacio},"",${c(3)}${r}+${c(4)}${r})`,
        `=IF(${vacio},"",${c(2)}${r}-${c(3)}${r})`,
      ]);
    }
    h.set(`${c(0)}${P.ini}:${c(6)}${P.fin}`, filas);
    h.fmt(`${c(2)}${P.ini}:${c(6)}${P.fin}`, { numFmt: FMT.dinero2 });
  };
  tabla('A', 'AMORTIZACIÓN CONSTANTE', false);
  tabla('I', 'CUOTA FIJA (FRANCÉS)', true);

  h.seccion(`Q${P.enc - 1}`, 'RESUMEN POR AÑO (va al flujo de caja)');
  h.set(`Q${P.enc}:Y${P.enc}`, [['Año', 'Interés (amort. constante)', 'Amortización (amort. constante)', 'Cuota (amort. constante)', 'Interés (cuota fija)', 'Amortización (cuota fija)', 'Cuota (cuota fija)', 'Saldo al cierre (amort. constante)', 'Saldo al cierre (cuota fija)']]);
  h.encabezado(`Q${P.enc}:Y${P.enc}`);
  const rg = col => `$${col}$${P.ini}:$${col}$${P.fin}`;
  h.set(`Q${P.res}:Y${P.resFin}`, Array.from({ length: 20 }, (_, k) => {
    const r = P.res + k;
    return [k + 1,
      `=SUMIF(${rg('B')},$Q${r},${rg('E')})`, `=SUMIF(${rg('B')},$Q${r},${rg('D')})`, `=SUMIF(${rg('B')},$Q${r},${rg('F')})`,
      `=SUMIF(${rg('J')},$Q${r},${rg('M')})`, `=SUMIF(${rg('J')},$Q${r},${rg('L')})`, `=SUMIF(${rg('J')},$Q${r},${rg('N')})`,
      `=ROUND($B$${P.monto}-SUM($S$${P.res}:S${r}),2)`, `=ROUND($B$${P.monto}-SUM($V$${P.res}:V${r}),2)`];
  }));
  h.set(`Q${P.resTotal}:W${P.resTotal}`, [['TOTAL', ...'RSTUVW'.split('').map(c => `=SUM(${c}${P.res}:${c}${P.resFin})`)]]);
  h.fmt(`R${P.res}:W${P.resTotal}`, { numFmt: FMT.dinero, borde: true });
  h.fmt(`X${P.res}:Y${P.resFin}`, { numFmt: FMT.dinero, borde: true });
  h.nota(`Q${P.resTotal + 1}`, 'Si el plazo es mayor que la vida del proyecto, el saldo al cierre del último año se paga en ese año (va en "Amortización (-)").');
  h.totalFila(`Q${P.resTotal}:W${P.resTotal}`);
  h.inmovilizar(P.enc, 0);
  return h;
}
const colIndice0 = l => l.charCodeAt(0) - 65;

// ======================= FLUJO =======================
export const FLUJO = { anio: 5, aux: {}, bloques: {} };

const AUX = [
  ['ing', 'Ingresos por ventas', (t, c) => `'${H.ventas}'!${c}${VENTAS.ingTotal}`],
  ['cf', 'Costos fijos', (t, c) => `IF(${c}$5=0,0,CFTotal)`],
  ['cv', 'Costos variables', (t, c) => `'${H.ventas}'!${c}${VENTAS.cvTotal}`],
  ['otros', 'Otros costos (dados por año)', (t, c) => (t === 0 ? '0' : `N(${DT(c + R.otros.fila)})`)],
  ['pv', 'Costos como % de ventas', (t, c) => `${c}6*PctVentas`],
  ['cop', 'Costos de operación', (t, c) => `SUM(${c}7:${c}10)`],
  ['ctReq', 'Capital de trabajo requerido', (t, c) => `${c}11*PctCT`],
  ['ctInv', 'Inversión en capital de trabajo', (t, c) => `IF(${c}$5=VidaProy,0,N(${Y(t + 1)}12)-${c}12)`],
  ['ctRec', 'Recuperación capital de trabajo', (t, c) => `IF(${c}$5=VidaProy,SUM($B$13:$V$13),0)`],
  ['dep', 'Depreciación', (t, c) => `'${H.dep}'!${c}${DEP.depTotal}`],
  ['amd', 'Amortización de diferidos', (t, c) => `'${H.dep}'!${c}${DEP.amortDif}`],
  ['inv', 'Inversión en activos y diferidos', (t, c) => `'${H.dep}'!${c}${DEP.inversion}`],
  ['libro', 'Valor residual libro', (t, c) => `IF(${c}$5=VidaProy,'${H.dep}'!$G$${DEP.total},0)`],
  ['gan', 'Ganancia en venta de activos', (t, c) => `IF(${c}$5=VidaProy,'${H.dep}'!$I$${DEP.total},0)`],
  ['merc', 'Valor comercial final', (t, c) => `IF(${c}$5=VidaProy,'${H.dep}'!$H$${DEP.total},0)`],
];
// Filas auxiliares: 6..20
AUX.forEach(([k], i) => { FLUJO.aux[k] = 6 + i; });

const ALT = {
  puro: { titulo: 'FLUJO DE CAJA DEL PROYECTO PURO (SIN FINANCIAMIENTO)', inicio: 23, nombre: 'Flujo puro' },
  constante: { titulo: 'FLUJO DE CAJA CON FINANCIAMIENTO: AMORTIZACIÓN CONSTANTE', inicio: 55, nombre: 'Financ. amortización constante', colInt: 'R', colAm: 'S', colSaldo: 'X' },
  cuota: { titulo: 'FLUJO DE CAJA CON FINANCIAMIENTO: CUOTA FIJA', inicio: 88, nombre: 'Financ. cuota fija', colInt: 'U', colAm: 'V', colSaldo: 'Y' },
};
export const BASE_PMIN = 121;

function bloqueFlujo(h, key) {
  const A = ALT[key], fin = key !== 'puro';
  const a = FLUJO.aux;
  const s = A.inicio;
  const filas = [];
  const add = (k, label, f, estilo = null) => filas.push({ k, label, f, estilo });
  const prest = col => (t, c) => (t === 0 ? '0' : `IFERROR(INDEX('${H.prest}'!$${col}$${PREST.res}:$${col}$${PREST.resFin},${c}$5),0)`);
  add('h_ing', 'INGRESOS', null, 'grupo');
  add('ing', 'Ingresos por ventas', (t, c) => `${c}${a.ing}`);
  add('otros', 'Otros ingresos (venta de activos)', (t, c) => `${c}${a.gan}`);
  add('ting', 'TOTAL INGRESOS', null, 'sub');
  add('h_cos', 'COSTOS', null, 'grupo');
  add('cop', 'Costos de operación', (t, c) => `${c}${a.cop}`);
  if (fin) add('int', 'Costo financiero (intereses)', prest(A.colInt));
  add('dep', 'Depreciaciones', (t, c) => `${c}${a.dep}`);
  add('amd', 'Amortización de diferidos', (t, c) => `${c}${a.amd}`);
  add('tcos', 'TOTAL COSTOS', null, 'sub');
  add('ug', 'UTILIDAD GRAVABLE', null, 'sub');
  add('iue', '="IUE ("&FIXED(TasaIUE*100,0)&" % ANUAL)"', null);
  add('un', 'UTILIDAD NETA', null, 'sub');
  add('dep2', 'Depreciaciones (+)', null);
  add('amd2', 'Amortización de diferidos (+)', null);
  add('libro', 'Valor residual libro (+)', (t, c) => `${c}${a.libro}`);
  add('ctr', 'Recuperación capital de trabajo (+)', (t, c) => `${c}${a.ctRec}`);
  add('inv', 'Inversión activos (-)', (t, c) => `-${c}${a.inv}`);
  add('ct', 'Capital de trabajo (-)', (t, c) => `-${c}${a.ctInv}`);
  if (fin) {
    add('pres', 'Préstamo (+)', (t, c) => `IF(${c}$5=0,MontoPrestamo,0)`);
    // Si el préstamo dura más que el proyecto, el saldo pendiente se cancela en el año n
    add('am', 'Amortización (-)', (t, c) => (t === 0 ? '0' : `-(${prest(A.colAm)(t, c)}+IF(${c}$5=VidaProy,${prest(A.colSaldo)(t, c)},0))`));
  }
  add('fc', 'FLUJO DE CAJA', null, 'total');
  add('fa', 'Factor de actualización', (t, c) => `1/(1+TasaDesc)^${c}$5`);
  add('fact', 'Flujo actualizado', null);
  add('acum', 'Flujo actualizado acumulado', null);
  add('tri', 'TRI (año de recuperación)', null);

  const rows = {};
  filas.forEach((x, i) => { rows[x.k] = s + 2 + i; });
  const R_ = k => rows[k];
  const formulas = {
    ting: (t, c) => `${c}${R_('ing')}+${c}${R_('otros')}`,
    tcos: (t, c) => `SUM(${c}${R_('cop')}:${c}${R_('amd')})`,
    ug: (t, c) => `${c}${R_('ting')}-${c}${R_('tcos')}`,
    iue: (t, c) => `MAX(0,${c}${R_('ug')}*TasaIUE)`,
    un: (t, c) => `${c}${R_('ug')}-${c}${R_('iue')}`,
    dep2: (t, c) => `${c}${R_('dep')}`,
    amd2: (t, c) => `${c}${R_('amd')}`,
    fc: (t, c) => `SUM(${c}${R_('un')}:${c}${R_(fin ? 'am' : 'ct')})`,
    fact: (t, c) => `${c}${R_('fc')}*${c}${R_('fa')}`,
    acum: (t, c) => `SUM($B${R_('fact')}:${c}${R_('fact')})`,
    tri: (t, c) => (t === 0 ? '' : `IF(AND(${Y(t - 1)}${R_('acum')}<0,${c}${R_('acum')}>=0,COUNT($B${R_('tri')}:${Y(t - 1)}${R_('tri')})=0),${Y(t - 1)}$5+(-${Y(t - 1)}${R_('acum')})/${c}${R_('fact')},"")`),
  };

  h.seccion(`A${s}`, A.titulo);
  h.val(`A${s + 1}`, 'AÑO');
  h.filaAnios(s + 1, (t, c) => `=${c}$5`);
  h.encabezado(`A${s + 1}:V${s + 1}`);
  h.fmt(`B${s + 1}:V${s + 1}`, { numFmt: FMT.anio });
  filas.forEach(x => {
    const r = rows[x.k];
    h.val(`A${r}`, x.label);
    if (x.estilo === 'grupo') { h.fmt(`A${r}`, { bold: true }); return; }
    const f = x.f || formulas[x.k];
    h.filaAnios(r, (t, c) => { const e = f(t, c); return e === '' ? '' : siAnio(c, 5, e); });
    if (x.estilo === 'sub') h.fmt(`A${r}:V${r}`, { bold: true });
    if (x.estilo === 'total') h.totalFila(`A${r}:V${r}`);
  });
  const ult = s + 2 + filas.length - 1;
  h.fmt(`A${s + 2}:V${ult}`, { borde: true });
  h.fmt(`B${s + 2}:V${ult}`, { numFmt: FMT.dinero });
  h.fmt(`B${R_('fa')}:V${R_('fa')}`, { numFmt: FMT.factor });
  h.fmt(`B${R_('tri')}:V${R_('tri')}`, { numFmt: FMT.dec2 });

  // Indicadores en X:Y
  const F = R_('fc');
  const ind = {
    van: s + 2, tir: s + 3, tur: s + 4, bc: s + 5, tri: s + 6, decision: s + 7, vac: s + 8, cae: s + 9,
  };
  h.set(`X${s + 1}:Y${s + 1}`, [['INDICADORES', '']]);
  h.encabezado(`X${s + 1}:Y${s + 1}`);
  const vacFila = VACCAE.res[key];
  h.set(`X${ind.van}:Y${ind.cae}`, [
    ['VAN', `=NPV(TasaDesc,C${F}:V${F})+B${F}`],
    ['TIR', `=IFERROR(IRR(B${F}:V${F}),"No existe")`],
    ['TUR (TIRM)', `=IFERROR(MIRR(B${F}:V${F},TasaDesc,TasaDesc),"s/d")`],
    ['B/C', `=IFERROR(SUMIF(B${R_('fact')}:V${R_('fact')},">0")/-SUMIF(B${R_('fact')}:V${R_('fact')},"<0"),"s/d")`],
    ['TRI (años)', `=IF(SUM(C${R_('tri')}:V${R_('tri')})=0,"No recupera",SUM(C${R_('tri')}:V${R_('tri')}))`],
    ['Decisión', `=IF(Y${ind.van}>=0,"CONVIENE","NO CONVIENE")`],
    ['VAC', `='${H.vac}'!Y${vacFila}`],
    ['CAE', `='${H.vac}'!Y${vacFila + 1}`],
  ]);
  h.fmt(`X${ind.van}:Y${ind.cae}`, { borde: true });
  h.fmt(`Y${ind.van}`, { numFmt: FMT.dinero, bold: true });
  h.fmt(`Y${ind.tir}:Y${ind.tur}`, { numFmt: FMT.pct });
  h.fmt(`Y${ind.bc}:Y${ind.tri}`, { numFmt: FMT.dec2 });
  h.fmt(`Y${ind.vac}:Y${ind.cae}`, { numFmt: FMT.dinero });
  h.semaforo(`Y${ind.decision}`);
  FLUJO.bloques[key] = { rows, ind, nombre: A.nombre };
  return FLUJO.bloques[key];
}

export function hojaFlujo(D, hayPrestamo) {
  const h = new Hoja(H.flujo, { color: C.tabCalculo });
  h.titulo('A1', 'FLUJO DE CAJA Y EVALUACIÓN FINANCIERA');
  h.val('A2', `=${DT('B' + R.nombre)}`);
  h.ancho('A', 230).ancho('B:V', 74).ancho('W', 10).ancho('X', 160).ancho('Y:AF', 82);
  h.seccion('A4', 'CÁLCULOS AUXILIARES');
  h.filaAnio(5);
  AUX.forEach(([k, label, f], i) => {
    const r = 6 + i;
    h.val(`A${r}`, label);
    h.filaAnios(r, (t, c) => siAnio(c, 5, f(t, c)));
  });
  h.fmt('A6:V20', { borde: true });
  h.fmt('B6:V20', { numFmt: FMT.dinero });
  h.fmt(`A${FLUJO.aux.cop}:V${FLUJO.aux.cop}`, { bold: true });

  const alts = ['puro', ...(hayPrestamo ? ['constante', 'cuota'] : [])];
  alts.forEach(k => bloqueFlujo(h, k));

  // Base para el precio mínimo: unidades × (1+g)^(t−1) × factor de actualización
  const fa = FLUJO.bloques.puro.rows.fa;
  h.seccion(`A${BASE_PMIN - 1}`, 'BASE PARA EL PRECIO MÍNIMO (unidades × crecimiento del precio × factor de actualización)');
  for (let j = 0; j < 10; j++) {
    const r = BASE_PMIN + j;
    h.val(`A${r}`, `='${H.ventas}'!A${VENTAS.cant + j}`);
    h.filaAnios(r, (t, c) => (t === 0 ? '' : siAnio(c, 5, `N('${H.ventas}'!${c}${VENTAS.cant + j})*(1+N(${DT('$D' + (R.prod.ini + j))}))^(${c}$5-1)*${c}${fa}`)));
  }
  h.fmt(`B${BASE_PMIN}:V${BASE_PMIN + 9}`, { numFmt: FMT.dinero, borde: true });

  // Resumen de la evaluación financiera (X4:AF)
  h.seccion('X3', 'RESUMEN DE LA EVALUACIÓN FINANCIERA');
  h.set('X4:AF4', [['Alternativa', 'VAN', 'TIR', 'TUR', 'B/C', 'TRI (años)', 'VAC', 'CAE', 'Decisión']]);
  h.encabezado('X4:AF4');
  alts.forEach((k, i) => {
    const b = FLUJO.bloques[k], r = 5 + i;
    h.set(`X${r}:AF${r}`, [[b.nombre, ...['van', 'tir', 'tur', 'bc', 'tri', 'vac', 'cae', 'decision'].map(x => `=Y${b.ind[x]}`)]]);
  });
  const rf = 4 + alts.length;
  h.set(`X${rf + 1}:Y${rf + 1}`, [['Tasa de descuento', '=TasaDesc']]);
  h.fmt(`X5:AF${rf + 1}`, { borde: true });
  h.fmt(`Y5:Y${rf}`, { numFmt: FMT.dinero });
  h.fmt(`Z5:AA${rf}`, { numFmt: FMT.pct });
  h.fmt(`AB5:AC${rf}`, { numFmt: FMT.dec2 });
  h.fmt(`AD5:AE${rf}`, { numFmt: FMT.dinero });
  h.fmt(`Y${rf + 1}`, { numFmt: FMT.pct });
  h.semaforo(`AF5:AF${rf}`);

  // Precio mínimo por producto
  const pm = 11;
  h.seccion(`X${pm - 1}`, 'PRECIO MÍNIMO (VAN = 0)');
  h.set(`X${pm}:${colLetra(colIndiceX(1 + alts.length))}${pm}`, [['Producto', 'Precio actual', ...alts.map(k => FLUJO.bloques[k].nombre)]]);
  h.encabezado(`X${pm}:${colLetra(colIndiceX(1 + alts.length))}${pm}`);
  for (let j = 0; j < 10; j++) {
    const r = pm + 1 + j, d = R.prod.ini + j;
    h.set(`X${r}:${colLetra(colIndiceX(1 + alts.length))}${r}`, [[
      `=${DT('A' + d)}&""`,
      `=IF(${DT('A' + d)}="","",N(${DT('C' + d)}))`,
      ...alts.map(k => `=IF(${DT('A' + d)}="","",IFERROR(N(${DT('C' + d)})-Y${FLUJO.bloques[k].ind.van}/((1-TasaIUE)*(1-PctVentas)*SUM(C${BASE_PMIN + j}:V${BASE_PMIN + j})),""))`),
    ]]);
  }
  h.fmt(`X${pm + 1}:${colLetra(colIndiceX(1 + alts.length))}${pm + 10}`, { borde: true });
  h.fmt(`Y${pm + 1}:${colLetra(colIndiceX(1 + alts.length))}${pm + 10}`, { numFmt: FMT.dinero2 });

  // Datos del gráfico de flujos (fila 140)
  const n = D.proyecto.n, g = 140;
  h.seccion(`A${g - 1}`, 'DATOS DEL GRÁFICO');
  h.set(`A${g}:${colLetra(n + 1)}${g}`, [['Flujo', ...Array.from({ length: n + 1 }, (_, t) => `Año ${t}`)]]);
  h.set(`A${g + 1}:${colLetra(n + 1)}${g + alts.length}`, alts.map(k => [FLUJO.bloques[k].nombre, ...Array.from({ length: n + 1 }, (_, t) => `=N(${Y(t)}${FLUJO.bloques[k].rows.fc})`)]));
  h.fmt(`B${g + 1}:${colLetra(n + 1)}${g + alts.length}`, { numFmt: FMT.dinero });
  h.grafico({ tipo: 'ColumnClustered', datos: `A${g}:${colLetra(n + 1)}${g + alts.length}`, por: 'Rows', titulo: 'Flujo de caja por año', pos: ['AH3', 'AR22'], leyenda: 'Bottom', formatoEje: FMT.dinero });
  h.inmovilizar(5, 1);
  return h;
}
const colIndiceX = k => 23 + k; // X = índice 23

// ======================= VAC-CAE =======================
export const VACCAE = { anio: 4, res: { puro: 6, constante: 8, cuota: 10 }, comp: 24 };

export function hojaVacCae(hayPrestamo, comparador = null) {
  const h = new Hoja(H.vac, { color: C.tabCalculo });
  const V = VACCAE;
  const a = FLUJO.aux;
  const F = c => `'${H.flujo}'!${c}`;
  h.titulo('A1', 'VALOR ACTUAL DE COSTOS (VAC) Y COSTO ANUAL EQUIVALENTE (CAE)');
  h.val('A2', `=${DT('B' + R.nombre)}`);
  h.ancho('A', 250).ancho('B:V', 76).ancho('W', 10).ancho('X', 190).ancho('Y', 96);
  h.seccion('A3', 'FLUJO DE COSTOS DEL PROYECTO (SIN IMPUESTOS)');
  h.filaAnio(V.anio);
  const filas = [
    ['Inversión activos y diferidos', (t, c) => F(`${c}${a.inv}`)],
    ['Capital de trabajo (inversión - recuperación)', (t, c) => `${F(c + a.ctInv)}-${F(c + a.ctRec)}`],
    ['Costos de operación', (t, c) => F(`${c}${a.cop}`)],
    ['Valor residual (valor comercial final) (-)', (t, c) => `-${F(c + a.merc)}`],
    ['COSTO NETO: PURO', (t, c) => `SUM(${c}5:${c}8)`],
  ];
  if (hayPrestamo) {
    const prest = col => (t, c) => (t === 0 ? '0' : `IFERROR(INDEX('${H.prest}'!$${col}$${PREST.res}:$${col}$${PREST.resFin},${c}$${V.anio}),0)`);
    filas.push(
      ['Préstamo recibido (-)', (t, c) => `IF(${c}$${V.anio}=0,-MontoPrestamo,0)`],
      ['Cuota del préstamo (amortización constante)', (t, c) => (t === 0 ? '0' : `${prest('T')(t, c)}+IF(${c}$${V.anio}=VidaProy,${prest('X')(t, c)},0)`)],
      ['Cuota del préstamo (cuota fija)', (t, c) => (t === 0 ? '0' : `${prest('W')(t, c)}+IF(${c}$${V.anio}=VidaProy,${prest('Y')(t, c)},0)`)],
      ['COSTO NETO: FINANC. AMORTIZACIÓN CONSTANTE', (t, c) => `${c}9+${c}10+${c}11`],
      ['COSTO NETO: FINANC. CUOTA FIJA', (t, c) => `${c}9+${c}10+${c}12`],
    );
  }
  filas.forEach(([label, f], i) => {
    const r = 5 + i;
    h.val(`A${r}`, label);
    h.filaAnios(r, (t, c) => siAnio(c, V.anio, f(t, c)));
  });
  const ult = 4 + filas.length;
  h.fmt(`A5:V${ult}`, { borde: true });
  h.fmt(`B5:V${ult}`, { numFmt: FMT.dinero });
  h.totalFila('A9:V9');
  if (hayPrestamo) h.totalFila('A13:V14');

  const vacDe = fila => `=NPV(TasaDesc,C${fila}:V${fila})+B${fila}`;
  const caeDe = r => `=IF(TasaDesc=0,Y${r}/VidaProy,Y${r}*(TasaDesc*(1+TasaDesc)^VidaProy)/((1+TasaDesc)^VidaProy-1))`;
  h.set('X5:Y5', [['RESULTADO', '']]);
  h.encabezado('X5:Y5');
  const res = [['VAC puro', vacDe(9)], ['CAE puro', caeDe(V.res.puro)]];
  if (hayPrestamo) res.push(
    ['VAC financ. amortización constante', vacDe(13)], ['CAE financ. amortización constante', caeDe(V.res.constante)],
    ['VAC financ. cuota fija', vacDe(14)], ['CAE financ. cuota fija', caeDe(V.res.cuota)],
    ['Menor costo', `=IF(MIN(Y6,Y8,Y10)=Y6,"Puro",IF(MIN(Y6,Y8,Y10)=Y8,"Financ. amortización constante","Financ. cuota fija"))`],
  );
  h.set(`X6:Y${5 + res.length}`, res);
  h.fmt(`X6:Y${5 + res.length}`, { borde: true });
  h.fmt(`Y6:Y${hayPrestamo ? 11 : 7}`, { numFmt: FMT.dinero });
  h.nota(`A${ult + 1}`, 'VAC = suma de los costos netos actualizados. CAE = VAC × i(1+i)^n / ((1+i)^n − 1). Se elige el de menor costo.');

  // Comparador de alternativas (hoja "VAC y CAE" de clase)
  const r0 = V.comp;
  h.seccion(`A${r0 - 2}`, 'COMPARACIÓN DE ALTERNATIVAS POR VAC Y CAE');
  h.nota(`A${r0 - 1}`, 'Llena solo las celdas amarillas. Con vidas útiles distintas compara por CAE.');
  h.set(`A${r0}:E${r0}`, [['Concepto', 'Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D']]);
  h.encabezado(`A${r0}:E${r0}`);
  const etiquetas = ['Nombre', 'Inversión inicial', 'Costo de operación anual', 'Vida útil (años)', 'Valor residual (por ciclo)', 'Veces que se repite (reinversión)', 'Tasa de descuento'];
  const comp = comparador || [];
  const filasC = etiquetas.map((e, i) => [e, ...[0, 1, 2, 3].map(k => {
    if (i === 6) return k === 0 ? (comp[i]?.[0] ?? '=TasaDesc') : `=$B$${r0 + 7}`;
    if (i === 5) return comp[i]?.[k] ?? 1;
    return comp[i]?.[k] ?? '';
  })]);
  h.set(`A${r0 + 1}:E${r0 + 7}`, filasC);
  h.entrada(`B${r0 + 1}:E${r0 + 6}`);
  h.entrada(`B${r0 + 7}`);
  const q = r0 + 9;
  const col = ['B', 'C', 'D', 'E'];
  const fc = (c, expr) => `=IF(${c}$${r0 + 2}="","",${expr})`;
  const R2 = k => r0 + k; // 1 nombre, 2 inv, 3 costo, 4 vida, 5 residual, 6 veces, 7 tasa
  h.set(`A${q}:E${q + 5}`, [
    ['Resultado', ...col.map(c => `=${c}${R2(1)}&""`)],
    ['Horizonte total (años)', ...col.map(c => fc(c, `${c}${R2(4)}*${c}${R2(6)}`))],
    ['VAC (un ciclo)', ...col.map(c => fc(c, `IF(${c}${R2(7)}=0,${c}${R2(2)}+${c}${R2(3)}*${c}${R2(4)}-${c}${R2(5)},${c}${R2(2)}+${c}${R2(3)}*(1-(1+${c}${R2(7)})^(-${c}${R2(4)}))/${c}${R2(7)}-${c}${R2(5)}/(1+${c}${R2(7)})^${c}${R2(4)})`))],
    ['VAC (horizonte total)', ...col.map(c => fc(c, `IF(${c}${R2(7)}=0,${c}${q + 2}*${c}${R2(6)},${c}${q + 2}*(1-(1+${c}${R2(7)})^(-${c}${q + 1}))/(1-(1+${c}${R2(7)})^(-${c}${R2(4)})))`))],
    ['CAE', ...col.map(c => fc(c, `IF(${c}${R2(7)}=0,${c}${q + 2}/${c}${R2(4)},${c}${q + 2}*(${c}${R2(7)}*(1+${c}${R2(7)})^${c}${R2(4)})/((1+${c}${R2(7)})^${c}${R2(4)}-1))`))],
    ['Decisión', ...col.map(c => fc(c, `IF(${c}${q + 4}=MIN($B$${q + 4}:$E$${q + 4}),"CONVIENE","")`))],
  ]);
  h.encabezado(`A${q}:E${q}`);
  h.fmt(`A${r0 + 1}:E${q + 5}`, { borde: true });
  h.fmt(`B${R2(2)}:E${R2(3)}`, { numFmt: FMT.dinero });
  h.fmt(`B${R2(5)}:E${R2(5)}`, { numFmt: FMT.dinero });
  h.fmt(`B${R2(7)}:E${R2(7)}`, { numFmt: FMT.pct });
  h.fmt(`B${q + 2}:E${q + 4}`, { numFmt: FMT.dinero });
  h.semaforo(`B${q + 5}:E${q + 5}`);
  return h;
}
export const COMPARADOR = { entradas: () => `B${VACCAE.comp + 1}:E${VACCAE.comp + 7}` };
