// Diagnóstico temporal — borrar cuando la API key esté estable
exports.handler = async () => {
  const key = process.env.WAKYMA_KEY;
  if (!key) return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "WAKYMA_KEY no configurada en Netlify" }) };
  try {
    const r    = await fetch("https://vets.wakyma.com/api/v3/clients?limit=1", { headers: { "Authorization": "Bearer " + key } });
    const body = await r.text();
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ status: r.status, key_preview: key.slice(0, 8) + "...", body: body.slice(0, 300) }) };
  } catch(e) {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e.message }) };
  }
};
