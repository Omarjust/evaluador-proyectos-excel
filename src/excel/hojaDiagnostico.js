// Hojas Diagnóstico (semáforos vivos + recomendaciones y plan del flujo) y Resumen.
import { Hoja, C, FMT, Y, colLetra } from './plan.js';
import { H, ref } from './mapa.js';
import { FLUJO, VACCAE } from './hojasCalculo.js';
import { RIESGO } from './hojaRiesgo.js';

const SEM = [['No', C.bad, 'beginsWith'], ['Alto', C.bad, 'beginsWith'], ['Ajustado', C.warn, 'beginsWith'], ['Moderado', C.warn, 'beginsWith'],
  ['Conviene', C.ok, 'beginsWith'], ['Bien', C.ok, 'beginsWith'], ['Bajo', C.ok, 'beginsWith']];

export function hojaDiagnostico({ R, recs, alertas, plan, reglas, tt, hayMC, fecha }) {
  const h = new Hoja(H.diag, { color: C.tabResumen });
  const b = FLUJO.bloques.puro.ind;
  const F = a => ref(H.flujo, a);
  h.titulo('A1', 'DIAGNÓSTICO DEL PROYECTO');
  h.nota('A2', `Los semáforos se recalculan solos. Los textos de recomendaciones y el plan del flujo se escribieron el ${fecha}.`);
  h.ancho('A', 210).ancho('B', 110).ancho('C', 100).ancho('D', 110).ancho('E', 470);

  h.seccion('A4', 'INDICADORES CLAVE');
  h.set('A5:E5', [['Criterio', 'Valor', 'Umbral', 'Semáforo', 'Comentario']]);
  h.encabezado('A5:E5');
  const usar = tt.usar === 'TUR' ? b.tur : b.tir;
  const filas = [
    ['VAN del flujo puro', `=${F('Y' + b.van)}`, 0, '=IF(B6>=C6,"Conviene","No conviene")',
      `="El proyecto "&IF(B6>=0,"deja ","pierde ")&FIXED(ABS(B6),0)&" en valor presente a la tasa de "&FIXED(TasaDesc*100,2)&" %"&"."`],
    [`Rentabilidad recomendada (${tt.usar})`, `=${F('Y' + usar)}`, '=TasaDesc', '=IF(ISNUMBER(B7),IF(B7>C7,"Conviene","No conviene"),"No existe")', tt.razones[0]],
    ['Relación beneficio / costo', `=${F('Y' + b.bc)}`, 1, '=IF(ISNUMBER(B8),IF(B8>=C8,"Conviene","No conviene"),"No existe")',
      '="Por cada 1 invertido se recibe "&FIXED(B8,2)&" en valor presente."'],
    ['Tiempo de recuperación (años)', `=${F('Y' + b.tri)}`, '=VidaProy/2', '=IF(ISNUMBER(B9),IF(B9<=C9,"Bien","Ajustado"),"No recupera")',
      '=IF(ISNUMBER(B9),"Recuperas la inversión en "&FIXED(B9,2)&" años de "&VidaProy&".","El flujo actualizado acumulado no llega a 0.")'],
  ];
  if (hayMC) filas.push(['Riesgo de que no sea factible P(VAN < 0)', `=${ref(H.riesgo, 'E' + RIESGO.preg)}`, 0.1,
    '=IF(B10<=0.1,"Bajo",IF(B10<=0.3,"Moderado","Alto"))', '="Probabilidad con la aproximación normal sobre "&FIXED(ROWS(MC_VAN),0)&" ensayos."']);
  const ult = 5 + filas.length;
  h.set(`A6:E${ult}`, filas);
  h.fmt(`A6:E${ult}`, { borde: true, wrap: true });
  h.fmt('B6:C6', { numFmt: FMT.dinero });
  h.fmt('B7:C7', { numFmt: FMT.pct });
  h.fmt('B8:C9', { numFmt: FMT.dec2 });
  if (hayMC) h.fmt('B10:C10', { numFmt: FMT.pct });
  h.semaforo(`D6:D${ult}`, SEM);

  let r = ult + 2;
  const bloqueTexto = (titulo, enc, filasT) => {
    h.seccion(`A${r}`, titulo); r++;
    h.set(`A${r}:${colLetra(enc.length - 1)}${r}`, [enc]);
    h.encabezado(`A${r}:${colLetra(enc.length - 1)}${r}`); r++;
    if (!filasT.length) { h.val(`A${r}`, 'Sin observaciones.'); r += 2; return; }
    h.set(`A${r}:${colLetra(enc.length - 1)}${r + filasT.length - 1}`, filasT);
    h.fmt(`A${r}:${colLetra(enc.length - 1)}${r + filasT.length - 1}`, { borde: true, wrap: true });
    const ini = r;
    r += filasT.length + 1;
    return ini;
  };
  const NIV = { ok: 'Bien', warn: 'Ajustado', bad: 'No conviene', info: 'Info' };
  const iniRec = bloqueTexto('RECOMENDACIONES (con su porqué)', ['Recomendación', 'Resumen', '', 'Estado', 'Por qué'],
    recs.map(x => [x.titulo, x.resumen, '', NIV[x.nivel], x.porque.join(' ')]));
  if (iniRec) h.semaforo(`D${iniRec}:D${iniRec + recs.length - 1}`, SEM);
  const iniAl = bloqueTexto('ALERTAS Y PUNTO DE EQUILIBRIO', ['Alerta', '', '', 'Estado', 'Explicación'],
    alertas.map(x => [x.titulo, '', '', NIV[x.nivel], x.porque]));
  if (iniAl) h.semaforo(`D${iniAl}:D${iniAl + alertas.length - 1}`, SEM);
  const iniPlan = bloqueTexto('PLAN DEL FLUJO, AÑO POR AÑO (flujo puro)', ['Año', 'Flujo de caja', 'Acumulado actualizado', '', 'Qué pasa'],
    plan.map(p => [`Año ${p.anio}`, Math.round(p.flujo * 100) / 100, Math.round(p.acumulado * 100) / 100, p.hito ? 'Recuperas' : '', `${p.texto} ${p.hito}`.trim()]));
  if (iniPlan) h.fmt(`B${iniPlan}:C${iniPlan + plan.length - 1}`, { numFmt: FMT.dinero });
  bloqueTexto('REGLAS DEL FLUJO QUE CONVIENE ENTENDER', ['Regla', '', '', '', 'Explicación con tus números'],
    reglas.map(x => [x.titulo, '', '', '', x.texto]));
  return h;
}

