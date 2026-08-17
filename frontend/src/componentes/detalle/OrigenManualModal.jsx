// src/componentes/detalle/OrigenManualModal.jsx
// Selector de un punto de partida a mano, para cuando no hay GPS real
// (permiso denegado o sin señal): reusa el LocationPicker del panel de admin
// (clic o arrastre sobre un mapa) para que el usuario marque desde dónde
// calcular la ruta, en vez de conformarse con el centro de Itagüí simulado.
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RiCloseLine, RiMapPin2Line } from 'react-icons/ri';
import { LocationPicker } from '../admin/LocationPicker';
import '../comunes/CustomModal.css';
import './OrigenManualModal.css';

export const OrigenManualModal = ({ isOpen, initial, onConfirm, onCancel }) => {
  // Sin efecto para "reiniciar al abrir": el padre monta este componente con
  // una `key` que cambia cada vez que se abre (ver RouteModal), así React lo
  // crea de cero y `useState(initial)` ya arranca con el valor correcto —
  // si no, el punto de un intento cancelado se quedaría pegado al reabrir.
  const [punto, setPunto] = useState(initial || null);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="custom-modal-backdrop" onClick={onCancel}>
      <div className="custom-modal-container origen-manual-modal" onClick={(e) => e.stopPropagation()}>
        <button className="custom-modal-close" onClick={onCancel} aria-label="Cerrar">
          <RiCloseLine />
        </button>

        <div className="custom-modal-content">
          <div className="custom-modal-header">
            <RiMapPin2Line className="custom-modal__icon custom-modal__icon--info" />
            <h3>Elige tu punto de partida</h3>
          </div>

          <div className="custom-modal-body">
            <p>
              Sin permiso de ubicación no podemos calcular la ruta desde donde estás. Marca en
              el mapa desde dónde quieres salir — la ruta se calculará desde ahí, pero no habrá
              seguimiento en vivo mientras caminas.
            </p>
            <LocationPicker
              lat={punto?.lat ?? ''}
              lng={punto?.lng ?? ''}
              onChange={(lat, lng) => setPunto({ lat, lng })}
              showSearch={false}
            />
          </div>

          <div className="custom-modal-actions">
            <button type="button" className="custom-modal-btn custom-modal-btn--cancel" onClick={onCancel}>
              Cancelar
            </button>
            <button
              type="button"
              className="custom-modal-btn custom-modal-btn--confirm custom-modal-btn--info"
              onClick={() => punto && onConfirm(punto)}
              disabled={!punto}
            >
              Usar este punto
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
