// backend/src/routes/stats.js
// Métricas reales del panel de administración: totales, tendencia de visitas,
// series temporales (diaria / semanal / mensual) y sitios más visitados.
// Todo se calcula desde datos reales (tabla sites + visit_log).
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';

export const statsRouter = Router();
statsRouter.use(requireAuth);

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const scalar = async (sql, params = []) => {
  const rows = await query(sql, params);
  return Number(rows[0]?.total ?? 0);
};

// Clave local YYYY-MM-DD de una fecha.
const dateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// GET /api/stats
statsRouter.get('/', asyncHandler(async (_req, res) => {
  // ── Totales ──
  const totals = {
    visits: await scalar('SELECT COALESCE(SUM(visits), 0) AS total FROM sites'),
    sites: await scalar('SELECT COUNT(*) AS total FROM sites'),
    announcements: await scalar('SELECT COUNT(*) AS total FROM announcements'),
    pqrs: await scalar('SELECT COUNT(*) AS total FROM pqrs'),
    pqrsPending: await scalar("SELECT COUNT(*) AS total FROM pqrs WHERE status = 'pending'"),
  };

  // ── Tendencia de visitas: este mes vs. mes anterior (desde visit_log) ──
  const visitsThisMonth = await scalar(
    'SELECT COUNT(*) AS total FROM visit_log WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())'
  );
  const visitsLastMonth = await scalar(
    'SELECT COUNT(*) AS total FROM visit_log WHERE YEAR(created_at) = YEAR(CURDATE() - INTERVAL 1 MONTH) AND MONTH(created_at) = MONTH(CURDATE() - INTERVAL 1 MONTH)'
  );
  let visitsTrend;
  if (visitsLastMonth > 0) {
    visitsTrend = Math.round(((visitsThisMonth - visitsLastMonth) / visitsLastMonth) * 100);
  } else {
    visitsTrend = visitsThisMonth > 0 ? 100 : 0;
  }

  const today = new Date();

  // ── Serie diaria: últimos 7 días ──
  const dailyRows = await query(
    'SELECT DATE(created_at) AS d, COUNT(*) AS c FROM visit_log WHERE created_at >= CURDATE() - INTERVAL 6 DAY GROUP BY DATE(created_at)'
  );
  const dailyMap = {};
  for (const r of dailyRows) dailyMap[dateKey(new Date(r.d))] = Number(r.c);
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    daily.push({ name: WEEKDAYS[d.getDay()], Interacciones: dailyMap[dateKey(d)] || 0 });
  }

  // ── Serie semanal: últimas 4 semanas ──
  const weeklyRows = await query(
    'SELECT FLOOR(DATEDIFF(CURDATE(), DATE(created_at)) / 7) AS wk, COUNT(*) AS c FROM visit_log WHERE created_at >= CURDATE() - INTERVAL 27 DAY GROUP BY wk'
  );
  const weeklyMap = {};
  for (const r of weeklyRows) weeklyMap[Number(r.wk)] = Number(r.c);
  const weekly = [];
  for (let wk = 3; wk >= 0; wk--) {
    weekly.push({ name: `Sem ${4 - wk}`, Interacciones: weeklyMap[wk] || 0 });
  }

  // ── Serie mensual: los 12 meses del año en curso ──
  const monthlyRows = await query(
    'SELECT MONTH(created_at) AS m, COUNT(*) AS c FROM visit_log WHERE YEAR(created_at) = YEAR(CURDATE()) GROUP BY MONTH(created_at)'
  );
  const monthlyMap = {};
  for (const r of monthlyRows) monthlyMap[Number(r.m)] = Number(r.c);
  const monthly = MONTHS.map((name, idx) => ({ name, Interacciones: monthlyMap[idx + 1] || 0 }));

  // ── Sitios más visitados ──
  const topRows = await query('SELECT id, name, visits FROM sites ORDER BY visits DESC, name ASC LIMIT 5');
  const topSites = topRows.map((r) => ({ id: r.id, name: r.name, visits: Number(r.visits) }));

  res.json({
    totals,
    visitsTrend,
    series: { daily, weekly, monthly },
    topSites,
  });
}));
