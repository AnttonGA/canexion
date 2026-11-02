// wk-estados-scan.js — Disparador diario de estados de socio + stats.
// Programada (netlify.toml, 08:30). Las funciones programadas no se pueden invocar por
// HTTP, así que solo dispara la background sync-stats-background (que devuelve 202 y sigue
// trabajando hasta 15 min). Va después del sync de ventas (07:00) y la desparasitación (08:00).

exports.handler = async () => {
  try {
    const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || "";
    const r = await fetch(base + "/.netlify/functions/sync-stats-background", { method: "POST" });
    return { statusCode: r.status, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ triggered: true, status: r.status }) };
  } catch (e) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
