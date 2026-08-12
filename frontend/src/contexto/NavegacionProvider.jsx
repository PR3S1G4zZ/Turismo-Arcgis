// src/contexto/NavegacionProvider.jsx
// Una sola navegación viva para toda la aplicación. Sin esto, el mapa y la isla
// de ruta calcularían cada uno su propio trayecto y mostrarían datos distintos;
// además habría varios `watchPosition` compitiendo por el GPS.
import { NavegacionContext } from './NavegacionContext';
import { useNavegacion } from '../hooks/useNavegacion';

export const NavegacionProvider = ({ children }) => {
  const navegacion = useNavegacion();
  return (
    <NavegacionContext.Provider value={navegacion}>
      {children}
    </NavegacionContext.Provider>
  );
};
