// Diagnóstico por reglas: recomendaciones con su porqué, alertas, explicación de cada
// indicador con los números reales y el "plan del flujo" año por año.
import { dinero, pct, num, anios as fAnios } from './formato.js';

const NOMBRE_ALT = { puro: 'flujo puro', constante: 'financiado con amortización constante', cuota: 'financiado con cuota fija' };

// ¿TIR o TUR? Reglas del TEMA 5 (5.3) más el supuesto de reinversión.
export function tirOTur(alt, tasa) {
  const { tir, tur, negativos, cambios } = alt;
  const r = { usar: 'TIR', valor: tir, razones: [] };
  if (tir === null) {
    r.usar = 'TUR'; r.valor = tur;
    r.razones.push('Este flujo no tiene una TIR real (la ecuación VAN = 0 no tiene solución), en cambio la TUR siempre existe.');
  }
  if (cambios > 1) {
    r.usar = 'TUR'; r.valor = tur;
    r.razones.push(`El flujo cambia de signo ${cambios} veces, así que la ecuación del VAN = 0 puede tener hasta ${cambios} TIR distintas. La TUR da un único valor.`);
  }
  if (negativos > 1) {
    r.usar = 'TUR'; r.valor = tur;
    r.razones.push(`Hay ${negativos} años con flujo negativo. El curso indica usar la TUR cuando se presenta más de un flujo negativo.`);
  }
  if (tir !== null && (tir > 2 * tasa || tir - tasa > 0.15)) {
    r.usar = 'TUR'; r.valor = tur;
    r.razones.push(`La TIR (${pct(tir)}) está muy por encima de la tasa (${pct(tasa)}). La TIR supone que cada flujo se reinvierte a la misma TIR, algo poco realista; la TUR los reinvierte a la tasa de descuento y da un número más creíble (${pct(tur)}).`);
  }
  if (r.usar === 'TIR') {
    r.razones.push(`El flujo es convencional (una sola inversión al inicio y luego flujos positivos) y la TIR (${pct(tir)}) no está muy lejos de la tasa, así que es confiable. La TUR (${pct(tur)}) lleva a la misma decisión.`);
  }
  r.decision = r.valor !== null && r.valor > tasa ? 'acepta' : 'rechaza';
  return r;
}

