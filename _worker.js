/* Wezzet: serves the static site and the forum API (/api/forum/*).
   Forum data lives in the Cloudflare D1 database bound as DB. */

const MAX = { title: 120, body: 5000, comment: 3000, author: 30 };
const LIMITS = { topic: [5, 3600], comment: [40, 3600], vote: [400, 3600], report: [30, 3600] };
const HIDE_AT_REPORTS = 3;
const PAGE = 30;
const SALT = "wezzet-forum-v1";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/forum/")) {
      if (!env.DB) return json({ error: "The forum database isn't connected yet." }, 503);
      try {
        return await api(request, env, url);
      } catch (e) {
        return json({ error: "Something went wrong on our side. Try again in a moment." }, 500);
      }
    }
    const res = await env.ASSETS.fetch(request);
    // _headers doesn't apply when a _worker.js is present, so set the same headers here.
    const out = new Response(res.body, res);
    out.headers.set("X-Content-Type-Options", "nosniff");
    out.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    out.headers.set("X-Frame-Options", "SAMEORIGIN");
    if (url.pathname.startsWith("/vendor/") && res.ok) out.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    else if (url.pathname.startsWith("/assets/") && /\.(css|js)$/.test(url.pathname) && res.ok) out.headers.set("Cache-Control", "public, max-age=300, must-revalidate");
    return out;
  },
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

function readCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(new RegExp("(?:^|;\\s*)" + name + "=([A-Za-z0-9-]{16,64})"));
  return m ? m[1] : null;
}

async function identity(request) {
  let uid = readCookie(request, "wz_uid");
  let setCookie = null;
  if (!uid) {
    uid = crypto.randomUUID();
    setCookie = `wz_uid=${uid}; Path=/; Max-Age=63072000; HttpOnly; Secure; SameSite=Lax`;
  }
  const ip = request.headers.get("cf-connecting-ip") || "local";
  return { voter: await sha(SALT + "|u|" + uid), who: await sha(SALT + "|ip|" + ip), setCookie };
}

async function allowed(env, who, action) {
  const [max, windowSec] = LIMITS[action];
  const since = Date.now() - windowSec * 1000;
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM actions WHERE who = ? AND action = ? AND created_at > ?")
    .bind(who, action, since).first();
  return (row ? row.n : 0) < max;
}

function logAction(env, who, action) {
  return env.DB.prepare("INSERT INTO actions (who, action, created_at) VALUES (?, ?, ?)").bind(who, action, Date.now());
}

function clean(s, max) {
  return String(s == null ? "" : s).replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
}

