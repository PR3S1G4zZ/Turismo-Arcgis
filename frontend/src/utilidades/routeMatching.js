import { POSITION_SOURCES } from './navigationContracts';
import { getNavigationProfile } from './navigationProfiles';
import { prepararRuta, proyectarPuntoEnSegmento } from './geoRuta';

const SEGMENTOS_HACIA_ATRAS = 3;
const SEGMENTOS_HACIA_ADELANTE = 60;
const AVANCE_MAXIMO_POR_DEFECTO_M = 120;
const TOLERANCIA_ACUMULADA_M = 0.01;

function esNumeroFinito(value) {
  return Number.isFinite(value);
}

function limitar(value, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, value));
}

/** Devuelve una coordenada de navegación en formato [lat, lng]. */
function puntoComoArray(punto) {
  if (Array.isArray(punto) && punto.length >= 2) {
    const lat = Number(punto[0]);
    const lng = Number(punto[1]);
    return esNumeroFinito(lat) && esNumeroFinito(lng) ? [lat, lng] : null;
  }

  const fuente = punto?.coords && typeof punto.coords === 'object'
    ? punto.coords
    : punto;
  const lat = Number(fuente?.lat ?? fuente?.latitude);
  const lng = Number(fuente?.lng ?? fuente?.longitude);
  return esNumeroFinito(lat) && esNumeroFinito(lng) ? [lat, lng] : null;
}

function puntoComoObjeto(punto) {
  const normalizado = puntoComoArray(punto);
  return normalizado ? { lat: normalizado[0], lng: normalizado[1] } : null;
}

/**
 * Calcula el ancho del corredor de matching según el perfil y la precisión
 * de la observación. La precisión nunca puede ampliar el corredor por encima
 * del máximo calibrado del perfil.
 *
 * @param {{profile?:'car'|'walk', perfil?:'car'|'walk', accuracyM?:number,
 *          accuracy?:number, precisionM?:number}|'car'|'walk'} config
 * @param {number} [accuracyM]
 */
export function calcularCorredorM(config = {}, accuracyM) {
  const opciones = typeof config === 'string'
    ? { profile: config, accuracyM }
    : typeof config === 'number'
      ? { accuracyM: config }
      : (config || {});
  const perfil = opciones.profile || opciones.perfil || 'walk';
  const matching = getNavigationProfile(perfil).matching;
  const precision = Number(opciones.accuracyM ?? opciones.accuracy ?? opciones.precisionM);
  const accuracyValida = esNumeroFinito(precision) && precision >= 0 ? precision : 0;
  return limitar(
    Math.max(matching.corridorMinM, accuracyValida * matching.accuracyMultiplier),
    matching.corridorMinM,
    matching.corridorMaxM,
  );
}

function rutaPreparada(ruta) {
  const puntosOriginales = ruta?.puntos;
  if (!Array.isArray(puntosOriginales) || puntosOriginales.length < 2) return null;
  const puntos = puntosOriginales.map(puntoComoArray);
  if (puntos.some((punto) => punto == null)) return null;

  const acumuladosValidos = Array.isArray(ruta.acumulados)
    && ruta.acumulados.length === puntos.length
    && ruta.acumulados.every(esNumeroFinito);
  if (acumuladosValidos && esNumeroFinito(ruta.largoTotalM)) {
    return { ...ruta, puntos };
  }
  return prepararRuta({ ...ruta, puntos });
}

function indiceAnteriorDe(opciones) {
  const previo = opciones.previousMatch || opciones.anterior || {};
  const valor = opciones.previousIndex
    ?? opciones.previousSegmentIndex
    ?? opciones.lastIndex
    ?? opciones.lastSegmentIndex
    ?? opciones.desdeIndice
    ?? opciones.indiceAnterior
    ?? previo.routeSegmentIndex
    ?? previo.segmentIndex
    ?? previo.indice;
  return esNumeroFinito(Number(valor)) ? Math.trunc(Number(valor)) : null;
}

function progresoAnteriorDe(opciones, ruta, indice) {
  const previo = opciones.previousMatch || opciones.anterior || {};
  const valor = opciones.previousProgressM
    ?? opciones.previousRecorridoM
    ?? opciones.lastProgressM
    ?? opciones.lastRecorridoM
    ?? opciones.progresoAnteriorM
    ?? previo.progressM
    ?? previo.lastProgressM
    ?? previo.recorridoM;
  if (esNumeroFinito(Number(valor))) return Number(valor);
  return indice == null ? null : ruta.acumulados[limitar(indice, 0, ruta.puntos.length - 2)];
}

