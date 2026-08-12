// src/componentes/admin/AdminDashboard.jsx
import { useState, useContext, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { 
  RiDashboard3Line, 
  RiAddLine, 
  RiEditLine, 
  RiCheckLine, 
  RiCloseLine,
  RiFileList3Line,
  RiDeleteBinLine,
  RiUpload2Line,
  RiGridLine,
  RiLeafLine,
  RiPaletteLine,
  RiRestaurantLine,
  RiBuildingLine,
  RiStore2Line,
  RiSearchLine,
  RiFilter3Line,
  RiGroupLine,
  RiBuilding4Line,
  RiMegaphoneLine,
  RiQuestionLine,
  RiSettings4Line,
  RiMapPinLine,
  RiMenuLine,
  RiCalendarEventLine,
  RiGoogleFill,
  RiFileExcel2Line,
  RiShieldUserLine
} from 'react-icons/ri';
import { AppContext } from '../../contexto/AppContext';
import { zoneOptions, DEFAULT_ZONE } from '../../datos/zones';
import { SiteCard } from '../inicio/SiteCard';
import { CustomModal } from '../comunes/CustomModal';
import { resolveImage } from '../../utilidades/image';
import { fetchGoogleEvents, uploadApi, statsApi } from '../../utilidades/api';
import { PqrsManager } from './PqrsManager';
import { UserManager } from './UserManager';
import { LocationPicker } from './LocationPicker';
import './AdminDashboard.css';

export const AdminDashboard = () => {
  const {
    sites,
    announcements,
    events,
    googleCalendarUrl,
    adminAuth,
    currentUser,
    login,
    logout,
    addSite,
    updateSite,
    updateAnnouncement,
    addAnnouncement,
    deleteAnnouncement,
    deleteSite,
    addEvent,
    updateEvent,
    deleteEvent,
    setGoogleCalendarUrl
  } = useContext(AppContext);

  // Estados de Login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Estadísticas reales del panel (se cargan desde el backend al iniciar sesión).
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!adminAuth) return;
    let cancelled = false;
    statsApi.get()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => { /* si falla, se muestran valores en cero */ });
    return () => { cancelled = true; };
    // Se recargan cuando cambia el número de sitios/anuncios (tras crear/editar/borrar).
  }, [adminAuth, sites.length, announcements.length]);

  // Estados de Dashboard
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics' | 'announcements' | 'create'
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [editingAnnId, setEditingAnnId] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('7days'); // '7days' | '30days' | 'year'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sitesSectionLayout, setSitesSectionLayout] = useState('list'); // 'list' | 'grid'
  
  // Estado para edición de anuncios
  const [annForm, setAnnForm] = useState({ title: '', date: '', image: '', cta: '' });

  // Estado para creación de nuevo anuncio
  const [showAddAnn, setShowAddAnn] = useState(false);
  const [newAnnForm, setNewAnnForm] = useState({
    title: '',
    date: '',
    image: '',
    cta: 'Más información'
  });

  // Estados para creación y gestión de sitios
  const [showAddSite, setShowAddSite] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState(null);
  const [editingSiteForm, setEditingSiteForm] = useState(null);
  const [siteForm, setSiteForm] = useState({
    name: '',
    category: 'Parque',
    zone: DEFAULT_ZONE,
    description: '',
    images: [''],
    rating: 5.0,
    address: '',
    lat: null,
    lng: null,
    hours: 'Lun–Dom 8:00 am – 6:00 pm',
    instagram: '',
    facebook: '',
    website: '',
    tags: ''
  });

  // Estados para búsqueda y filtrado en la gestión de sitios
  const [siteSearchQuery, setSiteSearchQuery] = useState('');
  const [siteSelectedCategory, setSiteSelectedCategory] = useState('Todos');
  const [showSiteFilters, setShowSiteFilters] = useState(false);

  // Estados para la gestión de eventos del calendario
  const EMPTY_EVENT_FORM = {
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    description: ''
  };
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);
  const [editingEventId, setEditingEventId] = useState(null);
  const [gcalInput, setGcalInput] = useState(googleCalendarUrl || '');
  const [gcalTesting, setGcalTesting] = useState(false);
  const [gcalTestResult, setGcalTestResult] = useState(null); // { ok: boolean, message: string }

  // Estado para modal personalizado
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    variant: 'warning',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    onConfirm: () => {},
    onCancel: () => {}
  });

  // Funciones de utilidad para modales personalizados
  const showAlert = (title, message, variant = 'success') => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'alert',
      variant,
      confirmText: 'Aceptar',
      onConfirm: () => setModal(prev => ({ ...prev, isOpen: false })),
      onCancel: () => setModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const showConfirm = (title, message, onConfirm, variant = 'warning', confirmText = 'Aceptar', cancelText = 'Cancelar') => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      variant,
      confirmText,
      cancelText,
      onConfirm: () => {
        onConfirm();
        setModal(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Manejador para la subida de archivos locales: sube la imagen al servidor
  // (autenticado) y guarda solo la URL resultante en el formulario.
  const handleFileChange = async (e, type, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadApi.image(file);
      if (type === 'announcement') {
        if (isEdit) {
          setAnnForm(prev => ({ ...prev, image: url }));
        } else {
          setNewAnnForm(prev => ({ ...prev, image: url }));
        }
      } else if (type === 'site') {
        if (isEdit) {
          setEditingSiteForm(prev => ({ ...prev, images: [url] }));
        } else {
          setSiteForm(prev => ({ ...prev, images: [url] }));
        }
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', err.message || 'No se pudo subir la imagen al servidor.', 'danger');
    }
  };

  const [loggingIn, setLoggingIn] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      await login(username, password);
      setLoginError('');
      setUsername('');
      setPassword('');
    } catch (err) {
      setLoginError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogoutClick = () => {
    showConfirm(
      '¿Cerrar Sesión?',
      '¿Seguro que deseas salir del panel de administración?',
      logout,
      'danger',
      'Cerrar Sesión',
      'Cancelar'
    );
  };

  const handleEditAnnClick = (ann) => {
    setEditingAnnId(ann.id);
    setAnnForm({
      title: ann.title,
      date: ann.date,
      image: ann.image,
      cta: ann.cta
    });
  };

  const handleSaveAnn = async (id) => {
    try {
      await updateAnnouncement({ id, ...annForm });
      setEditingAnnId(null);
      showAlert('Anuncio Guardado', 'El anuncio se actualizó correctamente.', 'success');
    } catch (err) {
      showAlert('Error', err.message || 'No se pudo guardar el anuncio.', 'danger');
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnForm.title || !newAnnForm.date) {
      showAlert('Campos obligatorios', 'Por favor completa el título y la fecha.', 'warning');
      return;
    }
    try {
      await addAnnouncement(newAnnForm);
    } catch (err) {
      showAlert('Error', err.message || 'No se pudo crear el anuncio.', 'danger');
      return;
    }
    showAlert('Anuncio Creado', '¡El anuncio ha sido publicado con éxito!', 'success');
    setNewAnnForm({
      title: '',
      date: '',
      image: '',
      cta: 'Más información'
    });
    setShowAddAnn(false);
  };

  const handleDeleteAnnClick = (id) => {
    showConfirm(
      '¿Eliminar Anuncio?',
      '¿Estás seguro de que quieres eliminar de forma permanente este anuncio?',
      async () => {
        try {
          await deleteAnnouncement(id);
          showAlert('Anuncio Eliminado', 'El anuncio ha sido removido del carrusel.', 'success');
        } catch (err) {
          showAlert('Error', err.message || 'No se pudo eliminar el anuncio.', 'danger');
        }
      },
      'danger',
      'Eliminar',
      'Cancelar'
    );
  };

  const handleEditSiteClick = (site) => {
    setEditingSiteId(site.id);
    
    const tagsStr = Array.isArray(site.tags)
      ? site.tags.join(', ')
      : site.tags || '';

    setEditingSiteForm({
      name: site.name,
      category: site.category || 'Parque',
      zone: site.zone || DEFAULT_ZONE,
      description: site.description,
      images: site.images || [''],
      rating: site.rating || 5.0,
      address: site.address,
      lat: site.lat ?? null,
      lng: site.lng ?? null,
      hours: site.hours || 'Lun–Dom 8:00 am – 6:00 pm',
      instagram: site.instagram || '',
      facebook: site.facebook || '',
      website: site.website || '',
      tags: tagsStr
    });
  };

  const handleSaveSite = async (e) => {
    e.preventDefault();
    if (!editingSiteForm.name || !editingSiteForm.description || !editingSiteForm.address) {
      showAlert('Campos obligatorios', 'Por favor completa los campos principales (nombre, descripción y dirección).', 'warning');
      return;
    }

    const tagsArray = typeof editingSiteForm.tags === 'string'
      ? editingSiteForm.tags.split(',').map(t => t.trim()).filter(t => t !== '')
      : editingSiteForm.tags || [];

    // El backend re-geocodifica la dirección automáticamente si cambió.
    try {
      await updateSite({
        id: editingSiteId,
        ...editingSiteForm,
        tags: tagsArray
      });
      setEditingSiteId(null);
      setEditingSiteForm(null);
      showAlert('Sitio Actualizado', 'El sitio turístico se ha modificado exitosamente.', 'success');
    } catch (err) {
      showAlert('Error', err.message || 'No se pudo actualizar el sitio.', 'danger');
    }
  };

  const handleCreateSite = async (e) => {
    e.preventDefault();
    if (!siteForm.name || !siteForm.description || !siteForm.address) {
      showAlert('Campos obligatorios', 'Por favor completa los campos principales (nombre, descripción y dirección).', 'warning');
      return;
    }
    
    const tagsArray = typeof siteForm.tags === 'string'
      ? siteForm.tags.split(',').map(t => t.trim()).filter(t => t !== '')
      : siteForm.tags || [];

    // El backend geocodifica la dirección física automáticamente.
    try {
      await addSite({
        ...siteForm,
        tags: tagsArray
      });
    } catch (err) {
      showAlert('Error', err.message || 'No se pudo registrar el sitio.', 'danger');
      return;
    }

    showAlert('Sitio Creado', '¡El nuevo sitio turístico se ha registrado con éxito!', 'success');

    // Limpiar formulario
    setSiteForm({
      name: '',
      category: 'Parque',
      zone: DEFAULT_ZONE,
      description: '',
      images: [''],
      rating: 5.0,
      address: '',
      lat: null,
      lng: null,
      hours: 'Lun–Dom 8:00 am – 6:00 pm',
      instagram: '',
      facebook: '',
      website: '',
      tags: ''
    });
    setShowAddSite(false);
  };

  const handleDeleteSiteClick = (id) => {
    showConfirm(
      '¿Eliminar Sitio?',
      '¿Estás seguro de que quieres eliminar de forma permanente este sitio turístico? Se perderán todas sus estadísticas.',
      async () => {
        try {
          await deleteSite(id);
          showAlert('Sitio Eliminado', 'El sitio turístico ha sido removido del sistema.', 'success');
        } catch (err) {
          showAlert('Error', err.message || 'No se pudo eliminar el sitio.', 'danger');
        }
      },
      'danger',
      'Eliminar',
      'Cancelar'
    );
  };

  // ===== Gestión de eventos del calendario =====
  const handleEditEventClick = (event) => {
    setEditingEventId(event.id);
    setEventForm({
      title: event.title || '',
      date: event.date || '',
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      location: event.location || '',
      description: event.description || ''
    });
  };

  const handleCancelEventEdit = () => {
    setEditingEventId(null);
    setEventForm(EMPTY_EVENT_FORM);
  };

  const handleSubmitEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !eventForm.date) {
      showAlert('Campos obligatorios', 'El evento necesita al menos un título y una fecha.', 'warning');
      return;
    }
    try {
      if (editingEventId !== null) {
        await updateEvent({ id: editingEventId, ...eventForm });
        showAlert('Evento Actualizado', 'El evento se ha modificado correctamente.', 'success');
      } else {
        await addEvent(eventForm);
        showAlert('Evento Creado', 'El evento ha sido publicado en el calendario.', 'success');
      }
      setEditingEventId(null);
      setEventForm(EMPTY_EVENT_FORM);
    } catch (err) {
      showAlert('Error', err.message || 'No se pudo guardar el evento.', 'danger');
    }
  };

  const handleDeleteEventClick = (id) => {
    showConfirm(
      '¿Eliminar Evento?',
      '¿Estás seguro de que quieres eliminar de forma permanente este evento del calendario?',
      async () => {
        try {
          await deleteEvent(id);
          if (editingEventId === id) handleCancelEventEdit();
          showAlert('Evento Eliminado', 'El evento ha sido removido del calendario.', 'success');
        } catch (err) {
          showAlert('Error', err.message || 'No se pudo eliminar el evento.', 'danger');
        }
      },
      'danger',
      'Eliminar',
      'Cancelar'
    );
  };

  const handleSaveGcalUrl = async () => {
    try {
      await setGoogleCalendarUrl(gcalInput.trim());
      setGcalTestResult(null);
      showAlert('Calendario Guardado', gcalInput.trim()
        ? 'La URL del calendario de Google se guardó. Los eventos aparecerán en la sección Calendario.'
        : 'Se eliminó la URL del calendario de Google.', 'success');
    } catch (err) {
      showAlert('Error', err.message || 'No se pudo guardar la URL del calendario.', 'danger');
    }
  };

  const handleTestGcalConnection = async () => {
    const url = gcalInput.trim();
    if (!url) {
      setGcalTestResult({ ok: false, message: 'Ingresa primero la URL del calendario.' });
      return;
    }
    setGcalTesting(true);
    setGcalTestResult(null);
    try {
      const evts = await fetchGoogleEvents(url);
      setGcalTestResult({ ok: true, message: `Conexión exitosa. Se encontraron ${evts.length} evento(s) en el calendario.` });
    } catch (err) {
      setGcalTestResult({ ok: false, message: err.message });
    } finally {
      setGcalTesting(false);
    }
  };

  // Eventos ordenados por fecha para la tabla de administración
  const sortedEvents = [...events].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const filteredSites = sites.filter(site => {
    const matchesSearch = site.name.toLowerCase().includes(siteSearchQuery.toLowerCase()) ||
                          site.address.toLowerCase().includes(siteSearchQuery.toLowerCase()) ||
                          site.description.toLowerCase().includes(siteSearchQuery.toLowerCase());
    const matchesCategory = siteSelectedCategory === 'Todos' || site.category === siteSelectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatCoordinates = (lat, lng) => {
    const latVal = Math.abs(lat).toFixed(4);
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngVal = Math.abs(lng).toFixed(4);
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `COORDS: ${latVal}° ${latDir}, ${lngVal}° ${lngDir}`;
  };

  // Series del gráfico de interacción, con datos reales de visitas del backend.
  const chartDataByPeriod = {
    '7days': stats?.series?.daily || [],
    '30days': stats?.series?.weekly || [],
    'year': stats?.series?.monthly || []
  };

  // Sitios más visitados (datos reales) para el panel lateral.
  const topSites = stats?.topSites || [];

  // Formatea números grandes con separador de miles.
  const formatNumber = (n) => (n ?? 0).toLocaleString('es-CO');

  // Exporta los sitios turísticos a un archivo CSV real y lo descarga.
  const handleExportData = () => {
    if (sites.length === 0) {
      showAlert('Sin datos', 'No hay sitios turísticos registrados para exportar.', 'warning');
      return;
    }
    const headers = ['id', 'nombre', 'categoria', 'zona', 'direccion', 'lat', 'lng', 'visitas', 'calificacion'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = sites.map((s) => [s.id, s.name, s.category, s.zone, s.address, s.lat, s.lng, s.visits ?? 0, s.rating].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitios-turisticos-itagui-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAlert('Exportación Completa', `Se exportaron ${sites.length} sitio(s) turístico(s) en formato CSV.`, 'success');
  };

  // Renderizado Condicional: Login
  if (!adminAuth) {
    return (
      <div className="login-container">
        <h2>Acceso Administrativo</h2>
        <form className="login-form" onSubmit={handleLoginSubmit}>
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input 
              type="text" 
              id="username"
              className="input-field" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input 
              type="password" 
              id="password"
              className="input-field" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {loginError && <p className="login-error">{loginError}</p>}
          <button type="submit" className="login-btn" disabled={loggingIn}>
            {loggingIn ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    );
  }

  // Renderizado: Panel de Admin
  return (
    <div className="admin-dashboard">
      {/* Barra de Cabecera Móvil */}
      <div className="admin-mobile-header">
        <button 
          className="admin-mobile-header__menu-btn" 
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          aria-label="Menú administrador"
        >
          <RiMenuLine />
        </button>
        <span className="admin-mobile-header__title">Panel de Administración</span>
      </div>

      {/* Overlay de Bloqueo para Móvil */}
      {isMobileSidebarOpen && (
        <div 
          className="admin-sidebar-overlay" 
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="admin-layout">
        
        {/* Left Sidebar */}
        <aside className={`admin-sidebar ${isMobileSidebarOpen ? 'admin-sidebar--open' : ''}`}>
          <div className="admin-sidebar__brand">
            <div className="admin-sidebar__logo-box">
              <RiBuilding4Line className="admin-sidebar__logo-icon" />
            </div>
            <h2 className="admin-sidebar__title">Alcaldía Itagüí</h2>
            <p className="admin-sidebar__subtitle">Panel Administrativo</p>
          </div>
          
          <nav className="admin-sidebar__nav">
            <button 
              className={`admin-sidebar__link ${activeTab === 'metrics' ? 'admin-sidebar__link--active' : ''}`}
              onClick={() => { setActiveTab('metrics'); setIsMobileSidebarOpen(false); }}
            >
              <RiDashboard3Line />
              <span>Dashboard</span>
            </button>
            <button 
              className={`admin-sidebar__link ${activeTab === 'announcements' ? 'admin-sidebar__link--active' : ''}`}
              onClick={() => { setActiveTab('announcements'); setIsMobileSidebarOpen(false); }}
            >
              <RiMegaphoneLine />
              <span>Anuncios</span>
            </button>
            <button 
              className={`admin-sidebar__link ${activeTab === 'create' ? 'admin-sidebar__link--active' : ''}`}
              onClick={() => { setActiveTab('create'); setIsMobileSidebarOpen(false); }}
            >
              <RiMapPinLine />
              <span>Sitios</span>
            </button>
            <button
              className={`admin-sidebar__link ${activeTab === 'events' ? 'admin-sidebar__link--active' : ''}`}
              onClick={() => { setActiveTab('events'); setIsMobileSidebarOpen(false); }}
            >
              <RiCalendarEventLine />
              <span>Calendario</span>
            </button>
            <button
              className={`admin-sidebar__link ${activeTab === 'pqrs' ? 'admin-sidebar__link--active' : ''}`}
              onClick={() => { setActiveTab('pqrs'); setIsMobileSidebarOpen(false); }}
            >
              <RiFileList3Line />
              <span>Solicitudes PQRS</span>
            </button>
            {currentUser?.role === 'superadmin' && (
              <button
                className={`admin-sidebar__link ${activeTab === 'users' ? 'admin-sidebar__link--active' : ''}`}
                onClick={() => { setActiveTab('users'); setIsMobileSidebarOpen(false); }}
              >
                <RiShieldUserLine />
                <span>Administradores</span>
              </button>
            )}
            <button
              className="admin-sidebar__link admin-sidebar__link--disabled"
              disabled
            >
              <RiSettings4Line />
              <span>Ajustes</span>
            </button>
          </nav>
          
          <div className="admin-sidebar__bottom-actions">
            <button className="admin-sidebar__report-btn" onClick={() => { showAlert('Nuevo Reporte', 'Generando un nuevo reporte del estado del turismo...', 'info'); setIsMobileSidebarOpen(false); }}>
              <RiAddLine /> <span>Nuevo Reporte</span>
            </button>
            <div className="admin-sidebar__divider"></div>
            <button className="admin-sidebar__support-btn" onClick={() => { showAlert('Soporte Técnico', 'Ponte en contacto con soporte técnico en soporte@itagui.gov.co', 'info'); setIsMobileSidebarOpen(false); }}>
              <RiQuestionLine /> <span>Soporte</span>
            </button>
            <button className="admin-sidebar__logout-btn" onClick={() => { handleLogoutClick(); setIsMobileSidebarOpen(false); }} style={{ marginTop: '12px' }}>
              Cerrar Sesión
            </button>
          </div>
        </aside>

        {/* Right Main Content */}
        <div className="admin-main-content">
          <header className="admin-content-header">
            <div className="admin-content-header__left">
              <h1 className="admin-content-title">
                {activeTab === 'metrics' && "Visión General"}
                {activeTab === 'announcements' && "Gestión de Anuncios"}
                {activeTab === 'create' && "Gestión de Sitios Turísticos"}
                {activeTab === 'events' && "Gestión del Calendario"}
                {activeTab === 'pqrs' && "Gestión de PQRS y Registro"}
                {activeTab === 'users' && "Gestión de Administradores"}
              </h1>
              <p className="admin-content-subtitle">
                {activeTab === 'metrics' && "Métricas clave y gestión del territorio turístico."}
                {activeTab === 'announcements' && "Publicar y administrar anuncios del carrusel de inicio."}
                {activeTab === 'create' && "Registrar, editar y eliminar los puntos de interés turístico de Itagüí."}
                {activeTab === 'events' && "Crear eventos, importar desde Excel y sincronizar el calendario de Google."}
                {activeTab === 'pqrs' && "Validar y cargar solicitudes de inclusión y actualizaciones de ofertas de comerciantes."}
                {activeTab === 'users' && "Registrar y administrar las cuentas de acceso al panel administrativo."}
              </p>
            </div>
            {activeTab === 'metrics' && (
              <div className="admin-content-header__actions">
                <button className="admin-header-btn-secondary" onClick={handleExportData}>
                  Exportar Datos
                </button>
                <button className="admin-header-btn-primary" onClick={() => { setActiveTab('create'); setShowAddSite(true); }}>
                  <RiAddLine /> Nuevo Sitio
                </button>
              </div>
            )}
          </header>

          <div className="admin-tab-pane">
            {/* CONTENIDO TAB 1: METRICAS */}
            {activeTab === 'metrics' && (
              <div className="admin-tab-content">
                
                {/* 3 KPI Cards */}
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-card__header">
                      <div className="metric-card__icon-wrapper metric-icon-visitors">
                        <RiGroupLine />
                      </div>
                      <span className={`metric-badge ${(stats?.visitsTrend ?? 0) >= 0 ? 'metric-badge--positive' : 'metric-badge--status'}`}>
                        {(stats?.visitsTrend ?? 0) >= 0 ? '+' : ''}{stats?.visitsTrend ?? 0}% vs mes anterior
                      </span>
                    </div>
                    <div className="metric-card__body">
                      <span className="metric-card__title">Visitantes Totales</span>
                      <span className="metric-card__value font-mono">{formatNumber(stats?.totals?.visits)}</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card__header">
                      <div className="metric-card__icon-wrapper metric-icon-sites">
                        <RiBuilding4Line />
                      </div>
                      <span className="metric-badge metric-badge--status">Activos</span>
                    </div>
                    <div className="metric-card__body">
                      <span className="metric-card__title">Sitios Registrados</span>
                      <span className="metric-card__value font-mono">{sites.length}</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card__header">
                      <div className="metric-card__icon-wrapper metric-icon-ads">
                        <RiMegaphoneLine />
                      </div>
                      <span className="metric-badge metric-badge--status">Publicados</span>
                    </div>
                    <div className="metric-card__body">
                      <span className="metric-card__title">Anuncios Activos</span>
                      <span className="metric-card__value font-mono">{announcements.length}</span>
                    </div>
                  </div>
                </div>

                {/* Bento Layout: Chart + Campaigns */}
                <div className="metrics-details-layout">
                  {/* Left Column: Interacción Diaria */}
                  <div className="details-card interaction-chart-card">
                    <div className="details-card__header">
                      <h3 className="details-card__title">
                        {chartPeriod === '7days' && "Interacción Diaria"}
                        {chartPeriod === '30days' && "Interacción Semanal"}
                        {chartPeriod === 'year' && "Interacción Mensual"}
                      </h3>
                      <div className="custom-dropdown-container">
                        <button 
                          className="custom-dropdown-trigger" 
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          type="button"
                          aria-haspopup="listbox"
                          aria-expanded={isDropdownOpen}
                        >
                          <span>
                            {chartPeriod === '7days' && "Últimos 7 días"}
                            {chartPeriod === '30days' && "Último mes"}
                            {chartPeriod === 'year' && "Este año"}
                          </span>
                          <span className={`custom-dropdown-arrow ${isDropdownOpen ? 'custom-dropdown-arrow--open' : ''}`}>▼</span>
                        </button>
                        
                        {isDropdownOpen && (
                          <>
                            <div className="custom-dropdown-backdrop" onClick={() => setIsDropdownOpen(false)} />
                            <ul className="custom-dropdown-menu" role="listbox">
                              <li>
                                <button
                                  className={`custom-dropdown-item ${chartPeriod === '7days' ? 'custom-dropdown-item--active' : ''}`}
                                  onClick={() => { setChartPeriod('7days'); setIsDropdownOpen(false); }}
                                  type="button"
                                >
                                  Últimos 7 días
                                </button>
                              </li>
                              <li>
                                <button
                                  className={`custom-dropdown-item ${chartPeriod === '30days' ? 'custom-dropdown-item--active' : ''}`}
                                  onClick={() => { setChartPeriod('30days'); setIsDropdownOpen(false); }}
                                  type="button"
                                >
                                  Último mes
                                </button>
                              </li>
                              <li>
                                <button
                                  className={`custom-dropdown-item ${chartPeriod === 'year' ? 'custom-dropdown-item--active' : ''}`}
                                  onClick={() => { setChartPeriod('year'); setIsDropdownOpen(false); }}
                                  type="button"
                                >
                                  Este año
                                </button>
                              </li>
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="details-card__body chart-body">
                      <div style={{ width: '100%', height: 260 }}>
                        <ResponsiveContainer>
                          <AreaChart data={chartDataByPeriod[chartPeriod]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorInteracciones" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--chart-line-color)" stopOpacity={0.35}/>
                                <stop offset="95%" stopColor="var(--chart-line-color)" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid-color)" />
                            <XAxis 
                              dataKey="name" 
                              stroke="var(--color-text-muted)" 
                              fontSize={11} 
                              tickLine={false} 
                              axisLine={false}
                            />
                            <YAxis 
                              stroke="var(--color-text-muted)" 
                              fontSize={11} 
                              tickLine={false} 
                              axisLine={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'var(--color-surface)', 
                                borderColor: 'var(--color-border)', 
                                color: 'var(--color-text-primary)',
                                borderRadius: 'var(--radius-sm)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                              }} 
                              itemStyle={{ color: 'var(--chart-line-color)', fontWeight: 600 }}
                              labelStyle={{ color: 'var(--color-text-secondary)', fontSize: 11 }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="Interacciones" 
                              stroke="var(--chart-line-color)" 
                              strokeWidth={3}
                              fillOpacity={1} 
                              fill="url(#colorInteracciones)" 
                              activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--chart-line-color)' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Sitios Más Visitados (datos reales) */}
                  <div className="details-card active-campaigns-card">
                    <div className="details-card__header">
                      <h3 className="details-card__title">Sitios Más Visitados</h3>
                    </div>
                    <div className="details-card__body campaigns-body">
                      {topSites.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>
                          Aún no hay visitas registradas.
                        </p>
                      ) : (
                        <table className="campaigns-table">
                          <thead>
                            <tr>
                              <th>Sitio</th>
                              <th className="text-right">Visitas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topSites.map((site) => (
                              <tr key={site.id}>
                                <td>
                                  <div className="campaign-name-row">
                                    <span className="campaign-name">{site.name}</span>
                                  </div>
                                </td>
                                <td className="text-right campaign-imp-cell">
                                  <span className="campaign-imp-val font-mono">{formatNumber(site.visits)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Gestión de Sitios Turísticos */}
                <div className="admin-dashboard-sites-section">
                  <div className="sites-section-header">
                    <h2 className="sites-section-title">Gestión de Sitios Turísticos</h2>
                    <div className="layout-toggle-buttons">
                      <button 
                        className={`layout-btn layout-btn--grid ${sitesSectionLayout === 'grid' ? 'layout-btn--active' : ''}`} 
                        onClick={() => setSitesSectionLayout('grid')}
                        title="Vista de Cuadrícula"
                      >
                        <RiGridLine size={16} />
                      </button>
                      <button 
                        className={`layout-btn layout-btn--list ${sitesSectionLayout === 'list' ? 'layout-btn--active' : ''}`}
                        onClick={() => setSitesSectionLayout('list')}
                        title="Vista de Lista"
                      >
                        <RiFileList3Line size={16} />
                      </button>
                    </div>
                  </div>

                  {sitesSectionLayout === 'list' ? (
                    <div className="admin-sites-table-wrapper">
                      <table className="admin-sites-table">
                        <thead>
                          <tr>
                            <th>IMG</th>
                            <th>Nombre del Sitio</th>
                            <th>Categoría</th>
                            <th>Coordenadas</th>
                            <th className="text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sites.map((site) => (
                            <tr key={site.id}>
                              <td className="admin-table-img-cell">
                                <img 
                                  src={site.images && site.images[0] ? resolveImage(site.images[0]) : 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&w=800&q=80'} 
                                  alt={site.name} 
                                  className="admin-table-img" 
                                />
                              </td>
                              <td className="admin-table-name-cell">
                                <span className="admin-table-site-name">{site.name}</span>
                              </td>
                              <td>
                                <span className="admin-table-category-badge">{site.category}</span>
                              </td>
                              <td>
                                <span className="admin-table-coords-text font-mono">
                                  {formatCoordinates(site.lat || 6.1724, site.lng || -75.6091)}
                                </span>
                              </td>
                              <td className="text-right admin-table-actions-cell">
                                <div className="admin-table-action-buttons">
                                  <button className="table-icon-btn table-icon-btn--edit" onClick={() => { setActiveTab('create'); handleEditSiteClick(site); }} title="Editar">
                                    <RiEditLine />
                                  </button>
                                  <button className="table-icon-btn table-icon-btn--delete" onClick={() => handleDeleteSiteClick(site.id)} title="Eliminar">
                                    <RiDeleteBinLine />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="admin-sites-grid-cards">
                      {sites.map((site) => (
                        <div className="admin-site-grid-card" key={site.id}>
                          <div className="admin-site-grid-card__img-wrapper">
                            <img 
                              src={site.images && site.images[0] ? resolveImage(site.images[0]) : 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&w=800&q=80'} 
                              alt={site.name} 
                              className="admin-site-grid-card__img" 
                            />
                            <span className="admin-site-grid-card__category">{site.category}</span>
                          </div>
                          <div className="admin-site-grid-card__info">
                            <h4 className="admin-site-grid-card__name">{site.name}</h4>
                            <p className="admin-site-grid-card__coords font-mono">
                              {formatCoordinates(site.lat || 6.1724, site.lng || -75.6091)}
                            </p>
                          </div>
                          <div className="admin-site-grid-card__actions">
                            <button className="table-icon-btn table-icon-btn--edit" onClick={() => { setActiveTab('create'); handleEditSiteClick(site); }} title="Editar">
                              <RiEditLine />
                            </button>
                            <button className="table-icon-btn table-icon-btn--delete" onClick={() => handleDeleteSiteClick(site.id)} title="Eliminar">
                              <RiDeleteBinLine />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* CONTENIDO TAB 2: ANUNCIOS */}
            {activeTab === 'announcements' && (
              <div className="admin-tab-content">
                <div className="announcements-section-header">
                  <button className="site-form-btn" style={{ marginTop: 0, width: 'auto', padding: '10px 20px' }} onClick={() => setShowAddAnn(!showAddAnn)}>
                    {showAddAnn ? <><RiCloseLine style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Cancelar</> : <><RiAddLine style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Agregar Anuncio</>}
                  </button>
                </div>

                {showAddAnn && (
                  <form onSubmit={handleCreateAnnouncement} className="site-form-card" style={{ marginBottom: '32px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Nuevo Anuncio</h3>
                    <div className="site-form">
                      <div className="form-group">
                        <label>Título del Anuncio</label>
                        <input 
                          type="text" 
                          className="input-field"
                          value={newAnnForm.title} 
                          onChange={(e) => setNewAnnForm({ ...newAnnForm, title: e.target.value })}
                          placeholder="Ej. Concierto de Navidad"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Fecha o Subtexto</label>
                        <input 
                          type="text" 
                          className="input-field"
                          value={newAnnForm.date} 
                          onChange={(e) => setNewAnnForm({ ...newAnnForm, date: e.target.value })}
                          placeholder="Ej. 10 de Diciembre, 2025"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>URL Imagen</label>
                        <input 
                          type="text" 
                          className="input-field"
                          value={newAnnForm.image} 
                          onChange={(e) => setNewAnnForm({ ...newAnnForm, image: e.target.value })}
                          placeholder="URL de la imagen"
                        />
                      </div>

                      <div className="form-group">
                        <label className="file-upload-btn-label">Cargar imagen local desde el dispositivo:</label>
                        <label className="btn-secondary file-upload-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'fit-content' }}>
                          <RiUpload2Line size={16} /> Subir Imagen
                          <input 
                            type="file" 
                            accept="image/*" 
                            style={{ display: 'none' }} 
                            onChange={(e) => handleFileChange(e, 'announcement', false)} 
                          />
                        </label>
                      </div>

                      <div className="form-group">
                        <label>Texto de Botón CTA</label>
                        <input 
                          type="text" 
                          className="input-field"
                          value={newAnnForm.cta} 
                          onChange={(e) => setNewAnnForm({ ...newAnnForm, cta: e.target.value })}
                          placeholder="Ej. Más información"
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button type="submit" className="site-form-btn" style={{ flex: 1, marginTop: 0 }}>
                          <RiAddLine style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Guardar Anuncio
                        </button>
                        <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddAnn(false)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                <div className="admin-sites-table-wrapper" style={{ marginTop: '16px' }}>
                  <table className="admin-sites-table">
                    <thead>
                      <tr>
                        <th>IMG</th>
                        <th>Título del Anuncio</th>
                        <th>Fecha / Subtexto</th>
                        <th>Botón CTA</th>
                        <th className="text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {announcements.map((ann) => (
                        <tr key={ann.id}>
                          {editingAnnId === ann.id ? (
                            <td colSpan="5">
                              <div className="edit-form" style={{ padding: '16px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)' }}>
                                <div className="form-group">
                                  <label>Título del Anuncio</label>
                                  <input 
                                    type="text" 
                                    className="input-field"
                                    value={annForm.title} 
                                    onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                                  />
                                </div>
                                <div className="form-group">
                                  <label>Fecha o Subtexto</label>
                                  <input 
                                    type="text" 
                                    className="input-field"
                                    value={annForm.date} 
                                    onChange={(e) => setAnnForm({ ...annForm, date: e.target.value })}
                                  />
                                </div>
                                <div className="form-group">
                                  <label>URL Imagen</label>
                                  <input 
                                    type="text" 
                                    className="input-field"
                                    value={annForm.image} 
                                    onChange={(e) => setAnnForm({ ...annForm, image: e.target.value })}
                                  />
                                </div>
                                
                                <div className="form-group">
                                  <label className="file-upload-btn-label">Cargar imagen local:</label>
                                  <label className="btn-secondary file-upload-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'fit-content' }}>
                                    <RiUpload2Line size={16} /> Subir Imagen
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      style={{ display: 'none' }} 
                                      onChange={(e) => handleFileChange(e, 'announcement', true)} 
                                    />
                                  </label>
                                </div>

                                <div className="form-group">
                                  <label>Texto de Botón CTA</label>
                                  <input 
                                    type="text" 
                                    className="input-field"
                                    value={annForm.cta} 
                                    onChange={(e) => setAnnForm({ ...annForm, cta: e.target.value })}
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                  <button className="site-form-btn" style={{ marginTop: 0 }} onClick={() => handleSaveAnn(ann.id)}>
                                    <RiCheckLine style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Guardar
                                  </button>
                                  <button className="btn-secondary" onClick={() => setEditingAnnId(null)}>
                                    <RiCloseLine style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Cancelar
                                  </button>
                                </div>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="admin-table-img-cell">
                                <img 
                                  src={resolveImage(ann.image)} 
                                  alt={ann.title} 
                                  className="admin-table-img" 
                                />
                              </td>
                              <td className="admin-table-name-cell">
                                <span className="admin-table-site-name">{ann.title}</span>
                              </td>
                              <td>
                                <span style={{ color: 'var(--color-text-secondary)' }}>{ann.date}</span>
                              </td>
                              <td>
                                <span className="admin-table-category-badge" style={{ textTransform: 'none' }}>
                                  {ann.cta}
                                </span>
                              </td>
                              <td className="text-right admin-table-actions-cell">
                                <div className="admin-table-action-buttons">
                                  <button className="table-icon-btn table-icon-btn--edit" onClick={() => handleEditAnnClick(ann)} title="Editar">
                                    <RiEditLine />
                                  </button>
                                  <button className="table-icon-btn table-icon-btn--delete" onClick={() => handleDeleteAnnClick(ann.id)} title="Eliminar">
                                    <RiDeleteBinLine />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CONTENIDO TAB 3: GESTIONAR SITIOS */}
            {activeTab === 'create' && (
              <div className="admin-tab-content">
                {!showAddSite && editingSiteId === null ? (
                  // LISTADO DE SITIOS
                  <>
                    <div className="site-control-row">
                      <div className="search-bar admin-search-bar">
                        <RiSearchLine className="search-bar-icon" />
                        <input 
                          type="text" 
                          value={siteSearchQuery}
                          onChange={(e) => setSiteSearchQuery(e.target.value)}
                          placeholder="Buscar por nombre o dirección..." 
                          className="search-input"
                        />
                      </div>
                      
                      <button 
                        className={`btn-secondary filter-toggle-btn ${showSiteFilters ? 'filter-toggle-btn--active' : ''}`}
                        onClick={() => setShowSiteFilters(!showSiteFilters)}
                      >
                        <RiFilter3Line />
                        <span>Filtros</span>
                      </button>
                      
                      <button className="site-form-btn admin-add-site-btn" onClick={() => setShowAddSite(true)}>
                        <RiAddLine style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Registrar Nuevo Sitio
                      </button>
                    </div>

                    {showSiteFilters && (
                      <div className="admin-filters-row">
                        {[
                          { id: 'Todos', name: 'Todos', icon: RiGridLine },
                          { id: 'Parque', name: 'Parques', icon: RiLeafLine },
                          { id: 'Cultura', name: 'Cultura', icon: RiPaletteLine },
                          { id: 'Restaurante', name: 'Gastronomía', icon: RiRestaurantLine },
                          { id: 'Museo', name: 'Museos', icon: RiBuildingLine },
                          { id: 'Comercio', name: 'Comercio', icon: RiStore2Line }
                        ].map(cat => {
                          const Icon = cat.icon;
                          return (
                            <button
                              key={cat.id}
                              className={`filter-btn ${siteSelectedCategory === cat.id ? 'filter-btn--active' : ''}`}
                              onClick={() => setSiteSelectedCategory(cat.id)}
                            >
                              <Icon size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                              <span>{cat.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="admin-sites-table-wrapper">
                      <table className="admin-sites-table">
                        <thead>
                          <tr>
                            <th>Imagen</th>
                            <th>Nombre del Sitio</th>
                            <th>Categoría</th>
                            <th>Dirección</th>
                            <th className="text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSites.map((site) => (
                            <tr key={site.id}>
                              <td className="admin-table-img-cell">
                                <img 
                                  src={site.images && site.images[0] ? resolveImage(site.images[0]) : 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&w=800&q=80'} 
                                  alt={site.name} 
                                  className="admin-table-img" 
                                />
                              </td>
                              <td className="admin-table-name-cell">
                                <span className="admin-table-site-name">{site.name}</span>
                                <div className="admin-table-socials">
                                  {site.instagram && <span className="admin-table-social-badge">IG</span>}
                                  {site.facebook && <span className="admin-table-social-badge">FB</span>}
                                  {site.website && <span className="admin-table-social-badge">WEB</span>}
                                </div>
                              </td>
                              <td>
                                <span className="admin-table-category">{site.category}</span>
                              </td>
                              <td className="admin-table-address-cell">
                                <span className="admin-table-address" title={site.address}>{site.address}</span>
                              </td>
                              <td className="text-right admin-table-actions-cell">
                                <div className="admin-table-actions">
                                  <button className="btn-secondary btn-table-action" onClick={() => handleEditSiteClick(site)} title="Editar">
                                    <RiEditLine style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Editar
                                  </button>
                                  <button className="btn-secondary btn-danger btn-table-action" onClick={() => handleDeleteSiteClick(site.id)} title="Eliminar">
                                    <RiDeleteBinLine style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredSites.length === 0 && (
                        <div className="admin-table-empty">
                          <p>No hay destinos registrados que coincidan con tu búsqueda o filtros.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : editingSiteId !== null ? (
                  // FORMULARIO DE EDICIÓN DE SITIO
                  <div className="admin-create-layout">
                    <div className="site-form-card">
                      <h3>Editar Sitio Turístico</h3>
                      <form className="site-form" onSubmit={handleSaveSite}>
                        <div className="form-group">
                          <label>Nombre del Lugar</label>
                          <input 
                            type="text" 
                            className="input-field"
                            value={editingSiteForm.name}
                            onChange={(e) => setEditingSiteForm({ ...editingSiteForm, name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Categoría</label>
                            <select 
                              className="input-field"
                              value={editingSiteForm.category}
                              onChange={(e) => setEditingSiteForm({ ...editingSiteForm, category: e.target.value })}
                            >
                              <option value="Parque">Parque</option>
                              <option value="Cultura">Cultura</option>
                              <option value="Restaurante">Restaurante</option>
                              <option value="Museo">Museo</option>
                              <option value="Comercio">Comercio</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Horarios de Atención</label>
                            <input
                              type="text"
                              className="input-field"
                              value={editingSiteForm.hours}
                              onChange={(e) => setEditingSiteForm({ ...editingSiteForm, hours: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Comuna / Zona Territorial</label>
                          <select
                            className="input-field"
                            value={editingSiteForm.zone}
                            onChange={(e) => setEditingSiteForm({ ...editingSiteForm, zone: e.target.value })}
                          >
                            {zoneOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Descripción</label>
                          <textarea
                            className="input-field"
                            value={editingSiteForm.description}
                            onChange={(e) => setEditingSiteForm({ ...editingSiteForm, description: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Dirección Física</label>
                          <input
                            type="text"
                            className="input-field"
                            value={editingSiteForm.address}
                            onChange={(e) => setEditingSiteForm({ ...editingSiteForm, address: e.target.value })}
                            placeholder="Calle 85 Sur #43, Itagüí"
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Ubicación en el Mapa (Real)</label>
                          <LocationPicker
                            address={editingSiteForm.address}
                            lat={editingSiteForm.lat}
                            lng={editingSiteForm.lng}
                            onChange={(lat, lng) => setEditingSiteForm(prev => ({ ...prev, lat, lng }))}
                            showAlert={showAlert}
                          />
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Instagram URL (Opcional)</label>
                            <input 
                              type="text" 
                              className="input-field"
                              value={editingSiteForm.instagram}
                              onChange={(e) => setEditingSiteForm({ ...editingSiteForm, instagram: e.target.value })}
                              placeholder="Ej. https://instagram.com/miusuario"
                            />
                          </div>
                          <div className="form-group">
                            <label>Facebook URL (Opcional)</label>
                            <input 
                              type="text" 
                              className="input-field"
                              value={editingSiteForm.facebook}
                              onChange={(e) => setEditingSiteForm({ ...editingSiteForm, facebook: e.target.value })}
                              placeholder="Ej. https://facebook.com/mipagina"
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Página Web URL (Opcional)</label>
                          <input 
                            type="text" 
                            className="input-field"
                            value={editingSiteForm.website}
                            onChange={(e) => setEditingSiteForm({ ...editingSiteForm, website: e.target.value })}
                            placeholder="Ej. https://miweb.com"
                          />
                        </div>

                        <div className="form-group">
                          <label>Clasificaciones / Etiquetas (separadas por comas)</label>
                          <input 
                            type="text" 
                            className="input-field"
                            value={editingSiteForm.tags || ''}
                            onChange={(e) => setEditingSiteForm({ ...editingSiteForm, tags: e.target.value })}
                            placeholder="Ej. comida, gimnasio, wifi, pet-friendly"
                          />
                        </div>

                        <div className="form-group">
                          <label>URL Imagen Principal</label>
                          <input 
                            type="text" 
                            className="input-field"
                            value={editingSiteForm.images[0] || ''}
                            onChange={(e) => setEditingSiteForm({ ...editingSiteForm, images: [e.target.value] })}
                          />
                        </div>

                        <div className="form-group">
                          <label className="file-upload-btn-label">O subir imagen desde el dispositivo:</label>
                          <label className="btn-secondary file-upload-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'fit-content', cursor: 'pointer' }}>
                            <RiUpload2Line size={16} /> Subir Archivo
                            <input 
                              type="file" 
                              accept="image/*" 
                              style={{ display: 'none' }} 
                              onChange={(e) => handleFileChange(e, 'site', true)} 
                            />
                          </label>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                          <button type="submit" className="site-form-btn" style={{ flex: 1, marginTop: 0 }}>
                            Guardar Cambios
                          </button>
                          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setEditingSiteId(null); setEditingSiteForm(null); }}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="preview-sticky">
                      <h3>Vista Previa (Editando)</h3>
                      <div style={{ maxWidth: '340px', margin: '0 auto' }}>
                        <SiteCard 
                          site={{
                            ...editingSiteForm,
                            name: editingSiteForm.name || 'Nombre de Ejemplo',
                            description: editingSiteForm.description || 'Descripción del sitio.',
                            rating: editingSiteForm.rating || 5.0
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  // FORMULARIO DE CREACIÓN DE SITIO
                  <div className="admin-create-layout">
                    <div className="site-form-card">
                      <h3>Registrar Sitio Turístico</h3>
                      <form className="site-form" onSubmit={handleCreateSite}>
                        <div className="form-group">
                          <label>Nombre del Lugar</label>
                          <input 
                            type="text" 
                            className="input-field"
                            value={siteForm.name}
                            onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                            placeholder="Ej. Parque de las Chimeneas"
                            required
                          />
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Categoría</label>
                            <select 
                              className="input-field"
                              value={siteForm.category}
                              onChange={(e) => setSiteForm({ ...siteForm, category: e.target.value })}
                            >
                              <option value="Parque">Parque</option>
                              <option value="Cultura">Cultura</option>
                              <option value="Restaurante">Restaurante</option>
                              <option value="Museo">Museo</option>
                              <option value="Comercio">Comercio</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Horarios de Atención</label>
                            <input
                              type="text"
                              className="input-field"
                              value={siteForm.hours}
                              onChange={(e) => setSiteForm({ ...siteForm, hours: e.target.value })}
                              placeholder="Ej. Lun–Dom 8:00 am – 6:00 pm"
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Comuna / Zona Territorial</label>
                          <select
                            className="input-field"
                            value={siteForm.zone}
                            onChange={(e) => setSiteForm({ ...siteForm, zone: e.target.value })}
                          >
                            {zoneOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Descripción</label>
                          <textarea
                            className="input-field"
                            value={siteForm.description}
                            onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })}
                            placeholder="Detalles sobre lo que ofrece el lugar, historia o actividades..."
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Dirección Física</label>
                          <input
                            type="text"
                            className="input-field"
                            value={siteForm.address}
                            onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                            placeholder="Calle 85 Sur #43, Itagüí"
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Ubicación en el Mapa (Real)</label>
                          <LocationPicker
                            address={siteForm.address}
                            lat={siteForm.lat}
                            lng={siteForm.lng}
                            onChange={(lat, lng) => setSiteForm(prev => ({ ...prev, lat, lng }))}
                            showAlert={showAlert}
                          />
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Instagram URL (Opcional)</label>
                            <input 
                              type="text" 
                              className="input-field"
                              value={siteForm.instagram || ''}
                              onChange={(e) => setSiteForm({ ...siteForm, instagram: e.target.value })}
                              placeholder="Ej. https://instagram.com/miusuario"
                            />
                          </div>
                          <div className="form-group">
                            <label>Facebook URL (Opcional)</label>
                            <input 
                              type="text" 
                              className="input-field"
                              value={siteForm.facebook || ''}
                              onChange={(e) => setSiteForm({ ...siteForm, facebook: e.target.value })}
                              placeholder="Ej. https://facebook.com/mipagina"
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Página Web URL (Opcional)</label>
                          <input 
                            type="text" 
                            className="input-field"
                            value={siteForm.website || ''}
                            onChange={(e) => setSiteForm({ ...siteForm, website: e.target.value })}
                            placeholder="Ej. https://miweb.com"
                          />
                        </div>

                        <div className="form-group">
                          <label>Clasificaciones / Etiquetas (separadas por comas)</label>
                          <input 
                            type="text" 
                            className="input-field"
                            value={siteForm.tags || ''}
                            onChange={(e) => setSiteForm({ ...siteForm, tags: e.target.value })}
                            placeholder="Ej. comida, gimnasio, wifi, pet-friendly"
                          />
                        </div>

                        <div className="form-group">
                          <label>URL Imagen Principal</label>
                          <input 
                            type="text" 
                            className="input-field"
                            value={siteForm.images[0]}
                            onChange={(e) => setSiteForm({ ...siteForm, images: [e.target.value] })}
                            placeholder="URL de la imagen"
                          />
                        </div>

                        <div className="form-group">
                          <label className="file-upload-btn-label">O subir imagen desde el dispositivo:</label>
                          <label className="btn-secondary file-upload-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'fit-content', cursor: 'pointer' }}>
                            <RiUpload2Line size={16} /> Subir Archivo
                            <input 
                              type="file" 
                              accept="image/*" 
                              style={{ display: 'none' }} 
                              onChange={(e) => handleFileChange(e, 'site', false)} 
                            />
                          </label>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                          <button type="submit" className="site-form-btn" style={{ flex: 1, marginTop: 0 }}>
                            Crear Sitio
                          </button>
                          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddSite(false)}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="preview-sticky">
                      <h3>Vista Previa (Nuevo)</h3>
                      <div style={{ maxWidth: '340px', margin: '0 auto' }}>
                        <SiteCard 
                          site={{
                            ...siteForm,
                            name: siteForm.name || 'Nombre de Ejemplo',
                            description: siteForm.description || 'Descripción del sitio.',
                            rating: siteForm.rating || 5.0
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CONTENIDO TAB EVENTOS: CALENDARIO */}
            {activeTab === 'events' && (
              <div className="admin-tab-content animate-fade-in">
                <div className="events-admin-layout">
                  {/* Columna izquierda: formulario crear/editar */}
                  <div className="site-form-card">
                    <h3>{editingEventId !== null ? 'Editar Evento' : 'Registrar Nuevo Evento'}</h3>
                    <form className="site-form" onSubmit={handleSubmitEvent}>
                      <div className="form-group">
                        <label>Título del Evento *</label>
                        <input
                          type="text"
                          className="input-field"
                          value={eventForm.title}
                          onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                          placeholder="Ej. Festival Cultural de Itagüí"
                          required
                        />
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Fecha *</label>
                          <input
                            type="date"
                            className="input-field"
                            value={eventForm.date}
                            onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Lugar</label>
                          <input
                            type="text"
                            className="input-field"
                            value={eventForm.location}
                            onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                            placeholder="Ej. Parque Principal"
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Hora de Inicio</label>
                          <input
                            type="time"
                            className="input-field"
                            value={eventForm.startTime}
                            onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Hora de Fin</label>
                          <input
                            type="time"
                            className="input-field"
                            value={eventForm.endTime}
                            onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Descripción</label>
                        <textarea
                          className="input-field"
                          value={eventForm.description}
                          onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                          placeholder="Detalles del evento, actividades, público objetivo…"
                        />
                      </div>

                      <div className="form-actions" style={{ display: 'flex', gap: '12px' }}>
                        <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                          {editingEventId !== null ? 'Guardar Cambios' : 'Crear Evento'}
                        </button>
                        {editingEventId !== null && (
                          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleCancelEventEdit}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </form>

                    {/* Bloque: Importar Excel (próximamente) */}
                    <div className="events-integration-card events-integration-card--muted">
                      <div className="events-integration-card__head">
                        <RiFileExcel2Line className="events-integration-card__icon" />
                        <div>
                          <h4>Importar desde Excel</h4>
                          <p>Carga masiva de eventos. Los campos del archivo se definirán próximamente.</p>
                        </div>
                      </div>
                      <button type="button" className="btn-secondary" disabled title="Disponible próximamente">
                        Próximamente
                      </button>
                    </div>

                    {/* Bloque: Google Calendar */}
                    <div className="events-integration-card">
                      <div className="events-integration-card__head">
                        <RiGoogleFill className="events-integration-card__icon" />
                        <div>
                          <h4>Calendario de Google</h4>
                          <p>Pega la URL pública (.ics) del calendario compartido de la oficina de comunicación.</p>
                        </div>
                      </div>
                      <input
                        type="url"
                        className="input-field"
                        value={gcalInput}
                        onChange={(e) => { setGcalInput(e.target.value); setGcalTestResult(null); }}
                        placeholder="https://calendar.google.com/calendar/ical/…/public/basic.ics"
                      />
                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                        <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleSaveGcalUrl}>
                          Guardar URL
                        </button>
                        <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleTestGcalConnection} disabled={gcalTesting}>
                          {gcalTesting ? 'Probando…' : 'Probar Conexión'}
                        </button>
                      </div>
                      {gcalTestResult && (
                        <p className={`events-gcal-result ${gcalTestResult.ok ? 'events-gcal-result--ok' : 'events-gcal-result--error'}`}>
                          {gcalTestResult.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Columna derecha: lista de eventos existentes */}
                  <div className="events-list-card">
                    <h3>Eventos Publicados ({sortedEvents.length})</h3>
                    {sortedEvents.length === 0 ? (
                      <div className="empty-state">
                        <p>Aún no hay eventos en el calendario. Crea el primero con el formulario.</p>
                      </div>
                    ) : (
                      <ul className="events-admin-list">
                        {sortedEvents.map((event) => (
                          <li key={event.id} className="events-admin-item">
                            <div className="events-admin-item__info">
                              <span className="events-admin-item__date">{event.date}</span>
                              <span className="events-admin-item__title">{event.title}</span>
                              {(event.startTime || event.location) && (
                                <span className="events-admin-item__meta">
                                  {event.startTime ? event.startTime : 'Todo el día'}
                                  {event.location ? ` · ${event.location}` : ''}
                                </span>
                              )}
                            </div>
                            <div className="events-admin-item__actions">
                              <button className="table-icon-btn table-icon-btn--edit" onClick={() => handleEditEventClick(event)} title="Editar">
                                <RiEditLine />
                              </button>
                              <button className="table-icon-btn table-icon-btn--delete" onClick={() => handleDeleteEventClick(event.id)} title="Eliminar">
                                <RiDeleteBinLine />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO TAB 4: PQRS */}
            {activeTab === 'pqrs' && (
              <div className="admin-tab-content animate-fade-in">
                <PqrsManager showAlert={showAlert} showConfirm={showConfirm} />
              </div>
            )}

            {/* CONTENIDO TAB USUARIOS: solo super-admin */}
            {activeTab === 'users' && currentUser?.role === 'superadmin' && (
              <div className="admin-tab-content animate-fade-in">
                <UserManager showAlert={showAlert} showConfirm={showConfirm} />
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal Personalizado Global */}
      <CustomModal 
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        variant={modal.variant}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />
    </div>
  );
};
