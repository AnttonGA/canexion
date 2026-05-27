// wk-deworm-scan.js
// Función diaria: detecta compras de productos de desparasitación en Wakyma
// hechas hace exactamente DEWORM_DAYS días y crea avisos en Supabase.
// Se activa automáticamente cada día (ver netlify.toml) o manualmente via POST.

const WAKYMA_KEY   = process.env.WAKYMA_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const DEWORM_DAYS  = 75; // 2,5 meses

// ── Wakyma helper ────────────────────────────────────────
async function wk(endpoint) {
  const r = await fetch("https://vets.wakyma.com" + endpoint, {
    headers: { "Authorization": "Bearer " + WAKYMA_KEY }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Wakyma ${r.status}: ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  return json.data ?? json;
}

// ── Supabase helper ───────────────────────────────────────
async function sb(method, table, opts = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  if (opts.filter) url += "?" + opts.filter;
  const headers = {
    "apikey":        SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type":  "application/json"
  };
  if (method === "POST")
    headers["Prefer"] = "return=minimal,resolution=ignore-duplicates";
  const r = await fetch(url, {
    method, headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  if (r.status === 204 || method === "POST") return null;
  return r.json();
}

// ── Handler ───────────────────────────────────────────────
exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin":  "*",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { ...cors, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }

  try {
    // 1 — Cargar palabras clave desde Supabase
    const kwRows  = await sb("GET", "deworm_keywords");
    const keywords = (kwRows || []).map(r => r.keyword.toLowerCase().trim()).filter(Boolean);

    if (!keywords.length) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true, message: "Sin palabras clave configuradas", created: 0 }) };
    }

    // 2 — Fecha objetivo: hoy − DEWORM_DAYS
    const target = new Date();
    target.setDate(target.getDate() - DEWORM_DAYS);
    const tISO   = target.toISOString().split("T")[0]; // YYYY-MM-DD
    const todayISO = new Date().toISOString().split("T")[0];

    // 3 — Ventas de ese día en Wakyma
    const salesData = await wk(`/api/v3/sales?dateFrom=${tISO}&dateUntil=${tISO}&limit=500`);
    const sales = Array.isArray(salesData) ? salesData : (salesData?.data || []);

    if (!sales.length) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true, message: `Sin ventas el ${tISO}`, created: 0 }) };
    }

    let created = 0;
    const errors = [];

    for (const sale of sales) {
      try {
        const clientId = sale.clientId || sale.client_id;
        if (!clientId) continue;

        // 4 — Detalle de la venta (con líneas de productos)
        let detail;
        try {
          detail = await wk(`/api/v3/sales/${sale.id}`);
        } catch(e) {
          errors.push(`Sale ${sale.id}: ${e.message}`);
          continue;
        }
        const lines = detail.lines || detail.items || detail.products || [];

        // 5 — Filtrar líneas que coincidan con alguna palabra clave
        const matchingLines = lines.filter(line => {
          const name = (line.name || line.productName || line.product?.name || "").toLowerCase();
          return keywords.some(kw => name.includes(kw));
        });
        if (!matchingLines.length) continue;

        // 6 — Datos del cliente
        let client;
        try {
          const cRes = await wk(`/api/v3/clients/${clientId}`);
          client = Array.isArray(cRes) ? cRes[0] : cRes;
        } catch(e) { continue; }
        if (!client) continue;

        const phone      = (client.phone || client.mobilePhone || "").replace(/\D/g, "");
        const clientName = [client.name, client.surname].filter(Boolean).join(" ");

        // 7 — Mascota (opcional — solo si la venta la incluye)
        const petId = detail.petId || detail.pet_id || sale.petId || sale.pet_id || null;
        let petName = null;
        if (petId) {
          try {
            const petRes = await wk(`/api/v3/pets/${petId}`);
            const pet = Array.isArray(petRes) ? petRes[0] : petRes;
            petName = pet?.name || null;
          } catch(e) { /* silencioso */ }
        }

        // 8 — Resumen de productos (nombre + cantidad si >1)
        const productSummary = matchingLines.map(l => {
          const qty  = l.quantity || l.qty || 1;
          const name = l.name || l.productName || l.product?.name || "producto";
          return qty > 1 ? `${name} (x${qty})` : name;
        }).join(", ");

        // 9 — Insertar en Supabase (ignora duplicados por wk_sale_id)
        await sb("POST", "deworm_alerts", { body: {
          wk_sale_id:    String(sale.id),
          wk_client_id:  String(clientId),
          wk_pet_id:     petId ? String(petId) : null,
          client_name:   clientName,
          client_phone:  phone,
          pet_name:      petName,
          product_name:  productSummary,
          sale_date:     tISO,
          reminder_date: todayISO,
          status:        "pending"
        }});
        created++;

      } catch(e) {
        errors.push(e.message);
      }
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ success: true, date_scanned: tISO, sales_checked: sales.length, created, errors })
    };

  } catch(e) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
