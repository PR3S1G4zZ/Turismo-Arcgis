// src/paginas/PqrsPage.jsx
import { useState, useContext, useEffect } from 'react';
import { AppContext } from '../contexto/AppContext';
import { zoneOptions } from '../datos/zones';
import { uploadApi } from '../utilidades/api';
import { RiMailSendLine, RiCheckDoubleLine, RiArrowDownSLine, RiCloseLine } from 'react-icons/ri';
import { CustomModal } from '../componentes/comunes/CustomModal';
import './PqrsPage.css';

// Opciones de dropdowns del formulario
const requestTypeOptions = [
  { value: 'inclusion', label: 'Solicitud de Inclusión de Establecimiento' },
  { value: 'update', label: 'Actualización de Oferta o Promoción' },
  { value: 'pqrs', label: 'Petición, Queja, Reclamo o Sugerencia (PQRS)' }
];

const categoryOptions = [
  { value: 'Restaurante', label: 'Gastronomía / Restaurante' },
  { value: 'Comercio', label: 'Comercio local' },
  { value: 'Hospedaje', label: 'Hospedaje / Hotel' },
  { value: 'Parque', label: 'Parques y Naturaleza' },
  { value: 'Museo', label: 'Museos e Historia' },
  { value: 'Cultura', label: 'Cultura y Artesanías' },
  { value: 'Entretenimiento', label: 'Entretenimiento / Diversión' }
];