export function hojaResumen({ R, hayPrestamo, nombre, caso }) {
  const h = new Hoja(H.resumen, { color: C.tabResumen });
  h.titulo('A1', '=Datos!B5');
  h.val('A2', '=Datos!B6');
  h.ancho('A', 190).ancho('B:I', 96);
  h.seccion('A4', 'RESUMEN DE LA EVALUACIÓN FINANCIERA');
  h.set('A5:I5', [['Alternativa', 'VAN', 'TIR', 'TUR', 'B/C', 'TRI (años)', 'VAC', 'CAE', 'Decisión']]);
  h.encabezado('A5:I5');
  const alts = ['puro', ...(hayPrestamo ? ['constante', 'cuota'] : [])];
  alts.forEach((k, i) => {
    const r = 6 + i;
    h.set(`A${r}:I${r}`, [['X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF'].map(c => `=${ref(H.flujo, c + (5 + i))}`)]);
  });
  const ult = 5 + alts.length;
  h.fmt(`A6:I${ult}`, { borde: true });
  h.fmt(`B6:B${ult}`, { numFmt: FMT.dinero, bold: true });
  h.fmt(`C6:D${ult}`, { numFmt: FMT.pct });
  h.fmt(`E6:F${ult}`, { numFmt: FMT.dec2 });
  h.fmt(`G6:H${ult}`, { numFmt: FMT.dinero });
  h.semaforo(`I6:I${ult}`);
  h.set(`A${ult + 1}:B${ult + 1}`, [['Tasa de descuento', '=TasaDesc']]);
  h.fmt(`B${ult + 1}`, { numFmt: FMT.pct });

  // Índice con vínculos
  const hojas = [
    [H.datos, 'Tus datos (celdas amarillas)'], [H.ventas, 'Programa de ventas e ingresos por producto'],
    [H.dep, 'Depreciaciones y valor residual'], ...(hayPrestamo ? [[H.prest, 'Plan de pagos del préstamo']] : []),
    [H.flujo, 'Flujo de caja e indicadores'], [H.vac, 'VAC, CAE y comparación de alternativas'],
    [H.riesgo, 'Sensibilidad, araña, Monte Carlo y preguntas'], [H.diag, 'Diagnóstico y plan del flujo'],
  ];
  const r0 = ult + 3;
  h.seccion(`A${r0}`, 'CONTENIDO DEL LIBRO');
  hojas.forEach(([nom, desc], i) => {
    h.vinculo(`A${r0 + 1 + i}`, `'${nom}'!A1`, nom);
    h.val(`B${r0 + 1 + i}`, desc);
  });

  // Gráfico de flujos
  const n = R.n, g = 40;
  h.set(`A${g}:${colLetra(n + 1)}${g}`, [['Flujo', ...Array.from({ length: n + 1 }, (_, t) => `Año ${t}`)]]);
  h.set(`A${g + 1}:${colLetra(n + 1)}${g + alts.length}`, alts.map(k => [FLUJO.bloques[k].nombre, ...Array.from({ length: n + 1 }, (_, t) => `=N(${ref(H.flujo, Y(t) + FLUJO.bloques[k].rows.fc)})`)]));
  h.fmt(`B${g + 1}:${colLetra(n + 1)}${g + alts.length}`, { numFmt: FMT.dinero });
  h.grafico({ tipo: 'ColumnClustered', datos: `A${g}:${colLetra(n + 1)}${g + alts.length}`, por: 'Rows', titulo: 'Flujo de caja por año', pos: [`D${r0}`, `I${r0 + 18}`], leyenda: 'Bottom', formatoEje: FMT.dinero });
  return h;
}
