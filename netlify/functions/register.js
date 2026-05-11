// Netlify Function: registro de nuevo socio de Familia Canexion
// - Comprueba duplicado en Supabase
// - Busca el cliente en Wakyma por teléfono:
//     · Si existe  → enriquece email, vincula wk_client_id
//     · Si no existe → crea ficha en Wakyma (cliente + mascotas) y vincula el id
// - Inserta en Supabase con wk_client_id
//
// Variables de entorno necesarias (Netlify → Site config → Environment variables):
//   SUPABASE_URL   → https://lhvaonkibrfujdbbhkkr.supabase.co
//   SUPABASE_KEY   → sb_publishable_...
//   WAKYMA_KEY     → la API key de Wakyma

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const WAKYMA_KEY   = process.env.WAKYMA_KEY;

// ── Supabase helper ───────────────────────────────────────
async function sbFetch(method, path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey":        SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type":  "application/json",
      "Prefer":        "return=representation"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  if (r.status === 204) return null;
  return r.json();
}

// ── Wakyma GET helper ─────────────────────────────────────
async function wkFetch(endpoint) {
  if (!WAKYMA_KEY) return null;
  try {
    const r = await fetch("https://vets.wakyma.com" + endpoint, {
      headers: { "Authorization": "Bearer " + WAKYMA_KEY }
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.data ?? data;
  } catch(e) { return null; }
}

// ── Wakyma POST helper ────────────────────────────────────
async function wkPost(endpoint, body) {
  if (!WAKYMA_KEY) return null;
  try {
    const r = await fetch("https://vets.wakyma.com" + endpoint, {
      method:  "POST",
      headers: {
        "Authorization": "Bearer " + WAKYMA_KEY,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.data ?? data;
  } catch(e) { return null; }
}

// ── Convierte especie en texto al tipo numérico de Wakyma ─
function speciesToWkType(species) {
  if (!species) return 18;
  switch (species.toLowerCase()) {
    case "perro":  return 1;
    case "gato":   return 2;
    case "conejo": return 3;
    case "ave":    return 4;
    case "reptil": return 5;
    default:       return 18; // Otro
  }
}

// ── Convierte fecha YYYY-MM-DD al ISO que espera Wakyma ──
function toWkDate(dateStr) {
  if (!dateStr) return undefined;
  if (dateStr.includes("T")) return dateStr;
  return dateStr + "T00:00:00.000Z";
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors, body: "" };

  try {
    const payload = JSON.parse(event.body || "{}");
    const { name, phone, email, postal_code, address, language,
            pets, svc, benefits, marketing_consent, photo_consent,
            since, pet, species, pet_bday } = payload;

    if (!name || !phone || !postal_code) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Faltan campos obligatorios" }) };
    }

    // 1 — Comprobar duplicado en Supabase
    const existing = await sbFetch("GET", `clients?phone=eq.${encodeURIComponent(phone)}`);
    if (existing && existing.length > 0) {
      return { statusCode: 409, headers: cors, body: JSON.stringify({ error: "duplicado" }) };
    }

    // 2 — Buscar en Wakyma por teléfono
    let wkClientId    = null;
    let enrichedEmail = email;
    let foundInWakyma = false;

    const wkRes  = await wkFetch(`/api/v3/clients?phone=${encodeURIComponent(phone)}`);
    const wkList = Array.isArray(wkRes) ? wkRes : [];

    if (wkList.length > 0) {
      // Cliente ya existe en Wakyma → vincular
      const wkC     = wkList[0];
      wkClientId    = String(wkC.id);
      foundInWakyma = true;
      if (!email && (wkC.email || wkC.Email))
        enrichedEmail = wkC.email || wkC.Email;

    } else {
      // 2b — No existe en Wakyma → crear ficha nueva
      try {
        const nameParts = name.trim().split(/\s+/);
        const wkName    = nameParts[0];
        const wkSurname = nameParts.slice(1).join(" ") || "";

        const wkClient = await wkPost("/api/v3/clients", {
          name:                     wkName,
          surname:                  wkSurname || undefined,
          phone,
          email:                    enrichedEmail || undefined,
          cp:                       postal_code,
          address:                  address       || undefined,
          personalDataProcessing:   true,
          commercialCommunications: !!marketing_consent
        });

        if (wkClient && wkClient.id) {
          wkClientId = String(wkClient.id);

          // Crear mascotas en Wakyma
          const petsList = Array.isArray(pets) ? pets : [];
          for (const p of petsList) {
            if (!p.name) continue;
            const petBody = {
              name:     p.name,
              clientId: wkClientId,
              type:     speciesToWkType(p.species)
            };
            if (p.breed)    petBody.breed     = p.breed;
            if (p.pet_bday) petBody.birthDate = toWkDate(p.pet_bday);
            await wkPost("/api/v3/pets", petBody);
          }
        }
      } catch(e) {
        // Fallo silencioso — el registro en Supabase continúa igualmente
        console.error("Wakyma create error:", e.message);
      }
    }

    // 3 — Insertar en Supabase
    const result = await sbFetch("POST", "clients", {
      name,
      phone,
      email:             enrichedEmail || "",
      postal_code:       postal_code,
      since:             since    || "",
      pets:              pets     || [],
      pet:               pet      || (pets?.[0]?.name    || ""),
      species:           species  || (pets?.[0]?.species || ""),
      pet_bday:          pet_bday || (pets?.[0]?.pet_bday || null),
      svc:               svc      || "[]",
      benefits:          benefits || [],
      address:           address  || "",
      language:          language || "es",
      marketing_consent: !!marketing_consent,
      photo_consent:     !!photo_consent,
      wk_client_id:      wkClientId,
      notes:             ""
    });

    return {
      statusCode: 201,
      headers: cors,
      body: JSON.stringify({
        success:      true,
        foundInWakyma,
        client:       result?.[0] || null
      })
    };

  } catch(e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
