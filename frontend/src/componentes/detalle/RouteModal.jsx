// src/componentes/detalle/RouteModal.jsx
import { useState, useEffect, useMemo, useContext } from 'react';
import {
  RiCloseLine,
  RiCarLine,
  RiWalkLine,
  RiNavigationLine,
  RiSubtractLine,
  RiFlagLine,
  RiUserLocationLine,
  RiErrorWarningLine,
  RiCheckboxCircleLine,
  RiCornerUpLeftLine,
  RiCornerUpRightLine,
  RiArrowUpLine,
  RiLoopLeftLine,
  RiVolumeUpLine,
  RiVolumeMuteLine,
  RiRefreshLine
} from 'react-icons/ri';
import { AppContext } from '../../contexto/AppContext';
import { NavegacionContext } from '../../contexto/NavegacionContext';
import { formatearDistancia, formatearDuracion, distanciaM } from '../../utilidades/geoRuta';
import './RouteModal.css';

/**
 * Icono de la maniobra. Se deduce del texto de la indicación, que viene ya en
 * español tanto de ArcGIS como del respaldo: así el mismo mapeo sirve para los
 * dos proveedores sin depender de sus códigos internos de maniobra.
 */
function IconoManiobra({ texto = '', llegada = false }) {
  if (llegada) return <RiFlagLine />;
  const t = texto.toLowerCase();
  if (t.includes('glorieta') || t.includes('rotonda')) return <RiLoopLeftLine />;
  if (t.includes('izquierda')) return <RiCornerUpLeftLine />;
  if (t.includes('derecha')) return <RiCornerUpRightLine />;
  return <RiArrowUpLine />;
}