function timestampDe(observacion, opciones) {
  const timestamp = observacion.timestamp ?? opciones.timestamp;
  return esNumeroFinito(Number(timestamp)) ? Number(timestamp) : null;
}

function velocidadDe(observacion, opciones) {
  const velocidad = observacion.speed ?? observacion.velocidadMps ?? opciones.speedMps;
  return esNumeroFinito(Number(velocidad)) && Number(velocidad) >= 0 ? Number(velocidad) : null;
}

function maximoAvanceM({ observacion, opciones, perfil, accuracyM, timestamp }) {
  const configurado = opciones.maxForwardProgressM
    ?? opciones.maxProgressDeltaM
    ?? opciones.maximoAvanceM;
  if (esNumeroFinito(Number(configurado)) && Number(configurado) >= 0) return Number(configurado);

  const previo = opciones.previousMatch || opciones.anterior || {};
  const anteriorTimestamp = opciones.previousTimestamp
    ?? opciones.anteriorTimestamp
    ?? opciones.lastTimestamp
    ?? previo.timestamp;
  const dtMs = esNumeroFinito(Number(anteriorTimestamp)) && timestamp != null
    ? timestamp - Number(anteriorTimestamp)
    : null;
  if (dtMs != null && dtMs >= 0) {
    const velocidad = velocidadDe(observacion, opciones);
    const velocidadReferencia = velocidad ?? (perfil === 'car' ? 8 : 2);
    return Math.max(
      30,
      velocidadReferencia * (dtMs / 1000) * 3 + accuracyM * 2,
    );
  }
  return AVANCE_MAXIMO_POR_DEFECTO_M;
}

function rangoDeBusqueda(ruta, indiceAnterior, opciones = {}) {
  const ultimoSegmento = ruta.puntos.length - 2;
  if (indiceAnterior == null || opciones.searchAll === true || opciones.buscarTodaRuta === true) {
    return { inicio: 0, fin: ultimoSegmento + 1 };
  }
  const inicio = limitar(indiceAnterior - SEGMENTOS_HACIA_ATRAS, 0, ultimoSegmento);
  const fin = Math.min(ultimoSegmento + 1, indiceAnterior + SEGMENTOS_HACIA_ADELANTE + 1);
  return { inicio, fin };
}

function candidatosEnRango(ruta, posicion, rango) {
  const candidatos = [];
  for (let indice = rango.inicio; indice < rango.fin; indice += 1) {
    const proyeccion = proyectarPuntoEnSegmento(
      posicion,
      ruta.puntos[indice],
      ruta.puntos[indice + 1],
    );
    const inicioM = ruta.acumulados[indice];
    const finM = ruta.acumulados[indice + 1];
    candidatos.push({
      ...proyeccion,
      indice,
      recorridoM: inicioM + proyeccion.t * (finM - inicioM),
    });
  }
  return candidatos;
}

function mejorCandidato(candidatos, progresoAnterior = null) {
  return candidatos.reduce((mejor, candidato) => {
    if (!mejor) return candidato;
    if (candidato.distanciaM < mejor.distanciaM - TOLERANCIA_ACUMULADA_M) return candidato;
    if (Math.abs(candidato.distanciaM - mejor.distanciaM) > TOLERANCIA_ACUMULADA_M) return mejor;

    // En un cruce exacto la continuidad de progreso resuelve el empate; si
    // no hay continuidad disponible, el tramo anterior gana por estabilidad.
    if (progresoAnterior != null) {
      const distanciaAlAnterior = Math.abs(candidato.recorridoM - progresoAnterior);
      const distanciaMejorAlAnterior = Math.abs(mejor.recorridoM - progresoAnterior);
      if (distanciaAlAnterior < distanciaMejorAlAnterior - TOLERANCIA_ACUMULADA_M) {
        return candidato;
      }
      if (distanciaAlAnterior > distanciaMejorAlAnterior + TOLERANCIA_ACUMULADA_M) {
        return mejor;
      }
    }
    return candidato.indice < mejor.indice ? candidato : mejor;
  }, null);
}

function puntoDeEntrada(rutaOrOptions, posicionOrOptions, opcionesEntrada) {
  if (rutaOrOptions?.puntos) {
    return {
      ruta: rutaOrOptions,
      posicion: posicionOrOptions,
      opciones: opcionesEntrada || {},
    };
  }

  const opciones = rutaOrOptions || {};
  return {
    ruta: opciones.route || opciones.ruta,
    posicion: opciones.rawPosition
      || opciones.position
      || opciones.posicion
      || opciones.observacion,
    opciones: { ...opciones, ...(opciones.options || {}) },
  };
}

