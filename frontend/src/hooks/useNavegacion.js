// src/hooks/useNavegacion.js
// Motor de navegación en tiempo real, estilo Waze/Google Maps.
//
// Esri solo ofrece seguimiento de ruta con recálculo automático en sus SDK
// nativos (iOS, Android, .NET, Flutter): en web no existe. Este hook lo
// implementa sobre el servicio de rutas:
//   1. pide la ruta real por calles al backend (que habla con ArcGIS),
//   2. proyecta cada lectura del GPS sobre la polilínea para saber el avance
//      real siguiendo la calle y qué maniobra toca,
//   3. detecta la salida del trayecto y recalcula solo,
//   4. anuncia las indicaciones por voz.
import { useState, useEffect, useRef, useCallback } from 'react';
import { rutasApi } from '../utilidades/api';
import { useGeolocation } from './useGeolocation';
import { useWakeLock } from './useWakeLock';
import {
  prepararRuta,
  localizarEnRuta,
  pasoActivo,
  partirRuta,
  distanciaM,
  rumbo,
} from '../utilidades/geoRuta';
// Instrumentación de diagnóstico dev-only (Fase 1, DIAG-01) -- ver
// diagnosticoLatencias.js: no-op en producción, nunca registra coordenadas.
import { marcar, medir, MARCAS, TRAMOS } from '../utilidades/diagnosticoLatencias';

// Distancia al trayecto a partir de la cual se considera que el usuario se salió.
export const UMBRAL_DESVIO_M = 45;
// Lecturas seguidas fuera de ruta antes de recalcular: filtra el ruido del GPS.
export const LECTURAS_PARA_RECALCULAR = 3;
// Tiempo mínimo entre recálculos. Cada uno es una petición facturable a ArcGIS.
export const ESPERA_ENTRE_RECALCULOS_MS = 15000;
// Diez metros de banda evita alternar por ruido alrededor de la entrada. No
// reutiliza el margen geomÃ©trico interno de localizarEnRuta (30 m).
const UMBRAL_SALIDA_DESVIO_M = 35;
const MARGEN_PRECISION_DESVIO_M = 10;
const PRECISION_MAXIMA_DESVIO_M = 50;
const TOLERANCIA_RUMBO_DESVIO_GRADOS = 120;
const DESPLAZAMIENTO_MINIMO_COHERENTE_M = 8;
const VENTANA_CONFIRMACION_DESVIO_MS = ESPERA_ENTRE_RECALCULOS_MS;
// Radio de llegada al destino.
const RADIO_LLEGADA_M = 25;
// Antelación con la que se anuncia la siguiente maniobra.
const AVISO_PROXIMIDAD_M = 60;

const FASE_DESVIO_NORMAL = 'normal';
const FASE_DESVIO_CANDIDATO = 'candidato';
const FASE_DESVIO_CONFIRMADO = 'confirmado';
const FASE_DESVIO_SOLICITADO = 'solicitado';
const FASE_DESVIO_APLICADO = 'aplicado';

function crearEstadoDesvio() {
  return {
    fase: FASE_DESVIO_NORMAL,
    lecturas: 0,
    primeraLecturaMs: null,
  };
}

function diferenciaCircularGrados(a, b) {
  const diferencia = Math.abs(a - b) % 360;
  return Math.min(diferencia, 360 - diferencia);
}

function rumboLocalDeRuta(ruta, indice) {
  const puntoInicial = ruta?.puntos?.[indice];
  const puntoFinal = ruta?.puntos?.[indice + 1];
  if (!puntoInicial || !puntoFinal) return null;
  return rumbo(puntoInicial, puntoFinal);
}

/**
 * EvalÃºa una lectura ya aceptada por useGeolocation sin volver a proyectarla.
 * `speed` y `heading` son corroboraciÃ³n opcional: null significa evidencia
 * desconocida, nunca una contradicciÃ³n automÃ¡tica.
 */
