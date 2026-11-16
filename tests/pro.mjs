// Run with Node 22.5+ (node:sqlite): node tests/pro.mjs
// Wezzet Pro: account features (password, sign out others, recovery), limits flag, daily caps, agent cap, Stripe checkout + webhook.
import fs from "node:fs";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
const source = fs.readFileSync(new URL("../_worker.js", import.meta.url), "utf8");
const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const sql = new DatabaseSync(":memory:");
const stmt = (query, values = []) => ({
  bind(...v) { return stmt(query, v); },
  async first() { return sql.prepare(query).get(...values) || null; },
  async all() { return { results: sql.prepare(query).all(...values) }; },
  async run() { return sql.prepare(query).run(...values); },
});
const DB = { prepare: stmt, async batch(items) { const out = []; for (const i of items) out.push(/^\s*SELECT/i.test(i.q || "") ? await i.all() : await i.run()); return out; } };
// batch() returns D1-style results for SELECTs too.
DB.prepare = (q) => { const s = stmt(q); const wrap = (st) => ({ q, bind: (...v) => wrap(st.bind(...v)), first: () => st.first(), all: () => st.all(), run: () => st.run() }); return wrap(s); };
for (const s of fs.readFileSync(new URL("./fixtures/aicomms-schema.sql", import.meta.url), "utf8").split(";").map((s) => s.trim()).filter(Boolean)) sql.exec(s);
const env = { DB, TOKEN_SEAL_KEY: "test-seal", ASSETS: { fetch: async () => new Response("") } };
const ctx = { waitUntil() {} };
const jar = { a: "", b: "", anon: "" };
let who = "a";
const call = async (path, body, headers = {}, ip = "1.1.1.1") => {
  const h = { cookie: jar[who], "cf-connecting-ip": ip, ...headers };
  const r = await worker.fetch(new Request("https://wezzet.com" + path, body !== undefined ? { method: "POST", headers: { "content-type": "application/json", ...h }, body: typeof body === "string" ? body : JSON.stringify(body) } : { headers: h }), env, ctx);
  const sc = r.headers.get("set-cookie"); if (sc && /wzc=/.test(sc)) jar[who] = /Max-Age=0/.test(sc) ? "" : sc.split(";")[0];
  const t = await r.text(); try { return { s: r.status, ...JSON.parse(t) }; } catch { return { s: r.status, text: t }; }
};
const rows = (q, ...v) => sql.prepare(q).all(...v);

