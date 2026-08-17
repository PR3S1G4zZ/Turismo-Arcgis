import { useContext, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './contexto/AppProvider';
import { AppContext } from './contexto/AppContext';
import { NavegacionProvider } from './contexto/NavegacionProvider';
import { Header } from './componentes/estructura/Header';
import { Footer } from './componentes/estructura/Footer';
import { ScrollToTop } from './componentes/estructura/ScrollToTop';
import { Home } from './paginas/Home';
import { SiteDetailPage } from './paginas/SiteDetailPage';
import { AdminPage } from './paginas/AdminPage';
import { PqrsPage } from './paginas/PqrsPage';
import { CalendarPage } from './paginas/CalendarPage';
import { RouteModal } from './componentes/detalle/RouteModal';
import { InteractiveMap } from './componentes/detalle/InteractiveMap';

// Estilos globales
import './estilos/variables.css';
import './estilos/global.css';
import './estilos/animations.css';

// Rutas con transición suave: la key por pathname re-monta el contenedor
// en cada navegación, re-disparando la animación de entrada.
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/site/:id" element={<SiteDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/pqrs" element={<PqrsPage />} />
      </Routes>
    </div>
  );
}

// El mapa de pantalla completa no depende de la URL, así que sobrevive a
// cualquier cambio de ruta (por ejemplo el botón "atrás" del navegador):
// sin esto, quedaba tapando la página nueva y el usuario no podía volver a
// ver la información del sitio que lo abrió. La isla de ruta (activeRouteSite)
// se deja viva a propósito, para que el seguimiento persista entre vistas.
function RouteMapCloser() {
  const { pathname } = useLocation();
  const { isRouteMapOpen, setIsRouteMapOpen } = useContext(AppContext);
  const rutaPrevia = useRef(pathname);

  useEffect(() => {
    if (rutaPrevia.current !== pathname && isRouteMapOpen) {
      setIsRouteMapOpen(false);
    }
    rutaPrevia.current = pathname;
  }, [pathname, isRouteMapOpen, setIsRouteMapOpen]);

  return null;
}

function AppContent() {
  const { 
    activeRouteSite, 
    isRouteOpen, 
    setIsRouteOpen,
    setActiveRouteSite,
    isRouteMapOpen,
    setIsRouteMapOpen,
  } = useContext(AppContext);

  return (
    <BrowserRouter>
      <RouteMapCloser />
      <ScrollToTop />
      <Header />
      <main style={{ flex: 1 }}>
        <AnimatedRoutes />
      </main>
      <Footer />

      {/* Mapa de Ruta Completo en Pantalla Completa */}
      {isRouteMapOpen && activeRouteSite && (
        <div className="full-route-map-overlay">
          <InteractiveMap
            site={activeRouteSite}
            showRoute={true}
          />
        </div>
      )}

      {/* Isla Dinámica de Ruta Global que persiste en todas las vistas */}
      {activeRouteSite && (
        <RouteModal
          isOpen={isRouteOpen}
          onClose={() => {
            setIsRouteOpen(false);
            setActiveRouteSite(null);
            setIsRouteMapOpen(false);
          }}
          site={activeRouteSite}
        />
      )}
    </BrowserRouter>
  );
}

function App() {
  return (
    <AppProvider>
      {/* La navegación vive por encima de las vistas: una sola ruta activa y un
          único seguimiento de GPS compartido por el mapa y la isla de ruta. */}
      <NavegacionProvider>
        <AppContent />
      </NavegacionProvider>
    </AppProvider>
  );
}

export default App;