function evaluarEvidenciaDesvio({ ubicacion, position, anterior, timestamp, ruta }) {
  const desviacionM = ubicacion?.desviacionM;
  const accuracyM = position?.accuracy;
  if (!Number.isFinite(desviacionM)) {
    return { valida: false, desviado: false, confianza: 'desconocida', razon: 'distancia-invalida' };
  }
  if (!Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > PRECISION_MAXIMA_DESVIO_M) {
    return { valida: false, desviado: false, confianza: 'baja', razon: 'precision-invalida' };
  }

  const umbralEntradaM = Math.max(UMBRAL_DESVIO_M, accuracyM + MARGEN_PRECISION_DESVIO_M);
  let coherente = true;

  const tiempoAnteriorValido = Number.isFinite(anterior?.timestamp);
  const tiempoActualValido = Number.isFinite(timestamp);
  if (tiempoAnteriorValido && tiempoActualValido && timestamp <= anterior.timestamp) {
    return { valida: false, desviado: false, confianza: 'desconocida', razon: 'timestamp-obsoleto' };
  }

  const speed = position?.speed;
  if (speed != null && Number.isFinite(speed)) {
    if (speed < 0) coherente = false;
    if (
      coherente
      && tiempoAnteriorValido
      && tiempoActualValido
      && timestamp > anterior.timestamp
      && Number.isFinite(anterior.lat)
      && Number.isFinite(anterior.lng)
    ) {
      const desplazamientoM = distanciaM(
        [anterior.lat, anterior.lng],
        [position.lat, position.lng],
      );
      const transcurridoMs = timestamp - anterior.timestamp;
      // Tolerancia amplia para un GPS mÃ³vil, pero un salto de decenas de metros
      // con velocidad cero no puede convertirse en una salida persistente.
      const desplazamientoMaximoM = Math.max(
        20,
        (speed * transcurridoMs / 1000) * 3 + accuracyM * 2,
      );
      if (desplazamientoM > desplazamientoMaximoM) coherente = false;
    }
  }
  if (speed != null && !Number.isFinite(speed)) coherente = false;

  const heading = position?.heading;
  if (heading != null && Number.isFinite(heading)) {
    let referenciaRumbo = null;
    if (
      tiempoAnteriorValido
      && tiempoActualValido
      && Number.isFinite(anterior?.lat)
      && Number.isFinite(anterior?.lng)
      && distanciaM([anterior.lat, anterior.lng], [position.lat, position.lng]) >= DESPLAZAMIENTO_MINIMO_COHERENTE_M
    ) {
      referenciaRumbo = rumbo([anterior.lat, anterior.lng], [position.lat, position.lng]);
    }
    referenciaRumbo ??= rumboLocalDeRuta(ruta, ubicacion.indice);
    if (
      referenciaRumbo != null
      && diferenciaCircularGrados(heading, referenciaRumbo) > TOLERANCIA_RUMBO_DESVIO_GRADOS
    ) {
      coherente = false;
    }
  }
  if (heading != null && !Number.isFinite(heading)) coherente = false;

  const confianza = accuracyM <= 20 ? 'alta' : accuracyM <= 35 ? 'media' : 'baja';
  return {
    valida: coherente,
    desviado: coherente && desviacionM > umbralEntradaM,
    confianza,
    razon: coherente
      ? (desviacionM > umbralEntradaM ? 'distancia-confirmable' : 'dentro-de-ruta')
      : 'movimiento-incoherente',
    desviacionM,
  };
}

/**
 * MÃ¡quina pequeÃ±a y pura para persistencia/histÃ©resis. No hace llamadas ni
 * conoce React; la solicitud se produce Ãºnicamente al devolver confirmado.
 */
function avanzarEstadoDesvio(actual, evidencia, timestamp, ahora = Date.now()) {
  const estado = actual || crearEstadoDesvio();
  if (!evidencia?.valida) return { estado, evento: 'evidencia-ignorada' };

  const marca = Number.isFinite(timestamp) ? timestamp : ahora;
  const superaEntrada = evidencia.desviado;
  const estaBajoSalida = evidencia.desviacionM <= UMBRAL_SALIDA_DESVIO_M;

  if (estado.fase === FASE_DESVIO_APLICADO) {
    return avanzarEstadoDesvio(crearEstadoDesvio(), evidencia, timestamp, ahora);
  }
  if (estado.fase === FASE_DESVIO_NORMAL) {
    if (!superaEntrada) return { estado, evento: 'sin-desvio' };
    return {
      estado: { fase: FASE_DESVIO_CANDIDATO, lecturas: 1, primeraLecturaMs: marca },
      evento: 'desvio-detectado',
    };
  }
  if (estado.fase === FASE_DESVIO_CANDIDATO) {
    if (estaBajoSalida) return { estado: crearEstadoDesvio(), evento: 'desvio-descartado' };
    if (
      Number.isFinite(estado.primeraLecturaMs)
      && marca - estado.primeraLecturaMs > VENTANA_CONFIRMACION_DESVIO_MS
    ) {
      return superaEntrada
        ? {
          estado: { fase: FASE_DESVIO_CANDIDATO, lecturas: 1, primeraLecturaMs: marca },
          evento: 'desvio-detectado',
        }
        : { estado: crearEstadoDesvio(), evento: 'desvio-descartado' };
    }
    if (!superaEntrada) return { estado, evento: 'candidato-persistente' };
    const lecturas = estado.lecturas + 1;
    if (lecturas >= LECTURAS_PARA_RECALCULAR) {
      return {
        estado: { ...estado, fase: FASE_DESVIO_CONFIRMADO, lecturas },
        evento: 'desvio-confirmado',
      };
    }
    return { estado: { ...estado, lecturas }, evento: 'candidato-persistente' };
  }
  if (estado.fase === FASE_DESVIO_CONFIRMADO && estaBajoSalida) {
    return { estado: crearEstadoDesvio(), evento: 'desvio-superado' };
  }
  return { estado, evento: 'desvio-confirmado' };
}