function tooManyLinks(text) {
  return (text.match(/https?:\/\//gi) || []).length > 3;
}

async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

function hotRank(t, now) {
  const hours = (now - t.created_at) / 3600000;
  return (t.score + t.comment_count * 0.5) / Math.pow(hours + 2, 1.5);
}

async function myVotes(env, voter, kind, ids) {
  if (!ids.length) return {};
  const marks = ids.map(() => "?").join(",");
  const rows = await env.DB.prepare(`SELECT target_id, value FROM votes WHERE kind = ? AND voter = ? AND target_id IN (${marks})`)
    .bind(kind, voter, ...ids).all();
  const out = {};
  for (const r of rows.results || []) out[r.target_id] = r.value;
  return out;
}

const TOPIC_FIELDS = "id, title, body, author, created_at, score, comment_count";

async function api(request, env, url) {
  const id = await identity(request);
  const extra = id.setCookie ? { "set-cookie": id.setCookie } : {};
  const reply = (data, status = 200) => json(data, status, extra);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;

  // List topics
  if (path === "/api/forum/topics" && method === "GET") {
    const sort = ["hot", "new", "top"].includes(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "hot";
    const page = Math.max(0, Math.min(50, parseInt(url.searchParams.get("page") || "0", 10) || 0));
    let topics;
    if (sort === "hot") {
      const rows = await env.DB.prepare(`SELECT ${TOPIC_FIELDS} FROM topics WHERE hidden = 0 ORDER BY created_at DESC LIMIT 500`).all();
      const now = Date.now();
      topics = (rows.results || []).sort((a, b) => hotRank(b, now) - hotRank(a, now)).slice(page * PAGE, page * PAGE + PAGE + 1);
    } else {
      const order = sort === "new" ? "created_at DESC" : "score DESC, created_at DESC";
      const rows = await env.DB.prepare(`SELECT ${TOPIC_FIELDS} FROM topics WHERE hidden = 0 ORDER BY ${order} LIMIT ? OFFSET ?`)
        .bind(PAGE + 1, page * PAGE).all();
      topics = rows.results || [];
    }
    const more = topics.length > PAGE;
    topics = topics.slice(0, PAGE).map((t) => ({ ...t, body: t.body.slice(0, 240) }));
    const votes = await myVotes(env, id.voter, "t", topics.map((t) => t.id));
    for (const t of topics) t.my_vote = votes[t.id] || 0;
    return reply({ topics, more, sort, page });
  }

  // Create topic
  if (path === "/api/forum/topics" && method === "POST") {
    const b = await body(request);
    const title = clean(b.title, MAX.title).replace(/\s+/g, " ");
    const text = clean(b.body, MAX.body);
    const author = clean(b.author, MAX.author).replace(/\s+/g, " ") || "Anonymous";
    if (title.length < 3) return reply({ error: "Give your topic a title of at least 3 characters." }, 400);
    if (tooManyLinks(title + " " + text)) return reply({ error: "Posts can include up to 3 links." }, 400);
    if (!(await allowed(env, id.who, "topic"))) return reply({ error: "You've started several topics recently. Try again in an hour." }, 429);
    const now = Date.now();
    const res = await env.DB.prepare("INSERT INTO topics (title, body, author, created_at, score, poster) VALUES (?, ?, ?, ?, 1, ?)")
      .bind(title, text, author, now, id.who).run();
    const topicId = res.meta.last_row_id;
    await env.DB.batch([
      env.DB.prepare("INSERT OR REPLACE INTO votes (kind, target_id, voter, value) VALUES ('t', ?, ?, 1)").bind(topicId, id.voter),
      logAction(env, id.who, "topic"),
    ]);
    return reply({ id: topicId }, 201);
  }

  // Read one topic with its comments
  let m = path.match(/^\/api\/forum\/topics\/(\d+)$/);
  if (m && method === "GET") {
    const topicId = parseInt(m[1], 10);
    const topic = await env.DB.prepare(`SELECT ${TOPIC_FIELDS}, hidden FROM topics WHERE id = ?`).bind(topicId).first();
    if (!topic || topic.hidden) return reply({ error: "This topic doesn't exist or was removed." }, 404);
    const rows = await env.DB.prepare("SELECT id, parent_id, body, author, created_at, score, hidden FROM comments WHERE topic_id = ? ORDER BY created_at ASC LIMIT 2000")
      .bind(topicId).all();
    const comments = (rows.results || []).map((c) => (c.hidden ? { ...c, body: "", author: "" } : c));
    const tv = await myVotes(env, id.voter, "t", [topicId]);
    const cv = await myVotes(env, id.voter, "c", comments.map((c) => c.id));
    delete topic.hidden;
    topic.my_vote = tv[topicId] || 0;
    for (const c of comments) c.my_vote = cv[c.id] || 0;
    return reply({ topic, comments });
  }

  // Add a comment or reply
  m = path.match(/^\/api\/forum\/topics\/(\d+)\/comments$/);
  if (m && method === "POST") {
    const topicId = parseInt(m[1], 10);
    const b = await body(request);
    const text = clean(b.body, MAX.comment);
    const author = clean(b.author, MAX.author).replace(/\s+/g, " ") || "Anonymous";
    const parent = b.parent_id ? parseInt(b.parent_id, 10) : null;
    if (!text) return reply({ error: "Write something before posting." }, 400);
    if (tooManyLinks(text)) return reply({ error: "Comments can include up to 3 links." }, 400);
    const topic = await env.DB.prepare("SELECT id, hidden FROM topics WHERE id = ?").bind(topicId).first();
    if (!topic || topic.hidden) return reply({ error: "This topic doesn't exist or was removed." }, 404);
    if (parent) {
      const p = await env.DB.prepare("SELECT id FROM comments WHERE id = ? AND topic_id = ?").bind(parent, topicId).first();
      if (!p) return reply({ error: "The comment you're replying to no longer exists." }, 400);
    }
    if (!(await allowed(env, id.who, "comment"))) return reply({ error: "You're commenting very fast. Try again in a little while." }, 429);
    const res = await env.DB.prepare("INSERT INTO comments (topic_id, parent_id, body, author, created_at, score, poster) VALUES (?, ?, ?, ?, ?, 1, ?)")
      .bind(topicId, parent, text, author, Date.now(), id.who).run();
    const cid = res.meta.last_row_id;
    await env.DB.batch([
      env.DB.prepare("UPDATE topics SET comment_count = comment_count + 1 WHERE id = ?").bind(topicId),
      env.DB.prepare("INSERT OR REPLACE INTO votes (kind, target_id, voter, value) VALUES ('c', ?, ?, 1)").bind(cid, id.voter),
      logAction(env, id.who, "comment"),
    ]);
    return reply({ id: cid }, 201);
  }

  // Vote: value 1 (up), -1 (down) or 0 (remove)
  if (path === "/api/forum/vote" && method === "POST") {
    const b = await body(request);
    const kind = b.kind === "comment" ? "c" : b.kind === "topic" ? "t" : null;
    const target = parseInt(b.id, 10);
    const value = [1, -1, 0].includes(b.value) ? b.value : null;
    if (!kind || !target || value === null) return reply({ error: "That vote couldn't be read." }, 400);
    const table = kind === "t" ? "topics" : "comments";
    const exists = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ? AND hidden = 0`).bind(target).first();
    if (!exists) return reply({ error: "This post no longer exists." }, 404);
    if (!(await allowed(env, id.who, "vote"))) return reply({ error: "You're voting very fast. Try again later." }, 429);
    const old = await env.DB.prepare("SELECT value FROM votes WHERE kind = ? AND target_id = ? AND voter = ?").bind(kind, target, id.voter).first();
    const delta = value - (old ? old.value : 0);
    const stmts = [logAction(env, id.who, "vote")];
    if (value === 0) stmts.push(env.DB.prepare("DELETE FROM votes WHERE kind = ? AND target_id = ? AND voter = ?").bind(kind, target, id.voter));
    else stmts.push(env.DB.prepare("INSERT OR REPLACE INTO votes (kind, target_id, voter, value) VALUES (?, ?, ?, ?)").bind(kind, target, id.voter, value));
    if (delta) stmts.push(env.DB.prepare(`UPDATE ${table} SET score = score + ? WHERE id = ?`).bind(delta, target));
    await env.DB.batch(stmts);
    const row = await env.DB.prepare(`SELECT score FROM ${table} WHERE id = ?`).bind(target).first();
    return reply({ score: row.score, my_vote: value });
  }

  // Report: hides a post after several different people report it
  if (path === "/api/forum/report" && method === "POST") {
    const b = await body(request);
    const kind = b.kind === "comment" ? "c" : b.kind === "topic" ? "t" : null;
    const target = parseInt(b.id, 10);
    if (!kind || !target) return reply({ error: "That report couldn't be read." }, 400);
    if (!(await allowed(env, id.who, "report"))) return reply({ error: "You've sent a lot of reports. Try again later." }, 429);
    const table = kind === "t" ? "topics" : "comments";
    const res = await env.DB.prepare("INSERT OR IGNORE INTO reports (kind, target_id, voter, created_at) VALUES (?, ?, ?, ?)")
      .bind(kind, target, id.voter, Date.now()).run();
    if (res.meta.changes) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE ${table} SET reports = reports + 1 WHERE id = ?`).bind(target),
        env.DB.prepare(`UPDATE ${table} SET hidden = 1 WHERE id = ? AND reports >= ?`).bind(target, HIDE_AT_REPORTS),
        logAction(env, id.who, "report"),
      ]);
    }
    return reply({ ok: true });
  }

  return reply({ error: "Not found." }, 404);
}
