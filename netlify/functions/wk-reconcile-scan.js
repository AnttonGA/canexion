// wk-reconcile-scan.js — Disparador diario de la reconciliación aviso→compra.
// Programada (netlify.toml, 09:00, tras el sync de ventas de las 07:00). Las funciones
// programadas no se pueden invocar por HTTP, así que la lógica vive en reconcile.js.

exports.handler = async () => {
  try {
    const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || "";
    const r = await fetch(base + "/.netlify/functions/reconcile", { method: "POST" });
    const body = await r.text();
    return { statusCode: r.status, headers: { "Content-Type": "application/json" }, body };
  } catch (e) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
