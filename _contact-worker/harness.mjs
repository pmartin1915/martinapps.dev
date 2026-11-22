// node _contact-worker/harness.mjs [port]
// Local end-to-end harness for the support page message box. Serves the site from this
// checkout and runs the real Worker code at /contact against a FAKE email binding, so a
// browser can fill in and send the form with nothing leaving the machine.
//   /support/     the page, with the form pointed at /contact
//   /__sent       JSON list of what the Worker would have emailed
//   /__fail?on=1  make the fake binding fail, to see the error message (on=0 to undo)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./worker.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const port = Number(process.argv[2] || 8792);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const sent = [];
let fail = false;
const env = {
  CONTACT_TO: "inbox@harness.invalid",
  EMAIL: { send: async (m) => { if (fail) { const e = new Error("fake failure"); e.code = "E_FAKE"; throw e; } sent.push(m); return { messageId: String(sent.length) }; } },
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  try {
    if (url.pathname === "/__sent") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(sent)); }
    if (url.pathname === "/__fail") { fail = url.searchParams.get("on") === "1"; res.writeHead(200); return res.end(String(fail)); }
    if (url.pathname === "/contact") {
      const chunks = []; for await (const c of req) chunks.push(c);
      // The Worker only answers martinapps.dev. The harness page is same-origin on localhost,
      // so it presents the real origin on the page's behalf. Test-only: the Worker is unchanged.
      const r = await worker.fetch(new Request("https://harness.invalid/", {
        method: req.method, headers: { "Content-Type": req.headers["content-type"] || "", Origin: "https://martinapps.dev" },
        body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks),
      }), env);
      res.writeHead(r.status, { "Content-Type": "application/json" }); return res.end(await r.text());
    }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    if (p.includes("..")) { res.writeHead(400); return res.end(); }
    if (p === "" || p.endsWith("/") || p.endsWith("\\")) p = join(p, "index.html");
    let body = await readFile(join(root, p));
    if (p.replace(/\\/g, "/") === "support/index.html") body = Buffer.from(String(body).replace(/data-endpoint="[^"]*"/, 'data-endpoint="/contact"'));
    res.writeHead(200, { "Content-Type": types[extname(p)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
}).listen(port, "127.0.0.1", () => console.log(`harness on http://127.0.0.1:${port}/support/`));
