// node --test _contact-worker/worker.test.mjs
// Runs the Worker's fetch handler against a fake email binding. No network, no Cloudflare.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { validate, buildEmail, FROM } from "./worker.mjs";

const ORIGIN = "https://martinapps.dev";
const GOOD = { email: "pat@example.com", name: "Pat", app: "Wilderness", message: "The knots page will not open on my phone.", website: "" };
const fakeEnv = (opts = {}) => {
  const sent = [];
  return { sent, EMAIL: { send: async (m) => { if (opts.fail) { const e = new Error("no"); e.code = "E_RECIPIENT_NOT_ALLOWED"; throw e; } sent.push(m); return { messageId: "x" }; } }, CONTACT_TO: "owner@example.net" };
};
const post = (body, headers = {}) => new Request("https://w.example/", {
  method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
});

test("a good message is emailed once, to the secret address, with reply-to the visitor", async () => {
  const env = fakeEnv();
  const res = await worker.fetch(post(GOOD), env);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(env.sent.length, 1);
  const m = env.sent[0];
  assert.equal(m.to, "owner@example.net");
  assert.equal(m.from, FROM);
  assert.equal(m.replyTo, "pat@example.com");
  assert.equal(m.subject, "Website message: Wilderness");
  assert.match(m.text, /knots page will not open/);
});

test("other sites are refused and nothing is sent", async () => {
  for (const origin of ["https://evil.example", "https://martinapps.dev.evil.example", null]) {
    const env = fakeEnv();
    const headers = { "Content-Type": "application/json" };
    if (origin) headers.Origin = origin;
    const res = await worker.fetch(new Request("https://w.example/", { method: "POST", headers, body: JSON.stringify(GOOD) }), env);
    assert.equal(res.status, 403);
    assert.equal(env.sent.length, 0);
  }
});

test("preflight answers 204 with CORS; GET is refused", async () => {
  const pre = await worker.fetch(new Request("https://w.example/", { method: "OPTIONS", headers: { Origin: ORIGIN } }), fakeEnv());
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  const get = await worker.fetch(new Request("https://w.example/", { headers: { Origin: ORIGIN } }), fakeEnv());
  assert.equal(get.status, 405);
});

test("a filled hidden field is answered ok but nothing is sent", async () => {
  const env = fakeEnv();
  const res = await worker.fetch(post({ ...GOOD, website: "http://spam" }), env);
  assert.equal(res.status, 200);
  assert.equal(env.sent.length, 0);
});

test("a fast real visitor (autofill and paste) is still delivered", async () => {
  const env = fakeEnv();
  const res = await worker.fetch(post({ ...GOOD, elapsed_ms: 300 }), env);
  assert.equal(res.status, 200);
  assert.equal(env.sent.length, 1);
});

test("the recipient never comes from the request", async () => {
  const env = fakeEnv();
  await worker.fetch(post({ ...GOOD, to: "victim@example.org", cc: "victim@example.org", bcc: "victim@example.org", from: "ceo@example.org", replyTo: "x@example.org", subject: "Free money" }), env);
  assert.equal(env.sent.length, 1);
  assert.deepEqual(Object.keys(env.sent[0]).sort(), ["from", "replyTo", "subject", "text", "to"]);
  assert.equal(env.sent[0].to, "owner@example.net");
  assert.equal(env.sent[0].from, FROM);
  assert.equal(env.sent[0].replyTo, "pat@example.com");
  assert.doesNotMatch(JSON.stringify(env.sent[0]), /victim|Free money|ceo@/);
});

test("bad input is refused with a sentence, and nothing is sent", async () => {
  const cases = [
    { ...GOOD, email: "" }, { ...GOOD, email: "not-an-address" }, { ...GOOD, email: "a@b.co\nBcc: x@y.z" },
    { ...GOOD, email: "a b@c.de" }, { ...GOOD, email: "a\u0000b@c.de" }, { ...GOOD, email: ["a@b.co"] },
    { ...GOOD, message: "hi" }, { ...GOOD, message: "x".repeat(4001) }, { ...GOOD, message: 12345678901 }, [], "nope",
  ];
  for (const body of cases) {
    const env = fakeEnv();
    const res = await worker.fetch(post(body), env);
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
    const out = await res.json();
    assert.equal(out.ok, false);
    assert.ok(out.error.length > 5);
    assert.equal(env.sent.length, 0);
  }
  const big = await worker.fetch(post("x".repeat(20001)), fakeEnv());
  assert.equal(big.status, 413);
  // Size is counted in bytes: 10,001 two-byte letters is over the 20,000-byte cap.
  const wide = await worker.fetch(post("é".repeat(10001)), fakeEnv());
  assert.equal(wide.status, 413);
  const junk = await worker.fetch(post("{not json"), fakeEnv());
  assert.equal(junk.status, 400);
});

test("header injection: name and subject cannot carry line breaks or free text", () => {
  const v = validate({ ...GOOD, name: "Pat\r\nBcc: evil@example.com", app: "Free text\nSubject: hi" });
  assert.equal(v.ok, true);
  assert.doesNotMatch(v.value.name, /[\r\n]/);
  assert.equal(v.value.app, "General");
  const m = buildEmail(v.value, "owner@example.net");
  assert.doesNotMatch(m.subject, /[\r\n]/);
  assert.equal(m.subject, "Website message: General");
});

test("a send failure or missing setup tells the visitor to email, and leaks nothing", async () => {
  const failed = await worker.fetch(post(GOOD), fakeEnv({ fail: true }));
  assert.equal(failed.status, 502);
  const body = JSON.stringify(await failed.json());
  assert.match(body, /email us instead/);
  assert.doesNotMatch(body, /owner@example\.net|E_RECIPIENT/);
  const unset = await worker.fetch(post(GOOD), { EMAIL: undefined, CONTACT_TO: undefined });
  assert.equal(unset.status, 500);
});
