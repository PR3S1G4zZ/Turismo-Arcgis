import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Al navegar entre rutas, React Router conserva la posición de scroll
// de la vista anterior. Este componente restablece el scroll al inicio
// cada vez que cambia el pathname, para que cada página empiece arriba.
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
