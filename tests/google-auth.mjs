// Run with Node 24 or newer: node tests/google-auth.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
const source = fs.readFileSync(
  new URL("../_worker.js", import.meta.url),
  "utf8",
);
const { default: worker } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const sql = new DatabaseSync(":memory:");
const stmt = (query, values = []) => ({
  bind(...v) {
    return stmt(query, v);
  },
  async first() {
    return sql.prepare(query).get(...values) || null;
  },
  async all() {
    return { results: sql.prepare(query).all(...values) };
  },
  async run() {
    return sql.prepare(query).run(...values);
  },
});
const DB = {
  prepare: stmt,
  async batch(items) {
    sql.exec("BEGIN");
    try {
      const results = [];
      for (const i of items) results.push(await i.run());
      sql.exec("COMMIT");
      return results;
    } catch (e) {
      sql.exec("ROLLBACK");
      throw e;
    }
  },
};
const env = { DB };
const keys = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
jwk.kid = "test-key";
jwk.alg = "RS256";
globalThis.fetch = async () =>
  new Response(JSON.stringify({ keys: [jwk] }), {
    headers: { "cache-control": "max-age=3600" },
  });
const client =
  "659604026961-h7o5g8s98ns9enbhgesa4dpvse7hi7uh.apps.googleusercontent.com";
async function jwt(nonce, sub = "google-subject", extra = {}) {
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const input =
    enc({ alg: "RS256", kid: "test-key" }) +
    "." +
    enc({
      iss: "https://accounts.google.com",
      aud: client,
      sub,
      nonce,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...extra,
    });
  return (
    input +
    "." +
    Buffer.from(
      await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        keys.privateKey,
        new TextEncoder().encode(input),
      ),
    ).toString("base64url")
  );
}
async function call(
  path,
  data = {},
  cookie = "",
  origin = "https://wezzet.com",
) {
  const r = await worker.fetch(
    new Request("https://wezzet.com/api/chat/" + path, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        cookie,
        "cf-connecting-ip": "192.0.2.10",
      },
      body: JSON.stringify(data),
    }),
    env,
    {},
  );
  return {
    status: r.status,
    data: await r.json(),
    cookies: r.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; "),
  };
}
async function start(cookie = "", link = false) {
  const r = await call("google/start", { link }, cookie);
  assert.equal(r.status, 200);
  return r;
}
assert.equal(
  (await call("google/start", {}, "", "https://evil.example")).status,
  400,
);
let s = await start();
let credential = await jwt(s.data.nonce);
assert.equal(
  (await call("google", { credential }, s.cookies)).data.needsSignup,
  true,
);
for (const extra of [
  { aud: "evil" },
  { iss: "evil" },
  { exp: 0 },
  { nonce: "wrong" },
  { iat: 9999999999 },
])
  assert.equal(
    (
      await call(
        "google",
        {
          credential: await jwt(s.data.nonce, "google-subject", extra),
          age13: true,
        },
        s.cookies,
      )
    ).status,
    401,
  );
assert.equal(
  (
    await call(
      "google",
      { credential: credential.slice(0, -10) + "AAAAAAAAAA", age13: true },
      s.cookies,
    )
  ).status,
  401,
);
const signed = await call("google", { credential, age13: true }, s.cookies);
assert.equal(signed.status, 200);
assert(signed.data.me.name.startsWith("user_"));
const id = signed.data.me.id;
assert.equal(
  (await call("google", { credential, age13: true }, s.cookies)).status,
  401,
);
s = await start();
const returning = await call(
  "google",
  { credential: await jwt(s.data.nonce) },
  s.cookies,
);
assert.equal(returning.data.me.id, id);
assert.equal(sql.prepare("SELECT COUNT(*) n FROM ch_users").get().n, 1);
// Create an ordinary password account and explicitly link a different Google identity.
const old = await call("signup", {
  name: "existing",
  username: "ExistingUser",
  password: "test-password-123",
  age13: true,
});
assert.equal(old.status, 200);
s = await start(old.cookies, true);
const linked = await call(
  "google",
  { credential: await jwt(s.data.nonce, "second-subject") },
  s.cookies + "; " + old.cookies,
);
assert.equal(linked.data.me.id, old.data.me.id);
assert(linked.data.linked);
s = await start();
const linkedLogin = await call(
  "google",
  { credential: await jwt(s.data.nonce, "second-subject") },
  s.cookies,
);
assert.equal(linkedLogin.data.me.id, old.data.me.id);
s = await start(old.cookies, true);
assert.equal(
  (
    await call(
      "google",
      { credential: await jwt(s.data.nonce) },
      s.cookies + "; " + old.cookies,
    )
  ).status,
  409,
);
s = await start(old.cookies, true);
assert.equal(
  (
    await call(
      "google",
      { credential: await jwt(s.data.nonce, "second-subject") },
      s.cookies,
    )
  ).status,
  401,
);
sql.prepare("UPDATE ch_users SET banned=1 WHERE id=?").run(id);
s = await start();
assert.equal(
  (await call("google", { credential: await jwt(s.data.nonce) }, s.cookies))
    .status,
  403,
);
console.log(
  "PASS real RSA verification, audience/issuer/expiry/nonce/tampering rejection, CSRF, signup age gate, replay prevention, returning identity, password account linking, link conflicts, session binding and bans",
);
