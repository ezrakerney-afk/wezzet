/* Wezzet Host: upload an HTML page or small site to wezzet.com/host/<name>. Files are read in the browser and sent as base64. */
(() => {
  const $ = (id) => document.getElementById(id);
  const MAX = 2 * 1048576;
  let picked = [];
  const msg = $("msg");
  const show = (t, bad, html) => { msg[html ? "innerHTML" : "textContent"] = t; msg.className = "note" + (bad ? " error" : ""); msg.hidden = false; };
  const kb = (n) => (n < 1048576 ? Math.max(1, Math.round(n / 1024)) + " KB" : (n / 1048576).toFixed(2) + " MB");
  const call = (path, opt = {}) => fetch("/api/chat/host/" + path, { credentials: "same-origin", ...opt, headers: { "content-type": "application/json" } })
    .then((r) => r.json().catch(() => ({ error: "Server error (" + r.status + ")" }))).catch(() => ({ error: "Network error." }));
  const fix = (v) => v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+/, "").slice(0, 32);

  // Name: live preview and availability check.
  let timer;
  $("name").addEventListener("input", (e) => {
    const v = fix(e.target.value); if (v !== e.target.value) e.target.value = v;
    $("pv").textContent = v || "your-name";
    clearTimeout(timer); $("namehint").textContent = "";
    if (v.length >= 3) timer = setTimeout(async () => {
      const r = await call("check?name=" + encodeURIComponent(v.replace(/-$/, "")));
      $("namehint").textContent = r.ok ? (r.mine ? "This is your page. Publishing replaces it." : "Available.") : r.error || "";
    }, 350);
  });

  // Files: strip the shared top folder, so a picked folder "game/index.html" becomes "index.html".
  function setFiles(list) {
    list = list.filter((f) => !/(^|\/)\./.test(f.path) && f.file.size >= 0);
    const tops = new Set(list.map((f) => (f.path.includes("/") ? f.path.split("/")[0] : "")));
    if (tops.size === 1 && !tops.has("")) { const t = [...tops][0] + "/"; list.forEach((f) => (f.path = f.path.slice(t.length))); }
    picked = list;
    const total = list.reduce((s, f) => s + f.file.size, 0);
    $("picked").textContent = list.length ? list.length + (list.length === 1 ? " file, " : " files, ") + kb(total) + (total > MAX ? ". That's over 2 MB." : "") : "";
    if (!$("title").value) { const h = list.find((f) => f.path === "index.html") || list.find((f) => /\.html?$/i.test(f.path)); if (h) h.file.text().then((t) => { const m = t.match(/<title[^>]*>([^<]{1,80})/i); if (m && !$("title").value) $("title").value = m[1].trim(); }); }
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

  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };

  $("go").onclick = async () => {
    const me = window.wzAccount && (await window.wzAccount.ready);
    if (!me) { show("Sign in first. Hosting needs a free Wezzet account.", true); document.querySelector("[data-wz-account] button")?.focus(); return; }
    const name = $("name").value.replace(/-$/, "");
    if (name.length < 3) { show("Pick a page name of at least 3 characters.", true); $("name").focus(); return; }
    let files;
    const pasted = $("htmltext").value.trim();
    if (picked.length) {
      if (picked.reduce((s, f) => s + f.file.size, 0) > MAX) { show("Sites can be up to 2 MB in total.", true); return; }
      files = await Promise.all(picked.map(async (f) => ({ path: f.path, data: b64(await f.file.arrayBuffer()) })));
    } else if (pasted) files = [{ path: "index.html", data: b64(new TextEncoder().encode(pasted)) }];
    else { show("Choose files, a folder, or paste some HTML.", true); return; }
    $("go").disabled = true; show("Publishing...");
    const r = await call("upload", { method: "POST", body: JSON.stringify({ name, title: $("title").value, files }) });
    $("go").disabled = false;
    if (r.error) { show(r.error, true); return; }
    show('Live at <a href="/host/' + r.name + '" target="_blank" rel="noopener">wezzet.com/host/' + r.name + "</a>", false, true);
    loadMine();
  };

  async function loadMine() {
    const r = await call("mine");
    const ul = $("mine"); ul.replaceChildren();
    $("minebox").hidden = !(r.sites && r.sites.length);
    for (const s of r.sites || []) {
      const li = document.createElement("li");
      const a = Object.assign(document.createElement("a"), { href: "/host/" + s.name, target: "_blank", rel: "noopener", textContent: "/host/" + s.name });
      const info = Object.assign(document.createElement("span"), { className: "soft", textContent: (s.title && s.title !== s.name ? s.title + ", " : "") + kb(s.size) + (s.hidden ? ", taken down after reports" : "") });
      const edit = Object.assign(document.createElement("button"), { type: "button", className: "btn btn-quiet", textContent: "Replace" });
      edit.onclick = () => { $("name").value = s.name; $("name").dispatchEvent(new Event("input")); $("title").value = s.title || ""; $("name").scrollIntoView({ block: "center" }); };
      const del = Object.assign(document.createElement("button"), { type: "button", className: "btn btn-quiet", textContent: "Delete" });
      del.onclick = async () => { if (!confirm("Delete /host/" + s.name + "?")) return; const d = await call("delete", { method: "POST", body: JSON.stringify({ name: s.name }) }); if (d.error) show(d.error, true); loadMine(); };
      li.append(a, info, edit, del); ul.append(li);
    }
  }
  document.addEventListener("wz-account", loadMine);
  if (window.wzAccount && window.wzAccount.ready) window.wzAccount.ready.then(loadMine); else window.addEventListener("load", loadMine);
})();
