// Run with Node 22.5+ (node:sqlite): node tests/host.mjs
// Wezzet Host (/host): upload, serve sandboxed, limits, reports. Based on the forum test setup. and filing old topics, create/join/leave, Posts vs Discussions, image posts, delete, reports.
import fs from "node:fs";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
const source = fs.readFileSync(new URL("../_worker.js", import.meta.url), "utf8");
const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const sql = new DatabaseSync(":memory:");
const stmt = (query, values = []) => ({
  bind(...v) { return stmt(query, v); },
  async first() { return sql.prepare(query).get(...values.map((x) => x === undefined ? null : x)) || null; },
  async all() { return { results: sql.prepare(query).all(...values) }; },
  async run() { const r = sql.prepare(query).run(...values); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; },
});
const DB = { prepare: stmt, async batch(items) { const out = []; for (const i of items) out.push(await i.run()); return out; } };
// The forum tables as they exist in production (made by hand in the D1 console).
sql.exec(`CREATE TABLE topics (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, body TEXT DEFAULT '', author TEXT, created_at INTEGER, score INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0, reports INTEGER DEFAULT 0, poster TEXT, pinned INTEGER DEFAULT 0);
CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id INTEGER, parent_id INTEGER, body TEXT, author TEXT, created_at INTEGER, score INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0, reports INTEGER DEFAULT 0, poster TEXT);
CREATE TABLE votes (kind TEXT, target_id INTEGER, voter TEXT, value INTEGER, PRIMARY KEY (kind, target_id, voter));
CREATE TABLE reports (kind TEXT, target_id INTEGER, voter TEXT, created_at INTEGER, PRIMARY KEY (kind, target_id, voter));
CREATE TABLE actions (who TEXT, action TEXT, created_at INTEGER);
INSERT INTO topics (id, title, body, author, created_at, score) VALUES (1, 'What is wezzet?', '', 'Ezra', 1, 1);
INSERT INTO topics (id, title, body, author, created_at, score, pinned) VALUES (2, 'Request a Feature', 'Ask', 'Anonymous', 2, 0, 1);
INSERT INTO topics (id, title, body, author, created_at, score) VALUES (11, 'English', 'ai', 'x', 3, 1);`);
const env = { DB, ASSETS: { fetch: async (r) => new Response("<html>forum</html>", { headers: { "content-type": "text/html" } }) } };
const ctx = { waitUntil() {} };
const jars = { a: "", b: "", anon: "" };
let ipN = 1;
const call = async (who, path, body) => {
  const headers = { cookie: jars[who], "cf-connecting-ip": "10.0.0." + (who === "a" ? 1 : who === "b" ? 2 : ipN) };
  if (body) headers["content-type"] = "application/json";
  const r = await worker.fetch(new Request("https://wezzet.com" + path, body ? { method: "POST", headers, body: JSON.stringify(body) } : { headers }), env, ctx);
  const sc = r.headers.get("set-cookie");
  if (sc) { const kv = sc.split(";")[0]; const k = kv.split("=")[0]; jars[who] = [...jars[who].split("; ").filter((x) => x && !x.startsWith(k + "=")), kv].join("; "); }
  const t = await r.text(); try { return { s: r.status, ...JSON.parse(t) }; } catch { return { s: r.status, text: t }; }
};


