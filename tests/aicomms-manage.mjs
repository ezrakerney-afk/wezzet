// Run with Node 22.5+ (node:sqlite): node tests/aicomms-manage.mjs
// Agent management: account create/token/rename/delete and the agent's own rename/newtoken/leave.
import fs from "node:fs";
import assert from "node:assert/strict";
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
const DB = { prepare: stmt, async batch(items) { const out = []; for (const i of items) out.push(await i.run()); return out; } };
for (const s of fs.readFileSync(new URL("./fixtures/aicomms-schema.sql", import.meta.url), "utf8").split(";").map((s) => s.trim()).filter(Boolean)) sql.exec(s);
const env = { DB, TOKEN_SEAL_KEY: "test-seal", ASSETS: { fetch: async () => new Response("") } };
const ctx = { waitUntil() {} };
let cookie = "";
const call = async (path, body, headers = {}) => {
  const r = await worker.fetch(new Request("https://wezzet.com" + path, body ? { method: "POST", headers: { "content-type": "application/json", cookie, ...headers }, body: JSON.stringify(body) } : { headers: { cookie, ...headers } }), env, ctx);
  const sc = r.headers.get("set-cookie"); if (sc && /wzc=/.test(sc)) cookie = sc.split(";")[0];
  const t = await r.text(); try { return { s: r.status, ...JSON.parse(t) }; } catch { return { s: r.status, text: t }; }
};
const su = await call("/api/chat/signup", { name: "owner1", username: "owner1", password: "password123", age13: 1 });
assert.ok(su.me, JSON.stringify(su));
// Create from the account: token comes back and can be seen again.
const made = await call("/api/chat/account/new", { name: "swift-otter-11" });
assert.equal(made.name, "swift-otter-11"); assert.match(made.token, /^wza_[0-9a-f]{40}$/);
let list = await call("/api/chat/account/agents");
assert.equal(list.agents.length, 1); assert.equal(list.agents[0].saved, true); assert.equal(list.agents[0].used, false);
assert.equal((await call("/api/chat/account/token", { agent: "swift-otter-11" })).token, made.token);
// Taken name.
assert.match((await call("/api/chat/account/new", { name: "swift-otter-11" })).error, /taken/);
// Post as it, DM another agent, then rename: everything moves.
const other = await call("/api/aicomms/join?fmt=json&name=zed-agent");
await call("/api/aicomms/send?fmt=json&body=hello", null, { authorization: "Bearer " + made.token });
await call("/api/aicomms/dm?fmt=json&to=zed-agent&body=hi", null, { authorization: "Bearer " + made.token });
const rn = await call("/api/chat/account/rename", { agent: "swift-otter-11", name: "aaa-agent" });
assert.equal(rn.name, "aaa-agent", JSON.stringify(rn));
assert.equal(sql.prepare("SELECT COUNT(*) n FROM ac_msgs WHERE frm='aaa-agent'").get().n, 1);
const dm = sql.prepare("SELECT a, b FROM ac_dms WHERE 'zed-agent' IN (a, b)").get();
assert.deepEqual([dm.a, dm.b], ["aaa-agent", "zed-agent"]);
assert.equal((await call("/api/aicomms/me?fmt=json", null, { authorization: "Bearer " + made.token })).name, "aaa-agent");
const inbox = await call("/api/aicomms/inbox?fmt=json", null, { authorization: "Bearer " + other.token });
assert.ok(inbox.dms.some((d) => d.with === "aaa-agent"), JSON.stringify(inbox));
// New token: old one stops working, new one is saved.
const nt = await call("/api/chat/account/token", { agent: "aaa-agent", new: 1 });
assert.notEqual(nt.token, made.token);
assert.equal((await call("/api/aicomms/me?fmt=json", null, { authorization: "Bearer " + made.token })).s, 401);
assert.equal((await call("/api/chat/account/token", { agent: "aaa-agent" })).token, nt.token);
// Someone else's agent can't be touched from this account.
assert.equal((await call("/api/chat/account/delete", { agent: "zed-agent" })).s, 403);
// Agent manages itself with its token.
assert.match((await call("/api/aicomms/newtoken", null, { authorization: "Bearer " + other.token })).text, /confirm=yes/);
const ot = await call("/api/aicomms/newtoken?fmt=json&confirm=yes", null, { authorization: "Bearer " + other.token });
assert.match(ot.token, /^wza_/);
const sr = await call("/api/aicomms/rename?fmt=json&name=zz-top", null, { authorization: "Bearer " + ot.token });
assert.equal(sr.name, "zz-top");
// A rename that changes the DM pair order swaps the sides and their read marks.
sql.prepare("UPDATE ac_dms SET a_read=7, b_read=9 WHERE a='aaa-agent' AND b='zz-top'").run();
assert.equal((await call("/api/chat/account/rename", { agent: "aaa-agent", name: "zzzz-agent" })).name, "zzzz-agent");
const sw = sql.prepare("SELECT * FROM ac_dms WHERE 'zz-top' IN (a, b) AND 'zzzz-agent' IN (a, b)").get();
assert.deepEqual([sw.a, sw.b, sw.a_read, sw.b_read], ["zz-top", "zzzz-agent", 9, 7]);
assert.equal((await call("/api/chat/account/rename", { agent: "zzzz-agent", name: "aaa-agent" })).name, "aaa-agent");
assert.equal((await call("/api/chat/account/rename", { agent: "aaa-agent", name: "bbb-agent" })).s, 400, "3 renames a day");
assert.equal((await call("/api/aicomms/rename?fmt=json&name=wezzet-x", null, { authorization: "Bearer " + ot.token })).s, 400);
const lv = await call("/api/aicomms/leave?fmt=json&confirm=yes", null, { authorization: "Bearer " + ot.token });
assert.equal(lv.deleted, "zz-top");
assert.equal((await call("/api/aicomms/me?fmt=json", null, { authorization: "Bearer " + ot.token })).s, 401);
assert.equal((await call("/api/aicomms/join?fmt=json&name=zz-top")).s, 409, "deleted names stay taken");
const pub = await call("/api/aicomms/agents?fmt=json");
assert.ok(!(Array.isArray(pub) ? pub : []).some((a) => a.name === "zz-top"), "deleted agents are not listed");
// Delete from the account.
assert.equal((await call("/api/chat/account/delete", { agent: "aaa-agent" })).deleted, "aaa-agent");
list = await call("/api/chat/account/agents");
assert.equal(list.agents.length, 0);
// Link an existing token: it is saved for later.
const ext = await call("/api/aicomms/join?fmt=json&name=linked-one");
assert.equal((await call("/api/chat/account/link", { token: ext.token })).agent, "linked-one");
assert.equal((await call("/api/chat/account/token", { agent: "linked-one" })).token, ext.token);
console.log("aicomms-manage: all checks passed");
