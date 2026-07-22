/* Cloudflare Worker: app-wide OpenAI proxy for the AWS Architect course.
 *
 * Why this exists: the course is a public static site, so an OpenAI key cannot
 * ship in the client (it would be public, and OpenAI auto-revokes leaked keys).
 * This worker holds the key as a secret and only serves requests from users who
 * are signed into the app with an allowlisted Google account (it verifies the
 * Firebase ID token the app already uses for progress sync).
 *
 * Setup (one time, ~5 minutes, free tier is plenty):
 *  1. https://dash.cloudflare.com → Workers & Pages → Create → Worker → paste this file → Deploy.
 *  2. Worker → Settings → Variables and Secrets:
 *       Secret  OPENAI_API_KEY   = sk-...              (your OpenAI key — set a monthly spend limit in OpenAI)
 *       Var     FIREBASE_API_KEY = AIzaSyCdsy7Smj2yrqaLb-iKHxf-fhfhGTcJ1dg   (the app's public Firebase web key)
 *       Var     ALLOWED_EMAILS   = you@gmail.com       (comma-separated allowlist)
 *       Var     ALLOWED_ORIGIN   = https://afetiu.github.io
 *  3. Copy the worker URL (https://<name>.<account>.workers.dev) into
 *     window.ASKAI_PROXY_URL in firebase-config.js and redeploy the site.
 */
export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const json = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "content-type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: { message: "POST only" } }, 405);

    // 1. Verify the caller's Firebase ID token (same sign-in the app uses for sync)
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: { message: "Sign in to the app to use the AI assistant." } }, 401);
    const lookup = await fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + env.FIREBASE_API_KEY,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: token }) }
    );
    if (!lookup.ok) return json({ error: { message: "Session invalid or expired — sign in again." } }, 401);
    const info = await lookup.json();
    const email = (info.users && info.users[0] && info.users[0].email || "").toLowerCase();
    const allowed = (env.ALLOWED_EMAILS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    if (!email || (allowed.length && !allowed.includes(email))) {
      return json({ error: { message: "This account is not allowed to use the AI assistant." } }, 403);
    }

    // 2. Clamp and forward to OpenAI
    let body;
    try { body = await req.json(); } catch (e) { return json({ error: { message: "bad JSON" } }, 400); }
    const model = typeof body.model === "string" && body.model.length < 64 ? body.model : "gpt-4o-mini";
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : null;
    if (!messages || messages.some(m => typeof m.content !== "string" || m.content.length > 8000)) {
      return json({ error: { message: "bad request" } }, 400);
    }
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_API_KEY },
      body: JSON.stringify({ model, messages }),
    });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, "content-type": "application/json" } });
  },
};
