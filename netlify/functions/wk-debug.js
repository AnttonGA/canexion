// Función de diagnóstico — borrar después de resolver el problema
const WAKYMA_KEY = "hcV9EhBNSXVINsvhuo4Oxuoy5_jR-6aaaqTWBotDies1da4R";

async function tryFetch(url, headers) {
  try {
    const r = await fetch(url, { headers });
    const text = await r.text();
    return { url, status: r.status, body: text.slice(0, 300) };
  } catch(e) {
    return { url, status: "ERROR", body: e.message };
  }
}

exports.handler = async () => {
  const auth = { "Authorization": "Bearer " + WAKYMA_KEY };

  const tests = await Promise.all([
    // Probar distintas URLs base
    tryFetch("https://api.wakyma.com/api/v3/clients",       auth),
    tryFetch("https://wakyma.com/api/v3/clients",            auth),
    tryFetch("https://app.wakyma.com/api/v3/clients",        auth),
    tryFetch("https://api.wakyma.com/api/v3/",               auth),
    tryFetch("https://wakyma.com/api/v3/",                   auth),
    tryFetch("https://app.wakyma.com/api/v3/",               auth),
    // Raíz de cada dominio (para ver qué responde)
    tryFetch("https://api.wakyma.com/",                      auth),
    tryFetch("https://wakyma.com/",                          auth),
    tryFetch("https://app.wakyma.com/",                      auth),
  ]);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(tests, null, 2)
  };
};
