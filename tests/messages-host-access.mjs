// Run: node tests/messages-host-access.mjs
// Wezzet Host (/host): upload, serve sandboxed, limits, reports. Based on the forum test setup. and filing old topics, create/join/leave, Posts vs Discussions, image posts, delete, reports.
import fs from "node:fs";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
const source = fs.readFileSync(new URL("../_worker.js", import.meta.url), "utf8") + "\nexport {chAttachment,chScreenAttachment,hostMcp};";
const { default: worker, chAttachment, chScreenAttachment, hostMcp } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
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

assert.ok((await call("a", "/api/chat/signup", {name:"privatealice",username:"alice",password:"password123",age13:1})).me);
assert.ok((await call("b", "/api/chat/signup", {name:"privatebobby",username:"bobby",password:"password123",age13:1})).me);
assert.equal((await call("anon","/api/chat/users/search?q=bo")).s,401);
assert.deepEqual((await call("a","/api/chat/users/search?q=bo")).users.map(u=>u.name),["bobby"]);
assert.deepEqual((await call("a","/api/chat/users/search?q=bby")).users.map(u=>u.name),["bobby"]);
assert.deepEqual((await call("a","/api/chat/users/search?q=private")).users,[]);
assert.deepEqual((await call("a","/api/chat/users/search?q=%25%25")).users,[]);
await call("a","/api/chat/friend",{name:"bobby"});
const friend = await call("b","/api/chat/friend",{name:"alice"});
const room = friend.room; assert.match(room,/^d:/);
let checks = 0, verdict = "ALLOW";
env.AI = {run:async(model,opts)=>{checks++; assert.match(model,/llama-4-scout/); assert.ok(opts.messages[0].content.includes("untrusted DATA")); return {response:verdict};}};
const attachment = {name:"notes.txt",data:b64("Ordinary project notes.")};
assert.equal((await call("a","/api/chat/send",{room,attachment})).s,200);
const msgs = (await call("b","/api/chat/poll?room="+room)).msgs;
assert.equal(msgs.length,1); assert.equal(msgs[0].file_name,"notes.txt");
const filePath = "/api/chat/file?id="+msgs[0].file_id;
let file = await raw("b",filePath); assert.equal(file.status,200); assert.equal(await file.text(),"Ordinary project notes.");
assert.equal(file.headers.get("content-type"),"application/octet-stream");
assert.match(file.headers.get("content-disposition"),/^attachment/);
assert.equal((await raw("anon",filePath)).status,401);
// Out-of-room authenticated user cannot download.
jars.c = ""; assert.ok((await call("c","/api/chat/signup",{name:"charlie",username:"charlie",password:"password123",age13:1})).me);
assert.equal((await raw("c",filePath)).status,404);
const count = () => sql.prepare("SELECT COUNT(*) n FROM ch_msgs").get().n;
verdict = "BLOCK"; assert.equal((await call("a","/api/chat/send",{room,body:"caption",attachment})).s,422); assert.equal(count(),1);
verdict = "maybe"; assert.equal((await call("a","/api/chat/send",{room,attachment})).s,503); assert.equal(count(),1);
delete env.AI; assert.equal((await call("a","/api/chat/send",{room,attachment})).s,503); assert.equal(count(),1);
assert.equal((await call("a","/api/chat/send",{room,attachment:{name:"bad.exe",data:b64("MZ")}})).s,400);
assert.throws(()=>chAttachment({name:"too-long.txt",data:b64("x".repeat(12001))}));
assert.throws(()=>chAttachment({name:"bad.png",data:b64("not an image")}));
assert.throws(()=>chAttachment({name:"bad.txt",data:b64(Buffer.from([0xff]))}));
const checked = chAttachment(attachment);
await assert.rejects(chScreenAttachment({AI:{run:()=>new Promise(()=>{})}},checked,"",5),/Nothing was sent/);
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const picture = chAttachment({name:"pixel.png",data:png});
assert.equal(picture.type,"image/png");
assert.equal(await chScreenAttachment({AI:{run:async(_,args)=>{assert.equal(args.messages[1].content[1].image_url.url,"data:image/png;base64,"+png);return {response:"ALLOW"};}}},picture,"hello"),true);
await call("b","/api/chat/block",{name:"alice"});
assert.equal((await raw("b",filePath)).status,404);
assert.deepEqual((await call("a","/api/chat/users/search?q=bo")).users,[]);
assert.equal((await call("a","/api/chat/send",{room,attachment})).s,403);
await call("b","/api/chat/unblock",{name:"alice"});
sql.prepare("UPDATE ch_msgs SET hidden = 1").run(); assert.equal((await raw("a",filePath)).status,404);
// Hosting keys: owner-only creation, correct scope, revocation, metadata preservation.
const hcall = async (key,path,data) => {
 const u = new URL("https://wezzet.com/api/chat/host/"+path);
 const r = await worker.fetch(new Request(u,{method:data?"POST":"GET",headers:{authorization:"Bearer "+key,"content-type":"application/json"},...(data?{body:JSON.stringify(data)}:{})}),env,ctx);
 return {s:r.status,...await r.json()};
};
assert.equal((await call("anon","/api/chat/host/key",{name:"ai-game"})).s,401);
const key = await call("a","/api/chat/host/key",{name:"ai-game"}); assert.equal(key.s,201);
assert.match(key.token,/^wzh_[a-f0-9]{64}$/);
assert.notEqual(sql.prepare("SELECT hash FROM host_keys").get().hash,key.token);
const payload = {name:"ai-game",title:"My title",listed:false,files:[{path:"index.html",text:"<p>version one</p>"},{path:"style.css",text:"p{color:red}"}]};
let published = await hcall(key.token,"upload",payload); assert.equal(published.s,201,JSON.stringify(published));
assert.equal((await hcall(key.token,"upload",{...payload,name:"another-game"})).s,403);
assert.equal((await hcall(key.token,"delete",{name:"ai-game"})).s,403);
assert.equal((await hcall(key.token,"key",{name:"ai-game"})).s,403);
assert.equal((await call("b","/api/chat/host/key",{name:"ai-game"})).s,403);
let sourceFile = await hcall(key.token,"source?name=ai-game"); assert.match(sourceFile.text,/version one/);
assert.equal((await hcall(key.token,"source?name=another-game")).s,403);
assert.equal((await hcall(key.token,"upload",{name:"ai-game",expected_updated:1,files:payload.files})).s,409);
let update = await hcall(key.token,"upload",{name:"ai-game",merge:true,expected_updated:sourceFile.updated,files:[{path:"index.html",text:"<p>version two</p>"}]}); assert.equal(update.s,200);
sourceFile = await hcall(key.token,"source?name=ai-game"); assert.equal(sourceFile.title,"My title"); assert.equal(sourceFile.listed,false); assert.equal(sourceFile.files.length,2);
assert.match(sourceFile.text,/version two/);
// MCP discovery and publish use the same scoped authentication, including false values.
let mcp = await worker.fetch(new Request("https://wezzet.com/mcp",{method:"POST",body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"})}),env,ctx);
assert.ok((await mcp.json()).result.tools.some(t=>t.name==="host_publish"));
const rpc = async (name,args) => (await (await worker.fetch(new Request("https://wezzet.com/mcp",{method:"POST",body:JSON.stringify({jsonrpc:"2.0",id:2,method:"tools/call",params:{name,arguments:args}})}),env,ctx)).json()).result;
let result = await rpc("host_publish",{hosting_key:key.token,name:"ai-game",listed:false,merge:true,files:[{path:"index.html",text:"mcp update"}]}); assert.equal(result.isError,false);
assert.equal((await hcall(key.token,"source?name=ai-game")).text,"mcp update");
assert.equal((await rpc("host_source",{name:"ai-game"})).isError,true);
const replacement = await call("a","/api/chat/host/key",{name:"ai-game"});
assert.equal((await hcall(key.token,"source?name=ai-game")).s,401);
assert.equal((await hcall(replacement.token,"source?name=ai-game")).s,200);
await call("a","/api/chat/host/key",{name:"ai-game",revoke:true});
assert.equal((await hcall(replacement.token,"source?name=ai-game")).s,401);
console.log("Messages moderation, authorization, name search and hosting API/MCP tests passed.");