// "¿Por qué?" de cada indicador: qué es, cómo se calculó con tus números, qué significa
export function explicarIndicadores(R, altKey = 'puro') {
  const a = R[altKey];
  const m = R.D.proyecto.moneda;
  const i = R.tasa;
  const F = a.filas.flujo;
  const sumaAct = F.slice(1).map((f, t) => `${dinero(f, m)}/${num(1 + i, 2)}^${t + 1}`);
  const formulaVan = `${dinero(F[0], m)} + ${sumaAct.slice(0, 2).join(' + ')}${F.length > 3 ? ' + ...' : ''}`;
  const tt = tirOTur(a, i);
  const vpPos = F.reduce((s, f, t) => s + (f > 0 ? f / Math.pow(1 + i, t) : 0), 0);
  const vpNeg = F.reduce((s, f, t) => s + (f < 0 ? -f / Math.pow(1 + i, t) : 0), 0);
  return {
    van: {
      que: 'El VAN es lo que el proyecto te deja hoy, en dinero de hoy, por encima de lo que ganarías invirtiendo a tu tasa de descuento.',
      como: `VAN = ${formulaVan} = ${dinero(a.van, m)} (flujos traídos al año 0 con la tasa de ${pct(i)}).`,
      significa: a.van >= 0
        ? `Tu proyecto genera ${dinero(a.van, m)} más de lo que ganarías invirtiendo al ${pct(i)}. Por eso conviene.`
        : `Al ${pct(i)} el proyecto destruye ${dinero(-a.van, m)} de valor. No cubre lo que te exige tu tasa.`,
    },
    tir: {
      que: 'La TIR es la tasa que hace el VAN igual a 0: la rentabilidad propia del proyecto.',
      como: a.tir === null ? 'No existe una tasa que haga VAN = 0 para este flujo.' : `Se busca i tal que VAN(i) = 0. Para tu flujo da ${pct(a.tir)}.`,
      significa: tt.usar === 'TIR'
        ? `Rindes ${pct(a.tir)} anual frente a tu tasa de ${pct(i)}. ${a.tir > i ? 'Supera la tasa: conviene.' : 'No supera la tasa: no conviene.'}`
        : `Aquí conviene leer la TUR en vez de la TIR. ${tt.razones[0]}`,
    },
    tur: {
      que: 'La TUR (TIR modificada) supone que los flujos positivos se reinvierten a tu tasa de descuento.',
      como: a.tur === null ? 's/d' : `TUR = (valor futuro de los positivos al ${pct(i)} / valor presente de los negativos)^(1/${R.n}) − 1 = ${pct(a.tur)}. En Excel: TIRM(flujos; ${pct(i)}; ${pct(i)}).`,
      significa: `${a.tur > i ? 'Supera' : 'No supera'} tu tasa de ${pct(i)}. ${tt.usar === 'TUR' ? 'Es el indicador de rentabilidad recomendado para este flujo.' : 'Coincide en la decisión con la TIR.'}`,
    },
    bc: {
      que: 'La relación B/C compara lo que entra con lo que sale, todo en valor presente.',
      como: `B/C = VP de flujos positivos / VP de flujos negativos = ${dinero(vpPos, m)} / ${dinero(vpNeg, m)} = ${num(a.bc, 2)}.`,
      significa: a.bc >= 1 ? `Por cada ${m} 1 que pones recibes ${m} ${num(a.bc, 2)} en valor presente.` : `Por cada ${m} 1 que pones solo recuperas ${m} ${num(a.bc, 2)}.`,
    },
    tri: {
      que: 'El TRI es el tiempo que tardas en recuperar la inversión con flujos actualizados.',
      como: a.tri === null ? 'El flujo actualizado acumulado nunca llega a 0 dentro del horizonte.' : `Es el año en que el flujo actualizado acumulado pasa a positivo, interpolando: ${num(a.tri, 2)} años. Sin actualizar (TRI simple) sería ${a.triSimple === null ? 'no recupera' : num(a.triSimple, 2) + ' años'}.`,
      significa: a.tri === null ? 'No recuperas la inversión en la vida del proyecto: es una señal de alto riesgo.'
        : a.tri > R.n / 2 ? `Recuperas en ${fAnios(a.tri)}, más de la mitad de la vida del proyecto (${R.n} años): la liquidez es ajustada.`
          : `Recuperas en ${fAnios(a.tri)}, antes de la mitad de la vida del proyecto.`,
    },
    precioMin: {
      que: 'El precio mínimo es el precio de venta que deja el VAN exactamente en 0, con todo lo demás igual.',
      como: `Precio mínimo = precio − VAN / ((1 − IUE) × Σ unidades × factor de actualización). Es la fórmula lineal de la plantilla de clase: es exacta si ningún año tiene pérdida y no hay costos como % de ventas.`,
      significa: R.ventas.map((v, j) => `${v.nombre}: ${dinero(a.precioMin[j], m, 2)} (hoy ${dinero(R.D.productos[j].precio, m, 2)}).`).join(' '),
    },
    vac: {
      que: 'El VAC es el valor actual de todos los costos (inversión, capital de trabajo, operación) menos el valor de rescate. Sirve para comparar alternativas que dan el mismo servicio.',
      como: `VAC = Σ costo neto / (1 + ${pct(i)})^t = ${dinero(a.vac, m)}. CAE = VAC × i(1+i)^n / ((1+i)^n − 1) = ${dinero(a.cae, m)} por año.`,
      significa: 'Entre alternativas, gana la de menor VAC si tienen la misma vida; si las vidas son distintas, compara por CAE.',
    },
    tirOTur: tt,
  };
}

