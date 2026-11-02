// backfill-sales-background.js — Carga histórica de la caché de ventas de SOCIOS.
// Función EN SEGUNDO PLANO (sufijo -background → hasta 15 min). Respeta el límite de
// Wakyma (60 req/min) con una pausa entre llamadas, y reintenta si salta el 429.
// Devuelve 202 al instante; el progreso se vigila con backfill-sales {count:true}.
// Temporal: borrar (junto con backfill-sales.js) tras el backfill.

const WAKYMA_KEY   = process.env.WAKYMA_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Toda llamada a Wakyma pasa por aquí → pausa de 1,1s (≈54/min) + reintento ante 429.
async function wk(endpoint) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(1100);
    const r = await fetch("https://vets.wakyma.com" + endpoint, { headers: { "Authorization": "Bearer " + WAKYMA_KEY } });
    if (r.status === 429) { await sleep(20000); continue; }
    const text = await r.text();
    if (!r.ok) throw new Error(`Wakyma ${r.status}: ${text.slice(0, 120)}`);
    const json = JSON.parse(text);
    return json.data ?? json;
  }
  throw new Error("Wakyma 429 persistente");
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
  let from, until;
  try { const b = JSON.parse(event.body || "{}"); from = b.from; until = b.until; } catch(e) {}
  from  = from  || "2026-01-01";
  until = until || new Date().toISOString().split("T")[0];

  try {
    const socioRows = await sb("GET", "clients?select=wk_client_id&wk_client_id=not.is.null&order=wk_client_id.asc");
    const socios = [...new Set((socioRows || []).map(c => String(c.wk_client_id)))];
    let totalLines = 0, done = 0;

    for (const cid of socios) {
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
      totalLines += rows.length; done++;
    }

    console.log(`[backfill] socios=${done}/${socios.length} lines=${totalLines} (${from}..${until})`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, socios: done, lines: totalLines }) };
  } catch (e) {
    console.log(`[backfill] ERROR: ${e.message}`);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
