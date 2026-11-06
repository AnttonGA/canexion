// retention-summary.js — Lectura rápida del reparto de estados de socio (ops/verificación).
// GET → cuenta de clients por retention_status + una muestra. Usa service_role (ignora RLS).
// No modifica nada. Útil para comprobar el resultado de sync-stats-background.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const SB_ANON      = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY); // clave de proyecto para validar el token de sesión

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY } });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 150)}`);
  return r.json();
}

// Solo personal autenticado (devuelve PII).
async function requireStaff(event) {
  const h = (event && event.headers) || {};
  const token = ((h.authorization || h.Authorization || "").match(/Bearer\s+(.+)/i) || [])[1];
  if (!token || !SUPABASE_URL || !SB_ANON) return false;
  try { const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { "apikey": SB_ANON, "Authorization": "Bearer " + token } }); return r.ok; }
  catch (e) { return false; }
}

exports.handler = async (event) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (!(await requireStaff(event))) return { statusCode: 401, headers: cors, body: JSON.stringify({ ok: false, error: "No autorizado" }) };
  try {
    const rows = await sb("clients?select=name,retention_status,last_activity,buy_interval_days,retention_status_at&wk_client_id=not.is.null&order=last_activity.asc.nullsfirst");
    const counts = { activo: 0, riesgo: 0, inactivo: 0, sin_datos: 0, sin_calcular: 0 };
    for (const c of rows) {
      const s = c.retention_status || "sin_calcular";
      counts[s] = (counts[s] || 0) + 1;
    }
    const sample = rows.slice(0, 25).map(c => ({ socio: c.name, estado: c.retention_status, ult_actividad: c.last_activity, intervalo_dias: c.buy_interval_days }));
    const calculado = rows.some(c => c.retention_status_at);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, socios: rows.length, counts, calculado, muestra: sample }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
