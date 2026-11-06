// compute-deworm.js — Desparasitación POR PRODUCTO (Fase 0, plan 2027)
// Calcula los avisos de desparasitación desde la caché de ventas (sales_lines) y el
// catálogo (products type=antiparasitario con días de protección). SOLO Supabase
// (no llama a Wakyma → rápido, sin límite). Crea avisos en deworm_alerts para los
// socios a los que se les ha agotado la protección de su último antiparasitario.
// No programada: se puede invocar por HTTP; la dispara wk-deworm-scan a diario.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const SB_ANON      = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY); // clave de proyecto para validar el token de sesión

// El modo {detail:true} devuelve PII → solo personal autenticado.
async function requireStaff(event) {
  const h = (event && event.headers) || {};
  const token = ((h.authorization || h.Authorization || "").match(/Bearer\s+(.+)/i) || [])[1];
  if (!token || !SUPABASE_URL || !SB_ANON) return false;
  try { const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { "apikey": SB_ANON, "Authorization": "Bearer " + token } }); return r.ok; }
  catch (e) { return false; }
}

async function sb(method, path, body) {
  const headers = { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" };
  if (method === "POST") headers["Prefer"] = "return=minimal,resolution=ignore-duplicates";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  if (r.status === 204 || method === "POST") return null;
  return r.json();
}

// Antelación: avisamos LEAD_DAYS antes de que se agote la protección, para que no
// haya hueco sin desparasitar (el socio compra antes de quedarse descubierto).
// Editable desde el CRM (settings key=config → lead_days); 7 por defecto.
let LEAD_DAYS = 7;

async function loadConfig() {
  try { const r = await sb("GET", "settings?key=eq.config&select=value"); return (r && r[0] && r[0].value) || {}; }
  catch (e) { return {}; }
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

exports.handler = async (event) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  let detail = false;
  try { detail = !!JSON.parse((event && event.body) || "{}").detail; } catch(e) {}
  if (detail && !(await requireStaff(event))) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ ok: false, error: "No autorizado" }) };
  }
  try {
    const cfg = await loadConfig();
    if (cfg.lead_days != null) LEAD_DAYS = cfg.lead_days;
    const today = new Date().toISOString().slice(0, 10);

    // 1) Socios (para nombre/teléfono del aviso y para limitar a socios actuales)
    const socioRows = await sb("GET", "clients?select=wk_client_id,name,phone&wk_client_id=not.is.null");
    const socioMap = {};
    (socioRows || []).forEach(c => { socioMap[String(c.wk_client_id)] = c; });

    // 2) Antiparasitarios con días de protección en el catálogo
    const prods = await sb("GET", "products?select=wk_service_id,protection_days,units_per_pack&type=eq.antiparasitario");
    const prodMap = {};
    (prods || []).forEach(p => { if (p.protection_days) prodMap[p.wk_service_id] = p; });
    const ids = Object.keys(prodMap);
    if (!ids.length) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, msg: "Sin antiparasitarios con días de protección en el catálogo", created: 0 }) };
    }

    // 3) Compras de esos productos (socios), más recientes primero
    const inList = "(" + ids.map(encodeURIComponent).join(",") + ")";
    const lines = await sb("GET", `sales_lines?select=wk_sale_id,wk_client_id,wk_pet_id,wk_service_id,quantity,sale_date,product_name&wk_service_id=in.${inList}&order=sale_date.desc`);

    // 4) Última compra por socio → cobertura (días × unidades) → ¿protección agotada?
    const seen = new Set();
    const due = [];
    for (const ln of (lines || [])) {
      const cid = ln.wk_client_id;
      if (!cid || seen.has(cid)) continue;
      seen.add(cid);
      if (!socioMap[String(cid)]) continue;             // solo socios actuales
      const p = prodMap[ln.wk_service_id];
      // Cobertura = días que protege una unidad comprada × cuántas compró.
      const cover = (p.protection_days || 0) * (ln.quantity || 1);
      if (!cover) continue;
      const nextDue   = addDays(ln.sale_date, cover);         // día real en que se agota
      const alertDate = addDays(nextDue, -LEAD_DAYS);          // avisamos 7 días antes
      if (alertDate <= today) { ln._days = p.protection_days; ln._nextDue = nextDue; ln._name = (socioMap[String(cid)] || {}).name; due.push(ln); }
    }

    // Modo detalle: lista los vencidos con el cálculo (no crea avisos)
    if (detail) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({
        ok: true, antiparasitarios: ids.length, socios_due: due.length, hoy: today,
        detalle: due.slice(0, 30).map(d => ({ socio: d._name, producto: d.product_name, ultima_compra: d.sale_date, dias: d._days, cantidad: d.quantity, vence: d._nextDue }))
      }) };
    }

    // 5) Evitar duplicados: socios que ya tienen un aviso pendiente
    const pend = await sb("GET", "deworm_alerts?select=wk_client_id&status=eq.pending");
    const already = new Set((pend || []).map(a => String(a.wk_client_id)));

    const nuevos = due
      .filter(d => !already.has(String(d.wk_client_id)))
      .map(d => {
        const c = socioMap[String(d.wk_client_id)] || {};
        return {
          wk_sale_id:    String(d.wk_sale_id || ""),
          wk_client_id:  String(d.wk_client_id),
          wk_pet_id:     d.wk_pet_id ? String(d.wk_pet_id) : null,
          client_name:   c.name || "",
          client_phone:  c.phone || "",
          pet_name:      null,
          product_name:  d.product_name || "",
          sale_date:     d.sale_date,
          reminder_date: today,
          status:        "pending"
        };
      });

    if (nuevos.length) {
      for (let i = 0; i < nuevos.length; i += 100) await sb("POST", "deworm_alerts", nuevos.slice(i, i + 100));
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, antiparasitarios: ids.length, socios_due: due.length, created: nuevos.length }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
