const WAKYMA_KEY = process.env.WAKYMA_KEY;

exports.handler = async (event) => {
  // Responder preflight OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: ""
    };
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
    const r = await fetch("https://vets.wakyma.com" + endpoint, {
      headers: { "Authorization": "Bearer " + WAKYMA_KEY }
    });
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
