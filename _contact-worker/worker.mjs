// Contact relay for martinapps.dev/support.
// Takes one JSON POST from the support page and emails it to the address in the CONTACT_TO
// secret, through Cloudflare's own send_email binding. Nothing is stored here: no database,
// no log of the message text. The only copy is the email that lands in the inbox.
//
// Cost fence: this sends only to a destination address already verified in the Cloudflare
// account, which Cloudflare delivers free on every plan. It must never be pointed at
// arbitrary recipients; that needs a paid plan.

export const ALLOWED_ORIGINS = ["https://martinapps.dev", "https://www.martinapps.dev"];
export const APPS = ["General", "BoardBound", "Burn Wizard", "Wilderness", "Shortless", "Scrollometer", "Retold", "StoryCue", "Tellfolk"];
export const FROM = "website@martinapps.dev";
export const LIMITS = { body: 10000, name: 100, email: 200, messageMin: 10, messageMax: 4000, minFillMs: 3000 };

const EMAIL_RE = /^[^\s@<>"',;:\\]+@[^\s@<>"',;:\\]+\.[^\s@<>"',;:\\]{2,}$/;
const oneLine = (s) => String(s ?? "").replace(/[\r\n\t]+/g, " ").trim();

// Returns { ok: true, value } | { ok: true, drop: true } (looks like a bot: answer ok, send nothing)
// | { ok: false, error } with a sentence the page can show.
export function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "That did not look like a message." };
  // "website" is a field people never see. Only a script fills it in.
  if (oneLine(body.website)) return { ok: true, drop: true };
  // A person cannot type an address and a message in under three seconds.
  if (typeof body.elapsed_ms === "number" && body.elapsed_ms < LIMITS.minFillMs) return { ok: true, drop: true };
  const email = oneLine(body.email);
  if (!email || email.length > LIMITS.email || !EMAIL_RE.test(email)) return { ok: false, error: "Please check your email address." };
  const message = String(body.message ?? "").replace(/\r\n/g, "\n").trim();
  if (message.length < LIMITS.messageMin) return { ok: false, error: "Please write a little more so we can help." };
  if (message.length > LIMITS.messageMax) return { ok: false, error: "That message is too long. Please shorten it or email us." };
  const name = oneLine(body.name).slice(0, LIMITS.name);
  const app = APPS.includes(body.app) ? body.app : "General"; // subject is built only from this list
  return { ok: true, value: { email, message, name, app } };
}

export function buildEmail(v, to) {
  return {
    to,
    from: FROM,
    replyTo: v.email,
    subject: `Website message: ${v.app}`,
    text: `From: ${v.name ? v.name + " " : ""}<${v.email}>\nAbout: ${v.app}\n\n${v.message}\n\n-- \nSent from the form at martinapps.dev/support. Reply to this email to answer.`,
  };
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
const json = (status, obj, origin) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(origin ? cors(origin) : {}) } });

export default {
  // shortcut: no per-visitor rate limit, fine while the form gets a few messages a week; add
  // Cloudflare Turnstile or a rate-limit rule if junk starts arriving. Worst case is junk mail
  // in one inbox: it cannot cost money or reach anyone else.
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
    if (!allowed) return json(403, { ok: false, error: "Not allowed from this site." });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(allowed) });
    if (request.method !== "POST") return json(405, { ok: false, error: "Use the form on the support page." }, allowed);

    const raw = await request.text();
    if (raw.length > LIMITS.body) return json(413, { ok: false, error: "That message is too long. Please shorten it or email us." }, allowed);
    let body;
    try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: "That did not look like a message." }, allowed); }

    const checked = validate(body);
    if (!checked.ok) return json(400, { ok: false, error: checked.error }, allowed);
    if (checked.drop) return json(200, { ok: true }, allowed);

    if (!env.EMAIL || !env.CONTACT_TO) {
      console.error("contact: EMAIL binding or CONTACT_TO secret is missing");
      return json(500, { ok: false, error: "We could not send that. Please email us instead." }, allowed);
    }
    try {
      await env.EMAIL.send(buildEmail(checked.value, env.CONTACT_TO));
    } catch (err) {
      // The error code only (for example E_RECIPIENT_NOT_ALLOWED). Never the message text.
      console.error("contact: send failed", err && err.code ? err.code : String(err && err.name));
      return json(502, { ok: false, error: "We could not send that. Please email us instead." }, allowed);
    }
    return json(200, { ok: true }, allowed);
  },
};
