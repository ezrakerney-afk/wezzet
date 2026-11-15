/* Chain Watch (/tracker): private owner page. Read-only: it manages a watchlist and drafts tips; it never sends anything. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const api = (path, data) => fetch("/api/chat/tracker/" + path, data === undefined ? { credentials: "same-origin" } : { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(data) })
    .then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({ error: "Server error (" + r.status + ")" }))) }))
    .catch(() => ({ error: "Network error." }));
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === "dataset") Object.assign(e.dataset, v); else if (k in e) e[k] = v; else e.setAttribute(k, v); } e.append(...kids.filter((k) => k != null && k !== false)); return e; };
  const when = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "");
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 90 ? m + " min ago" : m < 2880 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " days ago"; };
  const short = (a) => (a && a.length > 18 ? a.slice(0, 8) + "…" + a.slice(-6) : a || "");
  const status = (t, err) => { const s = $("#tr-status"); s.textContent = t || ""; s.className = "tr-note" + (err ? " err" : ""); };
  const show = (r, okText) => { if (r.error) status(r.error, true); else status(okText || ""); return !r.error; };
  const picked = (body) => $$("input[data-id]:checked", body).map((i) => Number(i.dataset.id));
  const form = (f) => Object.fromEntries(new FormData(f));
  let S = { watch: [], alerts: [], explorer: {}, leads: [], leadAlerts: [] };

  // ---- gate ----
  async function start() {
    const me = window.wzAccount ? await window.wzAccount.ready : null;
    if (!me) { $("#tr-msg").textContent = "Sign in to continue."; $("#wz-account").hidden = false; return; }
    const r = await api("me");
    if (r.status === 401) { $("#tr-msg").textContent = "Sign in to continue."; $("#wz-account").hidden = false; return; }
    if (!r.ok) { $("#tr-msg").textContent = "Not available."; $("#wz-account").hidden = true; return; }
    $("#tr-gate").hidden = true; $("#tr-app").hidden = false;
    if (!r.seal) status("Heads up: TOKEN_SEAL_KEY isn't set in Cloudflare Pages, so API keys can't be saved yet.", true);
    tab(location.hash.slice(1) || "watch");
    loadRuns(true);
  }
  document.addEventListener("wz-account", () => location.reload());

  function tab(name) {
    if (!$(`[data-pane="${name}"]`)) name = "watch";
    $$(".tr-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    $$("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== name));
    history.replaceState(null, "", "#" + name);
    ({ watch: loadWatch, alerts: loadAlerts, leads: loadLeads, settings: loadSettings, runs: loadRuns })[name]();
  }
  $(".tr-tabs").onclick = (e) => { const b = e.target.closest("button[data-tab]"); if (b) { status(""); tab(b.dataset.tab); } };
  $$("[data-all]").forEach((c) => (c.onchange = () => $$("input[data-id]", c.closest("table")).forEach((i) => (i.checked = c.checked))));

  // ---- watchlist ----
  async function loadWatch() { const r = await api("watch"); if (show(r)) { S.watch = r.watch; drawWatch(); } }
  function drawWatch() {
    const f = $("#w-filter").value.trim().toLowerCase(), kids = $("#w-kids").checked;
    const rows = S.watch.filter((w) => (kids || !w.parent_id) && (!f || [w.address, w.label, w.chain, w.source].join(" ").toLowerCase().includes(f)));
    $("#w-rows").replaceChildren(...rows.slice(0, 1000).map((w) => el("tr", { className: w.paused ? "paused" : "" },
      el("td", {}, el("input", { type: "checkbox", dataset: { id: w.id } })),
      el("td", { className: "mono", title: w.address }, w.address),
      el("td", {}, w.chain),
      el("td", {}, w.label || ""),
      el("td", {}, w.source_url ? el("a", { href: w.source_url, target: "_blank", rel: "noopener noreferrer", textContent: w.source || "link" }) : w.source || ""),
      el("td", {}, when(w.added)),
      el("td", {}, w.parent_id ? "child of " + short(w.parent_address) + ", hop " + w.hop : "seed"),
      el("td", {}, w.last_activity ? when(w.last_activity) : ""),
      el("td", {}, el("button", { type: "button", className: "btn btn-quiet", textContent: "Edit", onclick: () => editWatch(w) })))));
    const n = S.watch.length, c = S.watch.filter((w) => w.parent_id).length, p = S.watch.filter((w) => w.paused).length;
    status(n + " addresses (" + (n - c) + " seeds, " + c + " children, " + p + " paused)" + (rows.length > 1000 ? ". Showing the first 1000." : ""));
  }
  function editWatch(w) {
    const f = $("#w-add"); f.closest("details").open = true;
    for (const k of ["id", "chain", "address", "label", "source", "source_url"]) f.elements[k].value = w[k] || "";
    f.elements.address.focus();
  }
  $("#w-filter").oninput = drawWatch; $("#w-kids").onchange = drawWatch;
  $("#w-add").onsubmit = async (e) => { e.preventDefault(); const d = form(e.target); const w = S.watch.find((x) => x.id == d.id); d.paused = w ? !!w.paused : false; if (show(await api("watch", d), "Saved.")) { e.target.reset(); e.target.elements.id.value = ""; loadWatch(); } };
  $("#w-add").onreset = () => setTimeout(() => ($("#w-add").elements.id.value = ""));
  $("#w-import").onsubmit = async (e) => {
    e.preventDefault(); const r = await api("watch/import", form(e.target));
    if (show(r)) { status("Added " + r.added + ", already there " + r.skipped + (r.badCount ? ", couldn't read " + r.badCount + " lines (" + r.bad.slice(0, 3).join(" | ") + ")" : "") + "."); e.target.elements.text.value = ""; S.watch = (await api("watch")).watch || S.watch; drawWatch(); status($("#tr-status").textContent); }
  };

  // ---- alerts ----
  async function loadAlerts() {
    const q = new URLSearchParams(); if ($("#a-tag").value) q.set("tag", $("#a-tag").value); if ($("#a-status").value) q.set("status", $("#a-status").value);
    const [r, l] = await Promise.all([api("alerts?" + q), api("leads")]);
    if (!show(r)) return;
    S.alerts = r.alerts; S.explorer = r.explorer;
    if (l.leads) { S.leads = l.leads; $("#a-lead").replaceChildren(el("option", { value: "", textContent: "as a new lead" }), ...l.leads.filter((x) => x.status !== "dropped").map((x) => el("option", { value: x.id, textContent: "into: " + x.title }))); }
    const nNew = (r.counts.find((c) => c.status === "new") || {}).n || 0;
    $('[data-tab="alerts"]').replaceChildren("Alerts", nNew ? el("span", { className: "n", textContent: nNew }) : "");
    $("#a-rows").replaceChildren(...S.alerts.map((a) => el("tr", {},
      el("td", {}, el("input", { type: "checkbox", dataset: { id: a.id } })),
      el("td", {}, when(a.ts)),
      el("td", { className: "mono", title: a.address }, a.chain + " " + short(a.address), a.counterparty ? el("div", { className: "hint", textContent: "→ " + short(a.counterparty), title: a.counterparty }) : ""),
      el("td", { className: "tr-tag" }, a.tag || ""),
      el("td", {}, [a.amount, a.asset].filter(Boolean).join(" ")),
      el("td", { className: "mono" }, S.explorer[a.chain] ? el("a", { href: S.explorer[a.chain] + a.tx, target: "_blank", rel: "noopener noreferrer", textContent: short(a.tx) }) : short(a.tx)),
      el("td", { className: "sum" }, a.summary || ""),
      el("td", {}, a.status))));
    status(S.alerts.length ? "" : "No alerts here yet.");
  }
  $("#a-tag").onchange = loadAlerts; $("#a-status").onchange = loadAlerts;
  const alertStatus = async (st) => { const ids = picked($("#a-rows")); if (!ids.length) return status("Tick some alerts first.", true); if (show(await api("alerts/status", { ids, status: st }))) loadAlerts(); };

  // ---- leads ----
  async function loadLeads() {
    const r = await api("leads"); if (!show(r)) return;
    S.leads = r.leads; S.leadAlerts = r.alerts; S.explorer = r.explorer;
    const byId = new Map(r.alerts.map((a) => [a.id, a]));
    $("#l-list").replaceChildren(...(S.leads.length ? S.leads.map((l) => leadBox(l, byId)) : [el("p", { className: "hint", textContent: "No leads yet. Promote alerts from the Alerts tab." })]));
  }
  function leadBox(l, byId) {
    const ids = JSON.parse(l.alert_ids || "[]");
    const title = el("input", { type: "text", value: l.title });
    const st = el("select", {}, ...["investigating", "ready", "submitted", "dropped"].map((s) => el("option", { value: s, textContent: s, selected: s === l.status })));
    const notes = el("textarea", { rows: 3, value: l.notes || "", placeholder: "Notes" });
    const pre = el("pre", { hidden: !l.draft, textContent: l.draft || "" });
    const copy = el("button", { type: "button", className: "btn btn-quiet", textContent: "Copy draft", hidden: !l.draft, onclick: async () => { try { await navigator.clipboard.writeText(pre.textContent); status("Copied. Review it, then submit it yourself."); } catch { status("Couldn't copy. Select the text instead.", true); } } });
    const draft = async (ai) => { status(ai ? "Asking Claude…" : ""); const r = await api("leads/draft", { id: l.id, ai }); if (show(r, r.note || "Draft ready. Nothing was sent.")) { pre.textContent = r.draft; pre.hidden = false; copy.hidden = false; } };
    return el("div", { className: "tr-lead" },
      el("div", { className: "tr-grid" }, el("label", { className: "wide" }, "Title", title), el("label", {}, "Status", st), el("label", { className: "full" }, "Notes", notes)),
      el("ul", {}, ...ids.map((id) => { const a = byId.get(id); return el("li", { className: "mono" }, a ? `${when(a.ts)} ${a.chain} ${a.tag || ""} ${[a.amount, a.asset].filter(Boolean).join(" ")} ` : "alert #" + id, a && S.explorer[a.chain] ? el("a", { href: S.explorer[a.chain] + a.tx, target: "_blank", rel: "noopener noreferrer", textContent: short(a.tx) }) : a ? short(a.tx) : ""); })),
      el("div", { className: "btn-row" },
        el("button", { type: "button", className: "btn", textContent: "Save", onclick: async () => show(await api("leads", { id: l.id, title: title.value, notes: notes.value, status: st.value }), "Saved.") }),
        el("button", { type: "button", className: "btn btn-quiet", textContent: "Draft tip", onclick: () => draft(false) }),
        el("button", { type: "button", className: "btn btn-quiet", textContent: "Summarize with Claude", onclick: () => draft(true) }),
        copy,
        el("button", { type: "button", className: "btn btn-quiet", textContent: "Delete", onclick: async () => { if (confirm("Delete this lead? Its alerts stay.") && show(await api("leads/delete", { ids: [l.id] }))) loadLeads(); } })),
      pre);
  }

  // ---- settings ----
  async function loadSettings() {
    const r = await api("settings"); if (!show(r)) return;
    const f = $("#s-form");
    for (const [k, v] of Object.entries(r.settings)) { const i = f.elements[k]; if (!i) continue; if (i.type === "checkbox") i.checked = v === "1"; else i.value = v; }
    $$("[data-k]", f).forEach((s) => (s.textContent = r.keys[s.dataset.k] || "not set"));
    $$("input[type=password]", f).forEach((i) => (i.value = ""));
    $("#t-state").textContent = r.token ? "A token is " + r.token + "." : "No token yet.";
  }
  $("#s-form").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target, d = { keys: {} };
    for (const k of ["interval", "channel", "email", "child_pct", "max_hops", "dormant_days", "keys_mode"]) d[k] = f.elements[k].value;
    d.paused = f.elements.paused.checked;
    $$("input[type=password]", f).forEach((i) => { if (i.value.trim()) d.keys[i.name.slice(2)] = i.value.trim(); });
    if (show(await api("settings", d), "Saved.")) { loadSettings(); loadRuns(true); }
  };

  // ---- run log ----
  async function loadRuns(headerOnly) {
    const r = await api("runs"); if (r.error) return headerOnly ? null : show(r);
    const last = r.runs[0], stale = last && Date.now() - (last.finished || last.started) > 2 * r.interval * 60000;
    const text = r.paused ? "Paused. The watcher is stopped." : last ? "Last run " + ago(last.finished || last.started) + (stale ? ". That's more than twice the " + r.interval + " min interval: check the watcher." : ".") : "The watcher hasn't run yet.";
    $("#tr-last").textContent = text; $("#tr-last").className = "hint" + (stale || r.paused ? " tr-warn" : "");
    if (headerOnly) return;
    $("#r-sum").textContent = text; $("#r-sum").className = "tr-big" + (stale ? " warn" : "");
    $("#r-rows").replaceChildren(...r.runs.map((x) => el("tr", {},
      el("td", {}, when(x.started)), el("td", {}, x.finished && x.started ? Math.max(0, Math.round((x.finished - x.started) / 1000)) + " s" : ""),
      el("td", {}, x.checked), el("td", {}, x.calls), el("td", {}, x.alerts), el("td", { className: "mono" + (x.errors ? " tr-warn" : "") }, x.errors || ""))));
  }

  // ---- buttons ----
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    if (act === "w-pause" || act === "w-resume" || act === "w-delete") {
      const ids = picked($("#w-rows")); if (!ids.length) return status("Tick some addresses first.", true);
      if (act === "w-delete" && !confirm("Delete " + ids.length + " address(es)?")) return;
      if (show(await api(act === "w-delete" ? "watch/delete" : "watch/pause", { ids, paused: act === "w-pause" }))) loadWatch();
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
      const ids = picked($("#a-rows")); if (!ids.length) return status("Tick some alerts first.", true);
      if (show(await api("alerts/promote", { ids, lead_id: $("#a-lead").value || undefined }), "Promoted. See the Leads tab.")) loadAlerts();
    }
    if (act === "t-new") {
      if (!confirm("Make a new watcher token? The old one stops working.")) return;
      const r = await api("settings/token", {});
      if (show(r, "Copy this token now. It won't be shown again.")) { $("#t-out").textContent = r.token; $("#t-out").hidden = false; loadSettings(); }
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