function opcionesDeMatcher(optionsOrProfile = {}) {
  if (typeof optionsOrProfile === 'string') return { profile: optionsOrProfile };
  return optionsOrProfile || {};
}

/**
 * Prepara una ruta para matching repetido sin mutar la geometría recibida.
 * `localizarPosicion` acepta el objeto devuelto o la ruta directamente.
 */
export function prepararRouteMatcher(ruta, optionsOrProfile = {}) {
  const options = opcionesDeMatcher(optionsOrProfile);
  const preparada = rutaPreparada(ruta);
  const profile = options.profile || options.perfil || options.mode || options.modo || 'walk';
  return {
    route: preparada,
    ruta: preparada,
    profile,
    options: { ...options, profile },
  };
}

/**
 * Hace matching conservador de una observación sobre la ruta.
 *
 * La coordenada cruda siempre se devuelve. Solo se publica `matchedPosition`
 * cuando la proyección cae dentro del corredor del perfil; de lo contrario
 * `positionSource` permanece en `raw` y `isOffRoute` queda visible para el
 * consumidor. El progreso se retiene cuando el candidato implicaría un salto
 * incompatible con el índice/avance anterior.
 *
 * @returns {object} resultado de matching compatible con NavigationPose
 */
export function matchRoutePosition(rutaOrOptions, posicionOrOptions, opcionesEntrada) {
  const entrada = puntoDeEntrada(rutaOrOptions, posicionOrOptions, opcionesEntrada);
  const opciones = entrada.opciones || {};
  const observacion = entrada.posicion || {};
  const rawArray = puntoComoArray(observacion);
  const rawPosition = rawArray ? puntoComoObjeto(rawArray) : null;
  const perfil = opciones.profile
    || opciones.perfil
    || opciones.mode
    || opciones.modo
    || 'walk';
  const accuracyRaw = observacion.accuracy
    ?? observacion.precisionM
    ?? opciones.accuracyM
    ?? opciones.accuracy;
  const accuracyM = esNumeroFinito(Number(accuracyRaw)) && Number(accuracyRaw) >= 0
    ? Number(accuracyRaw)
    : 0;
  const corridorM = calcularCorredorM({ profile: perfil, accuracyM });
  const indiceAnterior = indiceAnteriorDe(opciones);
  const ruta = rutaPreparada(entrada.ruta);
  const progresoAnterior = ruta
    ? progresoAnteriorDe(opciones, ruta, indiceAnterior)
    : null;
  const resultadoBase = {
    rawPosition,
    matchedPosition: null,
    source: POSITION_SOURCES.RAW,
    positionSource: POSITION_SOURCES.RAW,
    isOffRoute: true,
    confidence: 'lost',
    distanceToRouteM: Infinity,
    deviationM: Infinity,
    desviacionM: Infinity,
    corridorM,
    routeSegmentIndex: null,
    segmentIndex: null,
    indice: null,
    candidateProgressM: null,
    progressM: progresoAnterior,
    recorridoM: progresoAnterior,
    progressPlausible: false,
    remainingM: null,
    restanteM: null,
    projection: null,
    proyeccion: null,
  };
  if (!ruta || !rawArray) return resultadoBase;

  const rango = rangoDeBusqueda(ruta, indiceAnterior, opciones);
  let candidatos = candidatosEnRango(ruta, rawArray, rango);
  let candidato = mejorCandidato(candidatos, progresoAnterior);

  // Una lectura que deja la ventana local lejos de la ruta puede significar
  // que el usuario retrocedió o que el trazado tiene segmentos muy largos.
  // La recuperación global solo se usa si ningún candidato local está dentro
  // del corredor; así no convierte un cruce lejano en un salto silencioso.
  if (candidato && candidato.distanciaM > corridorM && rango.inicio > 0) {
    candidatos = candidatosEnRango(ruta, rawArray, { inicio: 0, fin: ruta.puntos.length - 1 });
    const global = mejorCandidato(candidatos, progresoAnterior);
    if (global && global.distanciaM < candidato.distanciaM) candidato = global;
  }
  if (!candidato) return resultadoBase;

  const timestamp = timestampDe(observacion, opciones);
  const maxAvanceM = maximoAvanceM({
    observacion,
    opciones,
    perfil,
    accuracyM,
    timestamp,
  });
  const perfilNavegacion = getNavigationProfile(perfil);
  const toleranciaRetrocesoM = Math.max(
    perfilNavegacion.motion.progressEnterM,
    accuracyM * 2,
  );
  const deltaM = progresoAnterior == null ? 0 : candidato.recorridoM - progresoAnterior;
  const avancePlausible = progresoAnterior == null
    || (deltaM <= maxAvanceM + TOLERANCIA_ACUMULADA_M
      && deltaM >= -toleranciaRetrocesoM - TOLERANCIA_ACUMULADA_M);
  const progresoAceptadoM = progresoAnterior == null || avancePlausible
    ? Math.max(progresoAnterior ?? 0, candidato.recorridoM)
    : progresoAnterior;
  const dentroDelCorredor = candidato.distanciaM <= corridorM;
  const matchedPosition = dentroDelCorredor ? puntoComoObjeto(candidato.proyeccion) : null;
  const progressM = dentroDelCorredor ? progresoAceptadoM : progresoAnterior;
  const restanteM = progressM == null
    ? null
    : Math.max(0, ruta.largoTotalM - progressM);
  const confidence = dentroDelCorredor
    ? (accuracyM <= 20 ? 'high' : accuracyM <= 35 ? 'medium' : 'low')
    : 'low';
  const source = matchedPosition ? POSITION_SOURCES.MATCHED : POSITION_SOURCES.RAW;

  return {
    ...resultadoBase,
    matchedPosition,
    source,
    positionSource: source,
    isOffRoute: !dentroDelCorredor,
    confidence,
    distanceToRouteM: candidato.distanciaM,
    deviationM: candidato.distanciaM,
    desviacionM: candidato.distanciaM,
    corridorM,
    routeSegmentIndex: candidato.indice,
    segmentIndex: candidato.indice,
    indice: candidato.indice,
    candidateProgressM: candidato.recorridoM,
    progressM,
    recorridoM: progressM,
    progressPlausible: avancePlausible,
    remainingM: restanteM,
    restanteM,
    projection: puntoComoObjeto(candidato.proyeccion),
    proyeccion: candidato.proyeccion,
    timestamp,
  };
}