export function recomendaciones(R, sim = null) {
  const m = R.D.proyecto.moneda;
  const i = R.tasa;
  const out = [];
  const p = R.puro;
  const tt = tirOTur(p, i);

  out.push({
    id: 'decision', nivel: p.van >= 0 ? 'ok' : 'bad',
    titulo: p.van >= 0 ? 'Conviene invertir' : 'No conviene invertir',
    resumen: p.van >= 0 ? `El VAN es positivo a la tasa de ${pct(i)}.` : `El VAN es negativo a la tasa de ${pct(i)}.`,
    porque: [
      `VAN ${dinero(p.van, m)}: ${p.van >= 0 ? 'el proyecto paga tu tasa y deja un excedente' : 'no alcanza a pagar tu tasa'}.`,
      `${tt.usar} ${pct(tt.valor)} frente a la tasa de ${pct(i)}.`,
      `B/C ${num(p.bc, 2)}: ${p.bc >= 1 ? 'los beneficios cubren los costos' : 'los beneficios no cubren los costos'}.`,
    ],
  });

  out.push({
    id: 'tirtur', nivel: 'info',
    titulo: `Usa la ${tt.usar}${tt.usar === 'TUR' ? ', no la TIR' : ''}`,
    resumen: `${tt.usar} ${pct(tt.valor)}`,
    porque: tt.razones,
  });

  if (R.hayPrestamo) {
    const mejor = R.cuota.van >= R.constante.van ? R.cuota : R.constante;
    const otro = mejor === R.cuota ? R.constante : R.cuota;
    const kd = R.D.prestamo.tasa * (1 - R.D.proyecto.iue);
    const conviene = mejor.van > p.van;
    out.push({
      id: 'financiar', nivel: conviene ? 'ok' : 'warn',
      titulo: conviene ? 'Financiarte conviene' : 'Financiarte no conviene',
      resumen: `El VAN ${conviene ? 'sube' : 'baja'} ${dinero(Math.abs(mejor.van - p.van), m)} con el préstamo.`,
      porque: [
        `El préstamo cuesta ${pct(R.D.prestamo.tasa)}, pero los intereses se descuentan antes del impuesto, así que el costo real es ${pct(R.D.prestamo.tasa)} × (1 − ${pct(R.D.proyecto.iue, 0)}) = ${pct(kd)}.`,
        kd < i ? `Ese costo es menor que tu tasa de descuento (${pct(i)}): usar dinero prestado es más barato que usar el tuyo.` : `Ese costo supera tu tasa de descuento (${pct(i)}): el dinero prestado sale más caro que el propio.`,
        `VAN puro ${dinero(p.van, m)} frente a VAN financiado ${dinero(mejor.van, m)}.`,
      ],
    });
    const totInt = alt => alt.filas.interes.reduce((s, x) => s + x, 0);
    out.push({
      id: 'sistema', nivel: 'info',
      titulo: `Elige ${mejor.sistema === 'cuota' ? 'cuota fija' : 'amortización constante'}`,
      resumen: `VAN ${dinero(mejor.van, m)} frente a ${dinero(otro.van, m)}.`,
      porque: [
        `Amortización constante paga menos intereses en total (${dinero(totInt(R.constante), m)} frente a ${dinero(totInt(R.cuota), m)}) porque devuelve capital más rápido.`,
        `Cuota fija alivia la caja al inicio: las primeras cuotas son más bajas y el dinero que pagas más tarde vale menos hoy.`,
        `Con tu tasa de ${pct(i)} gana ${mejor.sistema === 'cuota' ? 'cuota fija' : 'amortización constante'}: tiene mayor VAN y menor VAC (${dinero(mejor.vac, m)}).`,
      ],
    });
    if (R.D.prestamo.plazo > R.n) {
      out.push({ id: 'plazo', nivel: 'warn', titulo: 'El préstamo dura más que el proyecto', resumen: `Plazo ${R.D.prestamo.plazo} años, proyecto ${R.n} años.`, porque: [`El saldo pendiente al cierre del año ${R.n} se paga completo ese año (va en "Amortización (-)"). Si no es lo que dice el enunciado, ajusta el plazo.`] });
    }
  }

  out.push({
    id: 'vaccae', nivel: 'info', titulo: 'VAC o CAE',
    resumen: R.hayPrestamo ? 'Las tres alternativas tienen la misma vida: compara por VAC.' : 'Para comparar alternativas de distinta vida usa el CAE.',
    porque: [
      'El VAC solo compara bien alternativas con el mismo horizonte, porque suma costos de periodos distintos.',
      'El CAE convierte el VAC en una cuota anual equivalente, así que permite comparar vidas distintas (por ejemplo 5 frente a 8 años).',
    ],
  });

  return out;
}

