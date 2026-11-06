// reconcile.js — Cruza cada aviso enviado con las compras posteriores (Fase 1 / medición).
// Para cada fila de message_log sin reconciliar, mira si el socio compró algo en los 14
// días siguientes al aviso (desde la caché sales_lines) y marca purchased_14d. Si la
// ventana de 14 días ya cerró sin compra → false. Si sigue abierta → se deja pendiente.
// Alimenta los KPIs "compra 14d" y "recuperados" del panel. Solo Supabase (rápido).
// No programada: la dispara a diario wk-reconcile-scan tras el sync de ventas.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const WINDOW_DAYS  = 14;   // ventana de atribución compra-tras-aviso
const LOOKBACK_DAYS = 60;  // no reconciliar avisos más viejos que esto

async function sb(method, path, body) {
  const headers = { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" };
  if (method === "PATCH") headers["Prefer"] = "return=minimal";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  if (r.status === 204 || method === "PATCH") return null;
  return r.json();
}

const ymd = s => (s || "").toString().slice(0, 10);
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

exports.handler = async () => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const sinceIso = addDays(today, -LOOKBACK_DAYS);

    // 1) Avisos sin reconciliar (de los últimos 60 días)
    const logs = await sb("GET", `message_log?select=id,client_id,aviso_type,created_at&reconciled_at=is.null&created_at=gte.${sinceIso}`);
    if (!logs || !logs.length) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, pendientes: 0, reconciliados: 0 }) };
    }

    // 2) Mapa client_id (CRM) → wk_client_id (solo socios vinculados a Wakyma)
    const socios = await sb("GET", "clients?select=id,wk_client_id&wk_client_id=not.is.null");
    const cmap = {};
    (socios || []).forEach(c => { cmap[String(c.id)] = String(c.wk_client_id); });

    const work = logs.filter(l => cmap[String(l.client_id)]);
    if (!work.length) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, pendientes: logs.length, reconciliados: 0, msg: "sin avisos de socios vinculados" }) };
    }

    // 3) Compras de esos socios desde el aviso más antiguo
    const wkids = [...new Set(work.map(l => cmap[String(l.client_id)]))];
    const minDate = work.map(l => ymd(l.created_at)).sort()[0];
    const inList = "(" + wkids.map(encodeURIComponent).join(",") + ")";
    const sales = await sb("GET", `sales_lines?select=wk_client_id,sale_date&wk_client_id=in.${inList}&sale_date=gte.${minDate}&order=sale_date.asc`);
    const salesByWk = {};
    (sales || []).forEach(s => { (salesByWk[String(s.wk_client_id)] ||= []).push(ymd(s.sale_date)); });

    // 4) Resolver cada aviso
    const trueIds = [], falseIds = [];
    for (const l of work) {
      const wk = cmap[String(l.client_id)];
      const d0 = ymd(l.created_at);
      const dEnd = addDays(d0, WINDOW_DAYS);
      const bought = (salesByWk[wk] || []).some(sd => sd >= d0 && sd <= dEnd);
      if (bought)            trueIds.push(l.id);
      else if (today > dEnd) falseIds.push(l.id);   // ventana cerrada sin compra
      // ventana aún abierta → se deja pendiente para el próximo día
    }

    // 5) Marcar (dos lotes: con compra / sin compra)
    const nowIso = new Date().toISOString();
    const patchBatch = async (ids, val) => {
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const idList = "(" + chunk.map(encodeURIComponent).join(",") + ")";
        await sb("PATCH", `message_log?id=in.${idList}`, { purchased_14d: val, reconciled_at: nowIso });
      }
    };
    if (trueIds.length)  await patchBatch(trueIds, true);
    if (falseIds.length) await patchBatch(falseIds, false);

    return { statusCode: 200, headers: cors, body: JSON.stringify({
      ok: true, revisados: work.length, con_compra: trueIds.length, sin_compra: falseIds.length,
      aun_abiertos: work.length - trueIds.length - falseIds.length
    }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
