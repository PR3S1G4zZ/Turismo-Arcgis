// src/componentes/admin/UserManager.jsx
// Gestión de administradores (solo super-admin): registrar nuevos admins,
// activar/desactivar, restablecer contraseña y eliminar. Incluye también el
// cambio de la propia contraseña de la sesión activa.
import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexto/AppContext';
import {
  RiUserAddLine, RiDeleteBinLine, RiShieldKeyholeLine,
  RiToggleLine, RiToggleFill, RiLockPasswordLine,
} from 'react-icons/ri';

export const UserManager = ({
  showAlert = (t, m) => alert(`${t}: ${m}`),
  showConfirm = (t, m, onConfirm) => { if (window.confirm(m)) onConfirm(); },
}) => {
  const {
    currentUser, users, refreshUsers, createUser, updateUser, deleteUser, changePassword,
  } = useContext(AppContext);

  const [loadError, setLoadError] = useState('');
  const [newAdmin, setNewAdmin] = useState({ name: '', username: '', password: '' });
  const [creating, setCreating] = useState(false);

  // Cambio de la propia contraseña.
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    refreshUsers().catch((err) => setLoadError(err.message));
  }, [refreshUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newAdmin.name.trim() || !newAdmin.username.trim() || !newAdmin.password) {
      showAlert('Campos obligatorios', 'Completa nombre, usuario y contraseña.', 'warning');
      return;
    }
    if (newAdmin.password.length < 8) {
      showAlert('Contraseña débil', 'La contraseña debe tener al menos 8 caracteres.', 'warning');
      return;
    }
    setCreating(true);
    try {
      await createUser({
        name: newAdmin.name.trim(),
        username: newAdmin.username.trim().toLowerCase(),
        password: newAdmin.password,
        role: 'admin',
      });
      showAlert('Administrador Creado', `La cuenta "${newAdmin.username}" fue registrada correctamente.`, 'success');
      setNewAdmin({ name: '', username: '', password: '' });
    } catch (err) {
      showAlert('Error', err.message, 'danger');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = (user) => {
    updateUser(user.id, { active: !user.active })
      .catch((err) => showAlert('Error', err.message, 'danger'));
  };

  const handleResetPassword = (user) => {
    const nueva = window.prompt(`Nueva contraseña para "${user.username}" (mínimo 8 caracteres):`);
    if (nueva == null) return;
    if (nueva.length < 8) {
      showAlert('Contraseña débil', 'Debe tener al menos 8 caracteres.', 'warning');
      return;
    }
    updateUser(user.id, { password: nueva })
      .then(() => showAlert('Contraseña Actualizada', `Se restableció la contraseña de "${user.username}".`, 'success'))
      .catch((err) => showAlert('Error', err.message, 'danger'));
  };

  const handleDelete = (user) => {
    showConfirm(
      '¿Eliminar Administrador?',
      `¿Seguro que deseas eliminar la cuenta "${user.username}"? Esta acción no se puede deshacer.`,
      () => {
        deleteUser(user.id)
          .then(() => showAlert('Administrador Eliminado', `La cuenta "${user.username}" fue eliminada.`, 'success'))
          .catch((err) => showAlert('Error', err.message, 'danger'));
      },
      'danger', 'Eliminar', 'Cancelar'
    );
  };

  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();
    if (pwd.next.length < 8) {
      showAlert('Contraseña débil', 'La nueva contraseña debe tener al menos 8 caracteres.', 'warning');
      return;
    }
    if (pwd.next !== pwd.confirm) {
      showAlert('No coincide', 'La confirmación no coincide con la nueva contraseña.', 'warning');
      return;
    }
    try {
      await changePassword(pwd.current, pwd.next);
      showAlert('Contraseña Actualizada', 'Tu contraseña se cambió correctamente.', 'success');
      setPwd({ current: '', next: '', confirm: '' });
    } catch (err) {
      showAlert('Error', err.message, 'danger');
    }
  };

  const roleLabel = (role) => (role === 'superadmin' ? 'Super Admin' : 'Administrador');

  return (
    <div className="user-manager">
      {loadError && <p className="login-error">{loadError}</p>}

      <div className="admin-create-layout">
        {/* Registrar nuevo administrador */}
        <div className="site-form-card">
          <h3><RiUserAddLine style={{ verticalAlign: 'middle', marginRight: 6 }} /> Registrar Administrador</h3>
          <form className="site-form" onSubmit={handleCreate}>
            <div className="form-group">
              <label>Nombre Completo</label>
              <input
                type="text" className="input-field"
                value={newAdmin.name}
                onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                placeholder="Ej. María Gómez" required
              />
            </div>
            <div className="form-group">
              <label>Nombre de Usuario</label>
              <input
                type="text" className="input-field"
                value={newAdmin.username}
                onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                placeholder="Ej. mgomez (letras, números, . _ -)" required
              />
            </div>
            <div className="form-group">
              <label>Contraseña (mínimo 8 caracteres)</label>
              <input
                type="password" className="input-field"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                placeholder="••••••••" required
              />
            </div>
            <button type="submit" className="site-form-btn" disabled={creating} style={{ marginTop: 8 }}>
              {creating ? 'Creando…' : 'Crear Administrador'}
            </button>
          </form>

          {/* Cambiar mi propia contraseña */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
            <h3><RiLockPasswordLine style={{ verticalAlign: 'middle', marginRight: 6 }} /> Cambiar mi contraseña</h3>
            <form className="site-form" onSubmit={handleChangeOwnPassword}>
              <div className="form-group">
                <label>Contraseña Actual</label>
                <input type="password" className="input-field" value={pwd.current}
                  onChange={(e) => setPwd({ ...pwd, current: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Nueva Contraseña</label>
                  <input type="password" className="input-field" value={pwd.next}
                    onChange={(e) => setPwd({ ...pwd, next: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Confirmar Nueva</label>
                  <input type="password" className="input-field" value={pwd.confirm}
                    onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
                </div>
              </div>
              <button type="submit" className="btn-secondary" style={{ marginTop: 8 }}>Actualizar Contraseña</button>
            </form>
          </div>
        </div>

        {/* Listado de administradores */}
        <div className="site-form-card">
          <h3><RiShieldKeyholeLine style={{ verticalAlign: 'middle', marginRight: 6 }} /> Administradores ({users.length})</h3>
          <div className="admin-sites-table-wrapper" style={{ marginTop: 12 }}>
            <table className="admin-sites-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = currentUser && u.id === currentUser.id;
                  const isSuper = u.role === 'superadmin';
                  return (
                    <tr key={u.id}>
                      <td className="admin-table-name-cell">
                        <span className="admin-table-site-name">{u.name}</span>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>@{u.username}{isSelf ? ' (tú)' : ''}</div>
                      </td>
                      <td><span className="admin-table-category-badge">{roleLabel(u.role)}</span></td>
                      <td>
                        <span className={`pqrs-badge ${u.active ? 'pqrs-badge-validated' : 'pqrs-badge-rejected'}`}>
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="text-right admin-table-actions-cell">
                        <div className="admin-table-action-buttons">
                          <button
                            className="table-icon-btn"
                            onClick={() => handleResetPassword(u)}
                            title="Restablecer contraseña"
                          >
                            <RiLockPasswordLine />
                          </button>
                          {!isSuper && (
                            <button
                              className="table-icon-btn"
                              onClick={() => handleToggleActive(u)}
                              title={u.active ? 'Desactivar' : 'Activar'}
                            >
                              {u.active ? <RiToggleFill /> : <RiToggleLine />}
                            </button>
                          )}
                          {!isSuper && !isSelf && (
                            <button
                              className="table-icon-btn table-icon-btn--delete"
                              onClick={() => handleDelete(u)}
                              title="Eliminar"
                            >
                              <RiDeleteBinLine />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