export function alertas(R, sim = null) {
  const m = R.D.proyecto.moneda;
  const out = [];
  R.D.productos.forEach(p => {
    if (p.precio > 0 && p.cvu >= p.precio) out.push({ nivel: 'bad', titulo: `${p.nombre}: pierdes en cada unidad`, porque: `${p.nombre} cuesta ${dinero(p.cvu, m, 2)} producir y lo vendes a ${dinero(p.precio, m, 2)}. Revisa el precio o el CVu.` });
  });
  const F = R.puro.filas.flujo;
  const neg = F.map((f, t) => ({ f, t })).filter(x => x.t > 0 && x.f < 0);
  if (neg.length) out.push({ nivel: 'warn', titulo: `Flujo negativo en ${neg.map(x => 'año ' + x.t).join(', ')}`, porque: `En esos años el proyecto necesita dinero extra (${neg.map(x => dinero(x.f, m)).join(', ')}). Prevé capital para cubrirlo.` });
  const perdidas = R.puro.filas.utilidad.map((u, t) => ({ u, t })).filter(x => x.t > 0 && x.u < 0);
  if (perdidas.length) out.push({ nivel: 'info', titulo: 'Años con pérdida contable', porque: `En ${perdidas.map(x => 'año ' + x.t).join(', ')} la utilidad es negativa y el IUE se toma como 0 (MAX(0; utilidad × 25 %)): no existe impuesto negativo.` });
  if (R.puro.tri === null) out.push({ nivel: 'bad', titulo: 'No recuperas la inversión', porque: 'El flujo actualizado acumulado no llega a 0 dentro del horizonte.' });
  else if (R.puro.tri > R.n / 2) out.push({ nivel: 'warn', titulo: 'Recuperación lenta', porque: `El TRI (${fAnios(R.puro.tri)}) supera la mitad de la vida del proyecto.` });
  R.activos.forEach(a => {
    if (/terreno/i.test(a.nombre) && a.vida) out.push({ nivel: 'warn', titulo: 'El terreno no se deprecia', porque: `Le pusiste vida útil de ${a.vida} años a "${a.nombre}". El terreno no se desgasta: deja la vida útil vacía.` });
  });
  if (sim) {
    let k = 0, nn = 0; for (const v of sim.van) { if (isFinite(v)) { nn++; if (v < 0) k++; } }
    const pv = k / nn;
    if (pv > 0.3) out.push({ nivel: 'bad', titulo: 'Riesgo alto', porque: `${pct(pv)} de los ensayos dan VAN negativo.` });
  }
  // Punto de equilibrio (un producto: unidades; varios: ventas)
  const cf = R.costosFijos[1] || 0;
  if (R.D.productos.length === 1) {
    const pr = R.D.productos[0];
    const mc = pr.precio - pr.cvu;
    if (mc > 0) {
      const pe = cf / mc;
      const u1 = R.ventas[0].unidades[1];
      out.push({ nivel: u1 >= pe ? 'ok' : 'warn', titulo: `Punto de equilibrio: ${num(pe)} ${pr.unidad || 'u'} al año`, porque: `Costos fijos ${dinero(cf, m)} / margen por unidad ${dinero(mc, m, 2)} (precio − CVu). En el año 1 vendes ${num(u1)}: ${u1 >= pe ? 'cubres los costos fijos' : 'todavía no cubres los costos fijos'}. No incluye depreciación ni intereses.` });
    }
  } else if (R.ingresos[1] > 0) {
    const ratio = R.costosVariables[1] / R.ingresos[1];
    if (ratio < 1) out.push({ nivel: R.ingresos[1] >= cf / (1 - ratio) ? 'ok' : 'warn', titulo: `Punto de equilibrio: ${dinero(cf / (1 - ratio), m)} de ventas al año`, porque: `Costos fijos / (1 − costo variable / ventas) con la mezcla del año 1. Vendes ${dinero(R.ingresos[1], m)} en el año 1.` });
  }
  return out;
}