/**
 * Localiza una posición usando un matcher preparado o una ruta directa. El
 * contexto de cada lectura es deliberadamente explícito para que un cruce no
 * dependa de estado oculto del módulo.
 */
export function localizarPosicion(matcherOrRuta, posicion, context = {}) {
  const esMatcher = matcherOrRuta
    && !matcherOrRuta.puntos
    && (matcherOrRuta.route || matcherOrRuta.ruta);
  const ruta = esMatcher ? matcherOrRuta.route || matcherOrRuta.ruta : matcherOrRuta;
  const opcionesMatcher = esMatcher ? matcherOrRuta.options || {} : {};
  const opcionesContexto = context || {};
  return matchRoutePosition(ruta, posicion, {
    ...opcionesMatcher,
    ...opcionesContexto,
    profile: opcionesContexto.profile
      || opcionesContexto.perfil
      || opcionesMatcher.profile
      || opcionesMatcher.perfil,
  });
}

/**
 * Crea un matcher con memoria únicamente del último progreso aceptado. La
 * función sigue siendo pura respecto del mundo exterior y permite reiniciar
 * el estado sin tocar React ni la cámara.
 */
export function createRouteMatcher(ruta, opciones = {}) {
  const matcherPreparado = prepararRouteMatcher(ruta, opciones);
  let previousMatch = null;
  const matcher = (posicion, opcionesLectura = {}) => {
    const resultado = localizarPosicion(matcherPreparado, posicion, {
      ...opcionesLectura,
      previousMatch: opcionesLectura.previousMatch || previousMatch,
    });
    if (
      !resultado.isOffRoute
      && resultado.progressPlausible
      && Number.isFinite(resultado.progressM)
    ) {
      previousMatch = resultado;
    }
    return resultado;
  };
  matcher.match = matcher;
  matcher.reset = () => { previousMatch = null; };
  return matcher;
}

// Alias en español y nombres cortos para consumidores de las distintas olas.
export const crearMatcherRuta = createRouteMatcher;
export const prepararMatcherRuta = prepararRouteMatcher;
export const matchPosition = matchRoutePosition;
export const localizarPosicionEnRuta = localizarPosicion;
export const hacerMatchingRuta = matchRoutePosition;
export const calcularCorredor = calcularCorredorM;
