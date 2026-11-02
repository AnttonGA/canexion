// sync-stats-background.js — Estadísticas por socio + estado de retención (Fase 1, plan 2027)
// Para CADA socio baja las cabeceras de venta de Wakyma (fecha + empleado + total),
// clasifica en tienda/vet/peluquería (igual que la ficha del CRM), y calcula:
//   - wk_client_stats: totales, visitas y última visita por categoría (rellena a TODOS,
//     así las fichas cargan al instante sin recalcular).
//   - clients.retention_status: activo | riesgo | inactivo | sin_datos (reglas del spec).
// Background (hasta 15 min) + throttle 1,1s/llamada (Wakyma limita a 60/min).
// La dispara a diario wk-estados-scan.js. No consume el detalle de ventas (solo cabeceras).

const WAKYMA_KEY   = process.env.WAKYMA_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

// Clasificación de la venta por el primer nombre del empleado (igual que el CRM).
const EMP_ROLE = {
  "isabel": "shop", "alberto": "shop", "sylvia": "shop",
  "ana": "vet", "naiara": "vet", "onintza": "vet",
  "sara": "grooming"
};

// Umbrales (reglas del spec). Fáciles de tocar.
const ACTIVE_DAYS   = 90;    // activo si hay compra/visita en los últimos 90 días
const VET_INACTIVE  = 456;   // 15 meses sin visita al vet → inactivo
const STORE_FALLBACK_INACTIVE = 180; // sin intervalo conocido, inactivo a 180 días

const DAY = 86400000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function wk(endpoint) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(1100);
    const r = await fetch("https://vets.wakyma.com" + endpoint, { headers: { "Authorization": "Bearer " + WAKYMA_KEY } });
    if (r.status === 429) { await sleep(20000); continue; }
    const text = await r.text();
    if (!r.ok) throw new Error(`Wakyma ${r.status}: ${text.slice(0, 150)}`);
    const json = JSON.parse(text);
    return json.data ?? json;
  }
  throw new Error("Wakyma 429 persistente");
}

