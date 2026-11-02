// backfill-sales.js — Carga histórica de la caché de ventas de SOCIOS (Fase 0).
// Herramienta MANUAL (no programada; las programadas no se pueden invocar por HTTP).
// Procesa socios por tandas limitadas por tiempo (~7s) usando el filtro clientId de
// Wakyma. Se llama en bucle: POST {start, from, until} → devuelve "next" para la
// siguiente llamada hasta next=null. Se puede borrar tras el backfill.

const WAKYMA_KEY   = process.env.WAKYMA_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

async function wk(endpoint) {
  const r = await fetch("https://vets.wakyma.com" + endpoint, { headers: { "Authorization": "Bearer " + WAKYMA_KEY } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Wakyma ${r.status}: ${text.slice(0, 120)}`);
  const json = JSON.parse(text);
  return json.data ?? json;
}

async function sb(method, path, body) {
  const headers = { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" };
  if (method === "POST") headers["Prefer"] = "return=minimal,resolution=ignore-duplicates";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  if (r.status === 204 || method === "POST") return null;
  return r.json();
}

exports.handler = async (event) => {
  const t0 = Date.now();
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { ...cors, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };

  try {
    const b     = JSON.parse(event.body || "{}");
    if (b.diag) {
      const key = SUPABASE_KEY || "";
      return { statusCode: 200, headers: cors, body: JSON.stringify({
        url_set: !!SUPABASE_URL, url_prefix: (SUPABASE_URL || "").slice(0, 30),
        service_set: !!process.env.SUPABASE_SERVICE_KEY,
        publishable_set: !!process.env.SUPABASE_KEY,
        used_key_prefix: key.slice(0, 11), used_key_len: key.length
      }) };
    }
    const start = b.start || 0;
    const from  = b.from  || "2026-01-01";
    const until = b.until || new Date().toISOString().split("T")[0];

    const socioRows = await sb("GET", "clients?select=wk_client_id&wk_client_id=not.is.null&order=wk_client_id.asc");
    const socios = [...new Set((socioRows || []).map(c => String(c.wk_client_id)))];
    const total = socios.length;

    let i = start, lines = 0, done = 0;
    for (; i < total; i++) {
      if (Date.now() - t0 > 7000) break;   // time-box para no pasar el límite de 10s
      const cid = socios[i];

      // Ventas del socio (filtro por cliente, paginado con skip)
      let sales = [], skip = 0;
      for (let p = 0; p < 20; p++) {
        const res  = await wk(`/api/v3/sales?clientId=${encodeURIComponent(cid)}&dateFrom=${from}&dateUntil=${until}&limit=500&skip=${skip}`);
        const page = Array.isArray(res) ? res : (res && res.data ? res.data : []);
        sales = sales.concat(page);
        if (page.length < 500) break;
        skip += 500;
      }

      // Detalle → líneas
      const rows = [];
      for (const s of sales) {
        let detObj;
        try { const det = await wk(`/api/v3/sales/${s.id}`); detObj = Array.isArray(det) ? det[0] : det; }
        catch(e) { continue; }
        const dls  = (detObj && detObj.details) || [];
        const pid  = (s.pet && s.pet.id) ? String(s.pet.id) : null;
        const date = ((s.date || detObj.date || "") + "").slice(0, 10) || null;
        for (const ln of dls) {
          if (!ln.id) continue;
          rows.push({
            line_id:       String(ln.id),
            wk_sale_id:    String(s.id),
            wk_service_id: (ln.service && ln.service.id) ? String(ln.service.id) : null,
            product_name:  (ln.service && ln.service.name) || "",
            quantity:      (ln.quantity !== undefined ? ln.quantity : null),
            total_price:   (ln.totalPrice !== undefined ? ln.totalPrice : (ln.totalPriceWithTax !== undefined ? ln.totalPriceWithTax : null)),
            sale_date:     date,
            wk_client_id:  cid,
            wk_pet_id:     pid
          });
        }
      }
      for (let k = 0; k < rows.length; k += 200) await sb("POST", "sales_lines", rows.slice(k, k + 200));
      lines += rows.length; done++;
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, start, next: (i < total ? i : null), socios_done: done, lines, total_socios: total, from, until }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