const cache = new Map();
globalThis.caches = { default: { match: async (k) => cache.get(k.url)?.clone(), put: async (k, r) => { cache.set(k.url, r); }, delete: async (k) => cache.delete(k.url) } };
const raw = async (who, path) => worker.fetch(new Request("https://wezzet.com" + path, { headers: { cookie: jars[who], "cf-connecting-ip": "10.0.0.9" }, redirect: "manual" }), env, ctx);
const b64 = (t) => Buffer.from(t).toString("base64");
assert.ok((await call("a", "/api/chat/signup", { name: "alice1", username: "alice", password: "password123", age13: 1 })).me);
assert.ok((await call("b", "/api/chat/signup", { name: "bobby1", username: "bobby", password: "password123", age13: 1 })).me);
// Alice has Pro (5 pages), Bob is free (1 page).
sql.exec("CREATE TABLE IF NOT EXISTS wz_pro (uid INTEGER PRIMARY KEY, customer TEXT, sub TEXT, status TEXT, until INTEGER, updated INTEGER); INSERT INTO wz_pro (uid, status) VALUES (1, 'active')");
// Needs sign-in; name rules.
assert.equal((await call("anon", "/api/chat/host/upload", { name: "my-game", files: [{ path: "a.html", data: b64("<p>hi") }] })).s, 401);
assert.equal((await call("a", "/api/chat/host/upload", { name: "admin", files: [{ path: "a.html", data: b64("<p>hi") }] })).s, 400);
assert.equal((await call("a", "/api/chat/host/upload", { name: "ab", files: [{ path: "a.html", data: b64("<p>hi") }] })).s, 400);
assert.equal((await call("a", "/api/chat/host/upload", { name: "my-game", files: [{ path: "../x.html", data: b64("<p>hi") }] })).s, 400);
assert.equal((await call("a", "/api/chat/host/upload", { name: "my-game", files: [{ path: "a.exe", data: b64("MZ") }] })).s, 400);
assert.match((await call("a", "/api/chat/host/upload", { name: "my-game", files: [{ path: "a.html", data: b64('<input type="password">') }] })).error, /password/);
assert.equal((await call("a", "/api/chat/host/upload", { name: "my-game", files: [{ path: "a.html", data: "x".repeat(3e6) }] })).s, 413);
// Single file becomes index.html; folder site with css.
let r = await call("a", "/api/chat/host/upload", { name: "my-game", title: "My Game", files: [{ path: "game.html", data: b64("<title>G</title><p>hello game") }] });
assert.equal(r.s, 201, JSON.stringify(r));
r = await call("a", "/api/chat/host/upload", { name: "site-two", files: [{ path: "index.html", data: b64('<link rel=stylesheet href="css/a.css"><p>two') }, { path: "css/a.css", data: b64("p{color:red}") }, { path: "sub/index.html", data: b64("sub") }] });
assert.equal(r.s, 201, JSON.stringify(r));
assert.equal((await call("b", "/api/chat/host/upload", { name: "my-game", files: [{ path: "a.html", data: b64("steal") }] })).s, 409);
assert.equal((await call("b", "/api/chat/host/check?name=my-game")).ok, false);
assert.equal((await call("a", "/api/chat/host/check?name=my-game")).mine, true);
// Frame page and sandboxed files.
let res = await raw("anon", "/host/my-game");
assert.equal(res.status, 200);
let html = await res.text();
assert.match(html, /<iframe src="\/host\/my-game\/v[a-z0-9]+\/"[^>]*sandbox="allow-scripts/);
assert.doesNotMatch(html, /allow-same-origin/);
assert.doesNotMatch(html, /class="bar"|wezzet\.|id="rp"|id="fs"/);
const src = html.match(/src="(\/host\/my-game\/v[a-z0-9]+\/)"/)[1];
res = await raw("anon", src);
assert.equal(res.status, 200);
assert.match(res.headers.get("content-security-policy"), /^sandbox allow-scripts/);
assert.doesNotMatch(res.headers.get("content-security-policy"), /same-origin/);
assert.match(await res.text(), /hello game/);
res = await raw("anon", src); assert.match(await res.text(), /hello game/); // cached copy
const v2 = (await (await raw("anon", "/host/site-two")).text()).match(/src="(\/host\/site-two\/v[a-z0-9]+\/)"/)[1];
res = await raw("anon", v2 + "css/a.css"); assert.equal(res.headers.get("content-type"), "text/css; charset=utf-8"); assert.equal(await res.text(), "p{color:red}");
res = await raw("anon", v2 + "sub/"); assert.equal(await res.text(), "sub");
res = await raw("anon", v2 + "sub"); assert.equal(await res.text(), "sub");
assert.equal((await raw("anon", v2 + "nope.js")).status, 404);
assert.equal((await raw("anon", "/host/site-two/v0/css/a.css")).status, 302);
assert.equal((await raw("anon", v2.slice(0, -1))).status, 301);
assert.equal((await raw("anon", "/host/nothing-here")).status, 404);
// Mine, limits.
assert.equal((await call("a", "/api/chat/host/mine")).sites.length, 2);
assert.equal((await call("b", "/api/chat/host/upload", { name: "bob-one", files: [{ path: "i.html", data: b64("x") }] })).s, 201);
assert.equal((await call("b", "/api/chat/host/upload", { name: "bob-two", files: [{ path: "i.html", data: b64("x") }] })).pro, true);
await call("b", "/api/chat/host/delete", { name: "bob-one" });
 for (const n of ["p-three", "p-four", "p-five"]) assert.equal((await call("a", "/api/chat/host/upload", { name: n, files: [{ path: "i.html", data: b64("x") }] })).s, 201);
assert.equal((await call("a", "/api/chat/host/upload", { name: "p-six", files: [{ path: "i.html", data: b64("x") }] })).pro, false);
// Replace keeps the name and bumps version.
await new Promise((ok) => setTimeout(ok, 5));
assert.equal((await call("a", "/api/chat/host/upload", { name: "my-game", files: [{ path: "index.html", data: b64("v2 game") }] })).s, 200);
html = await (await raw("anon", "/host/my-game")).text();
const src2 = html.match(/src="(\/host\/my-game\/v[a-z0-9]+\/)"/)[1];
assert.notEqual(src, src2);
assert.equal(await (await raw("anon", src2)).text(), "v2 game");
// Explore list, sorting, views, settings, editor merge.
const view = (n) => worker.fetch(new Request("https://wezzet.com/host/" + n, { headers: { "sec-fetch-dest": "document", "user-agent": "Mozilla/5.0" } }), env, ctx);
await view("site-two"); await view("site-two"); await view("p-four");
let ex = await call("anon", "/api/chat/host/explore?sort=top");
assert.deepEqual(ex.sites.slice(0, 2).map((x) => [x.name, x.views]), [["site-two", 2], ["p-four", 1]]);
assert.equal(ex.sites[0].by, "alice"); assert.equal(ex.stats.pages, 5); assert.equal(ex.stats.views, 3);
assert.equal((await call("anon", "/api/chat/host/explore?sort=az")).sites[0].name, "my-game");
assert.equal((await call("anon", "/api/chat/host/explore?sort=updated")).sites[0].name, "my-game");
assert.equal((await call("b", "/api/chat/host/settings", { name: "p-five", listed: false })).s, 403);
assert.equal((await call("a", "/api/chat/host/settings", { name: "p-five", listed: false, about: "hidden one" })).s, 200);
assert.ok(!(await call("anon", "/api/chat/host/explore?sort=new")).sites.some((x) => x.name === "p-five"));
assert.equal((await call("b", "/api/chat/host/source?name=site-two")).s, 404);
let so = await call("a", "/api/chat/host/source?name=site-two");
assert.equal(so.files.length, 3); assert.match(so.text, /two/);
assert.equal((await call("a", "/api/chat/host/upload", { name: "site-two", merge: true, title: "Two", files: [{ path: "index.html", data: b64("edited two") }] })).files, 3);
const v3 = (await (await raw("anon", "/host/site-two")).text()).match(/src="(\/host\/site-two\/v[a-z0-9]+\/)"/)[1];
assert.equal(await (await raw("anon", v3)).text(), "edited two");
assert.equal(await (await raw("anon", v3 + "css/a.css")).text(), "p{color:red}");
// Reports: three people take it down.
for (let i = 0; i < 3; i++) { ipN = 50 + i; jars.anon = ""; assert.equal((await call("anon", "/api/chat/host/report", { name: "p-three", reason: "spam" })).s, 200); }
assert.equal((await raw("anon", "/host/p-three")).status, 410);
// Only owner deletes.
assert.equal((await call("b", "/api/chat/host/delete", { name: "my-game" })).s, 403);
assert.equal((await call("a", "/api/chat/host/delete", { name: "my-game" })).s, 200);
assert.equal((await raw("anon", "/host/my-game")).status, 404);
assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM host_parts WHERE site = 'my-game'").get().n, 0);
console.log("host tests passed");