// ---- Account ----
assert.ok((await call("/api/chat/signup", { name: "alice", username: "alice", password: "password123", age13: 1 })).me);
let acct = await call("/api/chat/account");
assert.equal(acct.plan.plan, "free"); assert.equal(acct.plan.limits, false); assert.equal(acct.plan.stripe, false);
assert.equal(acct.password, true); assert.equal(acct.recovery, null);
// Second device.
who = "b"; assert.ok((await call("/api/chat/login", { name: "alice", password: "password123" })).me);
assert.equal((await call("/api/chat/account")).sessions, 2);
// Change password: wrong current one fails, right one works and signs out device a.
assert.equal((await call("/api/chat/account/password", { old: "nope-nope", password: "newpass456" })).s, 401);
assert.equal((await call("/api/chat/account/password", { old: "password123", password: "short" })).s, 400);
assert.equal((await call("/api/chat/account/password", { old: "password123", password: "newpass456" })).ok, true);
who = "a"; assert.equal((await call("/api/chat/account")).s, 401);
assert.equal((await call("/api/chat/login", { name: "alice", password: "password123" })).s, 401);
assert.ok((await call("/api/chat/login", { name: "alice", password: "newpass456" })).me);
// Sign out the others.
assert.equal((await call("/api/chat/account/signout-others", {})).ok, true);
who = "b"; assert.equal((await call("/api/chat/account")).s, 401);
// Recovery code.
who = "a";
const { code } = await call("/api/chat/account/recovery", {});
assert.match(code, /^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
assert.ok((await call("/api/chat/account")).recovery);
assert.equal(rows("SELECT * FROM wz_recovery")[0].hash.includes(code), false);
who = "anon";
assert.equal((await call("/api/chat/recover", { name: "alice", code: "AAAAA-AAAAA-AAAAA-AAAAA", password: "hacked1234" })).s, 401);
const rec = await call("/api/chat/recover", { name: "alice", code: code.toLowerCase().replace(/-/g, " "), password: "recovered99" });
assert.ok(rec.me, JSON.stringify(rec)); assert.ok(rec.recovery && rec.recovery !== code);
assert.equal((await call("/api/chat/recover", { name: "alice", code, password: "again12345" })).s, 401, "old code is single-use");
who = "a"; assert.equal((await call("/api/chat/account")).s, 401, "recovery signs out everywhere");
assert.ok((await call("/api/chat/login", { name: "alice", password: "recovered99" })).me);
// Recovery attempts are rate-limited per IP.
who = "anon";
for (let i = 0; i < 3; i++) await call("/api/chat/recover", { name: "alice", code: "AAAAA-AAAAA-AAAAA-AAAAA", password: "hacked1234" });
assert.equal((await call("/api/chat/recover", { name: "alice", code: rec.recovery, password: "hacked1234" })).s, 429);
who = "a";

// ---- Limits OFF: nothing counted, nothing blocked ----
for (let i = 0; i < 30; i++) assert.equal((await call("/api/chat/use", { tool: "transcribe" })).ok, true);
assert.equal(rows("SELECT * FROM wz_usage").length, 0);

// ---- Limits ON ----
env.PRO_LIMITS = "on";
for (let i = 0; i < 15; i++) assert.equal((await call("/api/chat/use", { tool: "transcribe" })).ok, true);
const no = await call("/api/chat/use", { tool: "transcribe" });
assert.equal(no.s, 429); assert.match(no.error, /15 free transcriptions/);
assert.equal((await call("/api/chat/use", { tool: "remove-bg" })).ok, true, "caps are per tool");
assert.equal((await call("/api/chat/use", { tool: "celsius" })).ok, true, "unmetered tools are never capped");
acct = await call("/api/chat/account");
assert.deepEqual(acct.plan.usage.find((u) => u.tool === "transcribe"), { tool: "transcribe", label: "Transcriptions", used: 15, limit: 15 });
// Signed out: counted per IP, separately.
who = "anon"; jar.anon = "";
assert.equal((await call("/api/chat/use", { tool: "transcribe" }, {}, "2.2.2.2")).ok, true);
// AI chat is metered on the server (direct /api/ai per IP). The model call itself fails here (no backend), which is fine.
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response("{}", { status: 500 });
for (let i = 0; i < 60; i++) assert.notEqual((await call("/api/ai", { messages: [{ role: "user", content: "hi" }] }, {}, "3.3.3.3")).s, 429);
const aiNo = await call("/api/ai", { messages: [{ role: "user", content: "hi" }] }, {}, "3.3.3.3");
assert.equal(aiNo.s, 429); assert.equal(aiNo.limit, true);
globalThis.fetch = realFetch;
who = "a";

// ---- AI Comms: 7 linked agents online at once ----
const toks = [];
for (let i = 0; i < 8; i++) { const m = await call("/api/chat/account/new", { name: "agent-" + i + "-xx" }, {}, "9.9.9." + i); assert.ok(m.token, JSON.stringify(m)); toks.push(m.token); sql.prepare("UPDATE wz_links SET ts = ? WHERE agent = ?").run(1000 + i, m.name); }
const me = (t) => call("/api/aicomms/me?fmt=json", undefined, { authorization: "Bearer " + t });
for (let i = 0; i < 7; i++) assert.equal((await me(toks[i])).s, 200);
assert.equal((await me(toks[7])).s, 429, "8th online agent waits");
sql.prepare("UPDATE ac_agents SET seen = 0 WHERE name = 'agent-0-xx'").run();
assert.equal((await me(toks[7])).s, 200, "works once another goes quiet");

// ---- Stripe ----
assert.equal((await call("/api/chat/pro/checkout", {})).s, 503, "off until keys are set");
assert.equal((await call("/api/pro/webhook", "{}", { "stripe-signature": "t=1,v1=00" })).s, 503);
Object.assign(env, { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_ID: "price_x", STRIPE_WEBHOOK_SECRET: "whsec_test" });
let sent;
globalThis.fetch = async (u, o) => { sent = { u: String(u), body: new URLSearchParams(o.body), auth: o.headers.authorization }; return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/x" })); };
const co = await call("/api/chat/pro/checkout", {});
assert.equal(co.url, "https://checkout.stripe.com/c/x");
assert.equal(sent.u, "https://api.stripe.com/v1/checkout/sessions"); assert.equal(sent.auth, "Bearer sk_test_x");
const uid = String(acct.me.id);
assert.equal(sent.body.get("mode"), "subscription"); assert.equal(sent.body.get("line_items[0][price]"), "price_x"); assert.equal(sent.body.get("client_reference_id"), uid);
globalThis.fetch = realFetch;
assert.equal((await call("/api/chat/pro/portal", {})).s, 400, "no customer yet");
const sign = async (payload, t = Math.floor(Date.now() / 1000), secret = "whsec_test") => {
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Buffer.from(await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + payload))).toString("hex");
  return "t=" + t + ",v1=" + mac;
};
const hook = async (ev, opts = {}) => { const raw = JSON.stringify(ev); return call("/api/pro/webhook", raw, { "stripe-signature": opts.sig || await sign(raw, opts.t, opts.secret) }); };
const now = Math.floor(Date.now() / 1000);
const done = { type: "checkout.session.completed", created: now, data: { object: { mode: "subscription", client_reference_id: uid, customer: "cus_1", subscription: "sub_1" } } };
assert.equal((await hook(done, { secret: "wrong" })).s, 400, "bad signature");
assert.equal((await hook(done, { t: now - 600 })).s, 400, "old timestamp");
assert.equal((await hook(done, { sig: "t=" + now })).s, 400, "missing v1");
assert.equal((await hook(done)).received, true);
acct = await call("/api/chat/account");
assert.equal(acct.plan.plan, "pro"); assert.equal(acct.plan.canManage, true);
assert.equal(acct.plan.usage[0].limit, null);
assert.equal((await call("/api/chat/use", { tool: "transcribe" })).ok, true, "Pro is unlimited");
assert.equal((await me(toks[7])).s, 200);
assert.equal((await call("/api/chat/pro/checkout", {})).s, 400, "already Pro");
globalThis.fetch = async (u, o) => { sent = { u: String(u), body: new URLSearchParams(o.body) }; return new Response(JSON.stringify({ url: "https://billing.stripe.com/p/x" })); };
assert.equal((await call("/api/chat/pro/portal", {})).url, "https://billing.stripe.com/p/x");
assert.equal(sent.body.get("customer"), "cus_1");
globalThis.fetch = realFetch;
// Cancel: subscription.deleted (found by customer, no metadata) turns Pro off. An older "active" event can't turn it back on.
assert.equal((await hook({ type: "customer.subscription.deleted", created: now + 10, data: { object: { id: "sub_1", customer: "cus_1", status: "canceled" } } })).received, true);
assert.equal((await call("/api/chat/account")).plan.plan, "free");
await hook({ type: "customer.subscription.updated", created: now + 5, data: { object: { id: "sub_1", customer: "cus_1", status: "active", metadata: { uid } } } });
assert.equal((await call("/api/chat/account")).plan.plan, "free", "stale event ignored");
await hook({ type: "customer.subscription.updated", created: now + 20, data: { object: { id: "sub_1", customer: "cus_1", status: "active", items: { data: [{ current_period_end: now + 86400 * 30 }] }, metadata: { uid } } } });
acct = await call("/api/chat/account");
assert.equal(acct.plan.plan, "pro"); assert.ok(acct.plan.until > Date.now());
// Switching Stripe from test to live: the saved test customer is unknown, so Manage billing clears it and the account is Free again.
globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: "resource_missing", message: "No such customer: 'cus_1'" } }), { status: 400 });
const stale = await call("/api/chat/pro/portal", {});
assert.equal(stale.s, 409); assert.equal(stale.cleared, true);
globalThis.fetch = realFetch;
acct = await call("/api/chat/account");
assert.equal(acct.plan.plan, "free"); assert.equal(acct.plan.canManage, false);
assert.equal(rows("SELECT customer FROM wz_pro")[0].customer, null);
// Status page data works signed out.
who = "anon"; jar.anon = "";
const st = await call("/api/chat/pro/status");
assert.equal(st.stripe, true); assert.equal(st.free.transcribe.n, 15); assert.equal(st.me, undefined);
console.log("pro: all checks passed");
