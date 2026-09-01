// backend/src/db.js
// Capa de acceso a MySQL: pool de conexiones + creación del esquema y del
// super-administrador inicial. Toda la app usa el pool exportado.
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

let pool;

/** Devuelve el pool de conexiones (debe llamarse a initDb antes). */
export function getPool() {
  if (!pool) {
    throw new Error('El pool de base de datos no está inicializado. Llama a initDb() primero.');
  }
  return pool;
}

/** Helper de consulta: devuelve solo las filas. */
export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('superadmin','admin') NOT NULL DEFAULT 'admin',
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS sites (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    date VARCHAR(120) NOT NULL DEFAULT '',
    zone VARCHAR(80) DEFAULT '',
    image TEXT,
    cta VARCHAR(120) DEFAULT 'Más información',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    date DATE NOT NULL,
    start_time VARCHAR(5) DEFAULT '',
    end_time VARCHAR(5) DEFAULT '',
    location VARCHAR(200) DEFAULT '',
    description TEXT,
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS pqrs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('inclusion','update','pqrs') NOT NULL DEFAULT 'pqrs',
    name VARCHAR(160) NOT NULL,
    email VARCHAR(160) NOT NULL,
    subject VARCHAR(255) NOT NULL DEFAULT '',
    details TEXT,
    status ENUM('pending','validated','rejected') NOT NULL DEFAULT 'pending',
    meta JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Registro histórico de visitas (una fila por visita) para las métricas
  // temporales del panel. El contador rápido sigue en sites.visits.
  `CREATE TABLE IF NOT EXISTS visit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    site_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_visit_log_created (created_at),
    INDEX idx_visit_log_site (site_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

/**
 * Crea la base de datos si no existe, el esquema de tablas y el super-admin
 * inicial. Es idempotente: se puede llamar en cada arranque sin efectos.
 */
export async function initDb() {
  // 1) Conexión sin base de datos para crearla si hace falta.
  const bootstrap = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: false,
  });
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  // 2) Pool ya apuntando a la base de datos.
  pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  });

  // 3) Tablas.
  for (const stmt of SCHEMA_STATEMENTS) {
    await pool.query(stmt);
  }

  // 4) Super-admin inicial (solo si no hay ningún usuario todavía).
  await seedInitialAdmin();

  return pool;
}

async function seedInitialAdmin() {
  const rows = await query('SELECT COUNT(*) AS total FROM users');
  if (rows[0].total > 0) return;

  const { username, password, name } = config.seedAdmin;
  if (!password || password === 'Itagui2026*Cambiar') {
    throw new Error('SEED_ADMIN_PASSWORD is required when the database has no users.');
  }
  const hash = await bcrypt.hash(password, 12);
  await query(
    'INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)',
    [username, name, hash, 'superadmin']
  );
  console.log(`[db] Super-administrador inicial creado: "${username}". Cambia la contraseña tras el primer inicio de sesión.`);
}
