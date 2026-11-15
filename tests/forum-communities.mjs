// Run with Node 22.5+ (node:sqlite): node tests/forum-communities.mjs
// Forum communities: seeding and filing old topics, create/join/leave, Posts vs Discussions, image posts, delete, reports.
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

// Seeded communities, old topics filed.
let list = await call("anon", "/api/forum/communities");
assert.equal(list.s, 200);
assert.deepEqual(list.communities.slice(0, 4).map((c) => c.slug), ["general", "tools", "blockchain", "art"]);
let tools = await call("anon", "/api/forum/topics?c=tools&tab=discussions&sort=new");
assert.deepEqual(tools.topics.map((t) => t.id), [2], "Request a Feature lives in Tool improvements, pinned");
assert.equal((await call("anon", "/api/forum/topics?c=ai")).topics[0].id, 11);
assert.equal((await call("anon", "/api/forum/topics?sort=new")).topics.length, 2, "all-communities feed leaves out pinned topics");
assert.equal((await call("anon", "/api/forum/topics/2")).topic.community.slug, "tools");

// Anonymous discussion still works; anonymous community/join/image don't.
let t = await call("anon", "/api/forum/topics", { title: "Hello there", body: "hi", author: "Pat", community: "art" });
assert.equal(t.s, 201); assert.equal(t.community, "art");
assert.equal((await call("anon", "/api/forum/communities", { name: "Cats" })).s, 401);
assert.equal((await call("anon", "/api/forum/communities/art/join", {})).s, 401);
const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0]).toString("base64");
assert.equal((await call("anon", "/api/forum/topics", { title: "My art", community: "art", image: png })).s, 401);
// Cross-site form posts are refused.
const csrf = await worker.fetch(new Request("https://wezzet.com/api/forum/topics", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }), env, ctx);
assert.equal(csrf.status, 400);

// Sign up two accounts.
assert.ok((await call("a", "/api/chat/signup", { name: "alice1", username: "alice", password: "password123", age13: 1 })).me);
assert.ok((await call("b", "/api/chat/signup", { name: "bobby1", username: "bobby", password: "password123", age13: 1 })).me);

// Create, join, leave.
let made = await call("a", "/api/forum/communities", { name: "Pixel Art & Sprites", about: "Tiny pictures." });
assert.equal(made.s, 201); assert.equal(made.slug, "pixel-art-and-sprites");
assert.equal((await call("b", "/api/forum/communities", { name: "Pixel art and sprites" })).s, 409);
assert.equal((await call("b", "/api/forum/communities", { name: "Wezzet official" })).s, 400);
let one = await call("a", "/api/forum/communities/pixel-art-and-sprites");
assert.equal(one.community.members, 1); assert.ok(one.community.joined); assert.ok(one.community.can_mod); assert.equal(one.community.owner, "alice");
assert.equal((await call("b", "/api/forum/communities/pixel-art-and-sprites/join", {})).members, 2);
assert.ok((await call("b", "/api/forum/communities")).communities.find((c) => c.slug === "pixel-art-and-sprites").joined);
assert.equal((await call("b", "/api/forum/communities/pixel-art-and-sprites/leave", {})).members, 1);

// Image post by b goes to Posts, not Discussions; served back; bad images refused.
assert.equal((await call("b", "/api/forum/topics", { title: "Not an image", community: "art", image: "data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAA" })).s, 400);
let ip = await call("b", "/api/forum/topics", { title: "Sunset sketch", body: "made in Art Studio", community: "pixel-art-and-sprites", image: png });
assert.equal(ip.s, 201);
let posts = await call("a", "/api/forum/topics?c=pixel-art-and-sprites&tab=posts");
assert.equal(posts.topics.length, 1); assert.equal(posts.topics[0].kind, "image"); assert.equal(posts.topics[0].author, "bobby");
assert.ok(posts.topics[0].can_delete, "community creator can remove posts"); assert.ok(!posts.topics[0].mine);
assert.equal((await call("a", "/api/forum/topics?c=pixel-art-and-sprites&tab=discussions")).topics.length, 0);
const imgRes = await worker.fetch(new Request("https://wezzet.com" + posts.topics[0].image), env, ctx);
assert.equal(imgRes.status, 200); assert.equal(imgRes.headers.get("content-type"), "image/png");
assert.equal((await imgRes.arrayBuffer()).byteLength, 18);
// Article without image is fine; image kind without image isn't.
assert.equal((await call("b", "/api/forum/topics", { title: "Release notes", body: "Long text", kind: "news", community: "pixel-art-and-sprites" })).s, 201);
assert.equal((await call("b", "/api/forum/topics", { title: "Where is it", kind: "image", community: "art" })).s, 400);

// Delete: others can't, the author or community creator can; the image goes too.
const anonTopic = t.id;
assert.equal((await call("b", "/api/forum/delete", { kind: "topic", id: anonTopic })).s, 403);
assert.equal((await call("a", "/api/forum/delete", { kind: "topic", id: ip.id })).s, 200);
assert.equal((await worker.fetch(new Request("https://wezzet.com" + posts.topics[0].image), env, ctx)).status, 404);
assert.equal((await call("a", "/api/forum/topics/" + ip.id)).s, 404);
// Signed-in comment uses the account name and can be removed by its author.
let c = await call("b", "/api/forum/topics/1/comments", { body: "nice", author: "Ezra" });
let read = await call("b", "/api/forum/topics/1");
const mine = read.comments.find((x) => x.id === c.id);
assert.equal(mine.author, "bobby"); assert.ok(mine.can_delete); assert.equal(mine.uid, undefined);
assert.equal((await call("b", "/api/forum/delete", { kind: "comment", id: c.id })).s, 200);

// Reports hide a user community after 5 people; official ones can't be reported away.
for (let i = 0; i < 5; i++) { ipN = 50 + i; jars.anon = ""; await call("anon", "/api/forum/report", { kind: "community", id: "pixel-art-and-sprites" }); }
assert.equal((await call("a", "/api/forum/communities/pixel-art-and-sprites")).s, 404);
assert.equal((await call("anon", "/api/forum/report", { kind: "community", id: "general" })).s, 400);

// The /api/chat/forum alias (where the login cookie is sent) answers the same as /api/forum.
const alias = await call("a", "/api/chat/forum/communities");
assert.equal(alias.me.name, "alice"); assert.ok(alias.communities.length >= 7);
// /forum/<slug> serves the forum page.
const page = await worker.fetch(new Request("https://wezzet.com/forum/art"), env, ctx);
assert.equal(page.status, 200); assert.match(await page.text(), /forum/);
console.log("forum communities: all tests passed");
