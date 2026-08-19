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
import {
  prepararRuta,
  localizarEnRuta,
  pasoActivo,
  partirRuta,
  distanciaM,
} from '../utilidades/geoRuta';

// Distancia al trayecto a partir de la cual se considera que el usuario se salió.
const UMBRAL_DESVIO_M = 45;
// Lecturas seguidas fuera de ruta antes de recalcular: filtra el ruido del GPS.
const LECTURAS_PARA_RECALCULAR = 3;
// Tiempo mínimo entre recálculos. Cada uno es una petición facturable a ArcGIS.
const ESPERA_ENTRE_RECALCULOS_MS = 15000;
// Radio de llegada al destino.
const RADIO_LLEGADA_M = 25;
// Antelación con la que se anuncia la siguiente maniobra.
const AVISO_PROXIMIDAD_M = 60;

/** Lee un sitio del catálogo como punto [lat, lng] válido, o null. */
function puntoDeSitio(sitio) {
  const lat = Number(sitio?.lat);
  const lng = Number(sitio?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function useNavegacion() {
  const [estado, setEstado] = useState('inactivo'); // inactivo | calculando | previsualizando | navegando | llegado | error

  // Alta precisión (más batería) solo mientras hay una ruta en curso; el resto
  // del tiempo (p. ej. "Zona Actual" en Home) basta con la ubicación gruesa.
  const precisionAlta = estado !== 'inactivo';
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
  const [vozActiva, setVozActiva] = useState(true);
  // Punto de partida elegido a mano cuando no hay GPS real (permiso denegado
  // o sin señal): reemplaza la posición simulada del centro de Itagüí solo
  // para CALCULAR la ruta inicial. El seguimiento en vivo sigue dependiendo
  // del GPS real, porque un punto fijo no puede simular movimiento.
  const [origenManual, setOrigenManual] = useState(null);

  // Refs: el bucle del GPS no debe re-suscribirse en cada render.
  const rutaRef = useRef(null);
  const indiceRef = useRef(0);
  const ultimoCalculoRef = useRef(0);
  const lecturasFueraRef = useRef(0);
  const pasoAnunciadoRef = useRef(-1);
  const avisoAnunciadoRef = useRef(-1);
  const vozActivaRef = useRef(true);
  const calculandoRef = useRef(false);

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
    if (calculandoRef.current) return;
    calculandoRef.current = true;
    ultimoCalculoRef.current = Date.now();

    if (esRecalculo) setRecalculando(true);
    else setEstado('calculando');
    setError('');

    try {
      const cruda = await rutasApi.resolver(origen, destinoPunto, modoViaje, destinoPunto.nombre);
      const preparada = prepararRuta(cruda);
      if (!preparada) throw new Error('La ruta recibida no tiene un trayecto válido.');

      rutaRef.current = preparada;
      indiceRef.current = 0;
      lecturasFueraRef.current = 0;
      pasoAnunciadoRef.current = -1;
      avisoAnunciadoRef.current = -1;

      setRuta(preparada);
      setTramos({ recorrido: [], restante: preparada.puntos });
      setEstado(esVistaPrevia ? 'previsualizando' : 'navegando');

      if (esRecalculo) hablar('Recalculando la ruta.');
      return preparada;
    } catch (err) {
      setError(err.message || 'No se pudo calcular la ruta.');
      if (!esRecalculo) setEstado('error');
      return null;
    } finally {
      calculandoRef.current = false;
      setRecalculando(false);
    }
  }, [hablar]);

  // ─── Acciones públicas ────────────────────────────────────
  const iniciar = useCallback((sitio, modoViaje = 'walk') => {
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
    callar();
    rutaRef.current = null;
    indiceRef.current = 0;
    lecturasFueraRef.current = 0;
    pasoAnunciadoRef.current = -1;
    avisoAnunciadoRef.current = -1;
    setEstado('inactivo');
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
    ultimoCalculoRef.current = 0;
    calcular(position, destino, modo, true);
  }, [position, destino, modo, gpsConfiable, isSimulated, estado, calcular]);

  // ─── Bucle de seguimiento ─────────────────────────────────
  // Se dispara con cada lectura del GPS mientras haya navegación activa.
  useEffect(() => {
    if (estado !== 'navegando' || !gpsConfiable || isSimulated || !position || !rutaRef.current || !destino) return;

    const rutaActual = rutaRef.current;
    const pos = [position.lat, position.lng];

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
    if (ubicacion.desviacionM > UMBRAL_DESVIO_M) {
      lecturasFueraRef.current += 1;
      const suficientesLecturas = lecturasFueraRef.current >= LECTURAS_PARA_RECALCULAR;
      const pasoElTiempo = Date.now() - ultimoCalculoRef.current > ESPERA_ENTRE_RECALCULOS_MS;
      if (suficientesLecturas && pasoElTiempo) {
        lecturasFueraRef.current = 0;
        calcular(position, destino, modo, true);
      }
    } else {
      lecturasFueraRef.current = 0;
    }
  }, [position, estado, destino, modo, gpsConfiable, isSimulated, calcular, hablar]);

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
    activa: estado === 'calculando' || estado === 'previsualizando' || estado === 'navegando' || estado === 'llegado',
    navegando: estado === 'navegando',
    previsualizando: estado === 'previsualizando',
    llegado: estado === 'llegado',
    recalculando,
    error,

    // Ruta y avance
    ruta,
    destino,
    modo,
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
