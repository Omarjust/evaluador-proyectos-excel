// Monte Carlo en segundo plano: el panel sigue respondiendo y se puede detener.
import { prepararSimulacion } from './montecarlo.js';

let parar = false;
self.onmessage = e => {
  const m = e.data;
  if (m.tipo === 'parar') { parar = true; return; }
  parar = false;
  const { salida, correr } = prepararSimulacion(m.datos, { ensayos: m.ensayos, semilla: m.semilla });
  const paso = 500;
  const ciclo = () => {
    const fin = correr(paso);
    self.postMessage({ tipo: 'progreso', hecho: salida.hecho, N: salida.N });
    if (fin || parar) {
      self.postMessage({ tipo: 'fin', salida, parcial: !fin });
    } else setTimeout(ciclo, 0);
  };
  ciclo();
};
