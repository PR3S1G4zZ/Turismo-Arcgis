// src/hooks/useGeolocation.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { distanciaM, rumbo, suavizarRumbo, VELOCIDAD_MIN_MS } from '../utilidades/geoRuta';
import { marcar, MARCAS } from '../utilidades/diagnosticoLatencias';

// Coordenadas del Parque Principal de Itagüí como último recurso (solo si el
// usuario deniega el permiso o el GPS no está disponible).
const FALLBACK_LAT = 6.1724;
const FALLBACK_LNG = -75.6091;

// Umbrales para deducir el rumbo. El GPS solo da `coords.heading` fiable cuando
// hay velocidad; a pie casi siempre viene null, así que se calcula entre
// lecturas separadas por al menos unos metros (menos que eso es ruido del GPS).
const DESPLAZAMIENTO_MIN_M = 5;
const PRECISION_MAXIMA_M = 50;
// Los teléfonos pueden tardar varios segundos en entregar una fijación de
// alta precisión, especialmente al salir de un edificio. La vigencia lógica
// permite conservar un fix reciente durante un intervalo lento, sin esperar
// indefinidamente al timeout del navegador.
const EDAD_MAXIMA_EN_VIVO_MS = 10000;
const VIGENCIA_RUMBO_MS = 5000;
const GRACIA_LECTURA_INVALIDA_MS = 8000;
const TIMEOUT_GEOLOCALIZACION_MS = 15000;
const MAXIMUM_AGE_GEOLOCALIZACION_MS = 2000;
const ADELANTO_MAXIMO_RELOJ_MS = 30000;
const VELOCIDAD_MAXIMA_PLAUSIBLE_MS = 80;
const MARGEN_SALTO_GPS_M = 20;

const geolocationSupported =
  typeof navigator !== 'undefined' && 'geolocation' in navigator;

// Códigos de GeolocationPositionError (por nombre, para que el mapeo de
// mensajes se lea sin recordar qué número es cada cosa).
const ERROR_PERMISO_DENEGADO = 1;
const ERROR_POSICION_NO_DISPONIBLE = 2;
const ERROR_TIMEOUT = 3;

/**
 * Traduce el error crudo del navegador a un mensaje accionable en español.
 * El código 1 (permiso denegado) es ambiguo por sí solo: puede ser la primera
 * vez que se pregunta o un bloqueo permanente. `permiso` (del Permissions API,
 * cuando está disponible) desempata entre "toca Reintentar" y "actívalo desde
 * los ajustes del navegador", porque lo segundo ningún código en la página
 * puede resolverlo por sí solo.
 */
function mensajeDeError(err, permiso) {
  switch (err.code) {
    case ERROR_PERMISO_DENEGADO:
      return permiso === 'denied'
        ? 'Bloqueaste el permiso de ubicación. Actívalo desde el ícono 🔒 junto a la dirección del sitio (o en Ajustes del sitio de tu navegador) y vuelve a intentar.'
        : 'No se concedió el permiso de ubicación. Toca «Reintentar» para volver a pedirlo.';
    case ERROR_POSICION_NO_DISPONIBLE:
      return 'No se pudo determinar tu ubicación. Verifica que el GPS de tu dispositivo esté activado.';
    case ERROR_TIMEOUT:
      return 'Se agotó el tiempo esperando señal GPS. Verifica tu conexión y que el GPS esté encendido.';
    default:
      return 'No se pudo obtener tu ubicación.';
  }
}

/**
/**
 * Ubicación REAL del usuario, en vivo. Usa watchPosition para seguir la posición
 * del dispositivo mientras se mueve. `isSimulated` es true solo cuando se cae al
 * centro de Itagüí porque no hay permiso o señal (para poder avisarlo en la UI).
 *
 * @param {{precisionAlta?: boolean}} opciones `enableHighAccuracy` del GPS.
 *   Cuesta batería real en el teléfono: solo hace falta mientras hay una ruta
 *   en curso, no mientras el usuario simplemente navega el sitio (por eso es
 *   un parámetro y no una constante fija).
 *
 * Nota: la geolocalización del navegador exige contexto seguro (HTTPS) o
 * localhost. En el servidor de la Alcaldía debe servirse por HTTPS.
 */
