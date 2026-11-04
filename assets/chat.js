/* Wezzet chat client for /api/chat. Delivery: long polling (server holds each request until something new).
   Voice: 1-on-1 WebRTC in DMs, signaled through the API. */
(() => {
  const $ = (id) => document.getElementById(id);
  const api = async (path, data, signal) => {
    const r = await fetch("/api/chat/" + path, data ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) } : { signal });
    const j = await r.json().catch(() => ({ error: "Network error." }));
    if (!r.ok && j.error) throw new Error(j.error);
    return j;
  };
  let toastT = 0;
  const showErr = (el, e, ok) => {
    el.textContent = e ? e.message || e : ""; el.hidden = !e; el.className = "note " + (ok ? "ok" : "error");
    if (el.id === "err" && e && !el.dataset.net) { clearTimeout(toastT); toastT = setTimeout(() => { if (!el.dataset.net) el.hidden = true; }, ok ? 3500 : 6000); }
  };
  let me = null, cur = null, rooms = { channels: [], dms: [], groups: [], requests: [], blocks: [], online: [] }, last = 0, sig = 0, timer = 0, noteAt = -1, pushOn = false;
  let ctrl = null, roomsAt = 0, lastMsg = null;

  // Avatars: initial on a color picked from the name.
  const hue = (n) => { let h = 0; for (const c of n.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const SVG = {
    call: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z"/></svg>',
    msg: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Z"/></svg>',
    block: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-8 10a8 8 0 0 1 12.9-6.3L5.7 16.9A8 8 0 0 1 4 12Zm8 8a8 8 0 0 1-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20Z"/></svg>',
    add: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6Zm9 4c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z"/></svg>',
    remove: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-14-2v2h8v-2H1Zm14 4c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z"/></svg>',
    leave: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-9v-2h9V5h-9V3Zm-.6 4.6L10.8 9l-2 2H16v2H8.8l2 2-1.4 1.4L5 12l4.4-4.4Z"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25Zm16.71-10.04a1 1 0 0 0 0-1.41l-2.51-2.51a1 1 0 0 0-1.41 0l-1.96 1.96 3.92 3.92 1.96-1.96Z"/></svg>',
  };
  const avatar = (name, cls) => {
    const a = document.createElement("span"); a.className = "av" + (cls ? " " + cls : "");
    a.textContent = (name || "?")[0]; a.style.background = `hsl(${hue(name || "?")} 55% 42%)`; a.setAttribute("aria-hidden", "true");
    return a;
  };
  const withDot = (av, online) => {
    const w = document.createElement("span"); w.className = "av-wrap"; w.append(av);
    if (online !== undefined) { const d = document.createElement("span"); d.className = "dot" + (online ? " on" : ""); w.append(d); }
    return w;
  };

  // ---------- sign in / sign up ----------
  const auth = $("auth");
  auth.addEventListener("change", () => {
    const up = auth.mode.value === "signup";
    $("age-row").hidden = $("user-row").hidden = $("name-hint").hidden = !up; $("a-go").textContent = up ? "Create account" : "Sign in";
    $("a-pass").autocomplete = up ? "new-password" : "current-password";
  });
  auth.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const j = await api(auth.mode.value, { name: $("a-name").value.trim(), password: $("a-pass").value, username: $("a-user").value.trim(), age13: $("a-age").checked });
      $("a-pass").value = ""; showErr($("a-err")); start(j.me);
    } catch (e) { showErr($("a-err"), e); }
  });
  $("logout").addEventListener("click", async () => {
    hangup(true);
    try { const reg = await navigator.serviceWorker.getRegistration("/chat"); const sub = reg && await reg.pushManager.getSubscription(); if (sub) { await api("unpush", { endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch {}
    await api("logout", {}).catch(() => {}); location.reload();
  });

  const showMe = () => { $("me-name").textContent = me.name; $("me-av").replaceWith(Object.assign(avatar(me.name), { id: "me-av" })); };
  async function start(user) {
    me = user; $("auth-wrap").hidden = true; $("app").hidden = false; showMe();
    if ("Notification" in window) enablePush(false);
    await loadRooms(); open(location.hash.slice(1), true);
    poll();
  }

  // ---------- change username ----------
  $("rename-btn").addEventListener("click", () => { $("rename-form").hidden = false; $("me-bar").hidden = true; $("rename-input").value = me.name; $("rename-input").select(); });
  $("rename-cancel").addEventListener("click", () => { $("rename-form").hidden = true; $("me-bar").hidden = false; });
  $("rename-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const j = await api("username", { username: $("rename-input").value.trim() });
      me.name = j.name; showMe(); $("rename-form").hidden = true; $("me-bar").hidden = false; showErr($("err"));
      if (cur) { $("log").replaceChildren(); last = 0; lastMsg = null; restart(); }
    } catch (e) { showErr($("err"), e); }
  });

  // ---------- rooms ----------
  async function loadRooms() {
    rooms = await api("rooms"); roomsAt = Date.now();
    const item = (key, label, online, unread) => {
      const li = document.createElement("li"), b = document.createElement("button"), nm = document.createElement("span");
      b.className = "room" + (unread && key !== cur ? " unread" : ""); b.type = "button"; b.dataset.room = key;
      nm.className = "nm"; nm.textContent = label;
      b.append(key[0] === "d" ? withDot(avatar(label), online) : key[0] === "g" ? avatar(label, "grp") : "", nm);
      if (unread && key !== cur) { const n = document.createElement("span"); n.className = "badge"; n.textContent = unread > 99 ? "99+" : unread; b.append(n); }
      b.onclick = () => open(key); li.append(b); return li;
    };
    const row = (name, label, buttons) => {
      const li = document.createElement("li"), sp = document.createElement("span");
      li.className = "req"; sp.className = "nm"; sp.textContent = name;
      if (label) { const s = document.createElement("small"); s.textContent = " " + label; sp.append(s); }
      li.append(avatar(name), sp);
      for (const [text, path] of buttons) {
        const b = document.createElement("button"); b.type = "button"; b.textContent = text;
        b.onclick = async () => { try { const j = await api(path, { name }); await loadRooms(); if (j.room) open(j.room); else if (!roomInfo(cur)) open(""); } catch (e) { showErr($("err"), e); } };
        li.append(b);
      }
      return li;
    };
    $("ch-wrap").hidden = !rooms.channels.length;
    $("channels").replaceChildren(...rooms.channels.map((c) => item("c:" + c.id, "# " + c.name)));
    $("req-wrap").hidden = !rooms.requests.length;
    $("requests").replaceChildren(...rooms.requests.map((r) => r.incoming ? row(r.name, "", [["Accept", "friend"], ["Decline", "unfriend"]]) : row(r.name, "sent", [["Cancel", "unfriend"]])));
    $("groups").replaceChildren(...(rooms.groups || []).map((g) => item("g:" + g.id, g.name, undefined, g.unread)));
    $("dms").replaceChildren(...rooms.dms.map((d) => item("d:" + d.id, d.name, d.online, d.unread)));
    if (!rooms.dms.length) { const li = document.createElement("li"); li.className = "req"; li.innerHTML = '<span class="nm"><small>No conversations yet</small></span>'; $("dms").append(li); }
    const friends = new Set(rooms.dms.map((d) => d.name));
    const on = (rooms.online || []).filter((n) => !friends.has(n));
    $("on-wrap").hidden = !on.length;
    $("online").replaceChildren(...on.map((n) => row(n, "", [["Message", "dm"]])));
    $("blk-wrap").hidden = !rooms.blocks.length;
    $("blocks").replaceChildren(...rooms.blocks.map((n) => row(n, "", [["Unblock", "unblock"]])));
    badge(); mark(); head();
  }
  // Unread total in the tab title.
  const badge = () => {
    const sum = (list, k) => list.reduce((t, d) => t + (k + d.id === cur && !document.hidden ? 0 : d.unread || 0), 0);
    const n = sum(rooms.dms, "d:") + sum(rooms.groups || [], "g:") + rooms.requests.filter((r) => r.incoming).length;
    document.title = (n ? "(" + n + ") " : "") + "Chat | Wezzet";
  };
  const mark = () => document.querySelectorAll("button.room").forEach((b) => b.setAttribute("aria-current", b.dataset.room === cur));
  const roomInfo = (key) => !key ? null : key[0] === "c" ? rooms.channels.find((c) => "c:" + c.id === key)
    : key[0] === "g" ? (rooms.groups || []).find((g) => "g:" + g.id === key) : rooms.dms.find((d) => "d:" + d.id === key);
  function head() {
    const info = roomInfo(cur), dm = cur && cur[0] === "d", grp = cur && cur[0] === "g";
    if (!info) return;
    $("room-title").textContent = dm || grp ? info.name : "# " + info.name;
    $("room-status").textContent = dm ? (rooms.blocks.includes(info.name) ? "Blocked" : info.online ? "Online" : "Offline") : grp ? info.n + " members" : "";
    $("room-av").replaceChildren(dm ? withDot(avatar(info.name, "lg"), info.online) : grp ? avatar(info.name, "lg grp") : "");
    $("call-btn").hidden = !dm; $("info-btn").hidden = !(dm || grp);
    $("text").placeholder = "Message " + (dm || grp ? info.name : "#" + info.name);
    if (!$("profile").hidden) { if (grp) groupPanel(); else if (dm) profile(info.name); }
  }

  // ---------- profile / group panel ----------
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const act = (icon, label, fn, danger) => { const b = el("button", "act" + (danger ? " danger" : "")); b.type = "button"; b.innerHTML = SVG[icon]; b.append(label); b.onclick = fn; return b; };
  const showPanel = (nodes) => { $("profile-body").replaceChildren(...nodes); $("profile").hidden = false; $("app").classList.add("with-profile"); };
  const closePanel = () => { $("profile").hidden = true; $("app").classList.remove("with-profile"); };
  $("profile-close").addEventListener("click", closePanel);
  const isOnline = (name) => (rooms.online || []).includes(name) || rooms.dms.some((d) => d.name === name && d.online);
  const run = async (fn) => { try { await fn(); } catch (e) { showErr($("err"), e); } };
  function profile(name) {
    if (!name || name === me.name) return;
    const dm = rooms.dms.find((d) => d.name === name), blocked = rooms.blocks.includes(name), on = isOnline(name);
    const card = el("div", "card"), st = el("div", "status"), dot = el("span", "dot" + (on ? " on" : ""));
    st.append(dot, blocked ? "Blocked" : on ? "Online" : "Offline");
    card.append(avatar(name), el("h3", "", name), st);
    const acts = el("div", "actions");
    const openDm = async () => { const j = await api("dm", { name }); await loadRooms(); open(j.room); return j.room; };
    if (!blocked) {
      if (!dm || "d:" + dm.id !== cur) acts.append(act("msg", "Message", () => run(openDm)));
      acts.append(act("call", "Call", () => run(async () => { if (!dm || "d:" + dm.id !== cur) await openDm(); $("call-btn").click(); })));
    }
    acts.append(act("block", blocked ? "Unblock" : "Block", () => run(async () => {
      if (!blocked && !confirm("Block " + name + "? They'll be removed from your friends and can't message or call you.")) return;
      await api(blocked ? "unblock" : "block", { name }); await loadRooms(); if (!roomInfo(cur)) open(""); profile(name);
    }), !blocked));
    if (dm && !blocked) acts.append(act("remove", "Unfriend", () => run(async () => {
      if (!confirm("Remove " + name + " from your messages?")) return;
      await api("unfriend", { name }); await loadRooms(); open(""); closePanel();
    })));
    card.append(acts);
    showPanel([card]);
  }
  async function groupPanel() {
    const key = cur, info = roomInfo(key);
    if (!info || key[0] !== "g") return;
    const j = await api("group/members?room=" + key).catch((e) => { showErr($("err"), e); return null; });
    if (!j || cur !== key) return;
    const card = el("div", "card"), st = el("div", "status", j.members.length + " members");
    card.append(avatar(j.name, "grp"), el("h3", "", j.name), st);
    const acts = el("div", "actions");
    acts.append(act("edit", "Rename", () => run(async () => {
      const n = prompt("Group name", j.name); if (!n || !n.trim()) return;
      await api("group/rename", { room: key, name: n.trim() }); await loadRooms(); groupPanel();
    })));
    acts.append(act("leave", "Leave", () => run(async () => {
      if (!confirm("Leave " + j.name + "?")) return;
      await api("group/leave", { room: key }); closePanel(); await loadRooms(); open("");
    }), true));
    card.append(acts);
    const sect = el("div", "sect"), ul = el("ul"), form = el("form", "add");
    sect.append(el("h4", "", "Members"));
    for (const m of j.members) {
      const li = el("li"), nm = el("span", "nm", m.name);
      if (m.me) nm.append(el("small", "", " (you)"));
      li.append(withDot(avatar(m.name), m.online), nm);
      if (!m.me) li.onclick = () => profile(m.name);
      ul.append(li);
    }
    const inp = el("input"); inp.type = "text"; inp.placeholder = "Add by username"; inp.maxLength = 25; inp.setAttribute("aria-label", "Add someone to the group");
    const add = el("button", "btn btn-quiet", "Add"); add.type = "submit";
    form.append(inp, add);
    form.onsubmit = (ev) => { ev.preventDefault(); run(async () => { const r = await api("group/add", { room: key, name: inp.value.trim() }); showErr($("err"), r.name + " added.", true); await loadRooms(); groupPanel(); }); };
    sect.append(ul, form);
    showPanel([card, sect]);
  }
  const details = () => { const info = roomInfo(cur); if (!info) return; if (!$("profile").hidden) return closePanel(); cur[0] === "g" ? groupPanel() : profile(info.name); };
  $("info-btn").addEventListener("click", details);
  $("who").addEventListener("click", details);
  $("who").addEventListener("keydown", (ev) => { if (ev.key === "Enter") details(); });

  // New group
  $("new-group-btn").addEventListener("click", () => { $("group-form").hidden = !$("group-form").hidden; if (!$("group-form").hidden) $("g-name").focus(); });
  $("g-cancel").addEventListener("click", () => { $("group-form").hidden = true; });
  $("group-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    run(async () => {
      const j = await api("group/new", { name: $("g-name").value.trim(), members: $("g-members").value.split(/[,\s]+/).filter(Boolean) });
      $("g-name").value = $("g-members").value = ""; $("group-form").hidden = true;
      await loadRooms(); open(j.room);
    });
  });

  function open(key, boot) {
    if (!roomInfo(key)) key = boot && innerWidth < 760 ? "" : rooms.dms[0] ? "d:" + rooms.dms[0].id : (rooms.groups || [])[0] ? "g:" + rooms.groups[0].id : rooms.channels[0] ? "c:" + rooms.channels[0].id : "";
    cur = key; last = 0; lastMsg = null; history.replaceState(null, "", key ? "#" + key : location.pathname);
    $("app").classList.toggle("in-room", !!key);
    $("send-form").hidden = !key;
    if (!key) {
      const p = document.createElement("div"); p.className = "empty";
      p.innerHTML = "<b>Say hi to someone</b>Message anyone under Online now, or add a friend by their username.";
      $("log").replaceChildren(p); $("room-title").textContent = "Chat"; $("room-status").textContent = ""; $("room-av").replaceChildren();
      $("call-btn").hidden = $("info-btn").hidden = true; closePanel(); mark(); restart(); return;
    }
    $("log").replaceChildren(); head();
    mark(); badge(); restart();
    if (innerWidth >= 760) $("text").focus({ preventScroll: true });
  }
  $("back-btn").addEventListener("click", () => { cur = ""; $("app").classList.remove("in-room"); history.replaceState(null, "", location.pathname); mark(); restart(); });

  $("dm-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const j = await api("friend", { name: $("dm-name").value.trim() }); $("dm-name").value = ""; await loadRooms();
      if (j.room) { open(j.room); showErr($("err")); } else { if (!cur) open(""); showErr($("err"), "Friend request sent to " + j.name + ".", true); }
    }
    catch (e) { showErr($("err"), e); }
  });

  // ---------- messages ----------
  const fmt = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dayName = (ts) => {
    const d = new Date(ts), t = new Date(), y = new Date(Date.now() - 864e5);
    return d.toDateString() === t.toDateString() ? "Today" : d.toDateString() === y.toDateString() ? "Yesterday" : d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  };
  function render(m, pending) {
    const log = $("log");
    if (!lastMsg || new Date(lastMsg.ts).toDateString() !== new Date(m.ts).toDateString()) {
      const d = document.createElement("div"); d.className = "day" + (pending ? " pending" : ""); d.textContent = dayName(m.ts); log.append(d); lastMsg = null;
    }
    // Group messages from the same person within 5 minutes.
    const first = !lastMsg || lastMsg.uid !== m.uid || m.ts - lastMsg.ts > 300e3;
    const div = document.createElement("div"), p = document.createElement("div");
    div.className = "msg" + (first ? " first" : "") + (pending ? " pending" : "");
    p.className = "t"; p.textContent = m.body;
    if (first) {
      const h = document.createElement("div"), b = document.createElement("b"), t = document.createElement("time");
      h.className = "head"; b.textContent = m.name; t.textContent = fmt(m.ts); t.dateTime = new Date(m.ts).toISOString();
      h.append(b, t); const av = avatar(m.name, "lg"); div.append(av, h, p);
      if (m.uid !== me.id) av.onclick = b.onclick = () => profile(m.name);
    } else {
      const t = document.createElement("time"); t.className = "side-time"; t.textContent = fmt(m.ts); div.append(t, p);
    }
    if (m.uid !== me.id && m.id) {
      const rep = document.createElement("button"); rep.className = "rep"; rep.type = "button"; rep.textContent = "Report";
      rep.onclick = async () => { if (!confirm("Report this message?")) return; try { await api("report", { id: m.id }); div.remove(); } catch (e) { showErr($("err"), e); } };
      div.append(rep);
    }
    lastMsg = m; log.append(div);
    return div;
  }
  const atBottom = () => { const l = $("log"); return l.scrollHeight - l.scrollTop - l.clientHeight < 80; };
  const toBottom = () => { const l = $("log"); l.scrollTop = l.scrollHeight; };

  // Long-poll loop: one request open at a time; the server answers when something new arrives (or after ~20s).
  const restart = () => { if (ctrl) ctrl.abort(); clearTimeout(timer); timer = setTimeout(poll, 0); };
  async function poll() {
    clearTimeout(timer);
    if (!me) return;
    if (ctrl) ctrl.abort();
    const mine = ctrl = new AbortController(), want = cur;
    let wait = 0;
    try {
      if (Date.now() - roomsAt > 20000) await loadRooms();
      const seen = !document.hidden && document.hasFocus() ? "&seen=1" : "";
      // Hold the request open while visible (and after the first poll set the cursors).
      const hold = !document.hidden && noteAt >= 0 && !(call && !call.live) ? "&wait=1" : "";
      const j = await api("poll?room=" + encodeURIComponent(cur || "") + "&after=" + last + "&sig=" + sig + "&note=" + noteAt + seen + hold, null, mine.signal);
      if (mine !== ctrl) return;
      if (j.noteBase !== null && j.noteBase !== undefined) noteAt = Math.max(noteAt, j.noteBase);
      if (j.notes && j.notes.length) { noteAt = j.notes[j.notes.length - 1].id; onNotes(j.notes); }
      if (seen && cur) { const dm = roomInfo(cur); if (dm && dm.unread) { dm.unread = 0; badge(); } }
      if (want === cur && cur && j.msgs.length) {
        const end = atBottom() || last === 0;
        document.querySelectorAll(".msg.pending, .day.pending").forEach((el) => el.remove());
        j.msgs.forEach((m) => { if (m.id > last) { render(m); last = m.id; } });
        if (end || j.msgs[j.msgs.length - 1].uid === me.id) toBottom();
      }
      if (j.sigBase) sig = Math.max(sig, j.sigBase);
      for (const s of j.signals) { sig = Math.max(sig, s.id); onSignal(s); }
      if ($("err").dataset.net) { delete $("err").dataset.net; showErr($("err")); }
      wait = hold ? 50 : document.hidden ? 15000 : call && !call.live ? 1000 : 1500;
    } catch (e) {
      if (e.name === "AbortError" || mine !== ctrl) return;
      showErr($("err"), e); $("err").dataset.net = "1"; wait = 4000;
    }
    if (mine === ctrl) timer = setTimeout(poll, wait);
  }
  document.addEventListener("visibilitychange", () => { restart(); badge(); });
  window.addEventListener("focus", () => restart());

  // Sending shows the message right away, then the poll swaps in the saved copy.
  $("send-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const box = $("text"), body = box.value.trim();
    if (!body || !cur) return;
    box.value = ""; grow();
    const keep = lastMsg, el = render({ uid: me.id, name: me.name, body, ts: Date.now() }, true); toBottom();
    lastMsg = keep;
    try { await api("send", { room: cur, body }); restart(); }
    catch (e) { el.remove(); box.value = body; grow(); showErr($("err"), e); }
  });
  const grow = () => { const t = $("text"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; };
  $("text").addEventListener("input", grow);
  $("text").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); $("send-form").requestSubmit(); } });

  // ---------- notifications ----------
  let audio = null;
  const ding = () => {
    try {
      audio = audio || new AudioContext();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(0.08, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.25);
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.25);
    } catch {}
  };
  async function onNotes(notes) {
    const away = document.hidden || !document.hasFocus();
    const fresh = notes.filter((n) => away || n.room !== cur || n.kind === "friend");
    if (!fresh.length) return;
    await loadRooms();
    if (fresh.some((n) => n.kind !== "call")) ding();
    // With push turned on, the service worker shows the pop-up instead (no doubles).
    if (away && !pushOn && "Notification" in window && Notification.permission === "granted") {
      for (const n of fresh.slice(-3)) {
        try {
          const pop = new Notification(n.title, { body: n.body, tag: n.room || n.kind, icon: "/assets/icon-192.png" });
          pop.onclick = () => { window.focus(); if (n.room) open(n.room); pop.close(); };
        } catch {}
      }
    }
  }
  const pushable = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  async function enablePush(ask) {
    if (!("Notification" in window)) return;
    if (ask && Notification.permission === "default") await Notification.requestPermission();
    $("notif-btn").hidden = Notification.permission !== "default";
    if (Notification.permission !== "granted" || !pushable()) return;
    try {
      const reg = await navigator.serviceWorker.register("/chat-sw.js", { scope: "/chat" });
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { key } = await api("vapid");
        const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
      }
      await api("push", { endpoint: sub.endpoint });
      pushOn = true;
    } catch (e) { pushOn = false; }
  }
  $("notif-btn").addEventListener("click", () => enablePush(true));

  // ---------- voice (1-on-1) ----------
  // Group calls later: swap this peer connection for Cloudflare Calls sessions (one track per person, via an SFU).
  let call = null; // { room, name, pc, stream, live, offer }
  const bar = (text, answer) => {
    $("call-bar").hidden = !text; $("call-text").textContent = text || "";
    $("accept-btn").hidden = !answer; $("mute-btn").hidden = !(call && call.live);
  };
  async function peer(room) {
    const { iceServers } = await api("ice");
    const pc = new RTCPeerConnection({ iceServers });
    pc.ontrack = (e) => { $("remote-audio").srcObject = e.streams[0]; };
    pc.onconnectionstatechange = () => {
      if (!call) return;
      if (pc.connectionState === "connected") { call.live = true; bar("In a call with " + call.name); }
      if (["failed", "closed"].includes(pc.connectionState)) hangup(false, "Call ended.");
    };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    return { pc, stream };
  }
  // Wait for all ICE candidates so a single offer/answer is enough (fewer signals over polling).
  const gathered = (pc) => new Promise((ok) => {
    if (pc.iceGatheringState === "complete") return ok();
    const t = setTimeout(ok, 3000);
    pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(t); ok(); } });
  });
  $("call-btn").addEventListener("click", async () => {
    if (call) return;
    const key = cur, info = roomInfo(cur);
    try {
      call = { room: cur, name: info.name };
      bar("Calling " + info.name + "...");
      Object.assign(call, await peer(cur));
      await call.pc.setLocalDescription(await call.pc.createOffer());
      await gathered(call.pc);
      await api("signal", { room: cur, kind: "offer", data: JSON.stringify(call.pc.localDescription) });
      poll();
      setTimeout(() => { if (call && !call.live && call.room === key && !call.answered) hangup(true, "No answer."); }, 45000);
    } catch (e) { hangup(false); showErr($("err"), e.name === "NotAllowedError" ? "Allow microphone access to call." : e); }
  });
  $("accept-btn").addEventListener("click", async () => {
    if (!call || !call.offer) return;
    try {
      bar("Connecting...");
      Object.assign(call, await peer(call.room));
      await call.pc.setRemoteDescription(JSON.parse(call.offer));
      await call.pc.setLocalDescription(await call.pc.createAnswer());
      await gathered(call.pc);
      await api("signal", { room: call.room, kind: "answer", data: JSON.stringify(call.pc.localDescription) });
    } catch (e) { hangup(true); showErr($("err"), e.name === "NotAllowedError" ? "Allow microphone access to answer." : e); }
  });
  $("hang-btn").addEventListener("click", () => hangup(true));
  $("mute-btn").addEventListener("click", () => {
    const t = call && call.stream && call.stream.getAudioTracks()[0];
    if (!t) return; t.enabled = !t.enabled; $("mute-btn").textContent = t.enabled ? "Mute" : "Unmute";
  });
  function hangup(tell, msg) {
    if (!call) return;
    if (tell) api("signal", { room: call.room, kind: "bye" }).catch(() => {});
    if (call.pc) call.pc.close();
    if (call.stream) call.stream.getTracks().forEach((t) => t.stop());
    call = null; $("mute-btn").textContent = "Mute"; bar(msg || "");
    if (msg) setTimeout(() => { if (!call) bar(""); }, 4000);
  }
  async function onSignal(s) {
    const room = "d:" + s.dm;
    if (s.kind === "offer") {
      if (call) { api("signal", { room, kind: "busy" }).catch(() => {}); return; }
      if (!roomInfo(room)) await loadRooms();
      call = { room, name: s.name, offer: s.data };
      if (cur !== room) open(room);
      bar(s.name + " is calling", true);
    } else if (call && call.room === room) {
      if (s.kind === "answer" && call.pc && !call.answered) { call.answered = true; bar("Connecting..."); await call.pc.setRemoteDescription(JSON.parse(s.data)); }
      else if (s.kind === "bye") hangup(false, "Call ended.");
      else if (s.kind === "busy") hangup(false, s.name + " is busy.");
    }
  }

  // ---------- boot ----------
  api("me").then((j) => (j.me ? start(j.me) : ($("auth-wrap").hidden = false))).catch(() => { $("auth-wrap").hidden = false; });
})();
