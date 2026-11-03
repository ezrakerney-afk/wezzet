/* Wezzet forum client. Talks to /api/forum/* (see _worker.js). All user text is
   inserted with textContent, never as HTML. */
(() => {
  const $ = (id) => document.getElementById(id);
  const API = "/api/forum";
  const COLLAPSE_AT = -4;
  const state = { sort: "hot", page: 0, topicId: null };

  const UP = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3 2.5 10h11z" fill="currentColor"/></svg>';
  const DOWN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13 2.5 6h11z" fill="currentColor"/></svg>';

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) n.setAttribute(k, v);
    }
    for (const k of kids) if (k) n.append(k);
    return n;
  }

  function ago(ms) {
    const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
    const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [name, size] of units) {
      const v = Math.floor(s / size);
      if (v >= 1) return `${v} ${name}${v > 1 ? "s" : ""} ago`;
    }
    return "just now";
  }

  function toast(text) {
    const t = el("div", { class: "toast", role: "status", text });
    document.body.append(t);
    setTimeout(() => t.remove(), 3200);
  }

  async function call(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: { "content-type": "application/json", ...(opts.headers || {}) },
      credentials: "same-origin",
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    return data;
  }

  // Remember the visitor's display name on this device.
  const NAME_KEY = "wezzet.forum.name";
  const savedName = () => { try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; } };
  const saveName = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} };
  $("t-author").value = savedName();
  $("c-author").value = savedName();

  function voteWidget(kind, item, inline) {
    const box = el("div", { class: "vote" + (inline ? " inline" : "") });
    const up = el("button", { type: "button", "aria-label": "Upvote", "aria-pressed": String(item.my_vote === 1) });
    const down = el("button", { type: "button", "aria-label": "Downvote", "aria-pressed": String(item.my_vote === -1) });
    up.innerHTML = UP; down.innerHTML = DOWN;
    const score = el("span", { class: "score", text: String(item.score), "aria-label": `Score ${item.score}` });
    async function cast(dir) {
      const value = item.my_vote === dir ? 0 : dir;
      const before = { score: item.score, my_vote: item.my_vote };
      item.score += value - item.my_vote; item.my_vote = value;
      paint();
      try {
        const r = await call("/vote", { method: "POST", body: JSON.stringify({ kind, id: item.id, value }) });
        item.score = r.score; item.my_vote = r.my_vote; paint();
      } catch (e) {
        Object.assign(item, before); paint(); toast(e.message);
      }
    }
    function paint() {
      score.textContent = String(item.score);
      score.setAttribute("aria-label", `Score ${item.score}`);
      up.setAttribute("aria-pressed", String(item.my_vote === 1));
      down.setAttribute("aria-pressed", String(item.my_vote === -1));
    }
    up.addEventListener("click", () => cast(1));
    down.addEventListener("click", () => cast(-1));
    box.append(up, score, down);
    return box;
  }

  async function report(kind, id, btn) {
    btn.disabled = true;
    try {
      await call("/report", { method: "POST", body: JSON.stringify({ kind, id }) });
      btn.textContent = "Reported";
    } catch (e) { btn.disabled = false; toast(e.message); }
  }

  // ---------- Topic list ----------
  function topicRow(t) {
    const link = el("a", { class: "title", href: `/forum?t=${t.id}`, text: t.title });
    link.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); openTopic(t.id, true); });
    const meta = el("div", { class: "meta", text: `${t.author}, ${ago(t.created_at)}, ${t.comment_count} comment${t.comment_count === 1 ? "" : "s"}` });
    const main = el("div", {}, link, t.body ? el("p", { class: "preview", text: t.body }) : null, meta);
    return el("li", { class: "topic-row" }, voteWidget("topic", t), main);
  }

  async function loadTopics(reset) {
    if (reset) { state.page = 0; $("topics").innerHTML = ""; }
    $("load-error").hidden = true;
    try {
      const data = await call(`/topics?sort=${state.sort}&page=${state.page}`);
      for (const t of data.topics) $("topics").append(topicRow(t));
      $("topics-empty").hidden = $("topics").children.length > 0;
      $("more").hidden = !data.more;
    } catch (e) {
      $("load-error").textContent = e.message; $("load-error").hidden = false;
    }
  }

  document.querySelectorAll('input[name="sort"]').forEach((r) => r.addEventListener("change", () => { state.sort = r.value; loadTopics(true); }));
  $("more").addEventListener("click", () => { state.page++; loadTopics(false); });
  $("new-topic-btn").addEventListener("click", () => { $("topic-form").hidden = false; $("new-topic-btn").hidden = true; $("t-title").focus(); });
  $("topic-cancel").addEventListener("click", () => { $("topic-form").hidden = true; $("new-topic-btn").hidden = false; });

  $("topic-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("topic-error"); err.hidden = true;
    const btn = e.submitter || $("topic-form").querySelector("button[type=submit]");
    btn.disabled = true;
    const author = $("t-author").value.trim(); saveName(author); $("c-author").value = author;
    try {
      const r = await call("/topics", { method: "POST", body: JSON.stringify({ title: $("t-title").value, body: $("t-body").value, author }) });
      $("t-title").value = ""; $("t-body").value = "";
      $("topic-form").hidden = true; $("new-topic-btn").hidden = false;
      openTopic(r.id, true);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    btn.disabled = false;
  });

  // ---------- One topic ----------
  function commentNode(c, children) {
    const li = el("li", { class: "comment", id: `c${c.id}` });
    if (c.hidden) {
      li.append(el("p", { class: "removed", text: "This comment was hidden after reports." }));
    } else {
      const head = el("div", { class: "head" }, el("strong", { text: c.author }), el("span", { text: ago(c.created_at) }));
      const text = el("p", { class: "text", text: c.body });
      const replyBtn = el("button", { type: "button", class: "linkish", text: "Reply" });
      const reportBtn = el("button", { type: "button", class: "linkish", text: "Report" });
      reportBtn.addEventListener("click", () => report("comment", c.id, reportBtn));
      const tools = el("div", { class: "tools" }, voteWidget("comment", c, true), replyBtn, reportBtn);
      const body = el("div", {}, head, text, tools);
      if (c.score <= COLLAPSE_AT) {
        text.hidden = true;
        const show = el("button", { type: "button", class: "linkish", text: "Collapsed for low score. Show" });
        show.addEventListener("click", () => { text.hidden = false; show.remove(); });
        head.append(show);
      }
      replyBtn.addEventListener("click", () => {
        if (li.querySelector(":scope > .reply-form")) return;
        const ta = el("textarea", { maxlength: "3000", "aria-label": `Reply to ${c.author}` });
        const send = el("button", { class: "btn", type: "submit", text: "Post reply" });
        const cancel = el("button", { class: "btn btn-quiet", type: "button", text: "Cancel" });
        const msg = el("p", { class: "note error", role: "alert", hidden: "" });
        const form = el("form", { class: "reply-form" }, ta, el("div", { class: "actions", style: "display:flex;gap:10px" }, send, cancel), msg);
        cancel.addEventListener("click", () => form.remove());
        form.addEventListener("submit", async (ev) => {
          ev.preventDefault(); send.disabled = true; msg.hidden = true;
          try {
            await call(`/topics/${state.topicId}/comments`, { method: "POST", body: JSON.stringify({ body: ta.value, parent_id: c.id, author: $("c-author").value.trim() }) });
            await openTopic(state.topicId, false);
          } catch (ex) { msg.textContent = ex.message; msg.hidden = false; send.disabled = false; }
        });
        body.after(form);
        ta.focus();
      });
      li.append(body);
    }
    if (children.length) {
      const ul = el("ul", { class: "comments" });
      children.forEach((n) => ul.append(n));
      li.append(ul);
    }
    return li;
  }

  function renderComments(list) {
    const byParent = new Map();
    for (const c of list) {
      const k = c.parent_id || 0;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k).push(c);
    }
    const build = (pid) => (byParent.get(pid) || []).sort((a, b) => pid === 0 ? b.score - a.score || a.created_at - b.created_at : a.created_at - b.created_at).map((c) => commentNode(c, build(c.id)));
    const ul = $("comments");
    ul.innerHTML = "";
    build(0).forEach((n) => ul.append(n));
    $("comments-title").textContent = list.length ? `${list.length} comment${list.length === 1 ? "" : "s"}` : "No comments yet";
  }

  async function openTopic(id, push) {
    state.topicId = id;
    if (push) history.pushState({ t: id }, "", `/forum?t=${id}`);
    $("list-view").hidden = true;
    $("topic-view").hidden = false;
    $("load-error").hidden = true;
    try {
      const { topic, comments } = await call(`/topics/${id}`);
      document.title = `${topic.title} | Wezzet forum`;
      const full = $("topic-full");
      full.innerHTML = "";
      const reportBtn = el("button", { type: "button", class: "linkish", text: "Report" });
      reportBtn.addEventListener("click", () => report("topic", topic.id, reportBtn));
      const main = el("div", {},
        el("h1", { text: topic.title }),
        el("div", { class: "meta" }, document.createTextNode(`${topic.author}, ${ago(topic.created_at)}  `), reportBtn),
        topic.body ? el("p", { class: "text", text: topic.body }) : null);
      full.append(voteWidget("topic", topic), main);
      renderComments(comments);
      window.scrollTo(0, 0);
    } catch (e) {
      $("topic-full").innerHTML = "";
      $("comments").innerHTML = "";
      $("load-error").textContent = e.message; $("load-error").hidden = false;
    }
  }

  $("comment-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("comment-error"); err.hidden = true;
    const btn = $("comment-form").querySelector("button[type=submit]");
    btn.disabled = true;
    const author = $("c-author").value.trim(); saveName(author); $("t-author").value = author;
    try {
      await call(`/topics/${state.topicId}/comments`, { method: "POST", body: JSON.stringify({ body: $("c-body").value, author }) });
      $("c-body").value = "";
      await openTopic(state.topicId, false);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    btn.disabled = false;
  });

  function showList() {
    state.topicId = null;
    document.title = "Forum | Wezzet";
    $("topic-view").hidden = true;
    $("list-view").hidden = false;
    loadTopics(true);
  }

  $("back-link").addEventListener("click", (e) => { e.preventDefault(); history.pushState({}, "", "/forum"); showList(); });
  window.addEventListener("popstate", () => route());

  function route() {
    const t = parseInt(new URLSearchParams(location.search).get("t"), 10);
    if (t) openTopic(t, false); else showList();
  }
  route();
})();
