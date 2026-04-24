// Función de diagnóstico — borrar después de resolver el problema
const WAKYMA_KEY = "0jIXmFzxFwMEy5U2BlEvj3dgGuL0pcDasLKfsmXgD-NkYEiX";

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
  const phone = "607417207"; // cambiar por un teléfono real de Wakyma si hace falta

  const tests = await Promise.all([
    // Test 1: URL y auth actuales
    tryFetch(`https://api.wakyma.com/api/v3/clients?phone=${phone}`, {
      "Authorization": "Bearer " + WAKYMA_KEY
    }),
    // Test 2: Sin /api/ en la ruta
    tryFetch(`https://api.wakyma.com/v3/clients?phone=${phone}`, {
      "Authorization": "Bearer " + WAKYMA_KEY
    }),
    // Test 3: Auth con X-Api-Key en vez de Bearer
    tryFetch(`https://api.wakyma.com/api/v3/clients?phone=${phone}`, {
      "X-Api-Key": WAKYMA_KEY
    }),
    // Test 4: Auth con apikey (minúsculas)
    tryFetch(`https://api.wakyma.com/api/v3/clients?phone=${phone}`, {
      "apikey": WAKYMA_KEY
    }),
    // Test 5: Base sin parámetros (¿devuelve lista?)
    tryFetch(`https://api.wakyma.com/api/v3/clients`, {
      "Authorization": "Bearer " + WAKYMA_KEY
    }),
    // Test 6: Parámetro telephone en vez de phone
    tryFetch(`https://api.wakyma.com/api/v3/clients?telephone=${phone}`, {
      "Authorization": "Bearer " + WAKYMA_KEY
    }),
    // Test 7: Parámetro mobile
    tryFetch(`https://api.wakyma.com/api/v3/clients?mobile=${phone}`, {
      "Authorization": "Bearer " + WAKYMA_KEY
    }),
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
