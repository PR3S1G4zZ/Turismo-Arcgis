// src/utilidades/geoRuta.js
// Geometría de navegación: proyecta la posición del GPS sobre la polilínea de
// la ruta para saber cuánto falta SIGUIENDO LA CALLE (no en línea recta), qué
// maniobra toca ahora y si el usuario se salió del trayecto.
//
// A escala municipal la Tierra se puede tratar como plana: se usa una
// proyección equirectangular local, exacta de sobra para distancias de km.

const RADIO_TIERRA_M = 6371000;
const GRADOS_A_RAD = Math.PI / 180;

/** Distancia en metros entre dos puntos [lat, lng] (Haversine). */
export function distanciaM(a, b) {
  const dLat = (b[0] - a[0]) * GRADOS_A_RAD;
  const dLng = (b[1] - a[1]) * GRADOS_A_RAD;
  const lat1 = a[0] * GRADOS_A_RAD;
  const lat2 = b[0] * GRADOS_A_RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * RADIO_TIERRA_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Rumbo inicial en grados (0–360, horario desde el norte) para ir de `a` a `b`,
 * ambos [lat, lng]. Es el respaldo del heading del GPS: cuando el navegador no
 * entrega `coords.heading` (típico al ir a pie), se deduce entre dos lecturas.
 */
export function rumbo(a, b) {
  const lat1 = a[0] * GRADOS_A_RAD;
  const lat2 = b[0] * GRADOS_A_RAD;
  const dLng = (b[1] - a[1]) * GRADOS_A_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const grados = Math.atan2(y, x) / GRADOS_A_RAD;
  return (grados + 360) % 360;
}

/** Convierte [lat, lng] a metros en un plano local centrado en `ref`. */
function aPlano(punto, ref) {
  const cosLat = Math.cos(ref[0] * GRADOS_A_RAD);
  return {
    x: (punto[1] - ref[1]) * GRADOS_A_RAD * RADIO_TIERRA_M * cosLat,
    y: (punto[0] - ref[0]) * GRADOS_A_RAD * RADIO_TIERRA_M,
  };
}

/**
 * Precalcula lo que no cambia mientras el usuario camina: la distancia
 * acumulada hasta cada vértice y el punto de la ruta donde termina cada paso.
 * Se llama una vez por ruta, no en cada lectura del GPS.
 *
 * @param {{puntos:Array<[number,number]>, pasos:Array, distanciaM:number, duracionMin:number, fuente:string}} ruta
 */
export function prepararRuta(ruta) {
  const puntos = ruta?.puntos || [];
  if (puntos.length < 2) return null;

  // Distancia desde el inicio hasta cada vértice.
  const acumulados = new Array(puntos.length);
  acumulados[0] = 0;
  for (let i = 1; i < puntos.length; i++) {
    acumulados[i] = acumulados[i - 1] + distanciaM(puntos[i - 1], puntos[i]);
  }
  const largoTotalM = acumulados[acumulados.length - 1];

  // Cada paso de las indicaciones se ancla a la distancia recorrida en la que
  // termina. Así el paso activo se deduce del avance, sin depender de que el
  // servicio devuelva la geometría de cada instrucción.
  let offset = 0;
  const pasos = (ruta.pasos || []).map((paso) => {
    const inicioM = offset;
    offset += paso.distanciaM || 0;
    return { ...paso, inicioM, finM: offset };
  });

  return {
    ...ruta,
    puntos,
    pasos,
    acumulados,
    largoTotalM,
    // El total informado por el servicio puede diferir un poco del medido
    // sobre la geometría; manda el medido para que el progreso cuadre.
    distanciaM: largoTotalM || ruta.distanciaM || 0,
    duracionMin: ruta.duracionMin || 0,
  };
}

/**
 * Sitúa una posición GPS sobre la ruta preparada.
 *
 * @param {object} ruta        resultado de `prepararRuta`
 * @param {[number,number]} pos posición actual [lat, lng]
 * @param {number} desdeIndice  vértice desde el que buscar (evita saltar a un
 *                              tramo posterior cuando la ruta se cruza consigo misma)
 * @returns {{recorridoM:number, restanteM:number, desviacionM:number,
 *            indice:number, proyeccion:[number,number]}}
 */
export function localizarEnRuta(ruta, pos, desdeIndice = 0) {
  const { puntos, acumulados, largoTotalM } = ruta;

  // Ventana de búsqueda hacia adelante. Si nada encaja se reintenta con la
  // ruta completa: es el caso de quien retrocede o se desvía mucho.
  const buscar = (desde, hasta) => {
    let mejor = { distancia: Infinity, indice: desde, t: 0, proyeccion: puntos[desde] };
    for (let i = desde; i < hasta; i++) {
      const a = puntos[i];
      const b = puntos[i + 1];
      const pa = aPlano(a, pos);
      const pb = aPlano(b, pos);
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const largo2 = dx * dx + dy * dy;

      // Parámetro de la proyección sobre el segmento, recortado a [0, 1].
      let t = largo2 === 0 ? 0 : -(pa.x * dx + pa.y * dy) / largo2;
      t = Math.max(0, Math.min(1, t));

      const px = pa.x + t * dx;
      const py = pa.y + t * dy;
      const distancia = Math.hypot(px, py); // el origen del plano es `pos`

      if (distancia < mejor.distancia) {
        mejor = {
          distancia,
          indice: i,
          t,
          proyeccion: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        };
      }
    }
    return mejor;
  };

  const inicio = Math.max(0, Math.min(desdeIndice - 3, puntos.length - 2));
  const fin = Math.min(puntos.length - 1, inicio + 60);
  let mejor = buscar(inicio, fin);

  // Si la ventana deja al usuario lejos de la ruta, puede ser un desvío real
  // o que la ventana se quedó corta: se verifica contra la ruta completa.
  if (mejor.distancia > 30 && (inicio > 0 || fin < puntos.length - 1)) {
    const completa = buscar(0, puntos.length - 1);
    if (completa.distancia < mejor.distancia) mejor = completa;
  }

  const recorridoM =
    acumulados[mejor.indice] +
    mejor.t * (acumulados[mejor.indice + 1] - acumulados[mejor.indice]);

  return {
    recorridoM,
    restanteM: Math.max(0, largoTotalM - recorridoM),
    desviacionM: mejor.distancia,
    indice: mejor.indice,
    proyeccion: mejor.proyeccion,
  };
}

/**
 * Paso de las indicaciones que corresponde al avance actual.
 * @returns {{indice:number, paso:object|null, distanciaAManiobraM:number}}
 */
export function pasoActivo(ruta, recorridoM) {
  const pasos = ruta.pasos || [];
  if (pasos.length === 0) return { indice: -1, paso: null, distanciaAManiobraM: 0 };

  // Primer paso que aún no se ha terminado de recorrer.
  let indice = pasos.findIndex((p) => recorridoM < p.finM - 1);
  if (indice === -1) indice = pasos.length - 1;

  return {
    indice,
    paso: pasos[indice],
    distanciaAManiobraM: Math.max(0, pasos[indice].finM - recorridoM),
  };
}

/** Divide la polilínea en el tramo ya recorrido y el que falta. */
export function partirRuta(ruta, recorridoM) {
  const { puntos, acumulados } = ruta;
  const corte = puntos.findIndex((_, i) => acumulados[i] >= recorridoM);
  if (corte <= 0) return { recorrido: [], restante: puntos };
  return {
    recorrido: puntos.slice(0, corte + 1),
    restante: puntos.slice(corte),
  };
}

/** Formatea metros para mostrar al usuario ("350 m", "1,2 km"). */
export function formatearDistancia(metros) {
  if (!Number.isFinite(metros)) return '—';
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Formatea minutos ("8 min", "1 h 15 min"). */
export function formatearDuracion(minutos) {
  if (!Number.isFinite(minutos)) return '—';
  const total = Math.max(1, Math.round(minutos));
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${total % 60} min`;
}
