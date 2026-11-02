// wk-deworm-scan.js — Disparador diario de la desparasitación por producto.
// Programada (netlify.toml, 08:00). Las funciones programadas no se pueden invocar
// por HTTP, así que la lógica vive en compute-deworm.js (invocable/testeable) y esta
// solo la llama cada día, después del sync de ventas de las 07:00.

exports.handler = async () => {
  try {
    const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || "";
    const r = await fetch(base + "/.netlify/functions/compute-deworm", { method: "POST" });
    const body = await r.text();
    return { statusCode: r.status, headers: { "Content-Type": "application/json" }, body };
  } catch (e) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