export const useGeolocation = ({ precisionAlta = true } = {}) => {
  const [position, setPosition] = useState(
    geolocationSupported ? null : { lat: FALLBACK_LAT, lng: FALLBACK_LNG }
  );
  const [error, setError] = useState(
    geolocationSupported ? null : 'Geolocalización no soportada en este navegador.'
  );
  const [loading, setLoading] = useState(geolocationSupported);
  const [isSimulated, setIsSimulated] = useState(!geolocationSupported);
  const [gpsConfiable, setGpsConfiable] = useState(false);
  const [calidadGps, setCalidadGps] = useState(geolocationSupported ? 'sin_senal' : 'simulada');
  const [motivoCalidad, setMotivoCalidad] = useState(geolocationSupported ? 'esperando-fix' : 'geolocalizacion-no-soportada');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [vigenciaPosicionHasta, setVigenciaPosicionHasta] = useState(null);
  const [vigenciaRumboHasta, setVigenciaRumboHasta] = useState(null);
  // Estado real del permiso ('prompt' | 'granted' | 'denied'), cuando el
  // navegador expone el Permissions API para geolocalización. 'desconocido'
  // en el resto de los casos (p. ej. Safari/iOS), donde solo queda inferir
  // por el código de error de cada intento.
  const [permiso, setPermiso] = useState('desconocido');
  const permisoRef = useRef('desconocido');
  const precisionAltaRef = useRef(precisionAlta);
  const watchIdRef = useRef(null);
  // Última coordenada cruda y último rumbo suavizado, para deducir la dirección
  // de marcha entre lecturas sin re-suscribir el watch en cada render.
  const ultimaCoordRef = useRef(null);
  const rumboRef = useRef(null);
  const rumboTimestampRef = useRef(null);
  const ultimaAceptacionEnMsRef = useRef(null);
  const watchGeneracionRef = useRef(0);
  // Último error crudo del GPS, para poder retraducir el mensaje si el estado
  // de permiso se resuelve o cambia DESPUÉS de mostrado (la consulta al
  // Permissions API es async y puede llegar más tarde que el primer error).
  const ultimoErrorRef = useRef(null);
  const ultimoTimestampRef = useRef(null);

  useEffect(() => {
    permisoRef.current = permiso;
    if (ultimoErrorRef.current) {
      setError(mensajeDeError(ultimoErrorRef.current, permiso));
    }
  }, [permiso]);

  // Extraído para poder volver a pedirlo con un toque explícito del usuario
  // (`reintentar`): algunos navegadores móviles no muestran el diálogo nativo
  // de permiso si la primera petición ocurre sola al cargar la página, sin
  // ningún gesto del usuario de por medio.
  const iniciarSeguimiento = useCallback(() => {
    if (!geolocationSupported) return;
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);

    const watchGeneracion = ++watchGeneracionRef.current;

    setLoading(true);
    setError(null);
    ultimoErrorRef.current = null;

    const invalidarLectura = (motivo) => {
      const hayFixReciente = ultimaAceptacionEnMsRef.current != null
        && Date.now() - ultimaAceptacionEnMsRef.current <= GRACIA_LECTURA_INVALIDA_MS;
      // Un outlier no sustituye ni invalida inmediatamente el último fix
      // aceptado. Mientras siga dentro de la ventana de gracia, la cámara y la
      // flecha conservan una referencia estable; el progreso no recibe ningún
      // punto nuevo porque position tampoco cambia. Fuera de la ventana ya no
      // hay un fix reciente que conservar: calidadGps debe reflejar pérdida de
      // señal ('sin_senal'), no imprecisión ('degradada'), para no contradecir
      // gpsConfiable=false en mensajeEstadoGps (estadoGps.js).
      setGpsConfiable(hayFixReciente);
      setCalidadGps(hayFixReciente ? 'degradada' : 'sin_senal');
      setMotivoCalidad(motivo);
      setLoading(false);
    };

    const handleSuccess = (pos) => {
      if (watchGeneracionRef.current !== watchGeneracion) return;
      const { latitude, longitude, accuracy, heading: rumboGps, speed } = pos.coords;
      const timestamp = pos.timestamp;
      const ahora = Date.now();
      const coordenadasValidas = Number.isFinite(latitude)
        && latitude >= -90
        && latitude <= 90
        && Number.isFinite(longitude)
        && longitude >= -180
        && longitude <= 180;
      const relojNoAdelantado = timestamp - ahora <= ADELANTO_MAXIMO_RELOJ_MS;
      const esReciente = !precisionAltaRef.current
        || ahora - timestamp <= EDAD_MAXIMA_EN_VIVO_MS;
      const saltoPlausible = !ultimaCoordRef.current
        || (distanciaM(
          [ultimaCoordRef.current.lat, ultimaCoordRef.current.lng],
          [latitude, longitude],
        ) <= VELOCIDAD_MAXIMA_PLAUSIBLE_MS
          * Math.max((timestamp - ultimaCoordRef.current.timestamp) / 1000, 0.1)
          + Math.max(MARGEN_SALTO_GPS_M, ultimaCoordRef.current.accuracy + accuracy));
      const esConfiable = Number.isFinite(accuracy)
        && accuracy <= PRECISION_MAXIMA_M
        && Number.isFinite(timestamp)
        && (ultimoTimestampRef.current == null || timestamp > ultimoTimestampRef.current)
        && coordenadasValidas
        && relojNoAdelantado
        && esReciente
        && saltoPlausible;

      if (!esConfiable) {
        const motivo = !coordenadasValidas ? 'coordenadas-invalidas'
          : !Number.isFinite(accuracy) || accuracy > PRECISION_MAXIMA_M ? 'precision-baja'
            : !relojNoAdelantado ? 'reloj-futuro'
              : !esReciente ? 'fix-stale'
                : !saltoPlausible ? 'salto-no-plausible' : 'timestamp-obsoleto';
        invalidarLectura(motivo);
        return;
      }

      if (rumboTimestampRef.current != null
        && timestamp - rumboTimestampRef.current > EDAD_MAXIMA_EN_VIVO_MS) {
        rumboRef.current = null;
        rumboTimestampRef.current = null;
      }

      // Rumbo, en orden de preferencia: 1) el del GPS si hay movimiento real,
      // 2) el deducido entre la lectura anterior y esta, 3) el último conocido.
      // Se calcula sobre las coordenadas CRUDAS: suavizarlas antes aplanaría
      // el desplazamiento real y dañaría la dirección deducida.
      let rumboCrudo = null;
      if (Number.isFinite(rumboGps) && (speed == null || speed > VELOCIDAD_MIN_MS)) {
        rumboCrudo = rumboGps;
      } else if (ultimaCoordRef.current) {
        const previa = ultimaCoordRef.current;
        if (distanciaM([previa.lat, previa.lng], [latitude, longitude]) >= DESPLAZAMIENTO_MIN_M) {
          rumboCrudo = rumbo([previa.lat, previa.lng], [latitude, longitude]);
        }
      }
      if (rumboCrudo != null) {
        rumboRef.current = suavizarRumbo(rumboRef.current, rumboCrudo);
        rumboTimestampRef.current = timestamp;
      }
      ultimaCoordRef.current = { lat: latitude, lng: longitude, accuracy, timestamp };
      ultimoTimestampRef.current = timestamp;

      // Marca de arranque compartida por los tramos 1 (GPS->marcador) y 3
      // (GPS->cámara) del diagnóstico de latencias (Fase 1, DIAG-01): solo
      // fijaciones que llegan hasta aquí (esConfiable=true) la disparan.
      // Los extremos finales de ambos tramos se emparejan en
      // InteractiveMap.jsx (Plan 01-04).
      marcar(MARCAS.GPS_ACEPTADO);

      // Navegación y cámara consumen la fijación aceptada sin interpolación.
      // La interpolación pertenece exclusivamente al marcador visual del mapa.
      setPosition({
        lat: latitude,
        lng: longitude,
        accuracy,
        // Dirección de marcha en grados (0–360) o null mientras no se conozca.
        heading: rumboRef.current,
        speed: Number.isFinite(speed) ? speed : null,
      });
      ultimoErrorRef.current = null;
      setError(null);
      setIsSimulated(false);
      setGpsConfiable(true);
      setCalidadGps('confiable');
      setMotivoCalidad('fix-aceptado');
      setUltimaActualizacion(timestamp);
      ultimaAceptacionEnMsRef.current = ahora;
      setVigenciaPosicionHasta(precisionAltaRef.current ? ahora + EDAD_MAXIMA_EN_VIVO_MS : null);
      setVigenciaRumboHasta(rumboRef.current == null ? null : ahora + VIGENCIA_RUMBO_MS);
      setLoading(false);
    };

    const handleError = (err) => {
      if (watchGeneracionRef.current !== watchGeneracion) return;
      console.warn(`Error de geolocalización (${err.code}): ${err.message}.`);
      const hayFixReciente = ultimaAceptacionEnMsRef.current != null
        && Date.now() - ultimaAceptacionEnMsRef.current <= GRACIA_LECTURA_INVALIDA_MS;
      const esErrorTransitorio = err.code === ERROR_TIMEOUT || err.code === ERROR_POSICION_NO_DISPONIBLE;
      const conservarFix = hayFixReciente && esErrorTransitorio;
      // Un timeout puntual del watch no es un permiso denegado. Ocultar el
      // error transitorio evita que RouteModal muestre una tarjeta fatal cada
      // pocos segundos mientras el navegador sigue intentando obtener señal.
      ultimoErrorRef.current = conservarFix ? null : err;
      setError(conservarFix ? null : mensajeDeError(err, permisoRef.current));
      setGpsConfiable(conservarFix);
      setCalidadGps('sin_senal');
      setMotivoCalidad(err.code === ERROR_TIMEOUT ? 'timeout' : `error-${err.code}`);
      // Solo se usa un origen sintético cuando nunca hubo una fijación fiable.
      // Si el GPS falla después, conservar el último punto real evita que la
      // ruta parezca saltar a otro lugar mientras se recupera la señal.
      if (ultimoTimestampRef.current == null) {
        setPosition({ lat: FALLBACK_LAT, lng: FALLBACK_LNG });
        setIsSimulated(true);
      } else if (!conservarFix) {
        setPosition((previa) => {
          if (!previa || previa.heading == null) return previa;
          return { ...previa, heading: null };
        });
      }
      if (!conservarFix) {
        rumboRef.current = null;
        rumboTimestampRef.current = null;
        ultimaCoordRef.current = null;
        setVigenciaRumboHasta(null);
      }
      setLoading(false);
    };

    // Seguimiento en vivo de la ubicación real del dispositivo.
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: precisionAltaRef.current,
      timeout: TIMEOUT_GEOLOCALIZACION_MS,
      maximumAge: MAXIMUM_AGE_GEOLOCALIZACION_MS,
    });
  }, []);

  useEffect(() => {
    // La suscripción del GPS se crea al montar y su callback es quien actualiza estado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    iniciarSeguimiento();
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [iniciarSeguimiento]);

  // `enableHighAccuracy` no se puede cambiar en un watch ya activo: hay que
  // cerrarlo y volver a pedirlo. Se salta el primer render (el montaje ya lo
  // arranca arriba con el valor inicial) para no reabrir el watch dos veces
  // al cargar la página.
  const primeraVezRef = useRef(true);
  useEffect(() => {
    precisionAltaRef.current = precisionAlta;
    if (primeraVezRef.current) {
      primeraVezRef.current = false;
      return;
    }
    iniciarSeguimiento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisionAlta]);

  useEffect(() => {
    if (!precisionAlta || ultimaActualizacion == null) return undefined;
    const ahora = Date.now();
    const posicionHasta = vigenciaPosicionHasta
      ?? (ultimaAceptacionEnMsRef.current != null
        ? ultimaAceptacionEnMsRef.current + EDAD_MAXIMA_EN_VIVO_MS
        : ahora);
    const rumboHasta = vigenciaRumboHasta;
    const timers = [];
    if (rumboHasta != null) {
      timers.push(setTimeout(() => {
        rumboRef.current = null;
        rumboTimestampRef.current = null;
        setPosition((previa) => {
          if (!previa || previa.heading == null) return previa;
          return { ...previa, heading: null };
        });
        setVigenciaRumboHasta(null);
      }, Math.max(0, rumboHasta - ahora)));
    }
    timers.push(setTimeout(() => {
      ultimaCoordRef.current = null;
      setGpsConfiable(false);
      setCalidadGps('sin_senal');
      setMotivoCalidad('fix-stale');
      setVigenciaPosicionHasta(null);
    }, Math.max(0, posicionHasta - ahora)));
    return () => timers.forEach(clearTimeout);
  }, [precisionAlta, ultimaActualizacion, vigenciaPosicionHasta, vigenciaRumboHasta]);

  // Permissions API: cuando está disponible, dice el estado REAL del permiso
  // ('prompt' | 'granted' | 'denied'), no solo lo que se infiere de un error
  // puntual. Con `onchange` nos enteramos si el usuario lo activa desde los
  // ajustes del navegador mientras la página sigue abierta, y retomamos el
  // GPS solos — sin que tenga que volver a tocar "Reintentar".
  // No está disponible en todos los navegadores (Safari/iOS es el caso
  // notable): ahí `permiso` se queda en 'desconocido' y solo queda inferir
  // por el código de cada error, que ya cubre `mensajeDeError`.
  useEffect(() => {
    if (!geolocationSupported || typeof navigator.permissions?.query !== 'function') return;
    let status = null;
    let cancelado = false;

    const manejarCambio = () => {
      if (!status) return;
      setPermiso(status.state);
      if (status.state !== 'denied') iniciarSeguimiento();
    };

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((res) => {
        if (cancelado) return;
        status = res;
        setPermiso(res.state);
        status.addEventListener('change', manejarCambio);
      })
      .catch(() => {
        // El navegador no soporta consultar este permiso: se queda en
        // 'desconocido' y la UI se apoya solo en el código de error.
      });

    return () => {
      cancelado = true;
      status?.removeEventListener('change', manejarCambio);
    };
  }, [iniciarSeguimiento]);

  // Nota: si el navegador ya bloqueó el permiso ("denied", no "prompt"),
  // reintentar() no puede volver a mostrar el diálogo — eso solo lo deshace
  // el usuario desde los ajustes de sitio de su navegador. Si el estado es
  // "prompt" (nunca se decidió, o se reseteó), sí vuelve a preguntar.
  return {
    position,
    error,
    loading,
    isSimulated,
    posicionSimulada: isSimulated,
    gpsConfiable,
    calidadGps,
    motivoCalidad,
    ultimaActualizacion,
    vigenciaPosicionHasta,
    vigenciaRumboHasta,
    permiso,
    reintentar: iniciarSeguimiento,
  };
};
