/* Wezzet communities. Talks to /api/forum/* (see _worker.js). All user text is
   inserted with textContent, never as HTML.
   Routes: /forum (all communities), /forum/<slug>[?tab=discussions] (one community), /forum?t=<id> (one post). */
(() => {
  const $ = (id) => document.getElementById(id);
  const API = "/api/chat/forum"; // same API as /api/forum, under the path the site login cookie is sent to
  const COLLAPSE_AT = -4;
  const state = { view: "", sort: "hot", page: 0, dsort: "hot", dpage: 0, slug: null, tab: "posts", comm: null, topicId: null, me: null, comms: [] };

  const UP = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3 2.5 10h11z" fill="currentColor"/></svg>';
  const DOWN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13 2.5 6h11z" fill="currentColor"/></svg>';
  // Icons for the official communities; the rest get their first letter.
  const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    general: P('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>'),
    tools: P('<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8M9.3 17.7l-6-6 2.8-2.8a4 4 0 0 1 5.6 0l.4.4"/>'),
    blockchain: P('<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>'),
    art: P('<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>'),
    ai: P('<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    aicomms: P('<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9.5 15.5h5"/>'),
    converters: P('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  };
  const HUES = { general: 262, tools: 28, blockchain: 205, art: 330, ai: 280, aicomms: 160, converters: 45 };

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v; // only ever our own constant SVG strings
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v);
    }
    for (const k of kids) if (k) n.append(k);
    return n;
  }
  const hue = (slug) => HUES[slug] ?? [...slug].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  function avatar(c) {
    const a = el("span", { class: "fm-av", "aria-hidden": "true", style: `--h:${hue(c.slug)}` });
    if (c.official && ICONS[c.slug]) a.innerHTML = ICONS[c.slug]; else a.textContent = (c.name.match(/[A-Za-z0-9]/) || ["#"])[0].toUpperCase();
    return a;
  }
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  function ago(ms) {
    const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
    const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [name, size] of units) { const v = Math.floor(s / size); if (v >= 1) return `${v} ${name}${v > 1 ? "s" : ""} ago`; }
    return "just now";
  }

  function toast(text) {
    const t = el("div", { class: "toast", role: "status", text });
    document.body.append(t);
    setTimeout(() => t.remove(), 3200);
  }

  async function call(path, opts = {}) {
    const res = await fetch(API + path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) }, credentials: "same-origin" });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) { const e = new Error(data.error || "Something went wrong. Try again."); e.status = res.status; throw e; }
    if ("me" in data) setMe(data.me);
    return data;
  }
  const post = (path, data) => call(path, { method: "POST", body: JSON.stringify(data || {}) });

  // Remember the visitor's display name on this device (signed-out posting).
  const NAME_KEY = "wezzet.forum.name";
  const savedName = () => { try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; } };
  const saveName = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} };
  $("t-author").value = savedName();
  $("c-author").value = savedName();

  function setMe(me) {
    state.me = me || null;
    const on = !!state.me;
    $("t-author-field").hidden = on;
    $("c-author").hidden = on;
    $("posting-as").textContent = on ? `Posting as ${state.me.name}.` : "";
    $("posting-as").hidden = !on;
    paintKind();
  }
  // The shared site login can change on this page (sign in / out box).
  document.addEventListener("wz-account", () => route());

  // ---------- navigation ----------
  function go(href) { history.pushState({}, "", href); route(); }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault(); go(a.getAttribute("href"));
  });
  const navLink = (href, props, ...kids) => el("a", { href, "data-nav": "", ...props }, ...kids);

  function show(view) {
    state.view = view;
    for (const v of ["dir", "comm", "topic"]) $(v + "-view").hidden = v !== view;
    $("load-error").hidden = true;
  }
  function fail(e) { $("load-error").textContent = e.message; $("load-error").hidden = false; }

  // ---------- votes / reports ----------
  function voteWidget(kind, item, inline) {
    const box = el("div", { class: "vote" + (inline ? " inline" : "") });
    const up = el("button", { type: "button", "aria-label": "Upvote", "aria-pressed": String(item.my_vote === 1), html: UP });
    const down = el("button", { type: "button", "aria-label": "Downvote", "aria-pressed": String(item.my_vote === -1), html: DOWN });
    const score = el("span", { class: "score", text: String(item.score), "aria-label": `Score ${item.score}` });
    // One request at a time; fast clicks only change the wanted vote, then we sync once.
    let server = { score: item.score, my_vote: item.my_vote }, busy = false;
    function cast(dir) { const value = item.my_vote === dir ? 0 : dir; item.score += value - item.my_vote; item.my_vote = value; paint(); sync(); }
    async function sync() {
      if (busy) return;
      busy = true;
      try {
        while (item.my_vote !== server.my_vote) {
          const r = await post("/vote", { kind, id: item.id, value: item.my_vote });
          server = { score: r.score, my_vote: r.my_vote };
        }
      } catch (e) { toast(e.message); item.my_vote = server.my_vote; }
      item.score = server.score; busy = false; paint();
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
  function reportBtn(kind, id) {
    const b = el("button", { type: "button", class: "linkish", text: "Report" });
    b.addEventListener("click", async () => {
      b.disabled = true;
      try { await post("/report", { kind, id }); b.textContent = "Reported"; } catch (e) { b.disabled = false; toast(e.message); }
    });
    return b;
  }
  function deleteBtn(kind, id, done) {
    const b = el("button", { type: "button", class: "linkish", text: "Remove" });
    b.addEventListener("click", async () => {
      if (!confirm(kind === "topic" ? "Remove this post for everyone?" : "Remove this comment?")) return;
      b.disabled = true;
      try { await post("/delete", { kind, id }); done(); } catch (e) { b.disabled = false; toast(e.message); }
    });
    return b;
  }
  const pinMark = () => el("div", { class: "vote pin", text: "Pinned" });
  const KIND_LABEL = { image: "Image", article: "Article", news: "News" };

  // ---------- topic rows and post cards ----------
  function topicLink(t, cls) {
    return navLink(`/forum?t=${t.id}`, { class: cls, text: t.title });
  }
  function metaLine(t, withCommunity) {
    const m = el("div", { class: "meta" });
    if (withCommunity && t.community) m.append(navLink(`/forum/${t.community.slug}`, { class: "fm-in", text: t.community.name }));
    if (KIND_LABEL[t.kind]) m.append(el("span", { class: "fm-kind", text: KIND_LABEL[t.kind] }));
    m.append(el("span", { text: `${t.author}, ${ago(t.created_at)}` }), navLink(`/forum?t=${t.id}`, { text: plural(t.comment_count, "comment") }));
    return m;
  }
  function topicRow(t, withCommunity) {
    if (t.kind !== "discussion") return postCard(t, withCommunity);
    const main = el("div", {}, topicLink(t, "title"), t.body ? el("p", { class: "preview", text: t.body }) : null, metaLine(t, withCommunity));
    return el("li", { class: "topic-row" }, t.pinned ? pinMark() : voteWidget("topic", t), main);
  }
  function postCard(t, withCommunity) {
    const main = el("div", {}, metaLine(t, withCommunity), topicLink(t, "title"));
    if (t.image) main.append(navLink(`/forum?t=${t.id}`, { class: "fm-img", "aria-label": t.title }, el("img", { src: t.image, alt: t.title, loading: "lazy", decoding: "async" })));
    if (t.body) main.append(el("p", { class: "preview", text: t.body }));
    return el("li", { class: "fm-post" }, voteWidget("topic", t), main);
  }

  // ---------- all communities ----------
  function joinBtn(c, after) {
    const b = el("button", { type: "button", class: "btn fm-join" + (c.joined ? " btn-quiet" : ""), text: c.joined ? "Joined" : "Join", "aria-pressed": String(c.joined) });
    b.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!state.me) { toast("Sign in to join communities."); document.querySelector("[data-wz-account] button")?.focus(); return; }
      b.disabled = true;
      try {
        const r = await post(`/communities/${c.slug}/${c.joined ? "leave" : "join"}`);
        c.joined = r.joined; c.members = r.members;
        after ? after() : renderComms();
      } catch (ex) { toast(ex.message); }
      b.disabled = false;
    });
    return b;
  }
  function commCard(c) {
    const name = navLink(`/forum/${c.slug}`, { class: "fm-name", text: c.name });
    const head = el("div", {}, name, c.official ? el("span", { class: "fm-badge", text: "Official" }) : null);
    return el("li", { class: "fm-comm" }, avatar(c), head, el("p", { text: c.about || "A Wezzet community." }),
      el("div", { class: "fm-foot" }, el("span", { text: `${plural(c.members, "member")} · ${plural(c.posts, "post")}` }), joinBtn(c)));
  }
  function renderComms() {
    const q = $("comm-q").value.trim().toLowerCase();
    const list = state.comms.filter((c) => !q || (c.name + " " + c.about + " " + c.slug).toLowerCase().includes(q));
    $("comms").replaceChildren(...list.map(commCard));
    $("comms-empty").hidden = list.length > 0;
    const mine = state.comms.filter((c) => c.joined);
    $("mine-wrap").hidden = !mine.length;
    $("mine").replaceChildren(...mine.map((c) => navLink(`/forum/${c.slug}`, { class: "fm-chip" }, avatar(c), document.createTextNode(c.name))));
  }
  async function loadComms() {
    try { state.comms = (await call("/communities")).communities; renderComms(); } catch (e) { fail(e); }
  }
  async function loadFeed(reset) {
    if (reset) { state.dpage = 0; $("feed").replaceChildren(); }
    try {
      const d = await call(`/topics?sort=${state.dsort}&page=${state.dpage}`);
      for (const t of d.topics) $("feed").append(topicRow(t, true));
      $("feed-more").hidden = !d.more;
    } catch (e) { fail(e); }
  }
  async function showDir() {
    show("dir");
    document.title = "Communities | Wezzet";
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", "https://wezzet.com/forum");
    await Promise.all([loadComms(), loadFeed(true)]);
  }
  $("comm-q").addEventListener("input", renderComms);
  document.querySelectorAll('input[name="dsort"]').forEach((r) => r.addEventListener("change", () => { state.dsort = r.value; loadFeed(true); }));
  $("feed-more").addEventListener("click", () => { state.dpage++; loadFeed(false); });

  // Create a community
  const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "");
  $("new-comm-btn").addEventListener("click", () => {
    if (!state.me) { toast("Sign in to create a community."); document.querySelector("#dir-view [data-wz-account] button")?.focus(); return; }
    $("comm-form").hidden = false; $("new-comm-btn").hidden = true; $("cm-name").focus();
  });
  $("comm-cancel").addEventListener("click", () => { $("comm-form").hidden = true; $("new-comm-btn").hidden = false; });
  $("cm-name").addEventListener("input", () => { $("cm-url").textContent = "wezzet.com/forum/" + (slugify($("cm-name").value) || "…"); });
  $("comm-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("comm-error"); err.hidden = true;
    const btn = $("comm-form").querySelector("button[type=submit]"); btn.disabled = true;
    try {
      const r = await post("/communities", { name: $("cm-name").value, about: $("cm-about").value });
      $("cm-name").value = ""; $("cm-about").value = ""; $("comm-form").hidden = true; $("new-comm-btn").hidden = false;
      go(`/forum/${r.slug}?tab=discussions`);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    btn.disabled = false;
  });

  // ---------- one community ----------
  function renderBanner() {
    const c = state.comm;
    const head = $("comm-head");
    head.style.setProperty("--h", hue(c.slug));
    const act = el("div", { class: "fm-act" }, joinBtn(c, renderBanner));
    if (!c.official && c.can_mod) act.append(deleteCommBtn(c));
    if (!c.official) act.append(reportBtn("community", c.slug));
    const stats = el("div", { class: "fm-stats" },
      el("span", {}, el("b", { text: String(c.members) }), document.createTextNode(c.members === 1 ? " member" : " members")),
      el("span", {}, el("b", { text: String(c.posts) }), document.createTextNode(c.posts === 1 ? " post" : " posts")),
      el("span", { text: c.official ? "Official Wezzet community" : c.owner ? `Created by ${c.owner}` : "" }), act);
    head.replaceChildren(avatar(c), el("div", {}, el("h1", { text: c.name }), el("div", { class: "meta", text: `wezzet.com/forum/${c.slug}` })),
      el("p", { class: "fm-about", text: c.about || "A Wezzet community." }), stats);
  }
  function deleteCommBtn(c) {
    const b = el("button", { type: "button", class: "linkish", text: "Remove community" });
    b.addEventListener("click", async () => {
      if (!confirm(`Remove ${c.name} for everyone?`)) return;
      try { await post(`/communities/${c.slug}/delete`); go("/forum"); } catch (e) { toast(e.message); }
    });
    return b;
  }
  function paintTabs() {
    for (const t of ["posts", "discussions"]) {
      const b = $("tab-" + t);
      b.setAttribute("aria-selected", String(state.tab === t));
      b.tabIndex = state.tab === t ? 0 : -1;
    }
    $("tab-panel").setAttribute("aria-labelledby", "tab-" + state.tab);
    $("new-topic-btn").textContent = state.tab === "posts" ? "New post" : "New discussion";
    $("kind-pick").hidden = state.tab !== "posts";
    closeComposer();
    paintKind();
  }
  document.querySelectorAll(".fm-tabs [role=tab]").forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.tab, true));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = state.tab === "posts" ? "discussions" : "posts";
      setTab(next, true); $("tab-" + next).focus();
    });
  });
  function setTab(tab, push) {
    state.tab = tab;
    if (push) history.pushState({}, "", `/forum/${state.slug}${tab === "discussions" ? "?tab=discussions" : ""}`);
    paintTabs(); loadTopics(true);
  }
  async function loadTopics(reset) {
    if (reset) { state.page = 0; $("topics").replaceChildren(); }
    $("topics").className = state.tab === "posts" ? "fm-feed" : "topics";
    try {
      const d = await call(`/topics?c=${state.slug}&tab=${state.tab}&sort=${state.sort}&page=${state.page}`);
      for (const t of d.topics) $("topics").append(topicRow(t, false));
      const empty = $("topics").children.length === 0;
      $("topics-empty").hidden = !empty;
      $("topics-empty").textContent = state.tab === "posts" ? "No posts yet. Share an image, an article or some news." : "No discussions yet. Start the first one.";
      $("more").hidden = !d.more;
    } catch (e) { fail(e); }
  }
  async function showComm(slug, tab) {
    show("comm");
    if (state.slug !== slug) { state.comm = null; $("comm-head").replaceChildren(); $("topics").replaceChildren(); }
    state.slug = slug;
    try {
      const { community } = await call(`/communities/${slug}`);
      state.comm = community;
      document.title = `${community.name} | Wezzet communities`;
      document.querySelector('link[rel="canonical"]')?.setAttribute("href", `https://wezzet.com/forum/${community.slug}`);
      renderBanner();
      // Default tab: Posts when the community has any, otherwise Discussions.
      state.tab = tab || (community.media > 0 || community.posts === 0 ? "posts" : "discussions");
      $("tab-posts").replaceChildren("Posts", el("span", { class: "n", text: String(community.media) }));
      $("tab-discussions").replaceChildren("Discussions", el("span", { class: "n", text: String(community.posts - community.media) }));
      paintTabs();
      await loadTopics(true);
    } catch (e) { $("comm-head").replaceChildren(); $("topics").replaceChildren(); fail(e); }
  }
  document.querySelectorAll('input[name="sort"]').forEach((r) => r.addEventListener("change", () => { state.sort = r.value; loadTopics(true); }));
  $("more").addEventListener("click", () => { state.page++; loadTopics(false); });

  // ---------- composer ----------
  let image = null; // data: URL ready to send
  const kindNow = () => (state.tab === "posts" ? document.querySelector('input[name="kind"]:checked').value : "discussion");
  function paintKind() {
    const k = kindNow();
    $("img-field").hidden = k !== "image";
    $("t-title-label").textContent = k === "image" ? "Caption" : "Title";
    $("t-body-label").textContent = k === "image" ? "More about it (optional)" : k === "discussion" ? "Details (optional)" : "Text";
    $("t-body").style.minHeight = k === "article" || k === "news" ? "220px" : "";
    $("img-hint").textContent = state.me ? "Large images are shrunk to 1600 px. Up to 10 a day." : "Sign in to post images. Articles and news don't need an account.";
    $("t-image").disabled = !state.me;
  }
  document.querySelectorAll('input[name="kind"]').forEach((r) => r.addEventListener("change", paintKind));
  function closeComposer() { $("topic-form").hidden = true; $("new-topic-btn").hidden = false; $("topic-error").hidden = true; }
  $("new-topic-btn").addEventListener("click", () => { $("topic-form").hidden = false; $("new-topic-btn").hidden = true; paintKind(); ($("img-field").hidden ? $("t-title") : $("t-image")).focus(); });
  $("topic-cancel").addEventListener("click", closeComposer);

  // Shrink to 1600 px and re-encode (WebP, else JPEG) so uploads stay under the 1.2 MB limit. Small GIFs are kept as-is.
  async function prepareImage(file) {
    if (file.size > 25e6) throw new Error("That image is too big. Pick one under 25 MB.");
    if (file.type === "image/gif" && file.size < 1.1e6) return readAsDataURL(file);
    let bmp;
    try { bmp = await createImageBitmap(file); } catch (e) {
      bmp = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("This browser can't open that image. Try a JPG or PNG.")); i.src = URL.createObjectURL(file); });
    }
    let max = 1600, q = 0.86;
    for (let attempt = 0; attempt < 6; attempt++) {
      const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
      const s = Math.min(1, max / Math.max(w, h));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(w * s)); cv.height = Math.max(1, Math.round(h * s));
      const cx = cv.getContext("2d");
      cx.drawImage(bmp, 0, 0, cv.width, cv.height);
      let blob = await new Promise((ok) => cv.toBlob(ok, "image/webp", q));
      if (!blob || blob.type !== "image/webp") blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", q));
      if (blob && blob.size < 1.1e6) return readAsDataURL(blob);
      q -= 0.1; max = Math.round(max * 0.85);
    }
    throw new Error("Couldn't make that image small enough. Try another.");
  }
  const readAsDataURL = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error("That image couldn't be read.")); r.readAsDataURL(blob); });
  async function takeFile(file) {
    if (!file) return;
    if (!state.me) { toast("Sign in to post images."); return; }
    $("drop-text").textContent = "Preparing…";
    try {
      image = await prepareImage(file);
      $("img-preview").src = image; $("img-preview").hidden = false; $("drop-text").textContent = "Choose a different image";
    } catch (e) { image = null; $("img-preview").hidden = true; $("drop-text").textContent = "Choose an image or drop it here"; toast(e.message); }
  }
  $("t-image").addEventListener("change", () => takeFile($("t-image").files[0]));
  const drop = $("drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); takeFile(e.dataTransfer.files[0]); });

  $("topic-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("topic-error"); err.hidden = true;
    const btn = $("topic-submit"); btn.disabled = true;
    const author = $("t-author").value.trim(); if (!state.me) { saveName(author); $("c-author").value = author; }
    const kind = kindNow();
    try {
      if (kind === "image" && !image) throw new Error(state.me ? "Choose an image first." : "Sign in to post images.");
      const r = await post("/topics", { title: $("t-title").value, body: $("t-body").value, author, community: state.slug, kind, image: kind === "image" ? image : undefined });
      $("t-title").value = ""; $("t-body").value = ""; image = null; $("img-preview").hidden = true; $("t-image").value = ""; $("drop-text").textContent = "Choose an image or drop it here";
      closeComposer();
      go(`/forum?t=${r.id}`);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    btn.disabled = false;
  });

  // ---------- one post ----------
  function commentNode(c, children) {
    const li = el("li", { class: "comment", id: `c${c.id}` });
    if (c.hidden) {
      li.append(el("p", { class: "removed", text: "This comment was removed." }));
    } else {
      const head = el("div", { class: "head" }, el("strong", { text: c.author }), el("span", { text: ago(c.created_at) }));
      const text = el("p", { class: "text", text: c.body });
      const replyBtn = el("button", { type: "button", class: "linkish", text: "Reply" });
      const tools = el("div", { class: "tools" }, voteWidget("comment", c, true), replyBtn, reportBtn("comment", c.id),
        c.can_delete ? deleteBtn("comment", c.id, () => openTopic(state.topicId)) : null);
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
            await post(`/topics/${state.topicId}/comments`, { body: ta.value, parent_id: c.id, author: $("c-author").value.trim() });
            await openTopic(state.topicId);
          } catch (ex) { msg.textContent = ex.message; msg.hidden = false; send.disabled = false; }
        });
        body.after(form);
        ta.focus();
      });
      li.append(body);
    }
    if (children.length) li.append(el("ul", { class: "comments" }, ...children));
    return li;
  }
  function renderComments(list) {
    const byParent = new Map();
    for (const c of list) { const k = c.parent_id || 0; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(c); }
    const build = (pid) => (byParent.get(pid) || []).sort((a, b) => pid === 0 ? b.score - a.score || a.created_at - b.created_at : a.created_at - b.created_at).map((c) => commentNode(c, build(c.id)));
    $("comments").replaceChildren(...build(0));
    const shown = list.filter((c) => !c.hidden).length;
    $("comments-title").textContent = shown ? plural(shown, "comment") : "No comments yet";
  }
  async function openTopic(id) {
    const fresh = state.topicId !== id || state.view !== "topic";
    state.topicId = id;
    show("topic");
    if (fresh) { $("topic-full").replaceChildren(); $("comments").replaceChildren(); }
    try {
      const { topic, comments } = await call(`/topics/${id}`);
      document.title = `${topic.title} | Wezzet communities`;
      const back = $("back-link");
      if (topic.community) { back.href = `/forum/${topic.community.slug}${topic.kind === "discussion" ? "?tab=discussions" : ""}`; back.textContent = topic.community.name; }
      else { back.href = "/forum"; back.textContent = "All communities"; }
      const meta = metaLine(topic, true);
      meta.append(reportBtn("topic", topic.id));
      if (topic.can_delete) meta.append(deleteBtn("topic", topic.id, () => go(back.getAttribute("href"))));
      const main = el("div", {}, meta, el("h1", { text: topic.title }),
        topic.image ? el("a", { class: "fm-img", href: topic.image, target: "_blank", rel: "noopener" }, el("img", { src: topic.image, alt: topic.title })) : null,
        topic.body ? el("p", { class: "text", text: topic.body }) : null);
      $("topic-full").replaceChildren(topic.pinned ? pinMark() : voteWidget("topic", topic), main);
      renderComments(comments);
      if (fresh) window.scrollTo(0, 0);
    } catch (e) { $("topic-full").replaceChildren(); $("comments").replaceChildren(); fail(e); }
  }
  $("comment-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("comment-error"); err.hidden = true;
    const btn = $("comment-form").querySelector("button[type=submit]"); btn.disabled = true;
    const author = $("c-author").value.trim(); if (!state.me) { saveName(author); $("t-author").value = author; }
    try {
      await post(`/topics/${state.topicId}/comments`, { body: $("c-body").value, author });
      $("c-body").value = "";
      await openTopic(state.topicId);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    btn.disabled = false;
  });

  // ---------- router ----------
  window.addEventListener("popstate", () => route());
  function route() {
    const q = new URLSearchParams(location.search);
    const t = parseInt(q.get("t"), 10);
    const m = location.pathname.match(/^\/forum\/([a-z0-9-]{3,24})\/?$/);
    const slug = m ? m[1] : q.get("c");
    if (t) return openTopic(t);
    if (slug) {
      if (!m) history.replaceState({}, "", `/forum/${slug}`);
      return showComm(slug, ["posts", "discussions"].includes(q.get("tab")) ? q.get("tab") : null);
    }
    return showDir();
  }
  setMe(null);
  route();
})();