export const RouteModal = ({ isOpen, onClose, site }) => {
  const { isRouteMapOpen, setIsRouteMapOpen, setActiveRouteMode } = useContext(AppContext);
  const {
    posicion: userPosition,
    posicionSimulada: userLocationSimulated,
    estado,
    navegando,
    llegado,
    recalculando,
    fueraDeRuta,
    error: navError,
    gpsError,
    gpsPermiso,
    reintentarGps,
    ruta,
    instruccion,
    distanciaRestanteM,
    tiempoRestanteMin,
    progreso,
    iniciar,
    detener,
    recalcularAhora,
    vozActiva,
    setVozActiva,
  } = useContext(NavegacionContext);

  const [step, setStep] = useState('transport'); // 'transport' | 'confirm' | 'tracking'
  const [mode, setMode] = useState('walk'); // 'walk' | 'car'
  const [isMinimized, setIsMinimized] = useState(false);

  // Estados de acoplamiento de la Isla Dinámica (Desktop Drag & Snap)
  const [dockPosition, setDockPosition] = useState('top'); // 'top' | 'bottom' | 'left' | 'right'
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Guardar hora de inicio fija
  const startTime = useMemo(() => {
    if (step === 'tracking') {
      const now = new Date();
      return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return '';
  }, [step]);

  // Calcular hora estimada de llegada
  const endTime = useMemo(() => {
    if (step === 'tracking') {
      const now = new Date();
      now.setMinutes(now.getMinutes() + Math.round(tiempoRestanteMin));
      return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return '';
  }, [step, tiempoRestanteMin]);

  const timelineTitle = useMemo(() => {
    if (!site) return "Ruta de Destino";
    return `Ruta a ${site.name}`;
  }, [site]);

  const [isClosing, setIsClosing] = useState(false);

  // Limpiar estados al desmontar
  useEffect(() => {
    return () => {
      detener();
      setIsRouteMapOpen(false);
    };
  }, [detener, setIsRouteMapOpen]);

  const handleSelectMode = (selectedMode) => {
    setMode(selectedMode);
    setStep('confirm');
  };

  const handleStart = () => {
    setStep('tracking');
    setIsMinimized(false);
    setActiveRouteMode(mode);
    setIsRouteMapOpen(true); // La guía nace con el mapa abierto, como un navegador.
    iniciar(site, mode);
  };

  const handleCancel = () => {
    setStep('transport');
    detener();
    setIsRouteMapOpen(false);
  };

  const handleClose = () => {
    setIsClosing(true);
  };

  const handleTransitionEnd = (e) => {
    // Esperamos a que la transición de opacidad termine para cerrar realmente
    if (isClosing && e.propertyName === 'opacity') {
      detener();
      setIsRouteMapOpen(false);
      onClose();
      setIsClosing(false);
    }
  };

  // Manejo de Arrastre para Desktop
  const handleMouseDown = (e) => {
    if (window.innerWidth <= 768) return; // Solo drag en desktop
    if (isRouteMapOpen) return; // Desactivar drag si el mapa está abierto (forzado a la izquierda)

    // Si hace clic en un botón, enlace, imagen o íconos, no arrastrar
    if (e.target.closest('button, a, img, svg, path')) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
    setDragPos({
      x: rect.left,
      y: rect.top
    });
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      setDragPos({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = (e) => {
      setIsDragging(false);

      const el = document.querySelector('.route-modal') || document.querySelector('.route-pill');
      let centerX = e.clientX;
      let centerY = e.clientY;

      if (el) {
        const rect = el.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
      }

      const w = window.innerWidth;
      const h = window.innerHeight;

      // Calcular distancia a los 4 bordes desde el centro del elemento
      const distTop = centerY;
      const distBottom = h - centerY;
      const distLeft = centerX;
      const distRight = w - centerX;

      const minDist = Math.min(distTop, distBottom, distLeft, distRight);

      // Snap al borde más cercano
      if (minDist === distTop) {
        setDockPosition('top');
      } else if (minDist === distBottom) {
        setDockPosition('bottom');
      } else if (minDist === distLeft) {
        setDockPosition('left');
      } else {
        setDockPosition('right');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!isOpen) return null;

  // Estimación previa al cálculo: distancia en línea recta. Se sustituye por la
  // distancia real por calles en cuanto el servicio devuelve la ruta.
  const rectaM = userPosition && site?.lat && site?.lng
    ? distanciaM([userPosition.lat, userPosition.lng], [Number(site.lat), Number(site.lng)])
    : null;
  const previaDistancia = ruta ? ruta.distanciaM : rectaM;
  const previaTiempo = ruta
    ? ruta.duracionMin
    : (rectaM != null ? (rectaM / 1000 / (mode === 'walk' ? 5 : 30)) * 60 : null);

  const isMobile = window.innerWidth <= 768;
  const currentDock = isMobile ? 'bottom' : (isRouteMapOpen ? 'left' : dockPosition);
  const isPill = isMinimized && step === 'tracking';
  const calculando = estado === 'calculando';
  const mensajeError = navError || gpsError;

  const modalStyles = isDragging ? {
    position: 'fixed',
    left: dragPos.x,
    top: dragPos.y,
    margin: 0,
    transform: 'none',
    cursor: 'grabbing'
  } : {};

  return (
    <div className={`modal-overlay ${isPill ? 'modal-overlay--minimized' : ''}`} onClick={!isPill ? handleClose : undefined}>
      <div
        className={`route-modal ${isPill ? 'route-modal--minimized' : ''} ${step === 'tracking' && !isPill ? 'route-modal--tracking' : ''} ${isDragging ? 'route-modal--dragging' : ''} ${isClosing ? 'route-modal--closing' : ''} route-modal--dock-${currentDock}`}
        onClick={(e) => {
          e.stopPropagation();
          if (isPill) setIsMinimized(false);
        }}
        onMouseDown={handleMouseDown}
        onTransitionEnd={handleTransitionEnd}
        style={modalStyles}
        title={isPill ? "Arrastra a los bordes para mover. Haz clic para maximizar." : (window.innerWidth > 768 ? "Arrastra desde una zona vacía para acoplar a un borde" : undefined)}
      >
        <div className={`route-pill-content ${!isPill ? 'route-pill-content--hidden' : ''}`}>
          {mode === 'walk' ? <RiWalkLine className="route-pill__icon" /> : <RiCarLine className="route-pill__icon" />}
          <span className="route-pill__text">{formatearDistancia(distanciaRestanteM)}</span>
        </div>

        <div className={`route-modal-content ${isPill ? 'route-modal-content--hidden' : ''}`}>
          {window.innerWidth > 768 && <div className="route-modal__drag-handle" />}
          <div className="route-modal__actions-top">
            {step === 'tracking' && (
              <>
                <button
                  className="route-modal__minimize"
                  onClick={(e) => { e.stopPropagation(); setVozActiva(!vozActiva); }}
                  aria-label={vozActiva ? 'Silenciar indicaciones por voz' : 'Activar indicaciones por voz'}
                  title={vozActiva ? 'Silenciar voz' : 'Activar voz'}
                >
                  {vozActiva ? <RiVolumeUpLine /> : <RiVolumeMuteLine />}
                </button>
                <button
                  className="route-modal__minimize"
                  onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                  aria-label="Minimizar ruta"
                  title="Minimizar"
                >
                  <RiSubtractLine />
                </button>
              </>
            )}
            <button className="route-modal__close" onClick={handleClose} aria-label="Cerrar modal">
              <RiCloseLine />
            </button>
          </div>

          {/* PASO 1: Selección de transporte */}
        {step === 'transport' && (
          <div className="route-modal-step">
            <h3 className="route-modal__title">¿Cómo quieres llegar?</h3>
            <div className="transport-options">
              <button className="transport-btn" onClick={() => handleSelectMode('car')}>
                <RiCarLine />
                <span>En auto</span>
              </button>
              <button className="transport-btn" onClick={() => handleSelectMode('walk')}>
                <RiWalkLine />
                <span>A pie</span>
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: Confirmación de ruta */}
        {step === 'confirm' && (
          <div className="route-modal-step">
            <p className="confirm-title-label">Ruta de destino</p>
            <h3 className="confirm-destination">{site.name}</h3>

            <div className="confirm-divider" />

            <div className="confirm-details">
              {mode === 'walk' ? <RiWalkLine size={20} /> : <RiCarLine size={20} />}
              <span>
                <strong>{mode === 'walk' ? 'Caminando' : 'En auto'}</strong>
                {' · '}
                {previaTiempo != null ? `~${formatearDuracion(previaTiempo)}` : '—'}
                {' · '}
                {previaDistancia != null ? formatearDistancia(previaDistancia) : '—'}
              </span>
            </div>

            {/* Estado de la ubicación real del usuario */}
            {!userPosition ? (
              <p className="route-gps-status route-gps-status--wait">
                <RiUserLocationLine /> Obteniendo tu ubicación GPS…
              </p>
            ) : userLocationSimulated ? (
              <p className="route-gps-status route-gps-status--warn">
                <RiErrorWarningLine />{' '}
                {gpsError || 'No se pudo acceder a tu GPS; se usará el centro de Itagüí.'}
                {/* Con el permiso bloqueado, ningún código de la página puede
                    reabrir el diálogo nativo: mostrar "Reintentar" aquí solo
                    repetiría el mismo error sin que el usuario entienda por qué. */}
                {gpsPermiso !== 'denied' && (
                  <>
                    {' '}
                    <button type="button" className="route-gps-status__retry" onClick={reintentarGps}>
                      Reintentar
                    </button>
                  </>
                )}
              </p>
            ) : (
              <p className="route-gps-status route-gps-status--ok">
                <RiUserLocationLine /> Ubicación real detectada. La ruta seguirá tu movimiento en tiempo real.
              </p>
            )}

            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={handleCancel}>
                Atrás
              </button>
              <button className="confirm-btn-start" onClick={handleStart} disabled={!userPosition}>
                <RiNavigationLine />
                <span>Iniciar Ruta</span>
              </button>
            </div>
          </div>
        )}

              {/* PASO 3: Seguimiento Activo - Estilo Timeline */}
        {step === 'tracking' && (
          <div className="route-modal-step">
            <h3 className="route-modal__title route-tracking-title">{timelineTitle}</h3>

            {/* Maniobra actual: lo primero que debe ver quien va caminando. */}
            {calculando ? (
              <div className="maniobra-card maniobra-card--cargando">
                <RiRefreshLine className="maniobra-card__spin" />
                <span>Calculando la mejor ruta…</span>
              </div>
            ) : mensajeError ? (
              <div className="maniobra-card maniobra-card--error">
                <RiErrorWarningLine />
                <div className="maniobra-card__cuerpo">
                  <p className="maniobra-card__texto">{mensajeError}</p>
                  {/* Si el error es de GPS hay que repedir el permiso, no recalcular
                      una ruta que de todas formas partiría de la ubicación simulada.
                      Y si el permiso ya quedó bloqueado, ni eso: ningún código de la
                      página puede reabrir el diálogo, así que no se ofrece un botón
                      que solo repetiría el mismo error. */}
                  {!(gpsError && gpsPermiso === 'denied') && (
                    <button className="maniobra-card__reintentar" onClick={gpsError ? reintentarGps : recalcularAhora}>
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            ) : instruccion ? (
              <div className={`maniobra-card ${llegado ? 'maniobra-card--llegada' : ''}`}>
                <div className="maniobra-card__icono">
                  <IconoManiobra texto={instruccion.texto} llegada={llegado} />
                </div>
                <div className="maniobra-card__cuerpo">
                  {!llegado && (
                    <span className="maniobra-card__distancia font-mono">
                      {formatearDistancia(instruccion.distanciaM)}
                    </span>
                  )}
                  <p className="maniobra-card__texto">{instruccion.texto}</p>
                  {!llegado && instruccion.siguienteTexto && (
                    <p className="maniobra-card__siguiente">Luego: {instruccion.siguienteTexto}</p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Avisos de estado del seguimiento */}
            {recalculando && (
              <p className="route-gps-status route-gps-status--wait">
                <RiRefreshLine /> Te saliste del trayecto: recalculando…
              </p>
            )}
            {!recalculando && fueraDeRuta && navegando && (
              <p className="route-gps-status route-gps-status--warn">
                <RiErrorWarningLine /> Estás fuera del trayecto trazado.
              </p>
            )}

            {/* Resumen: cuánto falta */}
            {ruta && (
              <div className="route-resumen">
                <div className="route-resumen__dato">
                  <span className="route-resumen__valor font-mono">{formatearDistancia(distanciaRestanteM)}</span>
                  <span className="route-resumen__etiqueta">restantes</span>
                </div>
                <div className="route-resumen__dato">
                  <span className="route-resumen__valor font-mono">{formatearDuracion(tiempoRestanteMin)}</span>
                  <span className="route-resumen__etiqueta">de viaje</span>
                </div>
                <div className="route-resumen__dato">
                  <span className="route-resumen__valor font-mono">{endTime}</span>
                  <span className="route-resumen__etiqueta">llegada</span>
                </div>
              </div>
            )}

            {/* Progreso de Ruta */}
            <div className="timeline-progress-section">
              <div className="timeline-progress-labels">
                <span className="progress-label-title">PROGRESO DE RUTA (INICIO: {startTime})</span>
                <span className="progress-label-value font-mono">{progreso}% Completado</span>
              </div>
              <div className="timeline-progress-bar-track">
                <div className="timeline-progress-bar-fill" style={{ width: `${progreso}%` }}></div>
              </div>

              {/* Estado del seguimiento por GPS real */}
              {llegado ? (
                <p className="route-gps-status route-gps-status--ok">
                  <RiCheckboxCircleLine /> ¡Has llegado a tu destino!
                </p>
              ) : navegando ? (
                <p className="route-gps-status route-gps-status--ok">
                  <RiUserLocationLine /> Siguiendo tu ubicación en tiempo real…
                </p>
              ) : null}
            </div>

            {/* Timeline */}
            <div className="route-timeline">
              {/* Origen: Mi ubicación */}
              <div className="timeline-item timeline-item--start">
                <div className="timeline-left">
                  <div className="timeline-check timeline-check--start">
                    <RiUserLocationLine size={14} />
                  </div>
                  <div className="timeline-line"></div>
                </div>
                <div className="timeline-right">
                  <span className="timeline-stop-name">Mi ubicación</span>
                  <span className="timeline-stop-time font-mono">SALIDA {startTime}</span>
                </div>
              </div>

              {/* Destino: Sitio seleccionado */}
              <div className="timeline-item timeline-item--current">
                <div className="timeline-left">
                  <div className="timeline-check timeline-check--current">
                    <div className="timeline-check__dot"></div>
                  </div>
                </div>
                <div className="timeline-right">
                  <div className="next-stop-card">
                    <div className="next-stop-card__badge">
                      <RiNavigationLine size={12} />
                      <span>DESTINO FINAL</span>
                    </div>
                    <h4 className="next-stop-card__title">{site.name}</h4>
                    <p className="next-stop-card__desc">{site.description}</p>
                  </div>
                  <div className="route-metadata-outside">
                    <span className="next-stop-meta-badge font-mono">
                      COORDS: {site.lat ? parseFloat(site.lat).toFixed(4) : '6.1718'}° N
                    </span>
                    <span className="next-stop-time-remaining">
                      {mode === 'walk' ? <RiWalkLine /> : <RiCarLine />}
                      <span>Llegada aprox. {endTime} (~{formatearDuracion(tiempoRestanteMin)})</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="timeline-actions-bottom">
              <button className="timeline-close-map-btn" onClick={() => setIsRouteMapOpen(!isRouteMapOpen)}>
                {isRouteMapOpen ? 'Cerrar Mapa' : 'Abrir Mapa'}
              </button>
              <button className="timeline-finish-route-btn" onClick={() => { detener(); setIsRouteMapOpen(false); onClose(); }}>
                <span>Finalizar Ruta</span>
                <RiFlagLine />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
