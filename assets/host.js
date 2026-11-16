/* Wezzet Host: upload or write an HTML page and publish it at wezzet.com/host/<name>. Files are read in the browser and sent as base64. */
(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };
  const MAX = 2 * 1048576;
  const kb = (n) => (n < 1048576 ? Math.max(1, Math.round(n / 1024)) + " KB" : (n / 1048576).toFixed(2) + " MB");
  const num = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : String(n || 0));
  const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 90 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : s < 86400 * 30 ? Math.round(s / 86400) + " d ago" : new Date(t).toLocaleDateString(); };
  const call = (path, opt = {}) => fetch("/api/chat/host/" + path, { credentials: "same-origin", ...opt, headers: { "content-type": "application/json" } })
    .then((r) => r.json().catch(() => ({ error: "Server error (" + r.status + ")" }))).catch(() => ({ error: "Network error." }));
  const fix = (v) => v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+/, "").slice(0, 32);
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  const note = (box, t, bad, html) => { box[html ? "innerHTML" : "textContent"] = t; box.className = "note" + (bad ? " error" : ""); box.hidden = false; };
  const me = () => (window.wzAccount ? window.wzAccount.ready.then(() => window.wzAccount.me) : Promise.resolve(null));
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); } catch (e) { const t = el("textarea", { value: text }); document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
    const l = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = l), 1200);
  }

  // ---- sections (side panel links) ----
  const tabs = [...document.querySelectorAll(".ac-tab")], links = [...document.querySelectorAll(".ac-nav a")];
  function showTab(id) {
    if (!tabs.some((t) => t.id === id)) id = "explore";
    tabs.forEach((t) => (t.hidden = t.id !== id));
    links.forEach((a) => (a.hash === "#" + id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    if (id === "mine") loadMine();
    if (id === "editor") preview();
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !tabs.some((t) => t.id === a.hash.slice(1))) return;
    e.preventDefault(); history.pushState(null, "", a.hash); showTab(a.hash.slice(1)); scrollTo({ top: 0 });
  });
  addEventListener("popstate", () => showTab(location.hash.slice(1)));

  // ---- Explore: everyone's listed pages, with sorting ----
  let xPage = 0, xRows = [];
  function drawExplore() {
    const q = $("x-q").value.trim().toLowerCase();
    const rows = xRows.filter((s) => !q || (s.name + " " + (s.title || "") + " " + (s.about || "") + " " + (s.by || "")).toLowerCase().includes(q));
    $("x-list").replaceChildren(...(rows.length ? rows.map((s) => el("li", {}, el("a", { href: "/host/" + s.name },
      el("b", { textContent: s.title || s.name }), el("div", { className: "h-url", textContent: "/host/" + s.name }),
      el("p", { textContent: s.about || "" }),
      el("small", { textContent: num(s.views) + (s.views === 1 ? " view" : " views") + (s.by ? " · by " + s.by : "") + " · " + ago($("x-sort").value === "new" ? s.created : s.updated) })))) : [el("li", { className: "h-empty", textContent: q ? "Nothing matches." : "No pages yet. Yours could be the first." })]));
  }
  let xBust = "";
  async function loadExplore(fresh) {
    if (fresh) { xPage = 0; xBust = "&t=" + Date.now(); }
    const r = await call("explore?sort=" + $("x-sort").value + "&page=" + xPage + xBust);
    if (r.error) { $("x-list").replaceChildren(el("li", { className: "h-empty", textContent: r.error })); return; }
    xRows = r.sites || [];
    $("x-prev").hidden = xPage === 0; $("x-next").hidden = !r.more;
    $("x-n").textContent = r.stats && r.stats.pages ? num(r.stats.pages) + (r.stats.pages === 1 ? " page" : " pages") : "";
    if (r.stats) $("h-stats").replaceChildren(...[[num(r.stats.pages), "pages hosted"], [num(r.stats.views), "views"], ["2 MB", "per page"], ["Free", "always"]].map(([v, l]) => el("div", { className: "ac-tile" }, el("b", { textContent: v }), el("span", { textContent: l }))));
    drawExplore();
  }
  $("x-sort").onchange = () => { xPage = 0; loadExplore(); };
  $("x-q").oninput = drawExplore;
  $("x-prev").onclick = () => { xPage = Math.max(0, xPage - 1); loadExplore(); };
  $("x-next").onclick = () => { xPage++; loadExplore(); };

  // ---- Publish: name check, file picking, upload ----
  let picked = [], timer;
  function watchName(input, hint, pv) {
    input.addEventListener("input", () => {
      const v = fix(input.value); if (v !== input.value) input.value = v;
      if (pv) pv.textContent = v || "your-name";
      clearTimeout(timer); if (hint) hint.textContent = "";
      if (hint && v.length >= 3) timer = setTimeout(async () => {
        const r = await call("check?name=" + encodeURIComponent(v.replace(/-$/, "")));
        hint.textContent = r.ok ? (r.mine ? "This is your page. Publishing replaces it." : "Available.") : r.error || "";
      }, 350);
    });
  }
  watchName($("name"), $("namehint"), $("pv"));
  watchName($("e-name"));
  function setFiles(list) {
    list = list.filter((f) => !/(^|\/)\./.test(f.path));
    const tops = new Set(list.map((f) => (f.path.includes("/") ? f.path.split("/")[0] : "")));
    if (tops.size === 1 && !tops.has("")) { const t = [...tops][0] + "/"; list.forEach((f) => (f.path = f.path.slice(t.length))); }
    picked = list.sort((a, b) => a.path.localeCompare(b.path));
    const total = list.reduce((s, f) => s + f.file.size, 0);
    $("picked").textContent = list.length ? list.length + (list.length === 1 ? " file, " : " files, ") + kb(total) + " of 2 MB" + (total > MAX ? ". That's too big." : "") : "";
    $("meter").hidden = !list.length; $("meter").classList.toggle("over", total > MAX); $("meterbar").style.width = Math.min(100, (total / MAX) * 100) + "%";
    $("filelist").replaceChildren(...list.slice(0, 200).map((f) => el("li", {}, el("span", { textContent: f.path }), el("span", { textContent: kb(f.file.size) }))));
    const h = list.find((f) => f.path === "index.html") || list.find((f) => /\.html?$/i.test(f.path));
    if (h && !$("title").value) h.file.text().then((t) => { const m = t.match(/<title[^>]*>([^<]{1,80})/i); if (m && !$("title").value) $("title").value = m[1].trim(); });
  }
  $("files").onchange = (e) => setFiles([...e.target.files].map((file) => ({ file, path: file.name })));
  $("folder").onchange = (e) => setFiles([...e.target.files].map((file) => ({ file, path: file.webkitRelativePath || file.name })));
  const drop = $("drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("on"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("on"));
  drop.addEventListener("drop", async (e) => {
    e.preventDefault(); drop.classList.remove("on");
    const out = [];
    const walk = (entry, pre) => new Promise((res) => {
      if (entry.isFile) entry.file((file) => { out.push({ file, path: pre + file.name }); res(); }, res);
      else if (entry.isDirectory) { const rd = entry.createReader(), all = []; const next = () => rd.readEntries(async (ents) => { if (!ents.length) { for (const x of all) await walk(x, pre + entry.name + "/"); res(); } else { all.push(...ents); next(); } }, res); next(); }
      else res();
    });
    const items = [...(e.dataTransfer.items || [])].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (items.length) { for (const it of items) await walk(it, ""); setFiles(out); }
    else setFiles([...e.dataTransfer.files].map((file) => ({ file, path: file.name })));
  });
  const live = (r) => 'Live at <a href="/host/' + r.name + '" target="_blank" rel="noopener">wezzet.com/host/' + r.name + "</a>";
  $("go").onclick = async () => {
    const msg = $("msg");
    if (!(await me())) { note(msg, "Sign in first. Hosting needs a free Wezzet account.", true); document.querySelector("[data-wz-account] button")?.focus(); return; }
    const name = $("name").value.replace(/-$/, "");
    if (name.length < 3) { note(msg, "Pick a page name of at least 3 characters.", true); $("name").focus(); return; }
    if (!picked.length) { note(msg, "Choose files or a folder first, or write the page in the editor.", true); return; }
    if (picked.reduce((s, f) => s + f.file.size, 0) > MAX) { note(msg, "Sites can be up to 2 MB in total.", true); return; }
    $("go").disabled = true; note(msg, "Publishing...");
    const files = await Promise.all(picked.map(async (f) => ({ path: f.path, data: b64(await f.file.arrayBuffer()) })));
    const r = await call("upload", { method: "POST", body: JSON.stringify({ name, title: $("title").value, about: $("about").value, listed: $("listed").checked, files }) });
    $("go").disabled = false;
    if (r.error) { note(msg, r.error + (r.pro ? ' <a href="/pro">Get Pro</a>' : ""), true, !!r.pro); return; }
    note(msg, live(r), false, true); loadExplore(true);
  };

  // ---- Editor: write HTML with a live preview, start from a template, publish or download ----
  const page = (title, style, body, script) => `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n<style>\n${style}\n</style>\n</head>\n<body>\n${body}\n${script ? "<script>\n" + script + "\n</" + "script>\n" : ""}</body>\n</html>\n`;
  const TPL = {
    "Blank page": page("My page", "body { font: 18px/1.6 system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 16px; }", "<h1>Hello</h1>\n<p>This is my page.</p>"),
    "Link page": page("My links", "body { font: 17px system-ui, sans-serif; background: #f4f1ea; color: #222; text-align: center; padding: 48px 16px; }\nh1 { margin-bottom: 4px; }\na { display: block; max-width: 360px; margin: 12px auto; padding: 14px; border-radius: 12px; background: #222; color: #fff; text-decoration: none; }\na:hover { background: #6a3fe0; }", "<h1>Your name</h1>\n<p>A line about you.</p>\n<a href=\"https://example.com\">My website</a>\n<a href=\"https://example.com\">My videos</a>\n<a href=\"https://example.com\">Contact me</a>"),
    "Portfolio": page("Portfolio", "body { font: 17px/1.6 system-ui, sans-serif; margin: 0; color: #1b1a1f; }\nheader { padding: 72px 24px; background: #1b1a1f; color: #fff; }\nheader h1 { font-size: 44px; margin: 0; }\nmain { max-width: 860px; margin: 0 auto; padding: 32px 24px; }\n.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }\n.card { border: 1px solid #ddd; border-radius: 12px; padding: 18px; }", "<header>\n  <h1>Your name</h1>\n  <p>What you make, in one line.</p>\n</header>\n<main>\n  <h2>Work</h2>\n  <div class=\"grid\">\n    <div class=\"card\"><h3>Project one</h3><p>What it is and what you did.</p></div>\n    <div class=\"card\"><h3>Project two</h3><p>What it is and what you did.</p></div>\n    <div class=\"card\"><h3>Project three</h3><p>What it is and what you did.</p></div>\n  </div>\n</main>"),
    "Clicker game": page("Clicker", "body { font: 20px system-ui, sans-serif; text-align: center; padding-top: 60px; background: #111; color: #eee; }\nbutton { font-size: 28px; padding: 24px 40px; border-radius: 16px; border: 0; background: #6a3fe0; color: #fff; cursor: pointer; }\nbutton:active { transform: scale(.96); }", "<h1>Score: <span id=\"score\">0</span></h1>\n<button id=\"btn\">Click me</button>\n<p id=\"rate\"></p>", "let score = 0, power = 1;\nconst s = document.getElementById('score');\ndocument.getElementById('btn').onclick = () => {\n  score += power;\n  if (score >= power * 25) power++;\n  s.textContent = score;\n  document.getElementById('rate').textContent = '+' + power + ' per click';\n};"),
    "Dodge game": page("Dodge", "body { margin: 0; background: #111; color: #eee; font: 16px system-ui, sans-serif; text-align: center; }\ncanvas { display: block; margin: 12px auto; background: #1d1d24; border-radius: 12px; max-width: 96vw; touch-action: none; }", "<p>Move with the mouse, a finger or the arrow keys. Dodge the blocks.</p>\n<canvas id=\"c\" width=\"360\" height=\"480\"></canvas>", "const c = document.getElementById('c'), g = c.getContext('2d');\nlet x = 180, blocks = [], score = 0, over = false, left = false, right = false;\nconst at = (e) => { const r = c.getBoundingClientRect(); x = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) * c.width / r.width; };\nc.onmousemove = at; c.ontouchmove = (e) => { e.preventDefault(); at(e); };\nonkeydown = (e) => { if (e.key === 'ArrowLeft') left = true; if (e.key === 'ArrowRight') right = true; };\nonkeyup = (e) => { if (e.key === 'ArrowLeft') left = false; if (e.key === 'ArrowRight') right = false; };\nc.onclick = () => { if (over) { blocks = []; score = 0; over = false; } };\nfunction tick() {\n  if (!over) {\n    if (left) x -= 6; if (right) x += 6;\n    x = Math.max(15, Math.min(c.width - 15, x));\n    if (Math.random() < 0.05 + score / 20000) blocks.push({ x: Math.random() * (c.width - 30), y: -30, v: 2 + Math.random() * 3 + score / 600 });\n    for (const b of blocks) { b.y += b.v; if (b.y > 420 && b.y < 470 && b.x < x + 15 && b.x + 30 > x - 15) over = true; }\n    blocks = blocks.filter((b) => b.y < c.height);\n    score++;\n  }\n  g.clearRect(0, 0, c.width, c.height);\n  g.fillStyle = '#e25'; for (const b of blocks) g.fillRect(b.x, b.y, 30, 30);\n  g.fillStyle = '#4af'; g.fillRect(x - 15, 440, 30, 30);\n  g.fillStyle = '#eee'; g.font = '16px system-ui'; g.textAlign = 'left'; g.fillText('Score: ' + Math.floor(score / 10), 10, 24);\n  if (over) { g.textAlign = 'center'; g.font = '24px system-ui'; g.fillText('Game over. Click to play again.', c.width / 2, 240); }\n  requestAnimationFrame(tick);\n}\ntick();"),
  };
  const code = $("e-code"), view = $("e-view");
  let editing = null, ptimer;
  const draft = { get: () => { try { return localStorage.getItem("wz-host-draft") || ""; } catch (e) { return ""; } }, set: (v) => { try { localStorage.setItem("wz-host-draft", v); } catch (e) {} } };
  function preview() { view.srcdoc = code.value; }
  for (const k of Object.keys(TPL)) $("e-tpl").append(el("option", { value: k, textContent: k }));
  code.value = draft.get() || TPL["Blank page"];
  code.addEventListener("input", () => { clearTimeout(ptimer); ptimer = setTimeout(() => { preview(); if (!editing) draft.set(code.value); }, 400); });
  code.addEventListener("keydown", (e) => { if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); code.setRangeText("  ", code.selectionStart, code.selectionEnd, "end"); } });
  $("e-tpl").onchange = (e) => {
    const k = e.target.value; e.target.value = "";
    if (!k || (code.value.trim() && code.value !== TPL["Blank page"] && !confirm("Replace what's in the editor with the " + k + " template?"))) return;
    code.value = TPL[k]; if (!editing) draft.set(code.value); preview();
  };
  function resetEditor() { editing = null; $("e-name").value = ""; $("e-name").disabled = false; $("e-what").textContent = "New page"; code.value = draft.get() || TPL["Blank page"]; $("e-msg").hidden = true; preview(); }
  $("e-new").onclick = () => { if (editing || confirm("Start a new blank page? This clears the editor.")) { if (!editing) draft.set(""); resetEditor(); } };
  $("e-dl").onclick = () => { const a = el("a", { href: URL.createObjectURL(new Blob([code.value], { type: "text/html" })), download: "index.html" }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  $("e-go").onclick = async () => {
    const msg = $("e-msg");
    if (!(await me())) { note(msg, "Sign in first. Hosting needs a free Wezzet account.", true); return; }
    const name = (editing ? editing.name : $("e-name").value).replace(/-$/, "");
    if (name.length < 3) { note(msg, "Pick a page name of at least 3 characters.", true); $("e-name").focus(); return; }
    if (!code.value.trim()) { note(msg, "Write some HTML first.", true); return; }
    const m = code.value.match(/<title[^>]*>([^<]{1,80})/i);
    const data = { name, files: [{ path: editing ? editing.file : "index.html", data: b64(new TextEncoder().encode(code.value)) }] };
    if (editing) Object.assign(data, { merge: true, title: editing.title, about: editing.about, listed: editing.listed });
    else data.title = m ? m[1].trim() : "";
    $("e-go").disabled = true; note(msg, "Publishing...");
    const r = await call("upload", { method: "POST", body: JSON.stringify(data) });
    $("e-go").disabled = false;
    if (r.error) { note(msg, r.error + (r.pro ? ' <a href="/pro">Get Pro</a>' : ""), true, !!r.pro); return; }
    note(msg, live(r) + (editing ? ". Saved." : ""), false, true);
    if (!editing) { draft.set(""); editing = { name, file: "index.html", title: data.title, about: "", listed: true }; $("e-name").value = name; $("e-name").disabled = true; $("e-what").textContent = "Editing /host/" + name; }
    loadExplore(true);
  };
  async function openInEditor(name) {
    const r = await call("source?name=" + encodeURIComponent(name));
    if (r.error) { alert(r.error); return; }
    editing = { name, file: r.file, title: r.title, about: r.about, listed: r.listed };
    code.value = r.text; $("e-name").value = name; $("e-name").disabled = true;
    $("e-what").textContent = "Editing /host/" + name + (r.files.length > 1 ? " (index.html, other files are kept)" : "");
    $("e-msg").hidden = true; history.pushState(null, "", "#editor"); showTab("editor");
  }

  // ---- My pages ----
  async function loadMine() {
    const r = await call("mine");
    const sites = r.sites || [];
    $("m-guest").hidden = !!sites.length;
    $("m-guest").innerHTML = r.me ? 'You have no pages yet. <a href="#new">Publish your first one</a> or <a href="#editor">write one in the editor</a>.' : '<a href="/signin">Sign in</a> to see your pages, or <a href="#new">publish your first one</a>.';
    $("m-n").textContent = sites.length ? sites.length + (sites.length > 1 ? " pages, " : " page, ") + num(sites.reduce((n, s) => n + s.views, 0)) + " views" : "";
    $("m-list").replaceChildren(...sites.map((s) => {
      const url = "https://wezzet.com/host/" + s.name;
      const info = el("div", { className: "h-info" }, el("a", { href: "/host/" + s.name, target: "_blank", rel: "noopener", textContent: s.title || s.name }),
        el("div", { textContent: "/host/" + s.name + " · " + num(s.views) + (s.views === 1 ? " view" : " views") + " · " + kb(s.size) + ", " + s.files + (s.files === 1 ? " file" : " files") + " · updated " + ago(s.updated) + (s.hidden ? " · taken down after reports" : s.listed ? "" : " · not in Explore") }));
      const b = (t, fn) => el("button", { type: "button", className: "btn btn-quiet", textContent: t, onclick: fn });
      const set = el("div", { className: "h-set", hidden: true });
      const ti = el("input", { type: "text", value: s.title || "", maxLength: 80, placeholder: "Title" }), ab = el("input", { type: "text", value: s.about || "", maxLength: 160, placeholder: "Short description" });
      const li = el("input", { type: "checkbox", checked: s.listed });
      set.append(ti, ab, el("label", { className: "check" }, li, " Show in Explore"), b("Save", async () => { const d = await call("settings", { method: "POST", body: JSON.stringify({ name: s.name, title: ti.value, about: ab.value, listed: li.checked }) }); if (d.error) alert(d.error); else { loadMine(); loadExplore(true); } }));
      return el("li", {}, info,
        b("Copy link", (e) => copy(url, e.currentTarget)), b("Edit", () => openInEditor(s.name)),
        b("Replace", () => { $("name").value = s.name; $("name").dispatchEvent(new Event("input")); $("title").value = s.title || ""; $("about").value = s.about || ""; $("listed").checked = s.listed; history.pushState(null, "", "#new"); showTab("new"); }),
        b("Settings", () => (set.hidden = !set.hidden)),
        b("Delete", async () => { if (!confirm("Delete /host/" + s.name + "? This can't be undone.")) return; const d = await call("delete", { method: "POST", body: JSON.stringify({ name: s.name }) }); if (d.error) alert(d.error); loadMine(); loadExplore(true); }), set);
    }));
  }
  const acct = $("host-account");
  const setAcct = () => { const m = window.wzAccount && window.wzAccount.me; acct.textContent = m ? m.name : "Sign in →"; if (m) acct.href = "#mine"; else acct.href = "/signin"; };
  document.addEventListener("wz-account", () => { setAcct(); if (!$("mine").hidden) loadMine(); });
  me().then(setAcct);

  showTab(location.hash.slice(1));
  loadExplore();
})();