// Componente local CustomSelect (Dropdown de Stitch Style)
const CustomSelect = ({ label, options, value, onChange, placeholder = 'Seleccione una opción' }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => setIsOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="form-group select-group">
      <label>{label}</label>
      <div className="custom-dropdown" onClick={(e) => e.stopPropagation()}>
        <div 
          className={`custom-dropdown-trigger ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
          <RiArrowDownSLine className={`dropdown-arrow ${isOpen ? 'open' : ''}`} />
        </div>
        {isOpen && (
          <div className="custom-dropdown-menu">
            {options.map(opt => (
              <div 
                key={opt.value} 
                className={`custom-dropdown-option ${value === opt.value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const PqrsPage = () => {
  const { addPqrs } = useContext(AppContext);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: 'inclusion', // 'inclusion' | 'update' | 'pqrs'
    subject: '',
    details: '',
    // Campos específicos para establecimiento
    establishmentName: '',
    category: 'Restaurante',
    zone: 'Comuna 1',
    address: '',
    phone: '',
    hours: 'Lun–Dom 8:00 am – 10:00 pm',
    imageUrl: '',
    instagram: '',
    facebook: '',
    website: '',
    tags: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Estado para modal personalizado
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    variant: 'warning',
    confirmText: 'Aceptar',
    onConfirm: () => setModal(prev => ({ ...prev, isOpen: false })),
    onCancel: () => setModal(prev => ({ ...prev, isOpen: false }))
  });

  const showAlert = (title, message, variant = 'warning') => {
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

  const isStepValid = (step) => {
    if (step === 1) {
      return formData.name.trim() !== '' && 
             formData.email.trim() !== '' && 
             formData.subject.trim() !== '';
    }
    if (step === 2) {
      return formData.establishmentName.trim() !== '' && 
             formData.category.trim() !== '' && 
             formData.zone.trim() !== '' && 
             formData.address.trim() !== '' && 
             formData.phone.trim() !== '' && 
             formData.hours.trim() !== '';
    }
    if (step === 3) {
      return formData.details.trim() !== '' && 
             formData.tags.trim() !== '';
    }
    return true; // Paso 4 es opcional
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (isStepValid(currentStep)) {
      setCurrentStep(prev => prev + 1);
    } else {
      showAlert('Campos Requeridos', 'Por favor complete todos los campos obligatorios del paso actual antes de continuar.', 'warning');
    }
  };

  const handlePrevStep = (e) => {
    e.preventDefault();
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // La imagen se sube al servidor y se guarda solo su URL.
      const url = await uploadApi.publicImage(file);
      setFormData(prev => ({ ...prev, imageUrl: url }));
    } catch (err) {
      console.error(err);
      showAlert('Error de Imagen', err.message || 'No se pudo subir la imagen seleccionada.', 'danger');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones básicas de contacto
    if (!formData.name || !formData.email || !formData.subject || !formData.details) {
      showAlert('Campos Faltantes', 'Por favor complete todos los campos obligatorios.', 'warning');
      return;
    }

    // Validaciones adicionales si es de tipo inclusion
    if (formData.type === 'inclusion') {
      if (!formData.establishmentName || !formData.category || !formData.zone || !formData.address || !formData.phone || !formData.hours || !formData.tags) {
        showAlert('Campos Faltantes', 'Por favor complete todos los campos obligatorios del establecimiento (nombre, categoría, comuna, dirección, teléfono, horarios y clasificaciones).', 'warning');
        return;
      }
    }

    // Enviar la solicitud al backend.
    try {
      await addPqrs(formData);
    } catch (err) {
      showAlert('Error al Enviar', err.message || 'No se pudo registrar la solicitud. Inténtalo de nuevo.', 'danger');
      return;
    }
    setIsSubmitted(true);

    // Resetear formulario
    setCurrentStep(1);
    setFormData({
      name: '',
      email: '',
      type: 'inclusion',
      subject: '',
      details: '',
      establishmentName: '',
      category: 'Restaurante',
      zone: 'Comuna 1',
      address: '',
      phone: '',
      hours: 'Lun–Dom 8:00 am – 10:00 pm',
      imageUrl: '',
      instagram: '',
      facebook: '',
      website: '',
      tags: ''
    });
  };

  return (
    <div className="pqrs-page container animate-fade-in">
      <div className="pqrs-container">
        {isSubmitted ? (
          <div className="pqrs-success-card">
            <div className="success-icon-container">
              <RiCheckDoubleLine className="success-icon" size={48} />
            </div>
            <h2>¡Solicitud Enviada!</h2>
            <p>Gracias por ponerte en contacto. Tu solicitud ha sido registrada en el sistema.</p>
            <p className="success-note">
              Los administradores del sitio de Turismo Itagüí validarán tu información y la cargarán en el sistema a la brevedad.
            </p>
            <button className="btn-primary" onClick={() => setIsSubmitted(false)}>
              Enviar otra solicitud
            </button>
          </div>
        ) : (
          <div className="pqrs-form-card">
            <div className="pqrs-header">
              <h1>Contacto y PQRS</h1>
              <p>
                Si eres comerciante de Itagüí, utiliza este formulario para solicitar la inclusión de tu establecimiento o actualizar tus promociones y ofertas vigentes.
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="pqrs-form">
              {/* Si es inclusión de comercio, renderizamos el Stepper */}
              {formData.type === 'inclusion' && (
                <div className="stepper-wrapper">
                  {[
                    { step: 1, label: 'Contacto' },
                    { step: 2, label: 'Comercio' },
                    { step: 3, label: 'Detalles' },
                    { step: 4, label: 'Redes' }
                  ].map((s) => (
                    <div key={s.step} className={`step-item ${currentStep === s.step ? 'active' : ''} ${currentStep > s.step ? 'completed' : ''}`}>
                      <div className="step-number">{s.step}</div>
                      <div className="step-label">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* RENDERIZADO POR PASOS PARA INCLUSIÓN */}
              {formData.type === 'inclusion' ? (
                <div className="inclusion-steps-container">
                  
                  {/* PASO 1: Datos del Solicitante y Tipo de Solicitud */}
                  {currentStep === 1 && (
                    <div className="step-content animate-fade-in">
                      <div className="form-group-row">
                        <div className="form-group">
                          <label htmlFor="name">Nombre Completo / Razón Social *</label>
                          <input 
                            type="text" 
                            id="name" 
                            name="name" 
                            value={formData.name} 
                            onChange={handleChange}
                            placeholder="Ej. Juan Pérez o Inversiones S.A.S." 
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="email">Correo Electrónico de Contacto *</label>
                          <input 
                            type="email" 
                            id="email" 
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange}
                            placeholder="correo@ejemplo.com" 
                            required
                          />
                        </div>
                      </div>

                      <CustomSelect
                        label="Tipo de Solicitud *"
                        options={requestTypeOptions}
                        value={formData.type}
                        onChange={(val) => {
                          setFormData(prev => ({ ...prev, type: val }));
                          // Solo el flujo de "inclusión" es multipaso; los demás vuelven al paso 1
                          if (val !== 'inclusion') setCurrentStep(1);
                        }}
                      />

                      <div className="form-group">
                        <label htmlFor="subject">Asunto *</label>
                        <input 
                          type="text" 
                          id="subject" 
                          name="subject" 
                          value={formData.subject} 
                          onChange={handleChange}
                          placeholder="Ej. Registro de nuevo Café Gourmet" 
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* PASO 2: Información Básica del Comercio */}
                  {currentStep === 2 && (
                    <div className="step-content animate-fade-in">
                      <h3 className="section-divider-title" style={{ marginTop: 0 }}>Datos del Establecimiento</h3>
                      <div className="form-group-row">
                        <div className="form-group">
                          <label htmlFor="establishmentName">Nombre Comercial *</label>
                          <input 
                            type="text" 
                            id="establishmentName" 
                            name="establishmentName" 
                            value={formData.establishmentName} 
                            onChange={handleChange}
                            placeholder="Ej. Café Arte y Sabor" 
                            required
                          />
                        </div>
                        
                        <CustomSelect
                          label="Categoría del Establecimiento *"
                          options={categoryOptions}
                          value={formData.category}
                          onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                        />
                      </div>

                      <div className="form-group-row">
                        <CustomSelect
                          label="Comuna / Zona Territorial *"
                          options={zoneOptions}
                          value={formData.zone}
                          onChange={(val) => setFormData(prev => ({ ...prev, zone: val }))}
                        />

                        <div className="form-group">
                          <label htmlFor="address">Dirección Física *</label>
                          <input 
                            type="text" 
                            id="address" 
                            name="address" 
                            value={formData.address} 
                            onChange={handleChange}
                            placeholder="Ej. Calle 50 Sur #43A-25" 
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group-row">
                        <div className="form-group">
                          <label htmlFor="phone">Teléfono de Contacto *</label>
                          <input 
                            type="text" 
                            id="phone" 
                            name="phone" 
                            value={formData.phone} 
                            onChange={handleChange}
                            placeholder="Ej. 6043730000 o 3123456789" 
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="hours">Horario de Atención *</label>
                          <input 
                            type="text" 
                            id="hours" 
                            name="hours" 
                            value={formData.hours} 
                            onChange={handleChange}
                            placeholder="Ej. Lun-Sáb 8:00 am - 8:00 pm" 
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PASO 3: Descripción, Etiquetas e Imagen */}
                  {currentStep === 3 && (
                    <div className="step-content animate-fade-in">
                      <h3 className="section-divider-title" style={{ marginTop: 0 }}>Detalles del Comercio</h3>
                      
                      <div className="form-group">
                        <label htmlFor="details">Descripción del Establecimiento *</label>
                        <textarea 
                          id="details" 
                          name="details" 
                          value={formData.details} 
                          onChange={handleChange}
                          placeholder="Describe brevemente la oferta gastronómica, comercial, turística o de entretenimiento..."
                          rows="4"
                          required
                        ></textarea>
                      </div>

                      <div className="form-group">
                        <label htmlFor="tags">Clasificaciones / Etiquetas (separadas por comas) *</label>
                        <input 
                          type="text" 
                          id="tags" 
                          name="tags" 
                          value={formData.tags} 
                          onChange={handleChange}
                          placeholder="Ej. comida, gimnasio, pet-friendly, parqueadero, wifi" 
                          required
                        />
                      </div>

                      <div className="form-group file-upload-container" style={{ marginTop: '1.25rem' }}>
                        <label>Imagen / Foto del Establecimiento</label>
                        <div className="image-upload-wrapper">
                          <div className="file-input-wrapper">
                            <input 
                              type="file" 
                              id="image-file" 
                              accept="image/*" 
                              onChange={handleFileChange}
                              className="image-file-input"
                            />
                            <label htmlFor="image-file" className="file-upload-label-btn">
                              Seleccionar Foto Local
                            </label>
                          </div>
                          <div className="image-url-fallback">
                            <span className="or-divider">o ingresa una URL web:</span>
                            <input 
                              type="text" 
                              id="imageUrl" 
                              name="imageUrl" 
                              value={formData.imageUrl} 
                              onChange={handleChange}
                              placeholder="https://images.unsplash.com/photo-..." 
                            />
                          </div>
                        </div>
                        {formData.imageUrl && (
                          <div className="form-image-preview">
                            <img src={formData.imageUrl} alt="Vista previa del establecimiento" />
                            <button 
                              type="button" 
                              className="btn-danger-link"
                              onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                            >
                              <RiCloseLine size={16} /> Quitar imagen
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PASO 4: Redes Sociales */}
                  {currentStep === 4 && (
                    <div className="step-content animate-fade-in">
                      <h3 className="section-divider-title" style={{ marginTop: 0 }}>Redes Sociales y Enlaces (Opcionales)</h3>
                      <div className="form-group-row row-3col">
                        <div className="form-group">
                          <label htmlFor="instagram">Instagram</label>
                          <input 
                            type="text" 
                            id="instagram" 
                            name="instagram" 
                            value={formData.instagram} 
                            onChange={handleChange}
                            placeholder="@usuario" 
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="facebook">Facebook</label>
                          <input 
                            type="text" 
                            id="facebook" 
                            name="facebook" 
                            value={formData.facebook} 
                            onChange={handleChange}
                            placeholder="Nombre página" 
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="website">Sitio Web</label>
                          <input 
                            type="text" 
                            id="website" 
                            name="website" 
                            value={formData.website} 
                            onChange={handleChange}
                            placeholder="www.ejemplo.com" 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BOTONES DE NAVEGACIÓN PARA MÚLTIPLES PASOS */}
                  <div className="form-navigation-actions">
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={handlePrevStep}
                      style={{ visibility: currentStep > 1 ? 'visible' : 'hidden' }}
                    >
                      Anterior
                    </button>
                    
                    {currentStep < 4 ? (
                      <button 
                        type="button" 
                        className="btn-primary" 
                        onClick={handleNextStep}
                      >
                        Siguiente
                      </button>
                    ) : (
                      <button type="submit" className="btn-primary form-submit-btn" style={{ margin: 0 }}>
                        <RiMailSendLine size={18} />
                        <span>Enviar Solicitud</span>
                      </button>
                    )}
                  </div>

                </div>
              ) : (
                // FORMULARIO TRADICIONAL PARA OTROS TIPOS (Actualización / PQRS)
                <div className="traditional-pqrs-container">
                  <div className="form-group-row">
                    <div className="form-group">
                      <label htmlFor="name">Nombre Completo / Razón Social *</label>
                      <input 
                        type="text" 
                        id="name" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleChange}
                        placeholder="Juan Pérez" 
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">Correo Electrónico de Contacto *</label>
                      <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        value={formData.email} 
                        onChange={handleChange}
                        placeholder="correo@ejemplo.com" 
                        required
                      />
                    </div>
                  </div>

                  <CustomSelect
                    label="Tipo de Solicitud *"
                    options={requestTypeOptions}
                    value={formData.type}
                    onChange={(val) => setFormData(prev => ({ ...prev, type: val }))}
                  />

                  <div className="form-group">
                    <label htmlFor="subject">Asunto *</label>
                    <input 
                      type="text" 
                      id="subject" 
                      name="subject" 
                      value={formData.subject} 
                      onChange={handleChange}
                      placeholder="Asunto de la solicitud" 
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="details">Detalles de la Solicitud *</label>
                    <textarea 
                      id="details" 
                      name="details" 
                      value={formData.details} 
                      onChange={handleChange}
                      placeholder="Detalles sobre lo que deseas solicitar..." 
                      rows="5"
                      required
                    ></textarea>
                  </div>

                  <button type="submit" className="btn-primary form-submit-btn">
                    <RiMailSendLine size={18} />
                    <span>Enviar Solicitud</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
      {/* Modal Personalizado */}
      <CustomModal 
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        variant={modal.variant}
        confirmText={modal.confirmText}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />
    </div>
  );
};

export default PqrsPage;