// Explicaciones de las reglas del flujo, con los números del caso
export function reglasDelFlujo(R) {
  const m = R.D.proyecto.moneda;
  const n = R.n;
  return [
    { titulo: 'Capital de trabajo, un periodo antes', texto: `Necesitas el dinero de operación antes de vender, por eso cada aumento se invierte el año anterior: ${dinero(R.ctInv[0], m)} en el año 0. Todo lo invertido (${dinero(R.ctTotal, m)}) se recupera en el año ${n}.` },
    { titulo: 'La depreciación se resta y luego se suma', texto: `Se resta antes del impuesto porque es un gasto deducible (ahorra IUE), y se suma después porque no es una salida de dinero: el activo ya se pagó en el año de compra.` },
    { titulo: 'El IUE nunca es negativo', texto: 'Si la utilidad es negativa, el impuesto es 0 (MAX(0; utilidad × IUE)). Una pérdida no genera devolución de impuesto.' },
    { titulo: `Venta de activos en el año ${n}`, texto: `Se grava solo la ganancia (mercado − libro = ${dinero(R.gananciaVenta, m)}) como "Otros ingresos". El valor en libros (${dinero(R.libroTotal, m)}) se suma después del impuesto porque es recuperar lo invertido.` },
    ...(R.hayPrestamo ? [{ titulo: 'Intereses antes, amortización después', texto: `Los intereses son gasto deducible y van antes del impuesto. La amortización es devolver el capital prestado: no es gasto, va después del impuesto. El préstamo (${dinero(R.montoPrestamo, m)}) entra como ingreso en el año 0.` }] : []),
  ];
}

// Plan del flujo: qué pasa cada año, en palabras
export function planDelFlujo(R, altKey = 'puro') {
  const a = R[altKey];
  const m = R.D.proyecto.moneda;
  const f = a.filas;
  const acum = []; let s = 0;
  f.flujo.forEach((x, t) => { s += x / Math.pow(1 + R.tasa, t); acum.push(s); });
  return R.anios.map(t => {
    const partes = [];
    if (t === 0) {
      partes.push(`Inviertes ${dinero(R.inversion[0], m)} en activos${R.diferidos ? ' y diferidos' : ''} y ${dinero(R.ctInv[0], m)} en capital de trabajo.`);
      if (f.prestamo[0]) partes.push(`El banco presta ${dinero(f.prestamo[0], m)}, así que pones de tu bolsillo ${dinero(-f.flujo[0], m)}.`);
    } else {
      partes.push(`Vendes ${dinero(f.ingresos[t], m)} y gastas ${dinero(f.costosOp[t], m)} en operar.`);
      if (f.interes[t]) partes.push(`Pagas ${dinero(f.interes[t], m)} de intereses${f.amortizacion[t] ? ` y devuelves ${dinero(-f.amortizacion[t], m)} de capital` : ' (periodo de gracia: solo intereses)'}.`);
      partes.push(f.iue[t] > 0 ? `Pagas ${dinero(f.iue[t], m)} de IUE.` : 'No pagas IUE (no hay utilidad).');
      if (R.ctInv[t] > 0) partes.push(`Aumentas el capital de trabajo en ${dinero(R.ctInv[t], m)} para el año siguiente.`);
      if (R.inversion[t] > 0) partes.push(`Compras activos por ${dinero(R.inversion[t], m)}.`);
      if (t === R.n) partes.push(`Vendes los activos y recuperas ${dinero(R.ctTotal, m)} de capital de trabajo.`);
    }
    const quedan = f.flujo[t];
    const hito = t > 0 && acum[t - 1] < 0 && acum[t] >= 0 ? 'Aquí recuperas la inversión.' : '';
    return { anio: t, flujo: quedan, acumulado: acum[t], texto: partes.join(' '), hito };
  });
}

// Textos visibles sin guiones largos (regla de estilo)
export const sinGuionLargo = s => !/[–—]/.test(s);
