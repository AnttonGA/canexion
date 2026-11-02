// sync-sales.js — Caché de líneas de venta de SOCIOS (Fase 0, plan 2027)
// Sincroniza en Supabase (sales_lines) las líneas de venta de Wakyma de los
// clientes que son socios (tienen wk_client_id). Base para reposición,
// desparasitación por producto, estados de socio y medición.
//
// - Run programado (netlify.toml): sincroniza ayer → hoy.
// - Backfill / manual: POST (o GET) con from y until (YYYY-MM-DD).
//
// Variables de entorno: WAKYMA_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY.

const WAKYMA_KEY   = process.env.WAKYMA_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
// service_role (ignora RLS) si está; si no, la publishable (fallback).
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

async function wk(endpoint) {
  const r = await fetch("https://vets.wakyma.com" + endpoint, {
    headers: { "Authorization": "Bearer " + WAKYMA_KEY }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Wakyma ${r.status}: ${text.slice(0, 150)}`);
  const json = JSON.parse(text);
  return json.data ?? json;
}

async function sb(method, path, body) {
  const headers = {
    "apikey":        SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type":  "application/json"
  };
  if (method === "POST") headers["Prefer"] = "return=minimal,resolution=ignore-duplicates";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  if (r.status === 204 || method === "POST") return null;
  return r.json();
}

const ymd = d => d.toISOString().split("T")[0];

exports.handler = async (event) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { ...cors, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" }, body: "" };
  }

  try {
    // Rango: del body/query, o por defecto ayer → hoy (run programado)
    let from, until;
    try { const b = JSON.parse(event.body || "{}"); from = b.from; until = b.until; } catch(e) {}
    const qs = event.queryStringParameters || {};
    from  = from  || qs.from;
    until = until || qs.until;
    if (!from || !until) {
      const hoy = new Date(), ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      from = ymd(ayer); until = ymd(hoy);
    }

    // Conjunto de socios (wk_client_id)
    const socioRows = await sb("GET", "clients?select=wk_client_id&wk_client_id=not.is.null");
    const socios = new Set((socioRows || []).map(c => String(c.wk_client_id)));
    if (!socios.size) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, msg: "Sin socios vinculados", lines: 0 }) };
    }

    // Ventas del rango (paginadas con skip)
    let sales = [], skip = 0;
    for (let i = 0; i < 60; i++) {
      const res  = await wk(`/api/v3/sales?dateFrom=${from}&dateUntil=${until}&limit=500&skip=${skip}`);
      const page = Array.isArray(res) ? res : (res && res.data ? res.data : []);
      sales = sales.concat(page);
      if (page.length < 500) break;
      skip += 500;
    }

    // Solo ventas de socios
    const socioSales = sales.filter(s => {
      const cid = s.client && (s.client.id || s.clientId);
      return cid && socios.has(String(cid));
    });

    // Detalle de cada venta → líneas
    const rows = [];
    const errors = [];
    for (const s of socioSales) {
      let detObj;
      try {
        const det = await wk(`/api/v3/sales/${s.id}`);
        detObj = Array.isArray(det) ? det[0] : det;
      } catch(e) { errors.push(`sale ${s.id}: ${e.message}`); continue; }
      const lines = (detObj && detObj.details) || [];
      const cid   = String((s.client && (s.client.id || s.clientId)) || "");
      const pid   = (s.pet && s.pet.id) ? String(s.pet.id) : null;
      const date  = ((s.date || detObj.date || "") + "").slice(0, 10) || null;
      for (const ln of lines) {
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

    // Upsert por lotes (ignora duplicados por line_id)
    for (let i = 0; i < rows.length; i += 200) {
      await sb("POST", "sales_lines", rows.slice(i, i + 200));
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ ok: true, from, until, sales_total: sales.length, socio_sales: socioSales.length, lines: rows.length, errors: errors.slice(0, 5) })
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
