// Netlify Function: validar contraseña del CRM
// La contraseña se guarda en la variable de entorno CRM_PASSWORD (Netlify → Site config → Env vars)

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors, body: JSON.stringify({ ok: false }) };

  try {
    const { password } = JSON.parse(event.body || "{}");
    const ok = password && password === process.env.CRM_PASSWORD;
    return { statusCode: ok ? 200 : 401, headers: cors, body: JSON.stringify({ ok }) };
  } catch(e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false }) };
  }
};
