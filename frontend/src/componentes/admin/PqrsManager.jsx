// src/componentes/admin/PqrsManager.jsx
import { useContext, useState } from 'react';
import { AppContext } from '../../contexto/AppContext';
import {
  RiCheckLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiFileList3Line
} from 'react-icons/ri';

export const PqrsManager = ({
  showAlert = (title, msg) => alert(`${title}: ${msg}`), 
  showConfirm = (title, msg, onConfirm) => { if (window.confirm(msg)) onConfirm(); } 
}) => {
  const { pqrsList, updatePqrsStatus, deletePqrs, addSite, addAnnouncement } = useContext(AppContext);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'validated' | 'rejected'
  const [selectedPqrs, setSelectedPqrs] = useState(null);

  const filteredPqrs = pqrsList.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'pqrs-badge-pending';
      case 'validated': return 'pqrs-badge-validated';
      case 'rejected': return 'pqrs-badge-rejected';
      default: return '';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'validated': return 'Aceptado';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'inclusion': return 'Inclusión de Establecimiento';
      case 'update': return 'Actualización de Oferta';
      case 'pqrs': return 'PQRS / Contacto';
      default: return type;
    }
  };

  const handleValidate = async (pqrs) => {
    try {
      await updatePqrsStatus(pqrs.id, 'validated');

      // Si es una solicitud de inclusión de comercio, se carga automáticamente
      // como sitio (el backend resuelve las coordenadas a partir de la dirección).
      if (pqrs.type === 'inclusion') {
        const newSite = {
          name: pqrs.establishmentName || pqrs.subject.replace('Inclusión de ', '').replace('Inclusión: ', ''),
          category: pqrs.category || 'Comercio',
          zone: pqrs.zone || 'Comuna 1',
          description: pqrs.details,
          images: pqrs.imageUrl ? [pqrs.imageUrl] : [],
          rating: 5.0,
          address: pqrs.address || 'Dirección por confirmar',
          hours: pqrs.hours || 'Lun–Dom 8:00 am – 6:00 pm',
          phone: pqrs.phone || '',
          instagram: pqrs.instagram || '',
          facebook: pqrs.facebook || '',
          website: pqrs.website || '',
          tags: pqrs.tags || ''
        };
        await addSite(newSite);
        showAlert('Solicitud Aprobada', `El establecimiento "${newSite.name}" ha sido agregado automáticamente a los Sitios Turísticos (${newSite.zone}).`, 'success');
      } else if (pqrs.type === 'update') {
        // Si es una actualización de oferta, agregarla como anuncio de promoción
        const mockNewAnn = {
          title: pqrs.subject,
          date: 'Vigente',
          image: '',
          cta: 'Ver Oferta'
        };
        await addAnnouncement(mockNewAnn);
        showAlert('Solicitud Aprobada', `La oferta "${mockNewAnn.title}" ha sido agregada automáticamente a la sección de anuncios del carrusel.`, 'success');
      } else {
        showAlert('Solicitud Validada', `La solicitud de PQRS de ${pqrs.name} ha sido marcada como validada.`, 'success');
      }
    } catch (err) {
      showAlert('Error', err.message || 'No se pudo procesar la solicitud.', 'danger');
    }
  };

  const handleReject = (id) => {
    showConfirm(
      '¿Rechazar Solicitud?',
      '¿Está seguro de que desea rechazar esta solicitud?',
      () => { updatePqrsStatus(id, 'rejected').catch((err) => showAlert('Error', err.message, 'danger')); },
      'danger',
      'Rechazar',
      'Cancelar'
    );
  };

  const handleDelete = (id) => {
    showConfirm(
      '¿Eliminar Registro?',
      '¿Está seguro de que desea eliminar permanentemente este registro?',
      () => {
        deletePqrs(id).catch((err) => showAlert('Error', err.message, 'danger'));
        if (selectedPqrs && selectedPqrs.id === id) {
          setSelectedPqrs(null);
        }
      },
      'danger',
      'Eliminar',
      'Cancelar'
    );
  };

  return (
    <div className="pqrs-manager-container">
      <div className="pqrs-filters-nav">
        <div className="filter-tabs">
          <button 
            className={`filter-tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos ({pqrsList.length})
          </button>
          <button 
            className={`filter-tab-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pendientes ({pqrsList.filter(p => p.status === 'pending').length})
          </button>
          <button 
            className={`filter-tab-btn ${filter === 'validated' ? 'active' : ''}`}
            onClick={() => setFilter('validated')}
          >
            Validados ({pqrsList.filter(p => p.status === 'validated').length})
          </button>
          <button 
            className={`filter-tab-btn ${filter === 'rejected' ? 'active' : ''}`}
            onClick={() => setFilter('rejected')}
          >
            Rechazados ({pqrsList.filter(p => p.status === 'rejected').length})
          </button>
        </div>
      </div>

      <div className="pqrs-manager-layout">
        <div className="pqrs-list-section">
          {filteredPqrs.length === 0 ? (
            <div className="pqrs-empty">
              <RiFileList3Line size={48} className="empty-icon" />
              <h3>No hay solicitudes</h3>
              <p>No se encontraron registros de solicitudes con el filtro seleccionado.</p>
            </div>
          ) : (
            <div className="pqrs-table-wrapper">
              <table className="pqrs-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Remitente / Correo</th>
                    <th>Tipo</th>
                    <th>Asunto</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPqrs.map(pqrs => (
                    <tr 
                      key={pqrs.id} 
                      className={`pqrs-row ${selectedPqrs && selectedPqrs.id === pqrs.id ? 'pqrs-row--selected' : ''}`}
                      onClick={() => setSelectedPqrs(pqrs)}
                    >
                      <td className="font-mono">{pqrs.date}</td>
                      <td>
                        <div className="pqrs-sender-info">
                          <span className="sender-name">{pqrs.name}</span>
                          <span className="sender-email">{pqrs.email}</span>
                        </div>
                      </td>
                      <td>
                        <span className="pqrs-type-tag">{getTypeLabel(pqrs.type)}</span>
                      </td>
                      <td className="pqrs-subject-td">{pqrs.subject}</td>
                      <td>
                        <span className={`pqrs-badge ${getStatusBadgeClass(pqrs.status)}`}>
                          {getStatusLabel(pqrs.status)}
                        </span>
                      </td>
                      <td>
                        <div className="pqrs-action-buttons" onClick={(e) => e.stopPropagation()}>
                          {pqrs.status === 'pending' && (
                            <>
                              <button 
                                className="action-btn action-btn--approve" 
                                onClick={() => handleValidate(pqrs)}
                                title="Validar y Cargar en el Sistema"
                              >
                                <RiCheckLine />
                              </button>
                              <button 
                                className="action-btn action-btn--reject" 
                                onClick={() => handleReject(pqrs.id)}
                                title="Rechazar solicitud"
                              >
                                <RiCloseLine />
                              </button>
                            </>
                          )}
                          <button 
                            className="action-btn action-btn--delete" 
                            onClick={() => handleDelete(pqrs.id)}
                            title="Eliminar registro"
                          >
                            <RiDeleteBinLine />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detalle lateral de la solicitud seleccionada */}
        <div className="pqrs-detail-panel">
          {selectedPqrs ? (
            <div className="pqrs-detail-card">
              <div className="detail-header">
                <h3>Detalle de la Solicitud</h3>
                <span className={`pqrs-badge ${getStatusBadgeClass(selectedPqrs.status)}`}>
                  {getStatusLabel(selectedPqrs.status)}
                </span>
              </div>
              
              <div className="detail-body">
                <div className="detail-field">
                  <label>Remitente</label>
                  <p className="detail-val-name">{selectedPqrs.name}</p>
                  <p className="detail-val-email">{selectedPqrs.email}</p>
                </div>
                
                <div className="detail-row">
                  <div className="detail-field">
                    <label>Fecha</label>
                    <p className="font-mono">{selectedPqrs.date}</p>
                  </div>
                  <div className="detail-field">
                    <label>Tipo de Solicitud</label>
                    <p className="type-val">{getTypeLabel(selectedPqrs.type)}</p>
                  </div>
                </div>

                <div className="detail-field">
                  <label>Asunto</label>
                  <p className="detail-subject">{selectedPqrs.subject}</p>
                </div>

                <div className="detail-field">
                  <label>Detalle de la Solicitud</label>
                  <div className="detail-text-box">
                    {selectedPqrs.details}
                  </div>
                </div>

                {selectedPqrs.type === 'inclusion' && (
                  <div className="detail-establishment-section">
                    <h4 className="detail-section-title">Datos del Establecimiento</h4>
                    
                    <div className="detail-field">
                      <label>Nombre Comercial</label>
                      <p className="detail-val-highlight">{selectedPqrs.establishmentName || selectedPqrs.subject}</p>
                    </div>

                    <div className="detail-row">
                      <div className="detail-field">
                        <label>Categoría</label>
                        <p>{selectedPqrs.category || 'No especificada'}</p>
                      </div>
                      <div className="detail-field">
                        <label>Zona / Comuna</label>
                        <p>{selectedPqrs.zone || 'No especificada'}</p>
                      </div>
                    </div>

                    <div className="detail-row">
                      <div className="detail-field">
                        <label>Dirección</label>
                        <p>{selectedPqrs.address || 'No especificada'}</p>
                      </div>
                      <div className="detail-field">
                        <label>Teléfono</label>
                        <p>{selectedPqrs.phone || 'No especificado'}</p>
                      </div>
                    </div>

                    <div className="detail-field">
                      <label>Horario de Atención</label>
                      <p>{selectedPqrs.hours || 'No especificado'}</p>
                    </div>

                    <div className="detail-field">
                      <label>Clasificaciones / Etiquetas</label>
                      <p>{selectedPqrs.tags || 'Ninguna especificada'}</p>
                    </div>

                    {selectedPqrs.imageUrl && (
                      <div className="detail-field">
                        <label>Imagen Adjunta</label>
                        <div className="detail-image-container">
                          <img src={selectedPqrs.imageUrl} alt="Establecimiento" className="detail-image-preview" />
                        </div>
                      </div>
                    )}

                    {(selectedPqrs.instagram || selectedPqrs.facebook || selectedPqrs.website) && (
                      <div className="detail-field">
                        <label>Redes Sociales / Enlaces</label>
                        <div className="detail-socials">
                          {selectedPqrs.instagram && <span><strong>Instagram:</strong> {selectedPqrs.instagram}</span>}
                          {selectedPqrs.facebook && <span><strong>Facebook:</strong> {selectedPqrs.facebook}</span>}
                          {selectedPqrs.website && (
                            <span>
                              <strong>Web:</strong>{' '}
                              <a 
                                href={selectedPqrs.website.startsWith('http') ? selectedPqrs.website : `https://${selectedPqrs.website}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                {selectedPqrs.website}
                              </a>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedPqrs.status === 'pending' && (
                <div className="detail-actions">
                  <button 
                    className="btn-primary" 
                    onClick={() => handleValidate(selectedPqrs)}
                    style={{ flex: 1 }}
                  >
                    <RiCheckLine size={16} /> Validar y Cargar
                  </button>
                  <button 
                    className="btn-danger" 
                    onClick={() => handleReject(selectedPqrs.id)}
                    style={{ flex: 1 }}
                  >
                    <RiCloseLine size={16} /> Rechazar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="pqrs-detail-placeholder">
              <p>Selecciona una solicitud de la lista para ver su detalle completo y gestionarla.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
