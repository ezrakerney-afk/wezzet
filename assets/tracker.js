/* Chain Watch (/tracker): private owner page. Read-only: it manages a watchlist and drafts tips; it never sends anything. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const api = (path, data) => fetch("/api/chat/tracker/" + path, data === undefined ? { credentials: "same-origin" } : { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(data) })
    .then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({ error: "Server error (" + r.status + ")" }))) }))
    .catch(() => ({ error: "Network error." }));
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === "dataset") Object.assign(e.dataset, v); else if (k in e) e[k] = v; else e.setAttribute(k, v); } e.append(...kids.filter((k) => k != null && k !== false && k !== "")); return e; };
  const when = (t) => (t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 90 ? m + " min ago" : m < 2880 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " days ago"; };
  const short = (a) => (a && a.length > 20 ? a.slice(0, 10) + "…" + a.slice(-8) : a || "");
  const TAGS = { dispersal: "Dispersal", dex_swap: "DEX swap", bridge: "Bridge", mixer: "Mixer", exchange: "Exchange", dormant_wake: "Dormant wake", transfer: "Transfer" };
  const status = (t, kind) => { const s = $("#tr-status"); s.textContent = t || ""; s.className = "tr-note" + (kind === true ? " err" : kind ? " " + kind : ""); };
  const show = (r, okText) => { if (r.error) status(r.error, true); else status(okText || "", okText ? "good" : ""); return !r.error; };
  const picked = (body) => $$("input[data-id]:checked", body).map((i) => Number(i.dataset.id));
  const form = (f) => Object.fromEntries(new FormData(f));
  const chain = (c) => el("span", { className: "tr-chip chain", textContent: c });
  const tagChip = (t) => (t ? el("span", { className: "tr-chip t-" + t, textContent: TAGS[t] || t }) : "");
  const txLink = (a) => (S.explorer[a.chain] ? el("a", { className: "mono", href: S.explorer[a.chain] + a.tx, target: "_blank", rel: "noopener noreferrer", textContent: short(a.tx), title: "Open in explorer" }) : el("span", { className: "mono", textContent: short(a.tx) }));
  const copyText = async (t, ok) => { try { await navigator.clipboard.writeText(t); status(ok, "good"); } catch { status("Couldn't copy. Select the text instead.", true); } };
  const empty = (cols, text) => el("tr", {}, el("td", { colSpan: cols, className: "tr-empty", textContent: text }));
  let S = { watch: [], alerts: [], explorer: {}, leads: [], wView: "seeds", aView: "new", fView: "ends", flow: null };

  // ---- gate ----
  async function start() {
    const me = window.wzAccount ? await window.wzAccount.ready : null;
    const r = me ? await api("me") : { status: 401 };
    if (r.status === 401) { $("#tr-msg").textContent = "Chain Watch is in private beta. Sign in with an invited Wezzet account to open it."; $("#wz-account").hidden = false; return; }
    if (!r.ok) { $("#tr-msg").textContent = "Chain Watch is in private beta, so it's only open to invited accounts for now. It watches wallets named in FBI and Treasury notices and follows where stolen crypto moves."; $("#wz-account").hidden = true; return; }
    $("#tr-gate").hidden = true; $("#tr-app").hidden = false; $("#tr-run").hidden = false;
    tab(location.hash.slice(1) || "watch");
    summary();
  }
  document.addEventListener("wz-account", () => location.reload());

  // ---- overview cards + setup checklist ----
  async function summary() {
    const r = await api("summary"); if (r.error) return;
    const w = r.watch, a = r.alerts, l = r.leads, last = r.last;
    const set = (id, v, s, cls) => { $("#st-" + id).textContent = v; $("#st-" + id + "-s").textContent = s; $("#st-" + id).parentElement.className = "tr-stat" + (cls ? " " + cls : ""); };
    set("watch", w.total || 0, (w.seeds || 0) + " seeds, " + ((w.total || 0) - (w.seeds || 0)) + " children" + (w.paused ? ", " + w.paused + " paused" : ""));
    const pct = w.total ? Math.round((100 * (w.checked || 0)) / w.total) : 0;
    $("#st-sweep").style.width = pct + "%"; $("#st-sweep").parentElement.title = pct < 100 ? "First full check: " + pct + "% done" : "Every address checked";
    if (pct < 100 && w.total) $("#st-watch-s").textContent = "First check " + pct + "% done (" + (w.checked || 0) + " of " + w.total + ")";
    set("money", w.usd ? usd(w.usd) : "–", w.freeze ? usd(w.freeze) + " freezable at " + (w.freeze_n || 0) + " addresses" : w.checked ? "Balances fill in as addresses are checked" : "Waiting for the first check", w.freeze ? "hot" : "");
    opps();
    set("alerts", a.new || 0, (a.day || 0) + " in the last 24 h", a.new ? "hot" : "");
    set("leads", l.open || 0, (l.ready || 0) + " ready, " + (l.submitted || 0) + " submitted");
    const t = last && (last.finished || last.started), stale = t && Date.now() - t > 2 * r.interval * 60000;
    const state = r.paused ? "off" : !last ? "" : stale || last.errors ? "warn" : "ok";
    const word = r.paused ? "Paused" : !last ? "Starting" : stale ? "Late" : last.errors ? "Errors" : "Running";
    const line = r.paused ? "Turn it back on in Settings" : !last ? "Waiting for the first run" : "Last run " + ago(t) + (stale ? ", expected every " + r.interval + " min" : "");
    set("run", word, line, state === "warn" ? "warn" : "");
    $("#tr-health").hidden = false; $("#tr-health").className = "tr-pill " + state; $("#tr-last").textContent = r.paused ? "Paused" : last ? "Last run " + ago(t) : "Watcher not run yet";
    $("#r-dot").className = "dot " + state;
    $("#r-sum").textContent = r.paused ? "Paused. The watcher is stopped." : !last ? "The watcher hasn't run yet." : "Last run " + ago(t) + (stale ? ". That's more than twice the " + r.interval + " minute interval, so check the watcher." : ". Checks every " + r.interval + " minutes.");
    $("#r-sum").className = "tr-big" + (stale ? " tr-warn" : "");
    const n = $("#tab-alerts-n"); n.hidden = !a.new; n.textContent = a.new || "";
    // Setup steps, shown until the watcher has run once.
    const auto = r.engine !== "external";
    $("#tr-run").hidden = !auto;
    const steps = auto ? [["Official addresses imported" + (r.seeds_updated ? " (list from " + r.seeds_updated + ")" : ""), !!r.seeds_at, "watch"], ["First automatic check", !!last, "runs"], ["Choose how you want to hear about alerts", false, "settings"]]
      : [["Add seed addresses to the watchlist", !!w.total, "watch"], ["Generate the watcher token", r.token, "settings"], ["Run your watcher script", !!last, "runs"]];
    const box = $("#tr-setup");
    if (last && w.total) { box.hidden = true; return; }
    box.hidden = false;
    box.replaceChildren(el("b", { textContent: auto ? "Setting itself up. This takes a minute or two." : "Getting started" }), el("ol", {}, ...steps.map(([text, done, go]) => el("li", { className: done ? "done" : "" }, done ? text : el("button", { type: "button", textContent: text, onclick: () => tab(go) })))),
      !r.seal ? el("p", { className: "tr-warn tr-help", textContent: "Keys can't be saved yet: the site has no sealing secret set in Cloudflare." }) : "");
  }

  const usd = (n) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k" : Math.round(n || 0).toLocaleString("en-US"));
  async function opps() {
    const r = await api("holdings"); if (r.error) return;
    const list = r.holdings.filter((h) => h.bal_usd >= 1000).slice(0, 6);
    $("#tr-opps").hidden = !list.length;
    $("#tr-opps-list").replaceChildren(...list.map((h) => el("li", {},
      el("div", { className: "amt" }, el("b", { textContent: usd(h.bal_usd) }), h.freeze_usd >= 1000 ? el("span", { className: "tr-chip t-exchange", textContent: usd(h.freeze_usd) + " freezable" + (h.frozen === 0 ? ", not frozen yet" : "") }) : h.frozen === 1 ? el("span", { className: "tr-chip", textContent: "Already frozen" }) : ""),
      el("div", { className: "who" }, chain(h.chain), el("span", { className: "mono", textContent: short(h.address), title: h.address }), el("span", { className: "tr-sm", textContent: (h.label || "") + (h.source ? " · " + h.source : "") + (h.hop ? " · hop " + h.hop : "") + " · " + (h.balance || "") + (h.last_activity ? " · last moved " + ago(h.last_activity) : "") })),
      el("button", { type: "button", className: "btn btn-quiet", textContent: "Make lead", onclick: async (e) => { e.target.disabled = true; if (show(await api("watch/lead", { id: h.id }), "Lead created with the facts filled in. Check it in Leads before you send anything.")) summary(); } }))));
  }

  function tab(name) {
    if (!$(`[data-pane="${name}"]`)) name = "watch";
    $$(".tr-tabs button").forEach((b) => { b.classList.toggle("on", b.dataset.tab === name); b.setAttribute("aria-selected", b.dataset.tab === name); });
    $$("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== name));
    history.replaceState(null, "", "#" + name); status("");
    ({ watch: loadWatch, flow: loadFlow, alerts: loadAlerts, leads: loadLeads, settings: loadSettings, runs: loadRuns })[name]();
  }
  $(".tr-tabs").onclick = (e) => { const b = e.target.closest("button[data-tab]"); if (b) tab(b.dataset.tab); };
  $("#tr-stats").onclick = (e) => { const b = e.target.closest("[data-go]"); if (b) tab(b.dataset.go); };
  const seg = (id, key, fn) => ($(id).onclick = (e) => { const b = e.target.closest("button"); if (!b) return; $$("button", $(id)).forEach((x) => x.classList.toggle("on", x === b)); S[key] = b.dataset.v; fn(); });
  const selBar = (bar, body) => { const n = picked(body).length; $(bar).hidden = !n; $(bar + "-n").textContent = n + " selected"; };

  // ---- watchlist ----
  async function loadWatch() { const r = await api("watch"); if (show(r)) { S.watch = r.watch; drawWatch(); } }
  function drawWatch() {
    const f = $("#w-filter").value.trim().toLowerCase(), v = S.wView;
    const rows = S.watch.slice().sort((a, b) => (b.bal_usd || 0) - (a.bal_usd || 0)).filter((w) => (v === "all" || (v === "seeds" && !w.parent_id) || (v === "kids" && w.parent_id) || (v === "paused" && w.paused)) && (!f || [w.address, w.label, w.chain, w.source].join(" ").toLowerCase().includes(f)));
    $("#w-rows").replaceChildren(...(rows.length ? rows.slice(0, S.wMax || 50).map((w) => el("tr", { className: w.paused ? "paused" : "" },
      el("td", { className: "c" }, el("input", { type: "checkbox", dataset: { id: w.id }, ariaLabel: "Select" })),
      el("td", {}, chain(w.chain), el("span", { className: "mono", textContent: w.address }), w.paused ? el("span", { className: "tr-sm", textContent: "Paused" }) : ""),
      el("td", {}, w.label || "", el("span", { className: "tr-sm" }, w.source_url ? el("a", { href: w.source_url, target: "_blank", rel: "noopener noreferrer", textContent: w.source || "Source" }) : w.source || "")),
      el("td", {}, w.parent_id ? "Hop " + w.hop : "Seed", w.parent_id ? el("span", { className: "tr-sm mono", textContent: "from " + short(w.parent_address), title: w.parent_address }) : el("span", { className: "tr-sm", textContent: "added " + when(w.added) })),
      el("td", { className: "r" }, w.bal_at ? el("b", { textContent: w.bal_usd >= 1 ? usd(w.bal_usd) : "$0" }) : el("span", { className: "tr-sm", textContent: "Not checked yet" }), w.bal_at && w.balance !== "Empty" ? el("span", { className: "tr-sm", textContent: w.balance }) : "", w.freeze_usd >= 1000 ? el("span", { className: "tr-chip t-exchange", textContent: "Freezable" }) : w.frozen === 1 ? el("span", { className: "tr-chip", textContent: "Frozen" }) : ""),
      el("td", {}, w.last_activity ? ago(w.last_activity) : el("span", { className: "tr-sm", textContent: w.checked ? "Never" : "–" })),
      el("td", {}, el("button", { type: "button", className: "tr-link", textContent: "Edit", onclick: () => editWatch(w) })))) : [empty(7, S.watch.length ? "Nothing matches." : "No addresses yet. Add one, or bulk paste a list from a notice.")]));
    $('[data-all="w"]').checked = false; selBar("#w-sel", $("#w-rows"));
    if (rows.length > (S.wMax || 50)) $("#w-rows").append(el("tr", {}, el("td", { colSpan: 7, className: "tr-empty" }, el("button", { type: "button", className: "btn btn-quiet", textContent: "Show more (" + (rows.length - (S.wMax || 50)) + " left)", onclick: () => { S.wMax = (S.wMax || 50) + 100; drawWatch(); } }))));
  }
  const openBox = (id, on) => { $$("[data-box]").forEach((b) => (b.hidden = b.dataset.box !== id || !on)); };
  function editWatch(w) {
    const f = $("#w-add"); openBox("w-add-box", true); $("#w-add-title").textContent = "Edit address";
    for (const k of ["id", "chain", "address", "label", "source", "source_url"]) f.elements[k].value = w[k] || "";
    f.scrollIntoView({ block: "nearest" }); f.elements.label.focus();
  }
  $("#w-filter").oninput = drawWatch; seg("#w-view", "wView", drawWatch);
  $("#w-rows").onchange = () => selBar("#w-sel", $("#w-rows"));
  $("#w-add").onsubmit = async (e) => { e.preventDefault(); const d = form(e.target); const w = S.watch.find((x) => x.id == d.id); d.paused = w ? !!w.paused : false; if (show(await api("watch", d), "Saved.")) { e.target.reset(); e.target.elements.id.value = ""; openBox("", false); await loadWatch(); status("Saved.", "good"); summary(); } };
  $("#w-import").onsubmit = async (e) => {
    e.preventDefault(); const r = await api("watch/import", form(e.target)); if (!show(r)) return;
    const msg = "Added " + r.added + ". Already on the list: " + r.skipped + "." + (r.badCount ? " Couldn't read " + r.badCount + " line(s): " + r.bad.slice(0, 3).join(" | ") : "");
    e.target.elements.text.value = ""; if (!r.badCount) openBox("", false); await loadWatch(); status(msg, r.badCount ? true : "good"); summary();
  };

  // ---- alerts ----
  // ---- flow map: seed -> hops -> where the money landed ----
  async function loadFlow() {
    const r = await api("flow"); if (!show(r)) return;
    S.flow = r; S.explorer = r.explorer; drawFlow();
  }
  function drawFlow() {
    const { nodes, ends } = S.flow, want = $("#f-tag").value;
    const kids = new Map(), endsOf = new Map();
    for (const n of nodes) if (n.parent_id) (kids.get(n.parent_id) || kids.set(n.parent_id, []).get(n.parent_id)).push(n);
    for (const e of ends) if (e.tag !== "dispersal") (endsOf.get(e.watch_id) || endsOf.set(e.watch_id, []).get(e.watch_id)).push(e);
    const split = new Set(ends.filter((e) => e.tag === "dispersal").map((e) => e.watch_id));
    // How many endpoints of the wanted type sit at or below each node.
    const reach = new Map();
    const count = (n, seen) => { if (reach.has(n.id)) return reach.get(n.id); if (seen.has(n.id)) return 0; seen.add(n.id);
      let c = (endsOf.get(n.id) || []).filter((e) => !want || e.tag === want).length; for (const k of kids.get(n.id) || []) c += count(k, seen); reach.set(n.id, c); return c; };
    const size = (n) => 1 + (kids.get(n.id) || []).reduce((s, k) => s + size(k), 0);
    const totals = { exchange: 0, mixer: 0, bridge: 0, dex_swap: 0 }; for (const e of ends) if (e.tag in totals) totals[e.tag]++;
    $("#f-sum").replaceChildren(...Object.entries(totals).map(([t, n]) => el("div", { className: "tr-flowstat" + (n && (t === "exchange" || t === "mixer") ? " hot" : "") }, el("b", { textContent: n }), el("span", { textContent: TAGS[t] + (n === 1 ? " endpoint" : " endpoints") }))));
    const node = (n, open) => {
      const mine = (endsOf.get(n.id) || []).filter((e) => !want || e.tag === want), below = (kids.get(n.id) || []).filter((k) => S.fView === "moved" || count(k, new Set()) > 0);
      const head = el("div", { className: "tr-fnode" }, chain(n.chain), el("span", { className: "mono", textContent: short(n.address), title: n.address }),
        n.hop ? el("span", { className: "tr-fhop", textContent: "hop " + n.hop }) : el("span", { className: "tr-chip s-new", textContent: "seed" }),
        split.has(n.id) ? tagChip("dispersal") : "", n.label ? el("span", { className: "tr-flabel", textContent: n.label }) : "",
        n.last_activity ? el("span", { className: "tr-fwhen", textContent: "moved " + ago(n.last_activity) }) : "",
        el("button", { type: "button", className: "tr-link", textContent: "Copy", onclick: (ev) => { ev.preventDefault(); copyText(n.address, "Address copied."); } }));
      const list = el("ul", { className: "tr-flow" },
        ...mine.map((e) => el("li", { className: "tr-fend t-" + e.tag }, tagChip(e.tag), el("b", { textContent: e.name || short(e.counterparty) }), e.amount ? el("span", { textContent: e.amount + " " + e.asset }) : "", el("span", { className: "tr-fwhen", textContent: when(e.ts) }), txLink(e))),
        ...below.map((k) => el("li", {}, node(k, below.length + mine.length <= 3))));
      if (!mine.length && !below.length) return head;
      const d = el("details", { open }, el("summary", {}, head), list); return d;
    };
    const seeds = nodes.filter((n) => !n.parent_id).filter((n) => (S.fView === "moved" ? (kids.get(n.id) || []).length || (endsOf.get(n.id) || []).length : count(n, new Set()) > 0))
      .sort((a, b) => count(b, new Set()) - count(a, new Set()) || size(b) - size(a));
    $("#f-list").replaceChildren(...(seeds.length ? seeds.slice(0, 200).map((n, i) => el("div", { className: "tr-card tr-trail" },
      el("p", { className: "tr-fmeta", textContent: (size(n) > 1 ? size(n) - 1 + (size(n) === 2 ? " address followed, " : " addresses followed, ") : "Straight from the seed, ") + count(n, new Set()) + (want ? " " + TAGS[want].toLowerCase() : "") + " endpoint" + (count(n, new Set()) === 1 ? "" : "s") }), node(n, i < 3)))
      : [el("div", { className: "tr-card tr-empty", textContent: S.fView === "ends" ? "No trail has reached an exchange, mixer, bridge or swap yet. Try \"All trails that moved\"." : "Nothing has moved yet. Trails appear here once a watched address sends funds." })]));
  }
  $("#f-view").onclick = (e) => { const b = e.target.closest("button[data-v]"); if (!b || !S.flow) return; S.fView = b.dataset.v; $$("#f-view button").forEach((x) => x.classList.toggle("on", x === b)); drawFlow(); };
  $("#f-tag").onchange = () => S.flow && drawFlow();

  $("#a-list").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-explain]"); if (!b) return;
    e.preventDefault(); b.disabled = true; b.textContent = "Thinking…";
    const r = await api("alerts/explain", { id: Number(b.dataset.explain) });
    if (!show(r)) { b.disabled = false; b.textContent = "Explain with AI"; return; }
    const a = S.alerts.find((x) => x.id == b.dataset.explain); if (a) a.ai = r.ai;
    const body = b.closest(".body"), old = $(".ai", body), p = el("p", { className: "ai" }, el("b", { textContent: "AI summary " }), r.ai);
    if (old) old.replaceWith(p); else $(".meta", body).before(p);
    b.disabled = false; b.textContent = "Redo AI summary";
  });

  async function loadAlerts() {
    const q = new URLSearchParams(); if ($("#a-tag").value) q.set("tag", $("#a-tag").value); if (S.aView) q.set("status", S.aView);
    const [r, l] = await Promise.all([api("alerts?" + q), api("leads")]);
    if (!show(r)) return;
    S.alerts = r.alerts; S.explorer = r.explorer;
    if (l.leads) { S.leads = l.leads; $("#a-lead").replaceChildren(el("option", { value: "", textContent: "as a new lead" }), ...l.leads.filter((x) => x.status !== "dropped").map((x) => el("option", { value: x.id, textContent: "into: " + x.title }))); }
    $("#a-list").replaceChildren(...(S.alerts.length ? S.alerts.map((a) => el("label", { className: "tr-alert" + (a.status === "new" ? " is-new" : "") },
      el("input", { type: "checkbox", dataset: { id: a.id }, ariaLabel: "Select alert" }),
      el("div", { className: "body" },
        el("div", { className: "top" }, tagChip(a.tag), el("span", { className: "amt", textContent: [a.amount, a.asset].filter(Boolean).join(" ") }), a.status !== "new" ? el("span", { className: "tr-chip", textContent: a.status }) : "", el("span", { className: "time", textContent: when(a.ts), title: new Date(a.ts).toISOString() })),
        a.summary ? el("p", { className: "sum", textContent: a.summary }) : "",
        a.ai ? el("p", { className: "ai" }, el("b", { textContent: "AI summary " }), a.ai) : "",
        el("div", { className: "meta" }, el("span", {}, chain(a.chain), el("span", { className: "mono", textContent: short(a.address), title: a.address }), a.counterparty ? el("span", { className: "mono", textContent: " → " + short(a.counterparty), title: a.counterparty }) : ""), el("span", {}, "tx ", txLink(a)), el("button", { type: "button", className: "tr-link", dataset: { explain: a.id }, textContent: a.ai ? "Redo AI summary" : "Explain with AI" }))))) : [el("div", { className: "tr-card tr-empty", textContent: S.aView === "new" ? "No new alerts. You're caught up." : "No alerts here." })]));
    selBar("#a-sel", $("#a-list"));
  }
  $("#a-tag").onchange = loadAlerts; seg("#a-view", "aView", loadAlerts);
  $("#a-list").onchange = () => selBar("#a-sel", $("#a-list"));
  const alertStatus = async (st) => { const ids = picked($("#a-list")); if (ids.length && show(await api("alerts/status", { ids, status: st }), ids.length + " marked " + st + ".")) { const m = $("#tr-status").textContent; await loadAlerts(); status(m, "good"); summary(); } };

  // ---- leads ----
  async function loadLeads() {
    const r = await api("leads"); if (!show(r)) return;
    S.leads = r.leads; S.explorer = r.explorer;
    const byId = new Map(r.alerts.map((a) => [a.id, a]));
    $("#l-list").replaceChildren(...(S.leads.length ? S.leads.map((l) => leadBox(l, byId)) : [el("div", { className: "tr-card tr-empty", textContent: "No leads yet. Promote alerts from the Alerts tab." })]));
  }
  function leadBox(l, byId) {
    const ids = JSON.parse(l.alert_ids || "[]");
    const title = el("input", { type: "text", value: l.title });
    const st = el("select", {}, ...["investigating", "ready", "submitted", "dropped"].map((s) => el("option", { value: s, textContent: s[0].toUpperCase() + s.slice(1), selected: s === l.status })));
    const notes = el("textarea", { rows: 3, value: l.notes || "", placeholder: "What you found, what to check next…" });
    notes.style.fontFamily = "inherit";
    const pre = el("pre", { hidden: !l.draft, textContent: l.draft || "" });
    const copy = el("button", { type: "button", className: "btn", textContent: "Copy draft", hidden: !l.draft, onclick: () => copyText(pre.textContent, "Copied. Review it, then submit it yourself.") });
    const draft = async (ai) => { status(ai ? "Asking Claude…" : "Building draft…"); const r = await api("leads/draft", { id: l.id, ai }); if (r.error) return status(r.error, true); pre.textContent = r.draft; pre.hidden = false; copy.hidden = false; status(r.note || "Draft ready. Nothing was sent.", r.note ? true : "good"); };
    return el("div", { className: "tr-lead" },
      el("div", { className: "tr-grid" }, el("label", { className: "wide" }, "Title", title), el("label", {}, "Status", st), el("label", { className: "tr-full" }, "Notes", notes)),
      el("h3", { textContent: ids.length + " linked alert" + (ids.length === 1 ? "" : "s") }),
      el("ul", {}, ...ids.map((id) => { const a = byId.get(id); return a ? el("li", {}, tagChip(a.tag), el("b", { textContent: [a.amount, a.asset].filter(Boolean).join(" ") }), chain(a.chain), txLink(a), el("span", { className: "tr-sm", textContent: when(a.ts) })) : el("li", { textContent: "Alert #" + id + " (removed)" }); })),
      el("div", { className: "btn-row" },
        el("button", { type: "button", className: "btn", textContent: "Save", onclick: async () => { if (show(await api("leads", { id: l.id, title: title.value, notes: notes.value, status: st.value }), "Lead saved.")) summary(); } }),
        el("button", { type: "button", className: "btn btn-quiet", textContent: l.draft ? "Rebuild tip draft" : "Draft tip", onclick: () => draft(false) }),
        el("button", { type: "button", className: "btn btn-quiet", textContent: "Add Claude summary", onclick: () => draft(true) }),
        copy,
        el("button", { type: "button", className: "btn btn-quiet tr-danger", textContent: "Delete", onclick: async () => { if (confirm("Delete this lead? Its alerts stay.") && show(await api("leads/delete", { ids: [l.id] }))) { loadLeads(); summary(); } } })),
      pre);
  }

  // ---- settings ----
  async function loadSettings() {
    const r = await api("settings"); if (!show(r)) return;
    const f = $("#s-form");
    for (const [k, v] of Object.entries(r.settings)) { const i = f.elements[k]; if (!i) continue; if (i.type === "checkbox") i.checked = v === "1"; else i.value = v; }
    $$("[data-k]", f).forEach((s) => { const v = r.keys[s.dataset.k]; s.textContent = v ? "✓ " + v[0].toUpperCase() + v.slice(1) : "Not set"; s.className = v ? "set" : ""; });
    $$("input[type=password]", f).forEach((i) => (i.value = ""));
    S.keysSet = Object.values(r.keys).some(Boolean);
    f.elements.auto_seed.checked = r.settings.auto_seed !== "0"; f.elements.ai_alerts.checked = r.settings.ai_alerts !== "0";
    $("#t-state").textContent = r.token ? "✓ A token is " + r.token + "." : "No token yet.";
  }
  $("#s-form").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target, d = { keys: {} };
    for (const k of ["interval", "channel", "child_pct", "max_hops", "dormant_days", "keys_mode", "engine", "lookback_days"]) d[k] = f.elements[k].value;
    d.paused = f.elements.paused.checked; d.auto_seed = f.elements.auto_seed.checked; d.ai_alerts = f.elements.ai_alerts.checked;
    $$("input[type=password]", f).forEach((i) => { if (i.value.trim()) d.keys[i.name.slice(2)] = i.value.trim(); });
    if (show(await api("settings", d))) { await loadSettings(); status("Settings saved.", "good"); summary(); }
  };
  $("#s-form").elements.paused.onchange = (e) => api("settings", { paused: e.target.checked }).then((r) => { if (show(r, e.target.checked ? "Paused. The watcher stops at its next check." : "Unpaused.")) summary(); });

  // ---- run log ----
  async function loadRuns() {
    const r = await api("runs"); if (!show(r)) return;
    $("#r-rows").replaceChildren(...(r.runs.length ? r.runs.map((x) => el("tr", {},
      el("td", {}, when(x.started)), el("td", {}, x.finished && x.started ? Math.max(0, Math.round((x.finished - x.started) / 1000)) + " s" : ""),
      el("td", { className: "r" }, x.checked), el("td", { className: "r" }, x.calls), el("td", { className: "r" }, x.alerts), el("td", { className: "mono" + (x.errors ? " tr-warn" : "") }, x.errors || "None"))) : [empty(6, "No runs yet. They show up here once the watcher starts.")]));
    summary();
  }

  // ---- buttons ----
  $$("[data-all]").forEach((c) => (c.onchange = () => { $$("input[data-id]", c.closest("table")).forEach((i) => (i.checked = c.checked)); selBar("#w-sel", $("#w-rows")); }));
  document.addEventListener("click", async (e) => {
    const o = e.target.closest("[data-open]"); if (o) { const box = $(`[data-box="${o.dataset.open}"]`), on = box.hidden; if (o.dataset.open === "w-add-box") { $("#w-add").reset(); $("#w-add").elements.id.value = ""; $("#w-add-title").textContent = "Add an address"; } openBox(o.dataset.open, on); if (on) box.querySelector("input:not([type=hidden]),textarea").focus(); return; }
    if (e.target.closest("[data-close]")) return openBox("", false);
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    if (act === "w-pause" || act === "w-resume" || act === "w-delete") {
      const ids = picked($("#w-rows")); if (!ids.length) return;
      if (act === "w-delete" && !confirm("Delete " + ids.length + " address(es) from the watchlist?")) return;
      if (show(await api(act === "w-delete" ? "watch/delete" : "watch/pause", { ids, paused: act === "w-pause" }))) { await loadWatch(); summary(); }
    }
    if (act === "w-csv") {
      const cols = ["chain", "address", "label", "source", "source_url", "added", "parent_address", "hop", "paused", "last_seen_tx", "last_activity"];
      const q = (v) => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      const csv = [cols.join(",")].concat(S.watch.map((w) => cols.map((c) => q(c === "added" || c === "last_activity" ? (w[c] ? new Date(w[c]).toISOString() : "") : w[c])).join(","))).join("\n");
      const a = el("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "watchlist.csv" }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    if (act === "a-seen") alertStatus("seen");
    if (act === "a-dismiss") alertStatus("dismissed");
    if (act === "a-promote") {
      const ids = picked($("#a-list")); if (!ids.length) return;
      if (show(await api("alerts/promote", { ids, lead_id: $("#a-lead").value || undefined }))) { await loadAlerts(); status("Promoted. Find it in the Leads tab.", "good"); summary(); }
    }
    if (act === "run") {
      b.disabled = true; status("Checking the next few addresses…");
      const r = await api("run", {}); b.disabled = false;
      if (r.error) return status(r.error, true);
      const x = r.result || {};
      status(x.skipped === "busy" ? "A check ran a few seconds ago. Try again in a moment." : x.skipped ? "The watcher is " + (x.skipped === "paused" ? "paused" : "set to an external script") + ". Change that in Settings." : "Checked " + (x.checked || 0) + " addresses, " + (x.alerts || 0) + " new alert" + (x.alerts === 1 ? "" : "s") + (x.errors && x.errors.length ? ". " + x.errors.length + " had errors (see Run log)." : "."), x.skipped || (x.errors && x.errors.length) ? true : "good");
      const m = $("#tr-status").textContent, c = $("#tr-status").className; const cur = $(".tr-tabs button.on"); if (cur) await ({ watch: loadWatch, flow: loadFlow, alerts: loadAlerts, runs: loadRuns })[cur.dataset.tab]?.(); $("#tr-status").textContent = m; $("#tr-status").className = c; summary();
    }
    if (act === "seeds") {
      b.disabled = true; const r = await api("seeds", {}); b.disabled = false;
      if (r.error) return status(r.error, true);
      await loadWatch(); status("Official lists (" + r.updated + "): " + r.total + " addresses, " + r.added + " new.", "good"); summary();
    }
    if (act === "t-new") {
      if (!confirm("Make a new watcher token? The old one stops working.")) return;
      const r = await api("settings/token", {});
      if (show(r, "Copy this token now. It won't be shown again.")) { $("#t-out").textContent = r.token; $("#t-box").hidden = false; $("#t-state").textContent = "✓ New token made just now."; summary(); }
    }
    if (act === "t-copy") copyText($("#t-out").textContent, "Token copied. Paste it into the WEZZET_TOKEN secret.");
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