async function sb(method, path, body, extraPrefer) {
  const headers = { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" };
  if (method === "POST")  headers["Prefer"] = extraPrefer || "resolution=merge-duplicates,return=minimal";
  if (method === "PATCH") headers["Prefer"] = "return=minimal";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  if (r.status === 204 || method === "POST" || method === "PATCH") return null;
  return r.json();
}

const fmtD = d => d ? (d.toString().split("T")[0]) : null;
const daysSince = (dateStr, today) => dateStr ? Math.floor((today - new Date(dateStr + "T00:00:00Z").getTime()) / DAY) : null;

// Mediana de los huecos (en días) entre compras de tienda ordenadas.
function medianInterval(dates) {
  const ds = [...new Set(dates)].filter(Boolean).sort();  // una por día, ascendente
  if (ds.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < ds.length; i++) {
    gaps.push(Math.round((new Date(ds[i]) - new Date(ds[i - 1])) / DAY));
  }
  gaps.sort((a, b) => a - b);
  const m = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[m] : Math.round((gaps[m - 1] + gaps[m]) / 2);
}

// Estado de retención a partir de las fechas y el intervalo de tienda.
function computeStatus({ anyLast, vetLast, shopLast, interval, hasSales }, today) {
  if (!hasSales) return "sin_datos";
  const anyDays = daysSince(anyLast, today);
  if (anyDays !== null && anyDays <= ACTIVE_DAYS) return "activo";

  // Pasados los 90 días sin actividad = al menos "en riesgo"; escala a inactivo si:
  let inactive = false;
  const vetDays  = daysSince(vetLast, today);
  const shopDays = daysSince(shopLast, today);
  if (vetDays  !== null && vetDays  > VET_INACTIVE) inactive = true;                 // clínica: 15 meses
  if (interval && shopDays !== null && shopDays > 2 * interval) inactive = true;     // tienda: 2× intervalo
  if (!interval && shopDays !== null && shopDays > STORE_FALLBACK_INACTIVE) inactive = true;
  if (anyDays !== null && anyDays > STORE_FALLBACK_INACTIVE && vetDays === null) inactive = true;
  return inactive ? "inactivo" : "riesgo";
}

exports.handler = async () => {
  const today = Date.now();
  try {
    const socioRows = await sb("GET", "clients?select=id,wk_client_id&wk_client_id=not.is.null");
    const socios = (socioRows || []).filter(c => c.wk_client_id);

    let done = 0, errors = [];
    const counts = { activo: 0, riesgo: 0, inactivo: 0, sin_datos: 0 };

    for (const c of socios) {
      const cid = String(c.wk_client_id);
      try {
        // Cabeceras de venta del socio (paginadas con skip)
        let sales = [], skip = 0;
        for (let p = 0; p < 20; p++) {
          const res  = await wk(`/api/v3/sales?clientId=${encodeURIComponent(cid)}&limit=500&skip=${skip}`);
          const page = Array.isArray(res) ? res : (res && res.data ? res.data : []);
          sales = sales.concat(page);
          if (page.length < 500) break;
          skip += 500;
        }

        let shopTotal = 0, shopVisits = 0, shopLast = null;
        let vetTotal  = 0, vetVisits  = 0, vetLast  = null;
        let groomTotal = 0, groomVisits = 0, groomLast = null;
        const shopDates = [];
        const updLast = (cur, d) => (!d ? cur : (!cur || new Date(d) > new Date(cur) ? d : cur));

        for (const s of sales) {
          const total  = parseFloat(s.totalPriceWithTax || s.totalPriceNoTax || 0) || 0;
          const date   = s.createdAt || s.date;
          const empKey = (s.employee && s.employee.name ? s.employee.name : "").toLowerCase().split(" ")[0];
          const role   = EMP_ROLE[empKey] || "shop";
          if (role === "vet")            { vetTotal   += total; vetVisits++;   vetLast   = updLast(vetLast,   date); }
          else if (role === "grooming")  { groomTotal += total; groomVisits++; groomLast = updLast(groomLast, date); }
          else                           { shopTotal  += total; shopVisits++;  shopLast  = updLast(shopLast,  date); if (date) shopDates.push(fmtD(date)); }
        }

        const sl = fmtD(shopLast), vl = fmtD(vetLast), gl = fmtD(groomLast);
        const anyLast = [sl, vl, gl].filter(Boolean).sort().slice(-1)[0] || null;
        const interval = medianInterval(shopDates);
        const status = computeStatus({ anyLast, vetLast: vl, shopLast: sl, interval, hasSales: sales.length > 0 }, today);
        counts[status] = (counts[status] || 0) + 1;

        // wk_client_stats (upsert por wk_client_id)
        await sb("POST", "wk_client_stats", {
          wk_client_id:          cid,
          tienda_total:          shopTotal,  tienda_visits:     shopVisits,  tienda_last_visit:     sl,  tienda_avg:     shopVisits  ? shopTotal  / shopVisits  : 0,
          vet_total:             vetTotal,   vet_visits:        vetVisits,   vet_last_visit:        vl,  vet_avg:        vetVisits   ? vetTotal   / vetVisits   : 0,
          peluqueria_total:      groomTotal, peluqueria_visits: groomVisits, peluqueria_last_visit: gl,  peluqueria_avg: groomVisits ? groomTotal / groomVisits : 0,
          last_synced:           new Date().toISOString()
        });

        // clients (estado de retención)
        await sb("PATCH", `clients?wk_client_id=eq.${encodeURIComponent(cid)}`, {
          retention_status:    status,
          retention_status_at: new Date().toISOString(),
          last_activity:       anyLast,
          buy_interval_days:   interval
        });

        done++;
      } catch (e) {
        errors.push(`${cid}: ${e.message}`);
      }
    }

    console.log("[sync-stats] done:", done, "de", socios.length, "| estados:", JSON.stringify(counts), "| errores:", errors.length);
    return { statusCode: 200, body: JSON.stringify({ ok: true, socios: socios.length, done, counts, errors: errors.slice(0, 5) }) };
  } catch (e) {
    console.error("[sync-stats] fatal:", e.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
