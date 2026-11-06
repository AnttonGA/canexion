const WAKYMA_KEY  = process.env.WAKYMA_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SB_ANON      = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY); // clave de proyecto para validar el token de sesión

// Solo personal autenticado (sesión de Supabase Auth) puede usar el proxy.
async function requireStaff(event) {
  const h = event.headers || {};
  const token = ((h.authorization || h.Authorization || "").match(/Bearer\s+(.+)/i) || [])[1];
  if (!token || !SUPABASE_URL || !SB_ANON) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { "apikey": SB_ANON, "Authorization": "Bearer " + token } });
    return r.ok;
  } catch (e) { return false; }
}

exports.handler = async (event) => {
  // Responder preflight OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      },
      body: ""
    };
  }

  if (!(await requireStaff(event))) {
    return { statusCode: 401, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ success: false, error: "No autorizado" }) };
  }

  // Diagnóstico: clave no configurada
  if (!WAKYMA_KEY) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "WAKYMA_KEY no configurada en variables de entorno de Netlify" })
    };
  }

  const endpoint = (event.queryStringParameters || {}).e || "";
  if (!endpoint.startsWith("/api/v3/")) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "endpoint inválido" })
    };
  }

  try {
    const fetchOpts = {
      method:  event.httpMethod,
      headers: { "Authorization": "Bearer " + WAKYMA_KEY }
    };
    if (event.httpMethod === "POST" && event.body) {
      fetchOpts.headers["Content-Type"] = "application/json";
      fetchOpts.body = event.body;
    }
    const r = await fetch("https://vets.wakyma.com" + endpoint, fetchOpts);
    const text = await r.text();
    return {
      statusCode: r.status,
      headers: {
        "Content-Type":                "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: text
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
