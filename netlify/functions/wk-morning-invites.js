const WAKYMA_KEY   = "0jIXmFzxFwMEy5U2BlEvj3dgGuL0pcDasLKfsmXgD-NkYEiX";
const SUPABASE_URL = "https://lhvaonkibrfujdbbhkkr.supabase.co";
const SUPABASE_KEY = "sb_publishable_wwY0Zcd-sxz5Gqr_NJ7zhg_5OkSiCU0";

async function wakyma(endpoint, opts = {}) {
  const r = await fetch("https://vets.wakyma.com" + endpoint, {
    method: opts.method || "GET",
    headers: {
      "Authorization": "Bearer " + WAKYMA_KEY,
      ...(opts.body ? { "Content-Type": "application/json" } : {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Wakyma ${r.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function supabase(method, table, opts = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  if (opts.filter) url += "?" + opts.filter;
  const r = await fetch(url, {
    method,
    headers: {
      "apikey":        SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type":  "application/json",
      "Prefer":        "return=representation"
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Supabase ${r.status}: ${text}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin":  "*",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...cors,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  try {
    // ── Fechas ─────────────────────────────────────────────
    const pad = n => String(n).padStart(2, "0");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tDMY  = `${pad(tomorrow.getDate())}-${pad(tomorrow.getMonth()+1)}-${tomorrow.getFullYear()}`;
    const tISO  = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

    // ── Citas de mañana ────────────────────────────────────
    const apptRes = await wakyma(`/api/v3/appointments?dateFrom=${tDMY}&dateUntil=${tDMY}`);
    const appts   = Array.isArray(apptRes) ? apptRes : (apptRes.data || []);

    if (!appts.length) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ success: true, created: 0, message: "Sin citas para mañana" })
      };
    }

    // ── Teléfonos ya en Familia Canexion ───────────────────
    const sbClients  = await supabase("GET", "clients");
    const memberPhones = new Set(
      (sbClients || []).map(c => (c.phone || "").replace(/\D/g, "")).filter(Boolean)
    );

    // ── Invitaciones ya creadas para mañana ────────────────
    const existingInvites = await supabase("GET", "wk_invites",
      { filter: `appointment_date=eq.${tISO}` });
    const existingRemIds = new Set(
      (existingInvites || []).map(i => String(i.wk_reminder_id))
    );

    // ── Tipo de recordatorio ───────────────────────────────
    let reminderTypeId = null;
    try {
      const rtRes  = await wakyma("/api/v3/reminder-types");
      const rtList = Array.isArray(rtRes) ? rtRes : (rtRes.data || []);
      const match  =
        rtList.find(rt => (rt.name||"").toLowerCase().includes("familia")) ||
        rtList.find(rt => (rt.name||"").toLowerCase().includes("invit"))   ||
        rtList[0];
      if (match) reminderTypeId = match.id;
    } catch(e) { /* sin tipo → se envía sin él */ }

    // ── Procesar cada cita ─────────────────────────────────
    let created = 0;
    const errors = [];

    for (const appt of appts) {
      try {
        const clientId = appt.clientId || appt.client_id;
        const petId    = appt.petId    || appt.pet_id;
        if (!clientId) continue;

        // Datos del cliente
        let cData;
        try {
          const cRes = await wakyma(`/api/v3/clients/${clientId}`);
          cData = Array.isArray(cRes) ? cRes[0] : cRes;
        } catch(e) {
          // Intentar por búsqueda en array
          continue;
        }
        if (!cData) continue;

        const phone = ((cData.phone || cData.mobilePhone || "")).replace(/\D/g, "");

        // Saltar si ya es miembro
        if (phone && memberPhones.has(phone)) continue;

        // Crear recordatorio en Wakyma
        const remBody = {
          clientId,
          text:  "Invitar a Familia Canexion",
          date:  tDMY,
          state: 0
        };
        if (petId)          remBody.petId          = petId;
        if (reminderTypeId) remBody.reminderTypeId = reminderTypeId;

        const remRes = await wakyma("/api/v3/reminders", { method: "POST", body: remBody });
        const remId  = remRes.id || remRes.data?.id || remRes.reminderId;
        if (!remId) continue;

        // Evitar duplicado
        if (existingRemIds.has(String(remId))) continue;

        // Guardar en Supabase
        await supabase("POST", "wk_invites", { body: {
          wk_reminder_id:   String(remId),
          wk_client_id:     String(clientId),
          wk_pet_id:        petId ? String(petId) : null,
          client_name:      [cData.name, cData.surname].filter(Boolean).join(" "),
          client_phone:     phone,
          appointment_date: tISO,
          status:           "pending"
        }});

        existingRemIds.add(String(remId)); // evitar duplicado en mismo loop
        created++;
      } catch(e) {
        errors.push(e.message);
      }
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ success: true, created, total: appts.length, errors })
    };
  } catch(e) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