/** Lee un sitio del catálogo como punto [lat, lng] válido, o null. */
function puntoDeSitio(sitio) {
  const lat = Number(sitio?.lat);
  const lng = Number(sitio?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function useNavegacion() {
  const [estado, setEstado] = useState('inactivo'); // inactivo | calculando | previsualizando | navegando | llegado | error
  const wakeLock = useWakeLock(estado === 'calculando' || estado === 'navegando');

  // Alta precisión (más batería) solo mientras hay una ruta en curso; el resto
  // del tiempo (p. ej. "Zona Actual" en Home) basta con la ubicación gruesa.
  const precisionAlta = estado === 'calculando' || estado === 'navegando';
  const {
    position,
    isSimulated,
    gpsConfiable,
    ultimaActualizacion,
    loading: gpsCargando,
    error: gpsError,
    permiso: gpsPermiso,
    reintentar: reintentarGps,
  } = useGeolocation({ precisionAlta });

  const [ruta, setRuta] = useState(null);
  const [avance, setAvance] = useState(null);
  const [instruccion, setInstruccion] = useState(null);
  const [tramos, setTramos] = useState({ recorrido: [], restante: [] });
  const [destino, setDestino] = useState(null);
  const [modo, setModo] = useState('walk');
  const [error, setError] = useState('');
  const [recalculando, setRecalculando] = useState(false);
  const [estadoDesvio, setEstadoDesvio] = useState(FASE_DESVIO_NORMAL);
  const [confianzaDesvio, setConfianzaDesvio] = useState('desconocida');
  const [vozActiva, setVozActiva] = useState(true);
  // Punto de partida elegido a mano cuando no hay GPS real (permiso denegado
  // o sin señal): reemplaza la posición simulada del centro de Itagüí solo
  // para CALCULAR la ruta inicial. El seguimiento en vivo sigue dependiendo
  // del GPS real, porque un punto fijo no puede simular movimiento.
  const [origenManual, setOrigenManual] = useState(null);

  // Refs: el bucle del GPS no debe re-suscribirse en cada render.
  const rutaRef = useRef(null);
  const indiceRef = useRef(0);
  const pasoAnunciadoRef = useRef(-1);
  const avisoAnunciadoRef = useRef(-1);
  const vozActivaRef = useRef(true);
  const calculandoRef = useRef(false);
  const desvioRef = useRef(crearEstadoDesvio());
  const ultimaObservacionGpsRef = useRef(null);
  const sesionRef = useRef(0);
  const generacionSolicitudRef = useRef(0);
  const solicitudActivaRef = useRef(null);
  const cooldownRecalculoRef = useRef(0);

  useEffect(() => { vozActivaRef.current = vozActiva; }, [vozActiva]);

  // ─── Voz ──────────────────────────────────────────────────
  const hablar = useCallback((texto) => {
    if (!vozActivaRef.current || !texto) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      // Corta cualquier anuncio anterior sin terminar: sin esto, si dos
      // maniobras llegan seguidas (cruces cercanos) se encolan y la segunda
      // suena tarde, cuando ya no aplica.
      window.speechSynthesis.cancel();
      const mensaje = new SpeechSynthesisUtterance(texto);
      mensaje.lang = 'es-CO';
      mensaje.rate = 1;
      window.speechSynthesis.speak(mensaje);
    } catch {
      // La síntesis de voz es un extra: si el navegador no la permite, se sigue.
    }
  }, []);

  const callar = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // ─── Cálculo de la ruta ───────────────────────────────────
  const calcular = useCallback(async (origen, destinoPunto, modoViaje, esRecalculo = false, esVistaPrevia = false) => {
    const sesion = sesionRef.current;
    const generacion = ++generacionSolicitudRef.current;
    solicitudActivaRef.current = { sesion, generacion };
    calculandoRef.current = true;
    // Tramo 5 (solicitud->respuesta ArcGIS): arranca aquí, tras el guard de
    // identidad, para que una solicitud sustituida no contamine la mediciÃ³n.
    marcar(MARCAS.SOLICITUD_ENVIADA);

    if (esRecalculo) {
      desvioRef.current = { ...desvioRef.current, fase: FASE_DESVIO_SOLICITADO };
      setEstadoDesvio(FASE_DESVIO_SOLICITADO);
      setRecalculando(true);
    }
    else setEstado(esVistaPrevia ? 'previsualizando' : 'calculando');
    setError('');

    const sigueVigente = () => (
      sesionRef.current === sesion
      && solicitudActivaRef.current?.sesion === sesion
      && solicitudActivaRef.current?.generacion === generacion
    );

    try {
      const cruda = await rutasApi.resolver(origen, destinoPunto, modoViaje, destinoPunto.nombre);
      if (!sigueVigente()) return null;
      // Cubre el viaje completo frontend->backend->ArcGIS->frontend, no solo
      // el tiempo interno de ArcGIS -- también sirve de arranque del tramo 6
      // (respuesta->ruta renderizada), que 01-04 empareja en InteractiveMap.jsx.
      marcar(MARCAS.RESPUESTA_RECIBIDA);
      medir(TRAMOS.SOLICITUD_RESPUESTA_ARCGIS, MARCAS.SOLICITUD_ENVIADA, MARCAS.RESPUESTA_RECIBIDA);
      const preparada = prepararRuta(cruda);
      if (!preparada) throw new Error('La ruta recibida no tiene un trayecto válido.');

      rutaRef.current = preparada;
      indiceRef.current = 0;
      pasoAnunciadoRef.current = -1;
      avisoAnunciadoRef.current = -1;
      ultimaObservacionGpsRef.current = null;

      setRuta(preparada);
      setTramos({ recorrido: [], restante: preparada.puntos });
      setEstado(esVistaPrevia ? 'previsualizando' : 'navegando');

      if (esRecalculo) {
        desvioRef.current = { ...crearEstadoDesvio(), fase: FASE_DESVIO_APLICADO };
        setEstadoDesvio(FASE_DESVIO_APLICADO);
        cooldownRecalculoRef.current = Date.now() + ESPERA_ENTRE_RECALCULOS_MS;
        hablar('Recalculando la ruta.');
      } else {
        desvioRef.current = crearEstadoDesvio();
        setEstadoDesvio(FASE_DESVIO_NORMAL);
      }
      return preparada;
    } catch (err) {
      if (!sigueVigente()) return null;
      setError(err.message || 'No se pudo calcular la ruta.');
      if (!esRecalculo) setEstado('error');
      if (esRecalculo) {
        desvioRef.current = { ...desvioRef.current, fase: FASE_DESVIO_CONFIRMADO };
        setEstadoDesvio(FASE_DESVIO_CONFIRMADO);
      }
      return null;
    } finally {
      if (sigueVigente()) {
        solicitudActivaRef.current = null;
        calculandoRef.current = false;
        setRecalculando(false);
      }
    }
  }, [hablar]);

  // ─── Acciones públicas ────────────────────────────────────
  const iniciar = useCallback((sitio, modoViaje = 'walk') => {
    // Cada inicio representa una sesiÃ³n nueva: cualquier respuesta pendiente
    // de la navegaciÃ³n anterior queda inservible aunque no sea abortable.
    sesionRef.current += 1;
    generacionSolicitudRef.current += 1;
    solicitudActivaRef.current = null;
    calculandoRef.current = false;
    cooldownRecalculoRef.current = 0;
    rutaRef.current = null;
    indiceRef.current = 0;
    ultimaObservacionGpsRef.current = null;
    desvioRef.current = crearEstadoDesvio();
    setEstadoDesvio(FASE_DESVIO_NORMAL);
    setConfianzaDesvio('desconocida');
    setRecalculando(false);
    setRuta(null);
    setAvance(null);
    setInstruccion(null);
    setTramos({ recorrido: [], restante: [] });

    const base = puntoDeSitio(sitio);
    if (!base) {
      setError('El sitio no tiene coordenadas registradas.');
      setEstado('error');
      return;
    }
    // El origen elegido a mano (cuando no hay GPS real) solo sirve para
    // calcular ESTA ruta inicial; el seguimiento en vivo de más abajo sigue
    // dependiendo de `position` sin importar esto.
    const origen = origenManual || position;
    if (!origen) {
      setError('Aún no tenemos tu ubicación. Activa el GPS y concede el permiso.');
      setEstado('error');
      return;
    }
    // El nombre viaja con el destino para que las indicaciones lo mencionen,
    // también en los recálculos por desvío.
    const puntoDestino = { ...base, nombre: sitio.name || 'Destino' };
    setDestino(puntoDestino);
    setModo(modoViaje);
    const esVistaPrevia = Boolean(origenManual || isSimulated || !gpsConfiable);
    calcular(origen, puntoDestino, modoViaje, false, esVistaPrevia);
  }, [position, origenManual, isSimulated, gpsConfiable, calcular]);

  const detener = useCallback(() => {
    sesionRef.current += 1;
    generacionSolicitudRef.current += 1;
    solicitudActivaRef.current = null;
    calculandoRef.current = false;
    cooldownRecalculoRef.current = 0;
    callar();
    rutaRef.current = null;
    indiceRef.current = 0;
    pasoAnunciadoRef.current = -1;
    avisoAnunciadoRef.current = -1;
    desvioRef.current = crearEstadoDesvio();
    ultimaObservacionGpsRef.current = null;
    setEstado('inactivo');
    setEstadoDesvio(FASE_DESVIO_NORMAL);
    setConfianzaDesvio('desconocida');
    setRecalculando(false);
    setRuta(null);
    setAvance(null);
    setInstruccion(null);
    setTramos({ recorrido: [], restante: [] });
    setDestino(null);
    setError('');
    setOrigenManual(null);
  }, [callar]);

  const recalcularAhora = useCallback(() => {
    if (!position || !destino || !gpsConfiable || isSimulated || estado !== 'navegando') return;
    calcular(position, destino, modo, true);
  }, [position, destino, modo, gpsConfiable, isSimulated, estado, calcular]);

  // ─── Bucle de seguimiento ─────────────────────────────────
  // Se dispara con cada lectura del GPS mientras haya navegación activa.
  useEffect(() => {
    if (estado !== 'navegando' || !gpsConfiable || isSimulated || !position || !rutaRef.current || !destino) return;

    const rutaActual = rutaRef.current;
    const pos = [position.lat, position.lng];
    const timestampGps = Number.isFinite(ultimaActualizacion) ? ultimaActualizacion : null;
    const anteriorGps = ultimaObservacionGpsRef.current;

    const ubicacion = localizarEnRuta(rutaActual, pos, indiceRef.current);
    indiceRef.current = ubicacion.indice;
    setAvance(ubicacion);
    setTramos(partirRuta(rutaActual, ubicacion.recorridoM));

    // Llegada: se mide también en línea recta al destino, no solo sobre la
    // ruta, porque el último tramo puede terminar en la acera de enfrente.
    const distanciaAlDestinoM = distanciaM(pos, [destino.lat, destino.lng]);

    if (distanciaAlDestinoM <= RADIO_LLEGADA_M || ubicacion.restanteM <= RADIO_LLEGADA_M) {
      setEstado('llegado');
      setInstruccion({ texto: 'Has llegado a tu destino', distanciaM: 0, indice: -1, total: 0 });
      hablar(`Has llegado a ${destino.nombre}.`);
      return;
    }

    // Maniobra activa.
    const { indice, paso, distanciaAManiobraM } = pasoActivo(rutaActual, ubicacion.recorridoM);
    if (paso) {
      const siguiente = rutaActual.pasos[indice + 1] || null;
      setInstruccion({
        texto: paso.texto,
        distanciaM: distanciaAManiobraM,
        indice,
        total: rutaActual.pasos.length,
        siguienteTexto: siguiente?.texto || null,
      });

      if (pasoAnunciadoRef.current !== indice) {
        pasoAnunciadoRef.current = indice;
        avisoAnunciadoRef.current = -1;
        hablar(paso.texto);
      } else if (
        siguiente &&
        distanciaAManiobraM <= AVISO_PROXIMIDAD_M &&
        avisoAnunciadoRef.current !== indice
      ) {
        avisoAnunciadoRef.current = indice;
        hablar(`En ${Math.round(distanciaAManiobraM / 10) * 10} metros, ${siguiente.texto}`);
      }
    }

    // Detección de desvío y recálculo automático.
    if (desvioRef.current.fase !== FASE_DESVIO_SOLICITADO) {
      const evidencia = evaluarEvidenciaDesvio({
        ubicacion,
        position,
        anterior: anteriorGps,
        timestamp: timestampGps,
        ruta: rutaActual,
      });
      const transicion = avanzarEstadoDesvio(
        desvioRef.current,
        evidencia,
        timestampGps,
      );
      desvioRef.current = transicion.estado;
      setEstadoDesvio(transicion.estado.fase);
      if (evidencia.confianza) setConfianzaDesvio(evidencia.confianza);

      if (transicion.evento === 'desvio-detectado') {
        marcar(MARCAS.DESVIO_DETECTADO);
      }
      if (
        transicion.estado.fase === FASE_DESVIO_CONFIRMADO
        && Date.now() >= cooldownRecalculoRef.current
        && !calculandoRef.current
      ) {
        marcar(MARCAS.RECALCULO_SOLICITADO);
        medir(TRAMOS.DESVIO_SOLICITUD, MARCAS.DESVIO_DETECTADO, MARCAS.RECALCULO_SOLICITADO);
        calcular(position, destino, modo, true);
      }
    }

    const timestampOrdenado = !Number.isFinite(timestampGps)
      || !Number.isFinite(anteriorGps?.timestamp)
      || timestampGps > anteriorGps.timestamp;
    if (timestampOrdenado) {
      ultimaObservacionGpsRef.current = {
        lat: position.lat,
        lng: position.lng,
        timestamp: timestampGps,
      };
    }

  }, [position, estado, destino, modo, gpsConfiable, isSimulated, ultimaActualizacion, calcular, hablar]);

  useEffect(() => {
    if (estado === 'navegando' && !gpsConfiable) callar();
  }, [estado, gpsConfiable, callar]);

  // Silenciar la voz al desmontar.
  useEffect(() => callar, [callar]);

  // ─── Datos derivados para la interfaz ─────────────────────
  const largoTotalM = ruta?.largoTotalM || 0;
  const restanteM = avance?.restanteM ?? largoTotalM;
  const progreso = largoTotalM > 0
    ? Math.max(0, Math.min(100, Math.round(((largoTotalM - restanteM) / largoTotalM) * 100)))
    : 0;
  const tiempoRestanteMin = largoTotalM > 0 && ruta?.duracionMin
    ? (ruta.duracionMin * restanteM) / largoTotalM
    : 0;

  return {
    // Ubicación del usuario
    posicion: position,
    posicionSimulada: isSimulated,
    gpsConfiable,
    ultimaActualizacion,
    gpsCargando,
    gpsError,
    gpsPermiso,
    reintentarGps,
    // Origen a mano (cuando no hay GPS real) y el que realmente cuenta para
    // calcular la ruta inicial y las vistas previas de distancia/tiempo.
    origenManual,
    setOrigenManual,
    origenEfectivo: origenManual || position,

    // Estado de la navegación
    estado,
    wakeLock,
    activa: estado === 'calculando' || estado === 'previsualizando' || estado === 'navegando' || estado === 'llegado',
    navegando: estado === 'navegando',
    previsualizando: estado === 'previsualizando',
    llegado: estado === 'llegado',
    recalculando,
    estadoDesvio,
    confianzaDesvio,
    desvioDetectado: estadoDesvio === FASE_DESVIO_CANDIDATO
      || estadoDesvio === FASE_DESVIO_CONFIRMADO
      || estadoDesvio === FASE_DESVIO_SOLICITADO,
    recalculoSolicitado: estadoDesvio === FASE_DESVIO_SOLICITADO,
    rutaAplicada: estadoDesvio === FASE_DESVIO_APLICADO,
    error,

    // Ruta y avance
    ruta,
    destino,
    modo,
    // El mapa puede derivar una tangente visual de este matching existente;
    // la pausa de cámara nunca entra como dependencia del motor.
    avanceRuta: avance,
    tramos,
    instruccion,
    desviacionM: avance?.desviacionM ?? 0,
    fueraDeRuta: (avance?.desviacionM ?? 0) > UMBRAL_DESVIO_M,
    distanciaRestanteM: restanteM,
    distanciaTotalM: largoTotalM,
    tiempoRestanteMin,
    progreso,

    // Acciones
    iniciar,
    detener,
    recalcularAhora,
    vozActiva,
    setVozActiva,
  };
}
