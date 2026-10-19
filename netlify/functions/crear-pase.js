// Netlify Function: crea una tarjeta de socio en WalletWallet (Apple + Google Wallet)
// y devuelve el enlace (shareUrl) para enviar al cliente por WhatsApp.
// El codigo de barras (Code128) lleva el ID del socio como FCX-<id>, para
// escanearlo con el lector de tienda y abrir su ficha en el CRM.
//
// Variable de entorno necesaria (Netlify → Site config → Environment variables):
//   WALLETWALLET_KEY → la API key de WalletWallet (empieza por ww_live_...)

const WALLETWALLET_KEY = process.env.WALLETWALLET_KEY;

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors, body: "" };

  if (!WALLETWALLET_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "WALLETWALLET_KEY no configurada en Netlify" }) };
  }

  try {
    const { clientId, name, pet } = JSON.parse(event.body || "{}");
    if (!name || !clientId) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Faltan datos (name, clientId)" }) };
    }

    // Plan gratuito: solo presets de color y branding limitado (sin logo propio).
    const body = {
      logoText:        "Familia Canexion",
      colorPreset:     "green",
      primaryFields:   [{ label: "Socio/a", value: name }],
      secondaryFields: [{ label: "Mascota", value: pet || "—" }],
      backFields:      [{ label: "Familia Canexion", value: "Tu tarjeta de socio/a. Muéstrala en tienda para disfrutar de tus beneficios." }],
      barcodeValue:    "FCX-" + clientId,  // Code128 con el ID del socio (lector de tienda)
      barcodeFormat:   "Code128"
    };

    const r = await fetch("https://api.walletwallet.dev/api/passes", {
      method:  "POST",
      headers: {
        "Authorization": "Bearer " + WALLETWALLET_KEY,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    if (!r.ok) {
      return { statusCode: r.status, headers: cors, body: JSON.stringify({ error: "WalletWallet " + r.status + ": " + text.slice(0, 300) }) };
    }

    const data = JSON.parse(text);
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ shareUrl: data.shareUrl, serialNumber: data.serialNumber })
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
