-- =====================================================================
--  Turismo Itagüí — Script de base de datos (MySQL 8+)
-- =====================================================================
--  Reproduce EXACTAMENTE el esquema que crea el backend en
--  backend/src/db.js. Es idempotente: se puede ejecutar varias veces
--  sin romper nada (usa CREATE ... IF NOT EXISTS).
--
--  Uso:
--    mysql -u root -p < BD/schema.sql
--  o desde el cliente MySQL ya conectado:
--    SOURCE C:/Users/Usuario/Desktop/Turismo-Itagui/BD/schema.sql;
--
--  El backend también crea todo esto automáticamente al arrancar
--  (initDb). Este script sirve para desplegar/inspeccionar la BD a mano
--  (por ejemplo, en el servidor de la Alcaldía de Itagüí).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Base de datos
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `turismo_itagui`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `turismo_itagui`;

-- ---------------------------------------------------------------------
-- 2) Tablas
-- ---------------------------------------------------------------------

-- Administradores del panel (superadmin registra a los demás).
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('superadmin','admin') NOT NULL DEFAULT 'admin',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sitios turísticos / comercios.
CREATE TABLE IF NOT EXISTS sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'Comercio',
  zone VARCHAR(80) NOT NULL DEFAULT '',
  description TEXT,
  images JSON,
  rating DECIMAL(2,1) NOT NULL DEFAULT 5.0,
  address VARCHAR(255) NOT NULL DEFAULT '',
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  hours VARCHAR(120) DEFAULT '',
  phone VARCHAR(60) DEFAULT '',
  instagram VARCHAR(255) DEFAULT '',
  facebook VARCHAR(255) DEFAULT '',
  website VARCHAR(255) DEFAULT '',
  tags JSON,
  visits INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Anuncios / campañas destacadas.
CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  date VARCHAR(120) NOT NULL DEFAULT '',
  zone VARCHAR(80) DEFAULT '',
  image TEXT,
  cta VARCHAR(120) DEFAULT 'Más información',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Eventos del calendario (manual / excel / google).
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  date DATE NOT NULL,
  start_time VARCHAR(5) DEFAULT '',
  end_time VARCHAR(5) DEFAULT '',
  location VARCHAR(200) DEFAULT '',
  description TEXT,
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Solicitudes ciudadanas: inclusión de sitio, actualización y PQRS.
CREATE TABLE IF NOT EXISTS pqrs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('inclusion','update','pqrs') NOT NULL DEFAULT 'pqrs',
  name VARCHAR(160) NOT NULL,
  email VARCHAR(160) NOT NULL,
  subject VARCHAR(255) NOT NULL DEFAULT '',
  details TEXT,
  status ENUM('pending','validated','rejected') NOT NULL DEFAULT 'pending',
  meta JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Configuración clave/valor (p. ej. URL del calendario de Google).
CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Registro histórico de visitas (una fila por visita) para las métricas
-- temporales del panel. El contador rápido sigue en sites.visits.
CREATE TABLE IF NOT EXISTS visit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_visit_log_created (created_at),
  INDEX idx_visit_log_site (site_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3) Super-administrador inicial
-- ---------------------------------------------------------------------
--  Solo se inserta si la tabla users está vacía (igual que el backend).
--  Credenciales por defecto:
--      usuario:     admin
--      contraseña:  Itagui2026*Cambiar
--  IMPORTANTE: cambia la contraseña tras el primer inicio de sesión.
--
--  El hash es bcrypt (coste 12) de la contraseña anterior. Si cambias la
--  contraseña, regenera el hash con:
--      node -e "console.log(require('bcryptjs').hashSync('TU_CLAVE',12))"
-- ---------------------------------------------------------------------
INSERT INTO users (username, name, password_hash, role)
SELECT 'admin',
       'Administrador Principal',
       '$2a$12$4MfLSkeX0wgYyJ8FrSb3EecfDz.oLQkJHffgEOuvprrwiWLSStPAO',
       'superadmin'
WHERE NOT EXISTS (SELECT 1 FROM users);

-- =====================================================================
--  Fin del script.
-- =====================================================================
