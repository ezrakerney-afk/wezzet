/* Wezzet chat: polling client for /api/chat. Voice: 1-on-1 WebRTC in DMs, signaled through the API. */
(() => {
  const $ = (id) => document.getElementById(id);
  const api = async (path, data) => {
    const r = await fetch("/api/chat/" + path, data ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) } : {});
    const j = await r.json().catch(() => ({ error: "Network error." }));
    if (!r.ok && j.error) throw new Error(j.error);
    return j;
  };
  const showErr = (el, e) => { el.textContent = e ? e.message || e : ""; el.hidden = !e; };
  let me = null, cur = null, rooms = { channels: [], dms: [], requests: [], blocks: [] }, last = 0, sig = 0, timer = 0, busy = false, ticks = 0, noteAt = -1, pushOn = false;

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
  $("logout").addEventListener("click", async (ev) => {
    ev.preventDefault(); hangup(true);
    try { const reg = await navigator.serviceWorker.getRegistration("/chat"); const sub = reg && await reg.pushManager.getSubscription(); if (sub) { await api("unpush", { endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch {} await api("logout", {}).catch(() => {}); location.reload(); });

  async function start(user) {
    me = user; auth.hidden = true; $("app").hidden = false; $("me-name").textContent = me.name;
    if ("Notification" in window) enablePush(false);
    await loadRooms(); open(location.hash.slice(1));
    poll();
  }

  // ---------- rooms ----------
  async function loadRooms() {
    rooms = await api("rooms");
    const item = (key, label, online, unread) => {
      const li = document.createElement("li"), b = document.createElement("button");
      b.className = "room"; b.type = "button"; b.dataset.room = key;
      if (online !== undefined) { const d = document.createElement("span"); d.className = "dot" + (online ? " on" : ""); b.append(d); }
      b.append(label);
      if (unread && key !== cur) { const n = document.createElement("span"); n.className = "badge"; n.textContent = unread > 99 ? "99+" : unread; b.append(n); } b.onclick = () => open(key); li.append(b); return li;
    };
    const row = (name, label, buttons) => {
      const li = document.createElement("li"), sp = document.createElement("span");
      li.className = "req"; sp.textContent = name; if (label) sp.append(" (" + label + ")"); li.append(sp);
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
    $("dms").replaceChildren(...rooms.dms.map((d) => item("d:" + d.id, d.name, d.online, d.unread)));
    const friends = new Set(rooms.dms.map((d) => d.name));
    const on = (rooms.online || []).filter((n) => !friends.has(n));
    $("on-wrap").hidden = !on.length;
    $("online").replaceChildren(...on.map((n) => row(n, "", [["Message", "dm"]])));
    badge();
    $("blk-wrap").hidden = !rooms.blocks.length;
    $("blocks").replaceChildren(...rooms.blocks.map((n) => row(n, "", [["Unblock", "unblock"]])));
    mark();
  }
  // Unread total in the tab title.
  const badge = () => {
    const n = rooms.dms.reduce((t, d) => t + ("d:" + d.id === cur && !document.hidden ? 0 : d.unread || 0), 0) + rooms.requests.filter((r) => r.incoming).length;
    document.title = (n ? "(" + n + ") " : "") + "Chat | Wezzet";
  };
  const mark = () => document.querySelectorAll("button.room").forEach((b) => b.setAttribute("aria-current", b.dataset.room === cur));
  const roomInfo = (key) => key[0] === "c" ? rooms.channels.find((c) => "c:" + c.id === key) : rooms.dms.find((d) => "d:" + d.id === key);

  function open(key) {
    if (!roomInfo(key)) key = rooms.dms[0] ? "d:" + rooms.dms[0].id : rooms.channels[0] ? "c:" + rooms.channels[0].id : "";
    cur = key; last = 0; history.replaceState(null, "", key ? "#" + key : location.pathname);
    $("send-form").hidden = !key;
    if (!key) {
      const p = document.createElement("p"); p.className = "empty";
      p.textContent = "Message anyone under Online now, or add a friend by their username.";
      $("log").replaceChildren(p); $("room-title").textContent = "No friends yet"; $("call-btn").hidden = $("block-btn").hidden = true; mark(); return;
    }
    $("log").replaceChildren();
    const info = roomInfo(key), dm = key[0] === "d";
    $("room-title").textContent = dm ? info.name : "# " + info.name;
    $("call-btn").hidden = !dm; $("block-btn").hidden = !dm;
    if (dm) $("block-btn").textContent = rooms.blocks.includes(info.name) ? "Unblock" : "Block";
    mark(); badge(); poll();
  }

  $("dm-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const j = await api("friend", { name: $("dm-name").value.trim() }); $("dm-name").value = ""; await loadRooms();
      if (j.room) open(j.room); else if (!cur) open("");
      showErr($("err"), j.room ? "" : "Request sent to " + j.name + ".");
    }
    catch (e) { showErr($("err"), e); }
  });
  $("block-btn").addEventListener("click", async () => {
    const name = roomInfo(cur).name, blocked = rooms.blocks.includes(name);
    if (!blocked && !confirm("Block " + name + "? They'll be removed from your friends and can't message or call you.")) return;
    try { await api(blocked ? "unblock" : "block", { name }); await loadRooms(); open(cur); } catch (e) { showErr($("err"), e); }
  });

  // ---------- messages ----------
  const fmt = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  function render(m) {
    const div = document.createElement("div"), b = document.createElement("b"), t = document.createElement("time"), p = document.createElement("div"), rep = document.createElement("button");
    div.className = "msg"; b.textContent = m.name; t.textContent = fmt(m.ts); t.dateTime = new Date(m.ts).toISOString();
    p.className = "t"; p.textContent = m.body;
    rep.className = "rep"; rep.type = "button"; rep.textContent = "Report";
    rep.onclick = async () => { if (!confirm("Report this message?")) return; try { await api("report", { id: m.id }); div.remove(); } catch (e) { showErr($("err"), e); } };
    if (m.uid !== me.id) div.append(b, t, rep, p); else div.append(b, t, p);
    return div;
  }
  async function poll() {
    clearTimeout(timer);
    if (!me) return;
    if (!busy) {
      busy = true;
      try {
        const want = cur;
        if (++ticks % 5 === 0) await loadRooms();
        const seen = !document.hidden && document.hasFocus() ? "&seen=1" : "";
        const j = await api("poll?room=" + encodeURIComponent(cur) + "&after=" + last + "&sig=" + sig + "&note=" + noteAt + seen);
        if (j.noteBase !== null && j.noteBase !== undefined) noteAt = Math.max(noteAt, j.noteBase);
        if (j.notes && j.notes.length) { noteAt = j.notes[j.notes.length - 1].id; onNotes(j.notes); }
        if (seen && cur) { const dm = roomInfo(cur); if (dm && dm.unread) { dm.unread = 0; badge(); } }
        if (want === cur && cur && j.msgs.length) {
          const log = $("log"), atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
          j.msgs.forEach((m) => { if (m.id > last) { log.append(render(m)); last = m.id; } });
          if (atEnd || last === j.msgs[j.msgs.length - 1].id) log.scrollTop = log.scrollHeight;
        }
        if (j.sigBase) sig = Math.max(sig, j.sigBase);
        for (const s of j.signals) { sig = Math.max(sig, s.id); onSignal(s); }
        showErr($("err"));
      } catch (e) { showErr($("err"), e); }
      busy = false;
    }
    // Poll faster while a call is being set up. Pause while the tab is hidden to save requests.
    timer = setTimeout(poll, call && !call.live ? 1000 : document.hidden ? 15000 : 3000);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); badge(); });
  window.addEventListener("focus", () => poll());

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
  $("send-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const box = $("text"), body = box.value.trim();
    if (!body) return;
    try { await api("send", { room: cur, body }); box.value = ""; poll(); } catch (e) { showErr($("err"), e); }
  });
  $("text").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); $("send-form").requestSubmit(); } });

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
  api("me").then((j) => (j.me ? start(j.me) : (auth.hidden = false))).catch(() => { auth.hidden = false; });
})();
