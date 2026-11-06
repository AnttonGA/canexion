// send-wallet-push.js — Lanza una notificación push actualizando la tarjeta wallet.
// WalletWallet notifica en la pantalla de bloqueo al ACTUALIZAR el pase (PUT). El PUT
// reemplaza TODO el cuerpo, así que se reenvía el pase completo (igual que crear-pase)
// + el campo `notification` con el texto del banner. Un cuerpo idéntico no notifica.
//
// POST { serial, name, pet, notification }  →  PUT /api/passes/<serial>
// Variables de entorno: WALLETWALLET_KEY.

const WALLETWALLET_KEY = process.env.WALLETWALLET_KEY;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SB_ANON          = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY); // clave de proyecto para validar el token de sesión

async function requireStaff(event) {
  const h = (event && event.headers) || {};
  const token = ((h.authorization || h.Authorization || "").match(/Bearer\s+(.+)/i) || [])[1];
  if (!token || !SUPABASE_URL || !SB_ANON) return false;
  try { const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { "apikey": SB_ANON, "Authorization": "Bearer " + token } }); return r.ok; }
  catch (e) { return false; }
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors, body: "" };
  if (!(await requireStaff(event)))   return { statusCode: 401, headers: cors, body: JSON.stringify({ ok: false, error: "No autorizado" }) };
  if (!WALLETWALLET_KEY) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "WALLETWALLET_KEY no configurada" }) };

  try {
    const { serial, name, pet, notification, clientId } = JSON.parse(event.body || "{}");
    if (!serial || !notification) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Faltan datos (serial, notification)" }) };
    }

    // Cuerpo COMPLETO del pase (debe coincidir con crear-pase.js) + la notificación.
    const body = {
      logoText:        "Familia Canexion",
      colorPreset:     "green",
      primaryFields:   [{ label: "Socio/a", value: name || "Socio/a" }],
      secondaryFields: [{ label: "Mascota", value: pet || "—" }],
      backFields:      [{ label: "Familia Canexion", value: "Tu tarjeta de socio/a. Muéstrala en tienda para disfrutar de tus beneficios." }],
      barcodeValue:    "FCX-" + (clientId || ""),
      barcodeFormat:   "Code128",
      notification:    String(notification).slice(0, 256)
    };

    const r = await fetch("https://api.walletwallet.dev/api/passes/" + encodeURIComponent(serial), {
      method:  "PUT",
      headers: { "Authorization": "Bearer " + WALLETWALLET_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    if (!r.ok) {
      return { statusCode: r.status, headers: cors, body: JSON.stringify({ ok: false, error: "WalletWallet " + r.status + ": " + text.slice(0, 300) }) };
    }
    const data = JSON.parse(text);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, notifiedDevices: data.notifiedDevices, unchanged: data.unchanged }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
