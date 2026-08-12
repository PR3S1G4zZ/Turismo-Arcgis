// src/contexto/AppProvider.jsx
// Estado global del portal. Toda la información persiste ahora en el backend
// (API REST + MySQL); este proveedor la carga al montar y expone acciones
// asíncronas que llaman a la API y sincronizan el estado local.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppContext } from './AppContext';
import {
  authApi, usersApi, sitesApi, announcementsApi, eventsApi, pqrsApi, settingsApi,
  getToken, setToken, clearToken,
} from '../utilidades/api';

export const AppProvider = ({ children }) => {
  const [sites, setSites] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [googleCalendarUrl, setGoogleCalendarUrlState] = useState('');
  const [pqrsList, setPqrsList] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');

  // Sesión de administrador.
  const [currentUser, setCurrentUser] = useState(null);
  const adminAuth = !!currentUser;

  // Estados globales de la ruta (Isla Dinámica) — puramente de UI.
  const [activeRouteSite, setActiveRouteSite] = useState(null);
  const [activeRouteMode, setActiveRouteMode] = useState('walk');
  const [isRouteOpen, setIsRouteOpen] = useState(false);
  const [isRouteMapOpen, setIsRouteMapOpen] = useState(false);

  // Mapa id → visitas, derivado de los sitios (para los componentes que lo usan).
  const siteVisits = useMemo(
    () => Object.fromEntries(sites.map((s) => [s.id, s.visits ?? 0])),
    [sites]
  );

  // ─── Carga inicial de datos públicos ──────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sitesData, annData, evtData, settings] = await Promise.all([
          sitesApi.list(),
          announcementsApi.list(),
          eventsApi.list(),
          settingsApi.get(),
        ]);
        if (cancelled) return;
        setSites(sitesData);
        setAnnouncements(annData);
        setEvents(evtData);
        setGoogleCalendarUrlState(settings.googleCalendarUrl || '');
      } catch (err) {
        if (!cancelled) setDataError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Restaurar sesión si hay token guardado ───────────────
  const refreshPqrs = useCallback(async () => {
    const list = await pqrsApi.list();
    setPqrsList(list);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const { user } = await authApi.me();
        if (cancelled) return;
        setCurrentUser(user);
        refreshPqrs().catch(() => {});
      } catch {
        clearToken();
      }
    })();
    return () => { cancelled = true; };
  }, [refreshPqrs]);

  // ─── Autenticación ────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    const { token, user } = await authApi.login(username, password);
    setToken(token);
    setCurrentUser(user);
    refreshPqrs().catch(() => {});
    return user;
  }, [refreshPqrs]);

  const logout = useCallback(() => {
    clearToken();
    setCurrentUser(null);
    setPqrsList([]);
    setUsers([]);
  }, []);

  const changePassword = useCallback(
    (currentPassword, newPassword) => authApi.changePassword(currentPassword, newPassword),
    []
  );

  // ─── Gestión de administradores (super-admin) ─────────────
  const refreshUsers = useCallback(async () => {
    const list = await usersApi.list();
    setUsers(list);
    return list;
  }, []);

  const createUser = useCallback(async (payload) => {
    const created = await usersApi.create(payload);
    setUsers((prev) => [...prev, created]);
    return created;
  }, []);

  const updateUser = useCallback(async (id, payload) => {
    const updated = await usersApi.update(id, payload);
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    return updated;
  }, []);

  const deleteUser = useCallback(async (id) => {
    await usersApi.remove(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  // ─── Sitios ───────────────────────────────────────────────
  const addSite = useCallback(async (newSite) => {
    const created = await sitesApi.create(newSite);
    setSites((prev) => [...prev, created]);
    return created;
  }, []);

  const updateSite = useCallback(async (updatedSite) => {
    const { id, ...payload } = updatedSite;
    const saved = await sitesApi.update(id, payload);
    setSites((prev) => prev.map((s) => (s.id === id ? saved : s)));
    return saved;
  }, []);

  const deleteSite = useCallback(async (id) => {
    await sitesApi.remove(id);
    setSites((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const incrementVisit = useCallback(async (siteId) => {
    try {
      const { visits } = await sitesApi.visit(siteId);
      setSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, visits } : s)));
    } catch {
      // El conteo de visitas no es crítico; se ignora un fallo puntual.
    }
  }, []);

  // ─── Anuncios ─────────────────────────────────────────────
  const addAnnouncement = useCallback(async (newAnn) => {
    const created = await announcementsApi.create(newAnn);
    setAnnouncements((prev) => [...prev, created]);
    return created;
  }, []);

  const updateAnnouncement = useCallback(async (updatedAnn) => {
    const { id, ...payload } = updatedAnn;
    const saved = await announcementsApi.update(id, payload);
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? saved : a)));
    return saved;
  }, []);

  const deleteAnnouncement = useCallback(async (id) => {
    await announcementsApi.remove(id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ─── Eventos ──────────────────────────────────────────────
  const addEvent = useCallback(async (newEvent) => {
    const created = await eventsApi.create(newEvent);
    setEvents((prev) => [...prev, created]);
    return created;
  }, []);

  const updateEvent = useCallback(async (updatedEvent) => {
    const { id, ...payload } = updatedEvent;
    const saved = await eventsApi.update(id, payload);
    setEvents((prev) => prev.map((e) => (e.id === id ? saved : e)));
    return saved;
  }, []);

  const deleteEvent = useCallback(async (id) => {
    await eventsApi.remove(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ─── PQRS ─────────────────────────────────────────────────
  const addPqrs = useCallback(async (newPqrs) => {
    const created = await pqrsApi.create(newPqrs);
    setPqrsList((prev) => [created, ...prev]);
    return created;
  }, []);

  const updatePqrsStatus = useCallback(async (id, newStatus) => {
    const saved = await pqrsApi.updateStatus(id, newStatus);
    setPqrsList((prev) => prev.map((p) => (p.id === id ? saved : p)));
    return saved;
  }, []);

  const deletePqrs = useCallback(async (id) => {
    await pqrsApi.remove(id);
    setPqrsList((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ─── Ajustes ──────────────────────────────────────────────
  const setGoogleCalendarUrl = useCallback(async (url) => {
    const { googleCalendarUrl: saved } = await settingsApi.setGoogleCalendarUrl(url);
    setGoogleCalendarUrlState(saved || '');
    return saved;
  }, []);

  return (
    <AppContext.Provider value={{
      // Datos
      sites,
      announcements,
      events,
      googleCalendarUrl,
      pqrsList,
      users,
      siteVisits,
      loading,
      dataError,

      // Sesión
      currentUser,
      adminAuth,
      login,
      logout,
      changePassword,

      // Administradores
      refreshUsers,
      createUser,
      updateUser,
      deleteUser,

      // Rutas (UI)
      activeRouteSite,
      setActiveRouteSite,
      activeRouteMode,
      setActiveRouteMode,
      isRouteOpen,
      setIsRouteOpen,
      isRouteMapOpen,
      setIsRouteMapOpen,

      // Acciones de datos
      addSite,
      updateSite,
      deleteSite,
      incrementVisit,
      addAnnouncement,
      updateAnnouncement,
      deleteAnnouncement,
      addEvent,
      updateEvent,
      deleteEvent,
      addPqrs,
      updatePqrsStatus,
      deletePqrs,
      refreshPqrs,
      setGoogleCalendarUrl,
    }}>
      {children}
    </AppContext.Provider>
  );
};
