const $ = (id) => document.getElementById(id);
const msg = $("msg");
function show(text, bad) { msg.textContent = text; msg.className = "note" + (bad ? " error" : ""); msg.hidden = false; }
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); } catch (e) { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
  const l = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = l), 1200);
}
const keys = (() => { try { return JSON.parse(localStorage.getItem("wz-paste-keys") || "{}"); } catch (e) { return {}; } })();
const saveKeys = () => { try { localStorage.setItem("wz-paste-keys", JSON.stringify(keys)); } catch (e) {} };
async function api(path, data) {
  const r = await fetch("/api/paste/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, fmt: "json" }) });
  const j = await r.json().catch(() => ({ error: "Something went wrong. Try again." }));
  if (!r.ok) throw new Error(j.error || "Error " + r.status);
  return j;
}
const id = new URLSearchParams(location.search).get("id");
if (id) {
  $("make").hidden = true; $("view").hidden = false;
  const vt = $("vt"), key = keys[id];
  $("vraw").href = "/api/paste/" + encodeURIComponent(id);
  fetch("/api/paste/get?fmt=json&id=" + encodeURIComponent(id)).then((r) => r.json()).then((j) => {
    if (j.error) { show(j.error, true); return; }
    vt.value = j.text;
    $("meta").textContent = "Saved " + new Date(j.updated).toLocaleString() + ". Kept until " + new Date(j.expires).toLocaleDateString() + ".";
    if (key) { vt.readOnly = false; $("vsave").hidden = false; $("vdel").hidden = false; }
  }).catch(() => show("Couldn't load this paste.", true));
  $("vcopy").onclick = (e) => copyText(vt.value, e.currentTarget);
  $("vlink").onclick = (e) => copyText(location.href, e.currentTarget);
  $("vsave").onclick = async () => { try { await api("edit", { id, key, text: vt.value }); show("Saved."); } catch (e) { show(e.message, true); } };
  $("vdel").onclick = async () => {
    if (!confirm("Delete this paste?")) return;
    try { await api("delete", { id, key }); delete keys[id]; saveKeys(); location.href = "/paste"; } catch (e) { show(e.message, true); }
  };
} else {
  $("save").onclick = async () => {
    const text = $("t").value;
    if (!text.trim()) { show("Type or paste some text first.", true); return; }
    try {
      const j = await api("new", { text, days: $("days").value });
      keys[j.id] = j.key; saveKeys();
      location.href = "/paste?id=" + j.id;
    } catch (e) { show(e.message, true); }
  };
}
